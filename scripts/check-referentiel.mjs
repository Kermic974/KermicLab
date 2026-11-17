import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chargerSchemasReferentiel, erreursStructure } from "./lib/referentiel-structure.mjs";
import { typesRelation, verifierIntegrite } from "./lib/referentiel-integrite.mjs";
import { lireHistorique } from "./lib/referentiel-historique.mjs";

const racine = fileURLToPath(new URL("../", import.meta.url));
const comparer = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const decoder = new TextDecoder("utf-8", { fatal: true });

async function* fichiersJson(dossier, facultatif = false) {
  let contenu;
  try { contenu = await readdir(dossier, { withFileTypes: true }); }
  catch (erreur) {
    if (facultatif && erreur.code === "ENOENT") return;
    throw erreur;
  }
  for (const entree of contenu.sort((a, b) => comparer(a.name, b.name))) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) yield* fichiersJson(chemin);
    else if (entree.name.endsWith(".json")) yield chemin;
  }
}

export async function verifierReferentiel(cwd = racine, historiqueDe = lireHistorique) {
  const schemas = await chargerSchemasReferentiel();
  const entrees = [];
  const issues = [];
  const signaler = (entree, rule, message, severity = "ERROR", pointer = "") => {
    const objectId = typeof entree.objet?.id === "string" ? entree.objet.id : null;
    const location = entree.location + (pointer ? "#" + pointer : "");
    issues.push({ rule, severity, message, objectId, location });
  };
  try {
    for await (const chemin of fichiersJson(join(cwd, "referentiel", "objets"), true)) {
      const entree = { location: relative(cwd, chemin).split(sep).join("/") };
      try { entree.objet = JSON.parse(decoder.decode(await readFile(chemin))); }
      catch (erreur) {
        signaler(entree, "S4-JSON", erreur instanceof SyntaxError ? "JSON syntaxiquement invalide." : "Fichier JSON illisible.");
        continue;
      }
      const { objet } = entree;
      const type = objet?.type;
      const relation = typesRelation.has(type) || (typeof objet?.id === "string" && objet.id.startsWith("relation."));
      const schema = schemas.get(relation ? "relation" : type);
      if (!schema) {
        signaler(entree, "S4-SCHEMA-TYPE", "Type de contrat absent ou inconnu.");
        continue;
      }
      const erreurs = erreursStructure(schema, objet);
      for (const e of erreurs) signaler(entree, e.rule, e.message, e.severity, e.location);
      if (!erreurs.length) entrees.push(entree);
    }
  } catch {
    signaler({ location: "referentiel/objets" }, "S4-JSON", "Dossier canonique illisible.");
  }
  if (entrees.length) {
    let historique;
    try { historique = await historiqueDe(cwd); }
    catch {
      historique = null;
      signaler({ location: "referentiel/objets" }, "S4-HISTORIQUE-INDISPONIBLE", "L’historique complet de main est requis.");
    }
    verifierIntegrite(entrees, historique, signaler);
  }
  const champs = ["location", "rule", "severity", "objectId", "message"];
  issues.sort((a, b) => {
    for (const champ of champs) {
      const ordre = comparer(a[champ] ?? "", b[champ] ?? "");
      if (ordre) return ordre;
    }
    return 0;
  });
  const uniques = [...new Map(issues.map(issue => [JSON.stringify(issue), issue])).values()];
  const errors = uniques.filter(issue => issue.severity === "ERROR").length;
  return { specificationVersion: "1.1.2", verdict: errors ? "FAIL" : "PASS", errors, warnings: uniques.length - errors, issues: uniques };
}

async function principal() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => arg !== "--json")) {
    console.error("Usage : npm run check:referentiel -- [--json]");
    process.exitCode = 2;
    return;
  }
  const rapport = await verifierReferentiel(process.cwd());
  if (args.includes("--json")) console.log(JSON.stringify(rapport, null, 2));
  else {
    for (const issue of rapport.issues) console.log(issue.severity + " " + issue.rule + " " + issue.location + " — " + issue.message);
    const verdict = rapport.verdict === "PASS" && rapport.warnings ? "PASS avec avertissements" : rapport.verdict;
    console.log(verdict + " (" + rapport.errors + " erreurs, " + rapport.warnings + " avertissements)");
  }
  process.exitCode = rapport.errors > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await principal();
