import { readFile, readdir } from "node:fs/promises";
import { resolve, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chargerSchemasEvaluations } from "./lib/evaluations-structure.mjs";
import { verifierIntegriteEvaluations, verifierHistoriqueEvaluations } from "./lib/evaluations-integrite.mjs";
import { verifierRegistreMethodes } from "./lib/evaluations-methodes.mjs";
import { lireCorpusRevision, lireHistorique } from "./lib/referentiel-historique.mjs";
import { creerLecteurSources, preparerSources } from "./lib/experiences-sources.mjs";
import { verifierExperiences } from "./check-experiences.mjs";

const executer = promisify(execFile), decoder = new TextDecoder("utf-8", { fatal: true });
const cle = r => r.id + "@" + r.version;
async function lireCorpusCourant(cwd, dossier) {
  const sortie = [];
  async function parcourir(rep) {
    let lignes;
    try { lignes = await readdir(rep, { withFileTypes: true }); } catch (e) { if (e.code === "ENOENT") return; throw e; }
    for (const f of lignes.sort((a, b) => a.name.localeCompare(b.name))) {
      const chemin = join(rep, f.name);
      if (f.isDirectory()) await parcourir(chemin);
      else if (f.name.endsWith(".json")) {
        if (!f.isFile()) throw new Error("Objet non régulier.");
        sortie.push({ objet: JSON.parse(decoder.decode(await readFile(chemin))), location: relative(cwd, chemin).split(sep).join("/") });
      }
    }
  }
  await parcourir(resolve(cwd, dossier));
  return sortie;
}

/** Contrôle seulement les DÉFINITIONS publiques ; aucun journal ou état apprenant n'est lu dans le dépôt. */
export async function verifierEvaluations(cwd = process.cwd(), options = {}) {
  const issues = [], entrees = [];
  const signaler = (e, rule, message, severity = "ERROR") => issues.push({ rule, severity, message, location: e.location });
  const schemas = await chargerSchemasEvaluations();
  let registre = new Map();
  try { registre = await verifierRegistreMethodes(cwd, schemas.get("methods"), (r, m) => signaler({ location: "evaluations/methodes.json" }, r, m), options.methodes || {}); }
  catch { signaler({ location: "evaluations/methodes.json" }, "S7-15", "Registre, implémentation ou historique des méthodes illisible."); }
  try {
    for (const e of await lireCorpusCourant(cwd, "evaluations/objets")) {
      if (!schemas.get("definition")(e.objet)) signaler(e, "S7-01", "Contrat de définition S7 non respecté.");
      else entrees.push(e);
    }
  } catch { signaler({ location: "evaluations/objets" }, "S7-01", "Corpus de définitions illisible ou JSON invalide."); }

  if (entrees.length) {
    const r6 = await verifierExperiences(cwd, options.experiences || {});
    if (r6.errors) signaler({ location: "experiences/objets" }, "S7-02", "Sources S6 non conformes ; corriger leur rapport avant évaluation.");
    const contextes = new Map();
    const fichierGit = async (revision, chemin) => decoder.decode((await executer("git", ["show", revision + ":" + chemin], { cwd, encoding: "buffer", maxBuffer: 16 * 1024 * 1024 })).stdout);
    async function contexteDe(revision, definitions) {
      const k = revision || "courant";
      if (contextes.has(k)) return contextes.get(k);
      const charge = async espace => revision ? [...(await lireCorpusRevision(cwd, revision, espace)).values()]
        : (await lireCorpusCourant(cwd, espace)).map(e => e.objet);
      const [s4, s6] = await Promise.all([charge("referentiel/objets"), charge("experiences/objets")]);
      const cibles = new Map(s4.map(o => [cle(o), o])), experiences = new Map(s6.map(o => [cle(o), o]));
      const sourceRevision = new Map(s6.map(o => [cle(o), revision]));
      const necessaires = new Set(definitions.flatMap(d => [d.experience, ...d.criteria.flatMap(c => [c.unit, ...(c.remediation ? [c.remediation] : [])])]).map(cle));
      if ([...necessaires].some(id => !experiences.has(id))) {
        for (const etat of await lireHistorique(cwd, "experiences/objets", revision)) for (const o of etat.values()) {
          if (!experiences.has(cle(o))) { experiences.set(cle(o), o); sourceRevision.set(cle(o), etat.revision); }
        }
      }
      // Les cibles historiques explicitement épinglées restent résolubles, sans remplacement par latest.
      const ciblesRequises = definitions.flatMap(d => d.criteria.flatMap(c => [...c.bindings.flatMap(b => [b.target, ...(b.via ? [b.via] : [])]), ...(c.contextTargets || [])]));
      if (ciblesRequises.some(r => !cibles.has(cle(r)))) {
        for (const etat of await lireHistorique(cwd, "referentiel/objets", revision)) for (const o of etat.values()) if (!cibles.has(cle(o))) cibles.set(cle(o), o);
      }
      const lecteurs = new Map();
      const lecteurDe = rev => {
        const key = rev || "courant";
        if (!lecteurs.has(key)) lecteurs.set(key, creerLecteurSources(cwd, rev));
        return lecteurs.get(key);
      };
      const signatures = new Map(), visites = new Set(), pile = [...necessaires];
      while (pile.length) {
        const id = pile.pop(); if (visites.has(id)) continue; visites.add(id);
        const o = experiences.get(id); if (!o) continue;
        for (const r of o.components || []) pile.push(cle(r));
        const entree = { objet: o, location: "experiences/objets#" + o.id };
        await preparerSources(entree, lecteurDe(sourceRevision.get(id)), (_e, rule) => {
          if (["S6-SOURCE", "S6-ANSWER", "S6-PROVENANCE"].includes(rule)) throw new Error("Source S6 introuvable.");
        });
        signatures.set(id, entree.signature);
      }
      let methodes = registre;
      if (revision) {
        const ancien = JSON.parse(await fichierGit(revision, "evaluations/methodes.json"));
        if (!schemas.get("methods")(ancien)) throw new Error("Registre historique invalide.");
        methodes = new Map(ancien.methods.map(m => [m.id + "@" + m.version, m]));
      }
      const contexte = { cibles, experiences, relations: [...cibles.values()].filter(o => o.type === "contributesTo"), signatures,
        currentTargets: new Map(s4.map(o => [o.id, o])), currentExperiences: new Map(s6.map(o => [o.id, o])), registre: methodes, lecteur: lecteurDe(revision) };
      contextes.set(k, contexte); return contexte;
    }
    try {
      await verifierIntegriteEvaluations(entrees, await contexteDe(null, entrees.map(e => e.objet)), signaler);
      const historique = [];
      for (const etat of await (options.historiqueDe || lireHistorique)(cwd, "evaluations/objets")) {
        const precedents = [];
        for (const o of etat.values()) {
          if (!schemas.get("definition")(o)) throw new Error("Définition historique invalide.");
          precedents.push({ objet: o, location: "evaluations/objets#" + o.id });
        }
        if (precedents.length) await verifierIntegriteEvaluations(precedents, await contexteDe(etat.revision, precedents.map(e => e.objet)),
          (e, rule, message, severity = "ERROR") => { if (severity === "ERROR") signaler(e, rule, "Historique : " + message); });
        historique.push(new Map(precedents.map(e => [e.objet.id, e])));
      }
      verifierHistoriqueEvaluations(entrees, historique, signaler);
    } catch { signaler({ location: "evaluations/objets" }, "S7-15", "Historique complet des définitions, sources et méthodes requis."); }
  }
  const uniques = [...new Map(issues.map(i => [JSON.stringify(i), i])).values()];
  uniques.sort((a, b) => {
    for (const k of ["location", "rule", "severity", "message"]) if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
    return 0;
  });
  const errors = uniques.filter(i => i.severity === "ERROR").length, warnings = uniques.length - errors;
  return { specificationVersion: "1.0.0", verdict: errors ? "ERROR" : warnings ? "WARNING" : "PASS", errors, warnings, objects: entrees.length, issues: uniques };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(a => a !== "--json")) { console.error("Usage : npm run check:evaluations -- [--json]"); process.exitCode = 2; }
  else {
    const r = await verifierEvaluations();
    console.log(args.includes("--json") ? JSON.stringify(r, null, 2) : r.verdict + " (" + r.errors + " erreurs, " + r.warnings + " avertissements, " + r.objects + " définitions)");
    process.exitCode = r.errors ? 1 : 0;
  }
}
