// Import du ROME 4.0 de France Travail (chantier Métiers, ADR 0044) à partir d'un instantané local, sans réseau.
//
//   Préparer l'extrait versionné à partir du dossier dézippé de « Toutes les données du ROME » (JSON, data.gouv.fr) :
//   npm run import:rome -- <dossier> --extrait referentiel/sources/france-travail/rome-4.0-vNN.json --date AAAA-MM-JJ
//   Enrichir le référentiel des métiers (contextes de travail, transitions, métiers proches) :
//   npm run import:rome -- referentiel/sources/france-travail/rome-4.0-vNN.json [--preciser] [--appliquer]
//
//   options : --preciser (remplace un code ROME v3 venu de l'ONISEP par la fiche ROME 4.0 de même famille dont
//             l'intitulé est exactement le nom du métier), --candidats <json> (complète les candidats de l'import ONISEP par les compétences et savoirs du ROME),
//             --json (rapport machine)
//
// Codes de sortie : 0 rapport produit, 1 fichiers du ROME introuvables, 2 invocation invalide.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appliquerCodesPrecis, appliquerRome, codesPrecis, completerCandidats, decoderRome, extraitCompact, FORMAT_EXTRAIT } from "./lib/rome.mjs";

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
const preciser = drapeau("--preciser");
const sortieExtrait = option("--extrait");
const date = option("--date");
const candidats = option("--candidats");
const [source, ...reste] = args;
if (!source || reste.length || (sortieExtrait && !/^\d{4}-\d{2}-\d{2}$/.test(date ?? ""))) {
  console.error("Usage : node scripts/importer-rome.mjs <dossier ROME | extrait.json> [--extrait <json> --date AAAA-MM-JJ] [--candidats <json>] [--preciser] [--appliquer] [--json]");
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

/** Extrait compact : relu tel quel, ou construit à partir du dossier dézippé du ROME. */
async function lireExtraitOuDossier(chemin) {
  const fichiers = await entreesDuDossier(chemin);
  if (fichiers === null) {
    const extrait = JSON.parse(await readFile(chemin, "utf8"));
    if (extrait?.format !== FORMAT_EXTRAIT) { console.error(`${chemin} : ce n'est pas un extrait ROME (format ${extrait?.format}).`); process.exit(1); }
    return extrait;
  }
  const trouver = (prefixe) => fichiers.find((f) => f.startsWith(prefixe) && f.endsWith(".json"));
  const noms = { fiches: trouver("unix_fiche_emploi_metier_"), codes: trouver("unix_referentiel_code_rome_"), contextes: trouver("unix_referentiel_contexte_travail_") };
  if (!noms.fiches || !noms.codes) {
    console.error(`${chemin} : fichiers unix_fiche_emploi_metier_*.json et unix_referentiel_code_rome_*.json introuvables.`);
    process.exit(1);
  }
  const lire = async (nom) => (nom ? decoderRome(await readFile(join(chemin, nom))) : []);
  const version = /v4?(\d+)\.json$/.exec(noms.fiches)?.[1] ?? "?";
  const versionTexte = fichiers.includes("version.txt") ? decoderRome(JSON.stringify((await readFile(join(chemin, "version.txt"))).toString("latin1"))) : "";
  const numero = /Numero de version\s*:\s*(\d+)/.exec(versionTexte)?.[1] ?? version;
  const extrait = extraitCompact({ fiches: await lire(noms.fiches), codes: await lire(noms.codes), contextes: await lire(noms.contextes) },
    { version: numero, date, source: `${basename(chemin)} (${noms.fiches})` });
  if (sortieExtrait) await writeFile(sortieExtrait, serialiser(extrait));
  return extrait;
}

/** Une fiche par ligne : extrait lisible, diff court d'une version du ROME à l'autre. */
function serialiser(extrait) {
  const { contextes, fiches, ...tete } = extrait;
  const lignes = (liste) => liste.map((x) => `    ${JSON.stringify(x)}`).join(",\n");
  const enTete = JSON.stringify(tete, null, 2).replace(/\n}$/, "");
  return `${enTete},\n  "contextes": [\n${lignes(contextes)}\n  ],\n  "fiches": [\n${lignes(fiches)}\n  ]\n}\n`;
}

const extrait = await lireExtraitOuDossier(source);
const cheminMetiers = join(racine, "referentiel/metiers-v0.json");
const lu = JSON.parse(await readFile(cheminMetiers, "utf8"));
const precisions = codesPrecis(lu, extrait);
const metiers = preciser ? appliquerCodesPrecis(lu, precisions) : lu;
const { referentiel, rapport } = appliquerRome(metiers, extrait);
if (appliquer) await writeFile(cheminMetiers, `${JSON.stringify(referentiel, null, 2)}\n`);
if (candidats) {
  const liste = JSON.parse(await readFile(candidats, "utf8"));
  liste.candidats = completerCandidats(liste.candidats ?? [], extrait);
  await writeFile(candidats, `${JSON.stringify(liste, null, 2)}\n`);
}

const resume = { rome: extrait.rome, fiches: extrait.fiches.length, contextes: extrait.contextes.length, ...rapport, contextesUtilises: referentiel.contextesTravail.length, precisions };
if (json) console.log(JSON.stringify(resume, null, 2));
else {
  console.log(`ROME ${resume.rome} : ${resume.fiches} fiche(s), ${resume.contextes} contexte(s) de travail.`);
  console.log(`Référentiel : ${rapport.rattaches} métier(s) rattaché(s) ; contextes ${rapport.avecContextes}, transitions ${rapport.avecTransitions}, métiers proches ${rapport.avecProches} ; ${resume.contextesUtilises} contexte(s) utilisé(s).`);
  if (precisions.length) console.log(`Codes ROME 4.0 plus précis${preciser ? " appliqués" : " (--preciser pour les appliquer)"} : ${precisions.map((c) => `${c.metier} ${c.avant} → ${c.apres}`).join(", ")}.`);
  if (rapport.sansRome.length) console.log(`Sans code ROME : ${rapport.sansRome.join(", ")}.`);
  if (rapport.absents.length) console.log(`Codes absents du ROME : ${rapport.absents.join(", ")}.`);
  if (sortieExtrait) console.log(`Extrait écrit dans ${sortieExtrait}.`);
  if (candidats) console.log(`Candidats complétés dans ${candidats}.`);
  if (appliquer) console.log("Enrichissement appliqué à referentiel/metiers-v0.json.");
}
