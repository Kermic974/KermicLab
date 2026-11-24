import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chargerSchemasExperiences } from "./lib/experiences-structure.mjs";
import { chargerSchemasReferentiel } from "./lib/referentiel-structure.mjs";
import { typesRelation } from "./lib/referentiel-integrite.mjs";
import { verifierIntegriteExperiences } from "./lib/experiences-integrite.mjs";
import { lireHistorique } from "./lib/referentiel-historique.mjs";
import { creerLecteurSources, preparerSources } from "./lib/experiences-sources.mjs";

const decoder = new TextDecoder("utf-8", { fatal: true });
async function* fichiersJson(dossier) {
  let contenu;
  try { contenu = await readdir(dossier, { withFileTypes: true }); }
  catch (e) { if (e.code === "ENOENT") return; throw e; }
  for (const entree of contenu.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) yield* fichiersJson(chemin);
    else if (entree.name.endsWith(".json")) {
      if (!entree.isFile()) throw new Error("Objet canonique non régulier.");
      yield chemin;
    }
  }
}

export async function verifierExperiences(cwd = process.cwd(), options = {}) {
  const issues = [];
  const entrees = [];
  const signaler = (e, rule, message, severity = "ERROR", pointer = "") =>
    issues.push({ rule, severity, message, location: e.location + pointer });
  const schemas = await chargerSchemasExperiences();
  try {
    for await (const path of fichiersJson(join(cwd, "experiences/objets"))) {
      const e = { location: relative(cwd, path).split(sep).join("/") };
      try { e.objet = JSON.parse(decoder.decode(await readFile(path))); }
      catch { signaler(e, "S6-JSON", "Objet JSON illisible ou invalide."); continue; }
      const schema = schemas.get(e.objet?.type);
      if (!schema) { signaler(e, "S6-SCHEMA-TYPE", "Type d’expérience absent ou inconnu."); continue; }
      if (!schema(e.objet)) {
        for (const erreur of schema.errors.filter(e => e.keyword !== "if")) {
          signaler(e, "S6-SCHEMA-FORME", "Contrat JSON Schema non respecté : " + erreur.keyword + ".", "ERROR", "#" + erreur.instancePath);
        }
        continue;
      }
      entrees.push(e);
    }
  } catch { signaler({ location: "experiences/objets" }, "S6-JSON", "Corpus d’expériences illisible."); }
  if (entrees.length) {
    const cibles = new Map();
    const schemasS4 = await chargerSchemasReferentiel();
    try {
      for await (const path of fichiersJson(join(cwd, "referentiel/objets"))) {
        const o = JSON.parse(decoder.decode(await readFile(path)));
        const schema = schemasS4.get(typesRelation.has(o?.type) ? "relation" : o?.type);
        if (!schema || !schema(o) || cibles.has(o.id)) throw new Error("Cible invalide.");
        cibles.set(o.id, o);
      }
    } catch { signaler({ location: "referentiel/objets" }, "S6-CANONICAL", "Corpus S4 illisible, structure invalide ou ID dupliqué."); }
    const lecteurDe = options.lecteurDe || ((revision) => creerLecteurSources(cwd, revision, options.adaptateurs));
    const lecteur = lecteurDe(null);
    for (const entree of entrees) await preparerSources(entree, lecteur, signaler);
    let historique = null;
    try {
      const revisions = await (options.historiqueDe || lireHistorique)(cwd, "experiences/objets");
      historique = [];
      for (const etat of revisions) {
        const precedent = new Map();
        const lecteurAncien = lecteurDe(etat.revision);
        for (const [id, objet] of etat) {
          const schema = schemas.get(objet.type);
          if (!schema || !schema(objet)) throw new Error("Objet historique invalide.");
          const ancien = { objet, location: "experiences/objets#" + id };
          await preparerSources(ancien, lecteurAncien, (_e, rule) => {
            if (["S6-SOURCE", "S6-ANSWER"].includes(rule)) throw new Error("Source historique illisible.");
          });
          precedent.set(id, { objet, signature: ancien.signature });
        }
        historique.push(precedent);
      }
    } catch { historique = null; signaler({ location: "experiences/objets" }, "S6-HISTORY", "Historique complet des objets et sources requis."); }
    verifierIntegriteExperiences(entrees, cibles, historique, signaler);
  }
  const champs = ["location", "rule", "severity", "message"];
  const uniques = [...new Map(issues.map(i => [JSON.stringify(i), i])).values()];
  uniques.sort((a, b) => {
    for (const c of champs) if (a[c] !== b[c]) return a[c] < b[c] ? -1 : 1;
    return 0;
  });
  const errors = uniques.filter(i => i.severity === "ERROR").length;
  const warnings = uniques.length - errors;
  return { specificationVersion: "1.0.0", verdict: errors ? "ERROR" : warnings ? "WARNING" : "PASS", errors, warnings, objects: entrees.length, issues: uniques };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(a => a !== "--json")) {
    console.error("Usage : npm run check:experiences -- [--json]");
    process.exitCode = 2;
  } else {
    const r = await verifierExperiences();
    console.log(args.includes("--json") ? JSON.stringify(r, null, 2) : r.verdict + " (" + r.errors + " erreurs, " + r.warnings + " avertissements, " + r.objects + " objets)\n" +
      r.issues.map(i => i.severity + " " + i.rule + " " + i.location + " — " + i.message).join("\n"));
    process.exitCode = r.errors ? 1 : 0;
  }
}
