// Import de l'API « Marché du travail » de France Travail (chantier Métiers, ADR 0044, lot 8), sans réseau : à partir
// de réponses JSON enregistrées depuis la console de francetravail.io (indicateur de tension, niveau France, par code
// ROME). Préparé sans données réelles : voir l'en-tête de scripts/lib/marche.mjs.
//
//   Lister les codes ROME du référentiel à interroger :
//   npm run import:marche -- --codes
//   Préparer l'extrait versionné à partir d'un dossier de réponses (*.json) :
//   npm run import:marche -- <dossier> --extrait referentiel/sources/france-travail/marche-AAAA-TN.json --date AAAA-MM-JJ
//   Enrichir le référentiel (champ `marche`) :
//   npm run import:marche -- referentiel/sources/france-travail/marche-AAAA-TN.json [--appliquer]
//
//   options : --indicateur <code> (défaut PERSP_2, difficultés de recrutement), --json
//
// Codes de sortie : 0 rapport produit, 1 réponse ou extrait non reconnu, 2 invocation invalide.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appliquerMarche, codesAInterroger, extraitCompact, FORMAT_EXTRAIT, normaliserReponse } from "./lib/marche.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (nom) => {
  const i = args.indexOf(nom);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const drapeau = (nom) => {
  const i = args.indexOf(nom);
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
};
const json = drapeau("--json");
const appliquer = drapeau("--appliquer");
const codes = drapeau("--codes");
const sortieExtrait = option("--extrait");
const date = option("--date");
const indicateur = option("--indicateur") ?? "PERSP_2";
const [source, ...reste] = args;
const cheminMetiers = join(racine, "referentiel/metiers-v0.json");
const referentiel = JSON.parse(await readFile(cheminMetiers, "utf8"));

if (codes) {
  console.log(codesAInterroger(referentiel).join("\n"));
  process.exit(0);
}
if (!source || reste.length || (sortieExtrait && !/^\d{4}-\d{2}-\d{2}$/.test(date ?? ""))) {
  console.error("Usage : node scripts/importer-marche.mjs --codes | <dossier de réponses | extrait.json> [--extrait <json> --date AAAA-MM-JJ] [--indicateur PERSP_2] [--appliquer] [--json]");
  process.exit(2);
}

/**
 * Entrées d'un dossier, ou `null` si le chemin est un fichier. On tente directement la lecture du dossier plutôt que
 * de tester le chemin avant de le lire (pas de course entre le test et l'usage, CWE-367).
 */
async function entreesDuDossier(chemin) {
  try {
    return await readdir(chemin);
  } catch (e) {
    if (e?.code === "ENOTDIR") return null;
    throw e;
  }
}

async function lireExtrait(chemin) {
  try {
    const entrees = await entreesDuDossier(chemin);
    if (entrees === null) {
      const extrait = JSON.parse(await readFile(chemin, "utf8"));
      if (extrait?.format !== FORMAT_EXTRAIT) throw new Error(`ce n'est pas un extrait Marché du travail (format ${extrait?.format})`);
      return extrait;
    }
    const lignes = [];
    for (const nom of entrees.filter((f) => f.endsWith(".json")).sort()) {
      try {
        lignes.push(...normaliserReponse(JSON.parse(await readFile(join(chemin, nom), "utf8")), { indicateur }));
      } catch (e) {
        throw new Error(`${nom} : ${e.message}`);
      }
    }
    const extrait = extraitCompact(lignes, { date, source: `${basename(chemin)} (indicateur ${indicateur})` });
    if (sortieExtrait) await writeFile(sortieExtrait, `${JSON.stringify(extrait, null, 2)}\n`);
    return extrait;
  } catch (e) {
    console.error(`${chemin} : ${e.message}`);
    process.exit(1);
  }
}

const extrait = await lireExtrait(source);
const { referentiel: enrichi, rapport } = appliquerMarche(referentiel, extrait);
if (appliquer) await writeFile(cheminMetiers, `${JSON.stringify(enrichi, null, 2)}\n`);
const resume = { tensions: extrait.tensions.length, ...rapport };
if (json) console.log(JSON.stringify(resume, null, 2));
else {
  console.log(`Marché du travail : ${resume.tensions} code(s) ROME avec une tension (France).`);
  console.log(`Référentiel : ${rapport.rattaches} métier(s) enrichi(s) ; sans donnée : ${rapport.sansDonnees.length}.`);
  if (sortieExtrait) console.log(`Extrait écrit dans ${sortieExtrait}.`);
  if (appliquer) console.log("Tensions appliquées à referentiel/metiers-v0.json.");
}
