import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, readFile, readdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const DEBUT = "<!-- roadmap:auto:debut -->";
export const FIN = "<!-- roadmap:auto:fin -->";
export const WORKFLOWS = [
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml",
  ".github/workflows/securite-pr.yml"
];

export function validations(reponse, sha) {
  const derniers = WORKFLOWS.map((chemin) => reponse.workflow_runs
    .filter((run) => run.path === chemin && run.head_sha === sha && run.event === "push" && run.head_branch === "main")
    .sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0]);
  return derniers.every((run) => run?.status === "completed" && run.conclusion === "success") ? derniers : null;
}

export function selectionnerPr(prs, estAncetre) {
  return prs.filter((pr) => pr.merged_at && pr.base.ref === "main" &&
    pr.head.ref !== "automatisation/roadmap" && /^[a-f0-9]{40}$/.test(pr.merge_commit_sha) &&
    estAncetre(pr.merge_commit_sha))
    .sort((a, b) => b.merged_at.localeCompare(a.merged_at) || b.number - a.number)
    .slice(0, 20);
}

const echapper = (texte) => texte.replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function actualiser(html, { prs, runs, sha, depot, total, jeux }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(depot) || !/^[a-f0-9]{40}$/.test(sha)) throw new Error("Dépôt ou commit invalide");
  if (html.split(DEBUT).length !== 2 || html.split(FIN).length !== 2 ||
      html.indexOf(FIN) < html.indexOf(DEBUT)) throw new Error("Bornes de l'encart automatique absentes ou ambiguës");
  const empreinte = createHash("sha256").update(JSON.stringify({
    prs: prs.map(({ number, title, merged_at }) => ({ number, title, merged_at })), total, jeux
  })).digest("hex");
  const ancienBloc = html.slice(html.indexOf(DEBUT), html.indexOf(FIN));
  if (ancienBloc.includes(`data-roadmap-empreinte="${empreinte}"`)) return html;
  const origine = `https://github.com/${depot}`;
  const bloc = `${DEBUT}
<section id="suivi-automatique" aria-labelledby="t-suivi-automatique" data-roadmap-empreinte="${empreinte}">
<h2 id="t-suivi-automatique">Suivi automatique après validation</h2>
<p>État du catalogue public au commit <a href="${origine}/commit/${sha}"><code>${sha.slice(0, 7)}</code></a> :
  <strong>${total} pages, dont ${jeux} jeux</strong>. Ce suivi factuel complète le bilan éditorial daté ;
  il ne clôt aucune phase et ne certifie ni la relecture pédagogique ni un déploiement effectif.</p>
<p>Validations du même commit sur <code>main</code> :
  ${runs.map((run) => `<a href="${origine}/actions/runs/${run.id}">${echapper(run.name)}</a>`).join(" · ")}.</p>
<div class="fr-tableau" role="region" aria-label="PR fusionnées, défilement horizontal" tabindex="0">
<table>
<caption>Jusqu'à 20 PR récentes fusionnées et incluses dans ce commit validé (parmi les 100 PR fermées les plus récemment mises à jour, hors PR de cet automate)</caption>
<thead><tr><th scope="col">Fusion (UTC)</th><th scope="col">PR</th><th scope="col">Livraison</th></tr></thead>
<tbody>
${prs.map((pr) => `<tr><td><time datetime="${echapper(pr.merged_at)}">${echapper(pr.merged_at.slice(0, 10))}</time></td><td><a href="${origine}/pull/${pr.number}">#${pr.number}</a></td><td>${echapper(pr.title)}</td></tr>`).join("\n")}
</tbody>
</table>
</div>
<p>Les PR ouvertes, fermées sans fusion et les changements absents de ce commit sont exclus.
  Les titres décrivent les PR, pas une validation automatique de leurs objectifs.</p>
</section>
${FIN}`;
  return html.slice(0, html.indexOf(DEBUT)) + bloc + html.slice(html.indexOf(FIN) + FIN.length);
}

export async function preparer({ demander, sha, depot, estAncetre, html, total, jeux }) {
  const reponse = await demander(`/repos/${depot}/actions/runs?head_sha=${sha}&event=push&branch=main&per_page=100`);
  if (reponse.total_count > 100) throw new Error("Plus de 100 validations pour ce commit : contrôle manuel requis");
  const runs = validations(reponse, sha);
  if (!runs) return null;
  const prs = await demander(`/repos/${depot}/pulls?state=closed&sort=updated&direction=desc&per_page=100`);
  return actualiser(html, { prs: selectionnerPr(prs, estAncetre), runs, sha, depot, total, jeux });
}

async function main() {
  const depot = process.env.GITHUB_REPOSITORY;
  const jeton = process.env.GH_TOKEN;
  if (!depot || !jeton) throw new Error("GITHUB_REPOSITORY et GH_TOKEN sont requis");
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const demander = async (route) => {
    const reponse = await fetch(`https://api.github.com${route}`, {
      headers: { authorization: `Bearer ${jeton}`, accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28" }
    });
    if (!reponse.ok) throw new Error(`API GitHub : HTTP ${reponse.status} pour ${route}`);
    return reponse.json();
  };
  const estAncetre = (commit) => {
    try { execFileSync("git", ["merge-base", "--is-ancestor", commit, sha], { stdio: "pipe" }); return true; }
    catch (erreur) { if (erreur.status === 1) return false; throw erreur; }
  };
  let total = 0, jeux = 0;
  for (const dossier of await readdir("catalogue", { withFileTypes: true })) {
    if (!dossier.isDirectory()) continue;
    const fiche = await readFile(`catalogue/${dossier.name}/fiche.md`, "utf8");
    total++;
    if (/^sujet:\s*jeux\//m.test(fiche)) jeux++;
  }
  const fichier = "web/feuille-de-route.html";
  const html = await readFile(fichier, "utf8");
  const resultat = await preparer({ demander, sha, depot, estAncetre, html, total, jeux });
  if (resultat === null) {
    console.log("::notice::main attend trois workflows réussis sur le même commit. Le prochain workflow terminé réessaiera.");
  } else {
    await writeFile(fichier, resultat);
    console.log(resultat === html ? "Roadmap déjà à jour." : "Encart factuel de la roadmap actualisé.");
  }
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `prete=${resultat !== null}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
