// Publication programmée du blog (issue #312) : décision quotidienne de construire et déployer. Aucun appel réseau réel.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { articlesEnLigne, deciderPublication, ecartPublication } from "../../scripts/blog-programme.mjs";

const racine = new URL("../..", import.meta.url).pathname;
const SITE = "https://kermiclab.pages.dev";
const article = (date) => `---\ntitre: Article du ${date}\nauteur: Émile Grok\ndate: ${date}\nstatut: validé\n---\n\nTexte.\n`;
const enLigne = (slugs, status = 200) => async (url, init) => {
  assert.equal(url, `${SITE}/blog/index.json`);
  assert.equal(init.headers["user-agent"], "kermiclab-publication-programmee (CI)");
  return new Response(JSON.stringify({ articles: slugs.map((slug) => ({ slug })) }), { status });
};

async function avecBlog(f) {
  const dossier = await mkdtemp(path.join(tmpdir(), "blog-decision-"));
  try {
    await writeFile(path.join(dossier, "2026-11-16-a.md"), article("2026-11-16"));
    await writeFile(path.join(dossier, "2026-11-17-b.md"), article("2026-11-17"));
    return await f(dossier);
  } finally { await rm(dossier, { recursive: true, force: true }); }
}

test("écart : adresses à ajouter et à retirer, triées", () => {
  assert.deepEqual(ecartPublication(["b", "a", "c"], ["c", "z"]), { aAjouter: ["a", "b"], aRetirer: ["z"] });
  assert.deepEqual(ecartPublication(["a"], ["a"]), { aAjouter: [], aRetirer: [] });
});

test("décision : rien à faire tant que la date de l'article n'est pas arrivée", () => avecBlog(async (dossier) => {
  const d = await deciderPublication({ dossier, site: SITE, jour: "2026-11-16", fetch: enLigne(["2026-11-16-a"]) });
  assert.deepEqual(d, { aPublier: false, motif: "blog à jour au 2026-11-16 (1 article(s))" });
}));

test("décision : déploiement le jour où un article programmé arrive à sa date", () => avecBlog(async (dossier) => {
  const d = await deciderPublication({ dossier, site: SITE, jour: "2026-11-17", fetch: enLigne(["2026-11-16-a"]) });
  assert.deepEqual(d, { aPublier: true, motif: "à publier : 2026-11-17-b (au 2026-11-17)" });
}));

test("décision : un article en ligne qui ne devrait plus l'être déclenche aussi un déploiement", () => avecBlog(async (dossier) => {
  const d = await deciderPublication({ dossier, site: SITE, jour: "2026-11-16", fetch: enLigne(["2026-11-16-a", "2026-11-17-b"]) });
  assert.deepEqual(d, { aPublier: true, motif: "à retirer : 2026-11-17-b (au 2026-11-16)" });
}));

test("décision : liste en ligne injoignable ou mal formée → déploiement par précaution", () => avecBlog(async (dossier) => {
  for (const f of [enLigne([], 503), async () => { throw new Error("réseau"); }, async () => new Response("<html>"), async () => new Response('{"articles":[{"titre":"x"}]}')]) {
    assert.equal(await articlesEnLigne(SITE, { fetch: f }), null);
    const d = await deciderPublication({ dossier, site: SITE, jour: "2026-11-16", fetch: f });
    assert.equal(d.aPublier, true);
    assert.match(d.motif, /illisible/);
  }
}));

test("CI : exécution quotidienne vers 6 h à La Réunion, déploiement seulement si le blog a changé", async () => {
  const ci = await readFile(`${racine}.github/workflows/ci.yml`, "utf8");
  // 02:07 UTC = 06:07 à La Réunion (UTC+4, sans heure d'été).
  assert.match(ci, /schedule:\n\s+- cron: "7 2 \* \* \*"/);
  assert.match(ci, /run: node scripts\/blog-programme\.mjs/);
  assert.match(ci, /github\.event_name != 'schedule' \|\| needs\.programme\.outputs\.a_publier == 'true'/);
  assert.match(ci, /needs\.verifier\.result == 'success'/);
  // L'étape de décision ne reçoit aucun secret.
  const programme = ci.slice(ci.indexOf("  programme:"), ci.indexOf("  verifier:"));
  assert.doesNotMatch(programme, /secrets\./);
});

test("environnement Cursor : mêmes versions de Node et de Playwright que la CI, dépendances du Worker comprises", async () => {
  const lire = (f) => readFile(`${racine}${f}`, "utf8");
  const [ci, environnement, image] = await Promise.all([".github/workflows/ci.yml", ".cursor/environment.json", ".cursor/Dockerfile"].map(lire));
  const { install, build } = JSON.parse(environnement);
  const node = ci.match(/node-version: (\d+)/)[1];
  const playwright = ci.match(/playwright@([\d.]+)/)[1];
  assert.equal(build.dockerfile, "Dockerfile");
  assert.match(image, new RegExp(`^FROM node:${node}-`, "m"));
  assert.ok(install.includes(`playwright@${playwright}`), "même version de Playwright que la CI");
  for (const commande of ["npm ci", "npm ci --prefix worker", "npx playwright install --with-deps chromium"]) assert.ok(install.includes(commande), commande);
});

test("revue IA ignorée : un avertissement est émis (clé absente ou PR d'un fork) ; roadmap déclenchée par CI/CD seul", async () => {
  const revue = await readFile(`${racine}.github/workflows/revue-ia.yml`, "utf8");
  assert.equal(revue.match(/::warning::Revue de sécurité par IA ignorée/g).length, 2);
  assert.match(revue, /if: steps\.cle\.outputs\.ok != 'true'/);
  assert.match(revue, /if: github\.event\.pull_request\.head\.repo\.full_name != github\.repository/);
  assert.doesNotMatch(revue, /pull_request_target/);
  const roadmap = await readFile(`${racine}.github/workflows/roadmap.yml`, "utf8");
  assert.match(roadmap, /^\s+workflows: \["CI\/CD"\]$/m);
});
