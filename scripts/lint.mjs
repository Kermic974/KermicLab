// Lint léger sans dépendance : syntaxe JS, JSON valides, parité des clés i18n, absence de secrets évidents.
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { verifierDepot } from "./verifier-versions.mjs";

const racine = new URL("..", import.meta.url).pathname;
const ignores = new Set(["node_modules", ".git", "dist", ".wrangler", "generated", "catalogue-prive"]);
const erreurs = [];

async function parcourir(rep) {
  const sortie = [];
  for (const e of await readdir(rep, { withFileTypes: true })) {
    if (ignores.has(e.name)) continue;
    const p = path.join(rep, e.name);
    if (e.isDirectory()) sortie.push(...(await parcourir(p))); else sortie.push(p);
  }
  return sortie;
}

const fichiers = await parcourir(racine);
for (const f of fichiers) {
  const rel = path.relative(racine, f);
  if (/\.(m?js)$/.test(f)) {
    try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); } catch (e) { erreurs.push(`${rel}: ${e.stderr}`); }
  }
  if (f.endsWith(".json")) {
    try { JSON.parse(await readFile(f, "utf8")); } catch (e) { erreurs.push(`${rel}: JSON invalide (${e.message})`); }
  }
  if (/\.(m?js|json|toml|html|md|yml|ya?ml)$/.test(f)) {
    const t = await readFile(f, "utf8");
    if (/sk-ant-[a-zA-Z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/.test(t)) erreurs.push(`${rel}: secret probable dans le code`);
  }
}

const dossierI18n = path.join(racine, "web/i18n");
const langues = (await readdir(dossierI18n)).filter((f) => f.endsWith(".json"));
const cles = {};
for (const l of langues) cles[l] = Object.keys(JSON.parse(await readFile(path.join(dossierI18n, l), "utf8"))).sort();
const reference = cles["fr.json"];
for (const [l, c] of Object.entries(cles)) {
  const manquantes = reference.filter((k) => !c.includes(k));
  const enTrop = c.filter((k) => !reference.includes(k));
  if (manquantes.length || enTrop.length) erreurs.push(`web/i18n/${l}: clés manquantes [${manquantes}] / en trop [${enTrop}]`);
}
const indexHtml = await readFile(path.join(racine, "web/index.html"), "utf8");
for (const [, cle] of indexHtml.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)) {
  if (!reference.includes(cle)) erreurs.push(`web/index.html: clé i18n inconnue « ${cle} »`);
}

// Versions de la plateforme, des notions et du cercle (AGENTS.md §6 ter).
const versions = verifierDepot(racine);
erreurs.push(...versions.erreurs);
if (!versions.base) console.log("Versions : branche de base introuvable, évolutions non comparées.");

if (erreurs.length) { console.error(erreurs.join("\n")); process.exit(1); }
console.log(`Lint OK (${fichiers.length} fichiers, ${langues.length} langues).`);
