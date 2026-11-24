// Import des fiches métiers de l'ONISEP (chantier Métiers, ADR 0042) à partir d'un instantané local, sans réseau.
//
//   Préparer l'extrait versionné (base dérivée, licence ODbL) à partir des fichiers téléchargés sur data.gouv.fr :
//   npm run import:onisep -- "Ideo-Fiches metiers.xml" --complement ideo-metiers-onisep.csv \
//     --extrait referentiel/sources/onisep/ideo-metiers-AAAA-MM-JJ.json --date AAAA-MM-JJ
//   Rapprocher le référentiel de l'extrait (rapport, candidats) puis appliquer :
//   npm run import:onisep -- referentiel/sources/onisep/ideo-metiers-AAAA-MM-JJ.json [--appliquer] [--remplacer-propositions]
//
//   options : --format csv|json|xml (déduit de l'extension), --complement <csv> (domaines et liens d'« Idéo-Métiers
//             Onisep »), --extrait <json> et --date (écrit l'extrait compact), --candidats <fichier> (défaut : à côté
//             de la source), --appliquer (complète onisep, rome, niveauAcces, domaines, synonymes des métiers
//             rattachés), --remplacer-propositions (les valeurs ONISEP remplacent celles des fiches « proposition »),
//             --json (rapport machine)
//
// Codes de sortie : 0 rapport produit, 1 colonnes indispensables absentes, 2 invocation invalide.
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  appliquerRattachements, completerFiches, extraitCompact, fichesDeLExtrait, fusionnerFiches, lireInstantane, normaliserFiche,
  proposerDisciplines, rapportImport, rapprocher, reconnaitreColonnes
} from "./lib/onisep.mjs";

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
const remplacerPropositions = drapeau("--remplacer-propositions");
const format = option("--format");
const complement = option("--complement");
const sortieExtrait = option("--extrait");
const date = option("--date");
const sortieCandidats = option("--candidats");
const [source, ...reste] = args;
if (!source || reste.length || (format && !["csv", "json", "xml"].includes(format)) || (sortieExtrait && !/^\d{4}-\d{2}-\d{2}$/.test(date ?? ""))) {
  console.error("Usage : node scripts/importer-onisep.mjs <source.xml|csv|json> [--complement <csv>] [--extrait <json> --date AAAA-MM-JJ] [--format csv|json|xml] [--candidats <fichier>] [--appliquer] [--remplacer-propositions] [--json]");
  process.exit(2);
}

const formatDe = (chemin) => format ?? ({ ".json": "json", ".xml": "xml" }[extname(chemin).toLowerCase()] ?? "csv");
/** Fiches normalisées d'un fichier : extrait compact, ou lignes XML / CSV / JSON reconnues par leurs colonnes. */
async function lireFiches(chemin) {
  const texte = await readFile(chemin, "utf8");
  const f = formatDe(chemin);
  if (f === "json") {
    const donnees = JSON.parse(texte.replace(/^﻿/, ""));
    if (donnees?.format === "kermiclab-onisep-extrait") return { fiches: fichesDeLExtrait(donnees), colonnes: { extrait: chemin } };
  }
  const lignes = lireInstantane(texte, f);
  const colonnes = reconnaitreColonnes(Object.keys(lignes[0] ?? {}));
  if (!colonnes.onisep && !colonnes.lien || !colonnes.nom) {
    console.error(`${chemin} : colonnes indispensables introuvables (identifiant ou lien, intitulé). En-têtes lus : ${Object.keys(lignes[0] ?? {}).join(", ")}`);
    console.error("Ajouter l'alias manquant dans COLONNES (scripts/lib/onisep.mjs).");
    process.exit(1);
  }
  return { fiches: fusionnerFiches(lignes.map((l) => normaliserFiche(l, colonnes))), colonnes };
}

let { fiches, colonnes } = await lireFiches(source);
if (complement) fiches = completerFiches(fiches, (await lireFiches(complement)).fiches);
if (sortieExtrait) {
  const sources = [basename(source), complement && basename(complement)].filter(Boolean).join(" + ");
  await writeFile(sortieExtrait, `${JSON.stringify(extraitCompact(fiches, { source: sources, date }), null, 2)}\n`);
}

const cheminMetiers = join(racine, "referentiel/metiers-v0.json");
const metiers = JSON.parse(await readFile(cheminMetiers, "utf8"));
const resultat = rapprocher(fiches, metiers.metiers);
const regles = JSON.parse(await readFile(join(racine, "referentiel/regles-metiers.json"), "utf8"));
// Lot 3 : disciplines proposées par les règles ROME, à relire avant d'entrer dans le référentiel.
for (const c of resultat.candidats) c.disciplinesProposees = proposerDisciplines(c.rome, regles);
const rapport = rapportImport(resultat, colonnes);

const fichierCandidats = sortieCandidats ?? join(dirname(sortieExtrait ?? source), "candidats.json");
await writeFile(fichierCandidats, `${JSON.stringify({ source: basename(sortieExtrait ?? source), candidats: resultat.candidats }, null, 2)}\n`);
if (appliquer) {
  const { conflits, ...applique } = appliquerRattachements(metiers, resultat.rattachements, { remplacerPropositions });
  rapport.conflits = conflits;
  await writeFile(cheminMetiers, `${JSON.stringify(applique, null, 2)}\n`);
}

if (json) console.log(JSON.stringify(rapport, null, 2));
else {
  console.log(`Source : ${rapport.fiches} fiche(s), ${rapport.rattachements.length} rattachée(s) au référentiel, ${rapport.candidats} candidat(s), ${rapport.anomalies.length} anomalie(s), ${rapport.sansRome} sans code ROME.`);
  if (rapport.colonnesManquantes.length && !colonnes.extrait) console.log(`Colonnes non reconnues : ${rapport.colonnesManquantes.join(", ")}.`);
  console.log(`Par niveau d'accès : ${Object.entries(rapport.parNiveau).map(([k, n]) => `${k} ${n}`).join(", ")}.`);
  console.log(`Par domaine : ${Object.entries(rapport.parDomaine).slice(0, 15).map(([k, n]) => `${k} ${n}`).join(", ")}.`);
  if (rapport.conflits?.length) console.log(`Conflits à trancher (valeur conservée) : ${rapport.conflits.map((c) => `${c.metier}.${c.champ}`).join(", ")}.`);
  if (sortieExtrait) console.log(`Extrait écrit dans ${sortieExtrait}.`);
  console.log(`Candidats écrits dans ${fichierCandidats}${appliquer ? " ; rattachements appliqués à referentiel/metiers-v0.json" : ""}.`);
}
