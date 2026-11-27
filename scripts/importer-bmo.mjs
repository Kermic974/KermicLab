// Import de l'enquête « Besoins en main-d'œuvre » (BMO) de France Travail (chantier Métiers, ADR 0045, lot 9),
// à partir d'un instantané local, sans réseau.
//
//   Préparer l'extrait versionné à partir du fichier annuel téléchargé sur data.gouv.fr :
//   npm run import:bmo -- Base-open-data-BMO-AAAA.xlsx --extrait referentiel/sources/france-travail/bmo-AAAA.json --date AAAA-MM-JJ
//   Enrichir le référentiel (champ `perspectives` des métiers rattachés par `fap`) :
//   npm run import:bmo -- referentiel/sources/france-travail/bmo-AAAA.json [--appliquer]
//
//   options : --feuille <nom> (défaut BMO_<année>_open_data, sinon la première feuille reconnue), --json
//
// Codes de sortie : 0 rapport produit, 1 fichier non reconnu, 2 invocation invalide.
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { agregerBmo, appliquerBmo, extraitCompact, feuillesDuClasseur, FORMAT_EXTRAIT, lireFeuille } from "./lib/bmo.mjs";

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
const sortieExtrait = option("--extrait");
const date = option("--date");
const nomFeuille = option("--feuille");
const [source, ...reste] = args;
if (!source || reste.length || (sortieExtrait && !/^\d{4}-\d{2}-\d{2}$/.test(date ?? ""))) {
  console.error("Usage : node scripts/importer-bmo.mjs <fichier.xlsx | extrait.json> [--extrait <json> --date AAAA-MM-JJ] [--feuille <nom>] [--appliquer] [--json]");
  process.exit(2);
}

async function lireExtrait(chemin) {
  const octets = await readFile(chemin);
  if (extname(chemin).toLowerCase() === ".json") {
    const extrait = JSON.parse(octets.toString("utf8"));
    if (extrait?.format !== FORMAT_EXTRAIT) { console.error(`${chemin} : ce n'est pas un extrait BMO (format ${extrait?.format}).`); process.exit(1); }
    return extrait;
  }
  const feuilles = feuillesDuClasseur(octets);
  const nom = nomFeuille ?? feuilles.find((f) => /^BMO_\d{4}_open_data$/i.test(f)) ?? feuilles.find((f) => /BMO/i.test(f));
  if (!nom) { console.error(`${chemin} : feuille BMO introuvable (feuilles : ${feuilles.join(", ")}).`); process.exit(1); }
  const extrait = extraitCompact(agregerBmo(lireFeuille(octets, nom)), { date, source: `${basename(chemin)} (feuille ${nom})` });
  if (sortieExtrait) {
    const { metiers, ...tete } = extrait;
    const enTete = JSON.stringify(tete, null, 2).replace(/\n}$/, "");
    await writeFile(sortieExtrait, `${enTete},\n  "metiers": [\n${metiers.map((m) => `    ${JSON.stringify(m)}`).join(",\n")}\n  ]\n}\n`);
  }
  return extrait;
}

const extrait = await lireExtrait(source);
const cheminMetiers = join(racine, "referentiel/metiers-v0.json");
const { referentiel, rapport } = appliquerBmo(JSON.parse(await readFile(cheminMetiers, "utf8")), extrait);
if (appliquer) await writeFile(cheminMetiers, `${JSON.stringify(referentiel, null, 2)}\n`);

const parPalier = Object.groupBy(extrait.metiers, (m) => m.palier);
const resume = { annee: extrait.annee, metiersBmo: extrait.metiers.length, ...rapport, paliers: Object.fromEntries(Object.entries(parPalier).map(([k, v]) => [k, v.length])) };
if (json) console.log(JSON.stringify(resume, null, 2));
else {
  console.log(`BMO ${resume.annee} : ${resume.metiersBmo} métier(s) BMO ; paliers ${Object.entries(resume.paliers).map(([k, n]) => `${k} ${n}`).join(", ")}.`);
  console.log(`Référentiel : ${rapport.rattaches} métier(s) rattaché(s) ; sans code BMO : ${rapport.sansFap.length}.`);
  if (rapport.inconnus.length) console.log(`Codes BMO inconnus : ${rapport.inconnus.join(", ")}.`);
  if (sortieExtrait) console.log(`Extrait écrit dans ${sortieExtrait}.`);
  if (appliquer) console.log("Perspectives appliquées à referentiel/metiers-v0.json.");
}
