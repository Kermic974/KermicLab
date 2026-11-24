import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { methodeConnue } from "../../web/evaluation-correction-v1.js";
import { jourValide } from "../../web/evaluation-journal.js";
import { validerExercice } from "./gabarit.mjs";
import { extraireSectionDocumentaire } from "./experiences-sources.mjs";

const cle = r => r.id + "@" + r.version;
const actif = o => o && o.status !== "deprecated";
const transitions = new Set(["draft:review", "review:draft", "review:validated", "validated:deprecated"]);
const signe = v => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const canonique = v => Array.isArray(v) ? v.map(canonique) : v !== null && typeof v === "object"
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonique(v[k])])) : v;

/** Contexte explicite : références exactes, sources déjà qualifiées par S6, jamais des données d'élèves. */
export async function verifierIntegriteEvaluations(entrees, contexte, signaler) {
  const index = new Map();
  for (const e of entrees) {
    if (index.has(e.objet.id)) signaler(e, "S7-01", "Identifiant d'évaluation dupliqué.");
    index.set(e.objet.id, e);
  }
  for (const e of entrees) {
    const d = e.objet;
    if (d.replacedBy) {
      const suivant = index.get(d.replacedBy.id)?.objet;
      if (d.replacedBy.id === d.id || !suivant || suivant.version !== d.replacedBy.version || suivant.status === "deprecated")
        signaler(e, "S7-02", "Remplacement d'évaluation absent, auto-référent ou déprécié.");
    }
    const referenceDisponible = o => o && (o.status !== "deprecated" || d.status === "deprecated");
    const actuelleDepreciee = (table, id) => d.status !== "deprecated" && table?.get(id)?.status === "deprecated";
    const exp = contexte.experiences.get(cle(d.experience));
    if (!referenceDisponible(exp) || actuelleDepreciee(contexte.currentExperiences, d.experience.id)) signaler(e, "S7-02", "Expérience ou révision exacte absente ou dépréciée.");
    if (d.status === "validated" && exp?.status !== "validated" &&
        !(exp?.status === "review" && contexte.disponibles?.has(cle(d.experience))))
      signaler(e, "S7-02", "Évaluation validée liée à une expérience non autorisée pour publication.");
    const accessibles = new Set();
    const pile = exp ? [exp] : [];
    while (pile.length) {
      const o = pile.pop();
      if (accessibles.has(cle(o))) continue;
      accessibles.add(cle(o));
      for (const r of o.components || []) {
        const enfant = contexte.experiences.get(cle(r));
        if (!referenceDisponible(enfant)) signaler(e, "S7-02", "Composant d'expérience absent ou déprécié.");
        else pile.push(enfant);
      }
    }
    const ids = new Set();
    const empreintes = [];
    for (const c of d.criteria) {
      if (ids.has(c.id)) signaler(e, "S7-01", "Critère répété.");
      ids.add(c.id);
      const unite = contexte.experiences.get(cle(c.unit));
      if (!referenceDisponible(unite) || actuelleDepreciee(contexte.currentExperiences, c.unit.id) || !accessibles.has(cle(c.unit))) signaler(e, "S7-02", "Unité évaluée hors de l'expérience et de sa composition exacte.");
      const m = methodeConnue(c.method);
      const methodeRegistree = contexte.registre?.get(c.method.id + "@" + c.method.version);
      if (contexte.registre && (!methodeRegistree || (methodeRegistree.status !== "supported" && d.status !== "deprecated"))) signaler(e, "S7-08", "Méthode absente ou dépréciée pour cette nouvelle définition.");
      if (methodeRegistree) empreintes.push([c.id, "method", methodeRegistree.sha256]);
      if (!m || (m.mode === "deterministic" && (unite?.type !== "exercise" || unite.task?.format !== m.format || !c.observationKinds.includes("answer"))))
        signaler(e, "S7-08", "Méthode inconnue ou incompatible avec la tâche et ses observations.");
      if (c.method.mode !== "deterministic" || c.rubric) {
        const declarees = [...(unite?.task?.expected ? [unite.task.expected] : []), ...(unite?.successCriteria || [])];
        if (!c.rubric || !declarees.some(r => isDeepStrictEqual(r, c.rubric))) signaler(e, "S7-08", "Critères humains/assistés sans référence aux règles préparées de l'unité.");
        else {
          try {
            const v = await contexte.lecteur.source(c.rubric);
            if (["qcm", "nombre"].includes(v?.type)) validerExercice(v, "critères S7");
            else if (!(Array.isArray(v?.successCriteria) && v.successCriteria.length && v.successCriteria.every(x => typeof x === "string" && x.trim()))) throw new Error("Critères non définis.");
            empreintes.push([c.id, "rubric", v]);
          } catch { signaler(e, "S7-08", "Règles d'examen préparées absentes, illisibles ou insuffisantes."); }
        }
      }
      const vus = new Set();
      for (const b of c.bindings) {
        const cible = contexte.cibles.get(cle(b.target));
        if (vus.has(b.target.id)) signaler(e, "S7-03", "Cible répétée ou ambiguë dans le critère.");
        vus.add(b.target.id);
        if (!referenceDisponible(cible) || actuelleDepreciee(contexte.currentTargets, b.target.id) || !["microskill", "skill"].includes(cible.type) || !unite?.targets.includes(b.target.id) || !exp?.targets.includes(b.target.id))
          signaler(e, "S7-03", "Cible évaluée inconnue, périmée, contextuelle ou non visée explicitement.");
        if (cible?.type === "skill" && b.relation === "direct" && !b.justification?.trim()) signaler(e, "S7-04", "Évaluation directe de Skill sans justification.");
        if (b.relation === "contributive") {
          const directes = c.bindings.filter(v => v.relation === "direct" && contexte.cibles.get(cle(v.target))?.type === "microskill");
          if (cible?.type !== "skill" || !b.via || actuelleDepreciee(contexte.currentTargets, b.via.id) ||
              !directes.some(v => contexte.relations.some(r => r.id === b.via.id && r.version === b.via.version && r.type === "contributesTo" && r.source === v.target.id && r.target === b.target.id && referenceDisponible(r))))
            signaler(e, "S7-04", "Contribution indirecte sans MicroSkill directe ni relation canonique explicite.");
        }
      }
      for (const r of c.contextTargets || []) {
        const cible = contexte.cibles.get(cle(r));
        if (!referenceDisponible(cible) || actuelleDepreciee(contexte.currentTargets, r.id) || !["notion", "microskill", "skill"].includes(cible.type) || vus.has(r.id) || !exp?.targets.includes(r.id))
          signaler(e, "S7-03", "Cible de contexte absente, ambiguë ou hors expérience.");
        vus.add(r.id);
      }
      const s = c.scoring;
      if (s) {
        if (s.min >= s.max || s.thresholds.some(t => t.value < s.min || t.value > s.max) || new Set(s.thresholds.map(t => t.id)).size !== s.thresholds.length ||
            (s.kind === "outcome-values" && Object.values(s.values).some(v => v < s.min || v > s.max)) ||
            (s.kind === "human" && c.method.mode === "deterministic")) signaler(e, "S7-10", "Barème, échelle, seuils ou mode de score incohérents.");
      }
      if (bContributionSeulement(c)) signaler(e, "S7-04", "Un critère doit évaluer au moins une cible directe ; une contribution n'est pas une évaluation autonome.");
      if (c.feedback) {
        try { empreintes.push([c.id, "feedback", await contexte.lecteur.source(c.feedback.source)]); }
        catch { signaler(e, "S7-13", "Feedback référencé absent ou illisible, même s'il est facultatif."); }
      }
      if (c.remediation && (!actif(contexte.experiences.get(cle(c.remediation))) ||
          (contexte.disponibles && !contexte.disponibles.has(cle(c.remediation))))) signaler(e, "S7-13", "Ressource de remédiation absente ou non disponible.");
      const signature = contexte.signatures?.get(cle(c.unit));
      if (signature) empreintes.push([c.id, "unit", signature]);
    }
    for (const r of [...d.provenance, ...(d.review ? [d.review.source] : [])]) {
      try { empreintes.push(["document", r, extraireSectionDocumentaire(await contexte.lecteur.document(r), r.anchor)]); }
      catch { signaler(e, "S7-15", "Référence de provenance ou de revue absente ou ambiguë."); }
    }
    if (d.review && (!jourValide(d.review.day) || d.review.version !== d.version)) signaler(e, "S7-15", "Revue sans jour ou version exacte.");
    if (!d.review) signaler(e, d.status === "validated" ? "S7-15" : "S7-15-REVIEW", "Revue humaine à documenter pour cette version.", d.status === "validated" ? "ERROR" : "WARNING");
    e.signature = signe(canonique(empreintes));
  }
}

const bContributionSeulement = c => !c.bindings.some(b => b.relation === "direct");

/** Histoire des définitions seulement : aucun journal apprenant n'est lu ou versionné dans Git. */
export function verifierHistoriqueEvaluations(entrees, historique, signaler) {
  const courant = new Map(entrees.map(e => [e.objet.id, e]));
  const vus = new Map(), supprimes = new Set();
  let precedent = new Map();
  for (const etat of [...historique, courant]) {
    for (const id of precedent.keys()) if (!etat.has(id)) supprimes.add(id);
    for (const [id, valeur] of etat) {
      const e = valeur.objet ? valeur : { objet: valeur, location: "evaluations/objets#" + id };
      const o = e.objet;
      const ancien = vus.get(id);
      const lieu = courant.get(id) || e;
      if (supprimes.has(id) || (ancien && ancien.objet.type !== o.type)) signaler(lieu, "S7-15", "Identité d'évaluation réutilisée après retrait ou changement de type.");
      if (!ancien && o.status !== "draft") signaler(lieu, "S7-01", "Une nouvelle évaluation commence en draft, sans dérogation implicite S6.");
      if (ancien) {
        if (o.status !== ancien.objet.status && !transitions.has(ancien.objet.status + ":" + o.status)) signaler(lieu, "S7-01", "Transition de cycle documentaire interdite.");
        const change = !isDeepStrictEqual(o, ancien.objet) || e.signature !== ancien.signature;
        if (o.version < ancien.objet.version || (change && o.version <= ancien.objet.version)) signaler(lieu, "S7-15", "Modification de définition ou source sans version supérieure.");
      }
      vus.set(id, e);
    }
    precedent = etat;
  }
}
