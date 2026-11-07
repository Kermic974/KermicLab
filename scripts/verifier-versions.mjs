// Trois versions distinctes (AGENTS.md §6 ter ; feuille de route, phase 0, issue #177) :
// - plateforme : `version` de package.json, section du CHANGELOG, tag créé par le workflow Publication ;
// - notion ou jeu : `version` de catalogue/<id>/fiche.md (reprise dans les métadonnées de la page) ;
// - application du cercle : `VERSION` de src/ui/main.js, archivée dans versions/vX.Y/standalone.html.
// Ce module vérifie ce qui peut l'être automatiquement ; il est appelé par `npm run lint`.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
export const comparer = (a, b) => {
  const [x, y] = [a, b].map((v) => v.match(SEMVER).slice(1).map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
const versionFiche = (texte) => texte?.match(/^version:\s*["']?([^\s"']+)/m)?.[1] ?? null;
const versionCercle = (texte) => texte?.match(/const VERSION = '([^']+)'/)?.[1] ?? null;

/** Plateforme : version SemVer et section correspondante dans le CHANGELOG, avec une section « Non publié ». */
export function verifierPlateforme(pkg, changelog) {
  const erreurs = [];
  if (!SEMVER.test(String(pkg.version))) return [`package.json : version « ${pkg.version} » non SemVer`];
  if (!changelog.includes("## [Non publié]")) erreurs.push("CHANGELOG.md : section « ## [Non publié] » absente");
  const echappee = pkg.version.replaceAll(".", "\\.");
  if (!new RegExp(`^## \\[${echappee}\\] — \\d{4}-\\d{2}-\\d{2}$`, "m").test(changelog)) {
    erreurs.push(`CHANGELOG.md : section « ## [${pkg.version}] — AAAA-MM-JJ » absente pour la version de package.json`);
  }
  return erreurs;
}

/**
 * Application du cercle : VERSION SemVer, archive versions/vX.Y/standalone.html de la version courante, et chaque
 * archive qui porte une VERSION est rangée dans le dossier de sa version (archives anciennes sans constante tolérées).
 * `archives` : { "v1.4": "<contenu html>", … }.
 */
export function verifierCercle(mainJs, archives) {
  const version = versionCercle(mainJs);
  if (!version || !SEMVER.test(version)) return ["src/ui/main.js : constante VERSION SemVer introuvable"];
  const erreurs = [];
  const [maj, min] = version.split(".");
  const courante = archives[`v${maj}.${min}`];
  if (courante === undefined) erreurs.push(`versions/v${maj}.${min}/standalone.html absent pour la version ${version} du cercle`);
  else if (versionCercle(courante) !== version) {
    erreurs.push(`versions/v${maj}.${min}/standalone.html porte la version ${versionCercle(courante)}, attendu ${version} (python3 scripts/build-standalone.py --out versions/v${maj}.${min}/standalone.html)`);
  }
  for (const [dossier, html] of Object.entries(archives)) {
    const v = versionCercle(html);
    if (v && !v.startsWith(`${dossier.slice(1)}.`)) erreurs.push(`versions/${dossier}/standalone.html porte la version ${v}`);
  }
  return erreurs;
}

/**
 * Évolutions par rapport à la branche de base (quand elle est disponible) : la version d'une fiche ne recule jamais ;
 * un `contenu.json` modifié impose une version de notion supérieure ; une modification de src/ impose une nouvelle
 * VERSION du cercle. Les pages écrites à la main ne sont pas contrôlées ici : le build les régénère (CSP, modules
 * inclus) sans changement de contenu ; leur version reste à la charge de l'auteur.
 * `lire(ref, chemin)` renvoie le contenu d'un fichier à une révision (null s'il n'existe pas), `modifies` la liste
 * des fichiers modifiés depuis la base.
 */
export function verifierEvolutions({ modifies, lire }) {
  const erreurs = [];
  const notions = new Set(modifies.map((f) => f.match(/^catalogue\/([^/]+)\//)?.[1]).filter(Boolean));
  for (const id of notions) {
    const avant = versionFiche(lire("base", `catalogue/${id}/fiche.md`));
    const apres = versionFiche(lire("tete", `catalogue/${id}/fiche.md`));
    if (!avant || !apres || !SEMVER.test(avant) || !SEMVER.test(apres)) continue;
    const ecart = comparer(apres, avant);
    if (ecart < 0) erreurs.push(`catalogue/${id}/fiche.md : version ${apres} inférieure à ${avant} (base)`);
    else if (ecart === 0 && modifies.includes(`catalogue/${id}/contenu.json`) && lire("base", `catalogue/${id}/contenu.json`) !== null) {
      erreurs.push(`catalogue/${id} : contenu.json modifié sans nouvelle version dans fiche.md (${apres})`);
    }
  }
  if (modifies.some((f) => f.startsWith("src/") && !f.startsWith("src/dev.html"))) {
    const avant = versionCercle(lire("base", "src/ui/main.js")), apres = versionCercle(lire("tete", "src/ui/main.js"));
    if (avant && apres && SEMVER.test(avant) && SEMVER.test(apres) && comparer(apres, avant) <= 0) {
      erreurs.push(`src/ modifié sans nouvelle VERSION du cercle dans src/ui/main.js (${apres})`);
    }
  }
  return erreurs;
}

/** Lance les trois vérifications sur le dépôt. La base vient de VERSIONS_BASE, sinon origin/main ; absente → ignorée. */
export function verifierDepot(racine) {
  const lireFichier = (p) => readFileSync(path.join(racine, p), "utf8");
  const erreurs = [...verifierPlateforme(JSON.parse(lireFichier("package.json")), lireFichier("CHANGELOG.md"))];
  const archives = {};
  for (const d of readdirSync(path.join(racine, "versions"))) {
    const f = path.join(racine, "versions", d, "standalone.html");
    if (/^v\d+\.\d+$/.test(d) && existsSync(f)) archives[d] = readFileSync(f, "utf8");
  }
  erreurs.push(...verifierCercle(lireFichier("src/ui/main.js"), archives));
  const git = (...args) => execFileSync("git", args, { cwd: racine, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const base = process.env.VERSIONS_BASE || "origin/main";
  let modifies;
  try { modifies = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean); } catch { return { erreurs, base: null }; }
  const lire = (ref, chemin) => {
    if (ref === "tete") return existsSync(path.join(racine, chemin)) ? lireFichier(chemin) : null;
    try { return git("show", `${git("merge-base", base, "HEAD").trim()}:${chemin}`); } catch { return null; }
  };
  erreurs.push(...verifierEvolutions({ modifies, lire }));
  return { erreurs, base };
}
