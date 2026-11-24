import { readFile, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { canonique } from "./experiences-integrite.mjs";
import { validerExercice } from "./gabarit.mjs";

const executer = promisify(execFile);
const decoder = new TextDecoder("utf-8", { fatal: true });
const texte = v => typeof v === "string" && /\S/.test(v);
const vide = v => v === null || v === undefined || (typeof v === "string" && !texte(v)) ||
  (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).some(c => c !== "experienceId"));
const slug = v => v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9. -]/g, "").trim().replace(/\s+/g, "-");
const champsIndividuels = new Set(["learnerState", "studentAnswer", "learnerId", "userId", "sessionId", "attempts", "obtainedScore", "progression"]);
function declaratif(v, actifs = new Set()) {
  if (["function", "undefined", "symbol", "bigint"].includes(typeof v)) return false;
  if (typeof v === "number") return Number.isFinite(v);
  if (v === null || typeof v !== "object") return true;
  if (actifs.has(v)) return false;
  actifs.add(v);
  const valide = Object.entries(v).every(([cle, valeur]) => !champsIndividuels.has(cle) && declaratif(valeur, actifs));
  actifs.delete(v);
  return valide;
}

export function creerLecteurSources(cwd, revision = null, adaptateurs = {}) {
  const fichiers = new Map();
  const indexes = new Map();
  const racine = resolve(cwd);
  async function lire(path) {
    if (!/^(?:catalogue|Sample\/lab|src\/pedagogy|docs)\/[A-Za-z0-9._/-]+(?![\s\S])/.test(path) || /(^|\/)\.{1,2}(\/|$)|\/\//.test(path)) throw new Error("Chemin source interdit.");
    if (!fichiers.has(path)) fichiers.set(path, (async () => {
      if (revision) {
        if (!/^[a-f0-9]{40,64}(?![\s\S])/.test(revision)) throw new Error("Révision Git invalide.");
        return decoder.decode((await executer("git", ["-c", "core.longpaths=true", "show", revision + ":" + path], { cwd, encoding: "buffer", maxBuffer: 16 * 1024 * 1024 })).stdout);
      }
      const chemin = await realpath(resolve(racine, path));
      const relatif = relative(await realpath(racine), chemin);
      if (isAbsolute(relatif) || relatif === ".." || relatif.startsWith(".." + sep)) throw new Error("Source hors dépôt.");
      return decoder.decode(await readFile(chemin));
    })());
    return fichiers.get(path);
  }
  async function source(ref) {
    const contenu = await lire(ref.path);
    let valeur;
    if (ref.format === "catalogue-json") {
      if (!indexes.has(ref.path)) {
        const index = new Map();
        const pile = [JSON.parse(contenu)];
        while (pile.length) {
          const noeud = pile.pop();
          if (noeud === null || typeof noeud !== "object") continue;
          if (!Array.isArray(noeud) && Object.hasOwn(noeud, "experienceId")) {
            if (typeof noeud.experienceId !== "string" || !/^[a-zA-Z][a-zA-Z0-9._:-]*(?![\s\S])/.test(noeud.experienceId) || index.has(noeud.experienceId)) throw new Error("Ancre source invalide ou dupliquée.");
            index.set(noeud.experienceId, noeud);
          }
          pile.push(...Object.values(noeud));
        }
        indexes.set(ref.path, index);
      }
      valeur = indexes.get(ref.path).get(ref.anchor);
    } else if (adaptateurs[ref.format]) {
      // Adaptateurs internes explicites ; aucun script de la page n’est exécuté ici.
      valeur = await adaptateurs[ref.format](contenu, ref);
    } else throw new Error("Adaptateur de source non livré pour ce format.");
    if (vide(valeur)) throw new Error("Ancre source absente ou vide.");
    if (!declaratif(valeur)) throw new Error("Source non déclarative ou contenant un état individuel.");
    return valeur;
  }
  async function document(ref) {
    const contenu = await lire(ref.path);
    const titres = [...contenu.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => m[1]);
    const correspondances = titres.filter(t => slug(t) === slug(ref.anchor) || t.split(/\s/)[0] === ref.anchor);
    if (correspondances.length !== 1) throw new Error("Section documentaire absente ou ambiguë.");
    return contenu;
  }
  return { source, document, lire };
}

export async function preparerSources(entree, lecteur, signaler) {
  const contenus = [];
  const valeurs = new Map();
  const cle = r => JSON.stringify(canonique(r));
  async function source(ref) {
    if (!valeurs.has(cle(ref))) {
      try { valeurs.set(cle(ref), await lecteur.source(ref)); }
      catch { valeurs.set(cle(ref), null); signaler(entree, "S6-SOURCE", "Source ou ancre absente, illisible, ambiguë, non déclarative ou incompatible."); }
    }
    return valeurs.get(cle(ref));
  }
  function collecter(v) {
    if (v === null || typeof v !== "object") return;
    if (v.path && v.anchor && v.format) contenus.push(v);
    else for (const enfant of Object.values(v)) collecter(enfant);
  }
  collecter(entree.objet);
  for (const ref of contenus) await source(ref);
  const ordonnees = [...valeurs].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  entree.signature = createHash("sha256").update(JSON.stringify(canonique(ordonnees))).digest("hex");
  const o = entree.objet;
  if (o.task) {
    const attendu = await source(o.task.expected);
    const consigne = await source(o.task.prompt);
    if (attendu && consigne) {
      try {
        if (!texte(consigne.question)) throw new Error();
        if (o.task.format === "action") {
          const actions = await source(o.task.actions);
          if (!Array.isArray(actions?.actions) || !actions.actions.length || !actions.actions.every(texte) ||
              !Array.isArray(attendu.successCriteria) || !attendu.successCriteria.length || !attendu.successCriteria.every(texte)) throw new Error();
        } else {
          if (attendu.type !== (o.task.format === "number" ? "nombre" : "qcm")) throw new Error();
          validerExercice({ ...attendu, question: consigne.question }, "expérience");
        }
      } catch { signaler(entree, "S6-ANSWER", "Consigne, réponse, indices ou critères préparés incompatibles avec le format de tâche."); }
    }
  }
  for (const ref of [...o.provenance.references, ...(o.evidence || [])]) {
    try { await lecteur.document(ref); }
    catch { signaler(entree, "S6-PROVENANCE", "Référence documentaire introuvable ou illisible."); }
  }
  if (o.provenance.migration) {
    for (const path of o.provenance.migration.sourcePaths) {
      try { await lecteur.lire(path); }
      catch { signaler(entree, "S6-PROVENANCE", "Source déclarée de migration introuvable."); }
    }
  }
  const r = o.review;
  const date = r ? new Date(r.date + "T00:00:00Z") : null;
  entree.revueValide = Boolean(r && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === r.date && r.version === o.version);
  if (r) {
    try { await lecteur.document(r.source); }
    catch { entree.revueValide = false; signaler(entree, "S6-PROVENANCE", "Source de l’attestation de revue introuvable."); }
  }
  const a = o.accessibility;
  let revueAccess = false;
  if (a?.review) {
    try { await lecteur.document(a.review); revueAccess = true; }
    catch { signaler(entree, "S6-SOURCE", "Revue d’accessibilité référencée introuvable."); }
  }
  const visuelles = new Set(["visual", "audio", "pointer", "motion", "webgl"]);
  entree.accessibiliteValide = Boolean(a && revueAccess && a.modalities.every(modalite => !visuelles.has(modalite) ||
    a.alternatives.some(alt => alt.modality === modalite && valeurs.get(cle(alt.source)) !== null)));
  return entree;
}
