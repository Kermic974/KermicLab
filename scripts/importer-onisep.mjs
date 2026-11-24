// Import des fiches métiers de l'ONISEP (chantier Métiers, lot 2, ADR 0042) à partir d'un instantané local.
//
//   npm run import:onisep -- referentiel/sources/onisep/ideo-fiches-metiers-AAAA-MM-JJ.csv
//   options : --format csv|json (déduit de l'extension), --candidats <fichier> (défaut : à côté de l'instantané),
//             --appliquer (complète onisep, rome, niveauAcces, domaines des métiers rattachés), --json (rapport machine)
//
// Codes de sortie : 0 rapport produit, 1 colonnes indispensables absentes, 2 invocation invalide.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appliquerRattachements, lireInstantane, normaliserFiche, rapportImport, rapprocher, reconnaitreColonnes } from "./lib/onisep.mjs";

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
const format = option("--format");
const sortieCandidats = option("--candidats");
const [source, ...reste] = args;
if (!source || reste.length || (format && !["csv", "json"].includes(format))) {
  console.error("Usage : node scripts/importer-onisep.mjs <instantané.csv|json> [--format csv|json] [--candidats <fichier>] [--appliquer] [--json]");
  process.exit(2);
}

const lignes = lireInstantane(await readFile(source, "utf8"), format ?? (extname(source).toLowerCase() === ".json" ? "json" : "csv"));
const colonnes = reconnaitreColonnes(Object.keys(lignes[0] ?? {}));
if (!colonnes.onisep || !colonnes.nom) {
  console.error(`Colonnes indispensables introuvables (identifiant, intitulé). En-têtes lus : ${Object.keys(lignes[0] ?? {}).join(", ")}`);
  console.error("Ajouter l'alias manquant dans COLONNES (scripts/lib/onisep.mjs).");
  process.exit(1);
}
const cheminMetiers = join(racine, "referentiel/metiers-v0.json");
const metiers = JSON.parse(await readFile(cheminMetiers, "utf8"));
const resultat = rapprocher(lignes.map((l) => normaliserFiche(l, colonnes)), metiers.metiers);
const rapport = rapportImport(resultat, colonnes);

const fichierCandidats = sortieCandidats ?? join(dirname(source), "candidats.json");
await writeFile(fichierCandidats, `${JSON.stringify({ source, candidats: resultat.candidats }, null, 2)}\n`);
if (appliquer) await writeFile(cheminMetiers, `${JSON.stringify(appliquerRattachements(metiers, resultat.rattachements), null, 2)}\n`);

if (json) console.log(JSON.stringify(rapport, null, 2));
else {
  console.log(`Instantané : ${rapport.fiches} fiche(s), ${rapport.rattachements.length} rattachée(s) au référentiel, ${rapport.candidats} candidat(s), ${rapport.anomalies.length} anomalie(s), ${rapport.sansRome} sans code ROME.`);
  if (rapport.colonnesManquantes.length) console.log(`Colonnes non reconnues : ${rapport.colonnesManquantes.join(", ")}.`);
  console.log(`Par niveau d'accès : ${Object.entries(rapport.parNiveau).map(([k, n]) => `${k} ${n}`).join(", ")}.`);
  console.log(`Par domaine : ${Object.entries(rapport.parDomaine).slice(0, 15).map(([k, n]) => `${k} ${n}`).join(", ")}.`);
  console.log(`Candidats écrits dans ${fichierCandidats}${appliquer ? " ; rattachements appliqués à referentiel/metiers-v0.json" : ""}.`);
}
