import { methodeConnue, scoreDeclare, corrigerCritere, motifsPrepares } from "./evaluation-correction-v1.js";

export const referenceEgale = (a, b) => Boolean(a && b && a.id === b.id && a.version === b.version);
export function jourValide(jour) {
  if (typeof jour !== "string" || !/^\d{4}-\d{2}-\d{2}(?![\s\S])/.test(jour)) return false;
  const d = new Date(jour + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === jour;
}
const canonique = v => Array.isArray(v) ? v.map(canonique) : v !== null && typeof v === "object"
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonique(v[k])])) : v;
export const memeContenu = (a, b) => JSON.stringify(canonique(a)) === JSON.stringify(canonique(b));

/** Couche sémantique seulement. Le gestionnaire ci-dessous impose d'abord le schéma fermé. */
export function verifierSemantiqueJournal(journal, contexte) {
  const issues = [];
  const signaler = (rule, message, id = "attempt", severity = "ERROR") => issues.push({ rule, severity, message, location: id });
  const tentative = journal.attempt;
  const definition = contexte.resolveDefinition(tentative.definition);
  if (!definition || !referenceEgale(definition, tentative.definition) || !referenceEgale(definition.experience, tentative.experience) ||
      !contexte.resolveExperience(tentative.experience)) {
    signaler("S7-02", "Définition ou expérience exacte introuvable."); return issues;
  }
  if (!jourValide(tentative.openedOn)) signaler("S7-05", "Jour de création invalide.");
  const observations = new Map(), soumissions = new Map(), decisions = new Map(), dernieres = new Map();
  const ids = new Set([tentative.id]), reponsesUtilisees = new Set();
  const criteres = new Map(definition.criteria.map(c => [c.id, c]));
  let ferme = false;
  for (const [rang, e] of journal.events.entries()) {
    if (ids.has(e.id)) signaler("S7-05", "Identifiant d'occurrence répété.", e.id);
    ids.add(e.id);
    if (e.attemptId !== tentative.id || e.sequence !== rang + 1 || !jourValide(e.day) || e.day < tentative.openedOn)
      signaler("S7-05", "Rattachement, ordre ou jour incohérent.", e.id);
    if (ferme && e.recordType !== "decision") signaler("S7-06", "Tentative close : nouvelle activité refusée.", e.id);
    if (e.recordType === "observation") {
      const c = criteres.get(e.criterionId);
      if (!c || !c.observationKinds.includes(e.kind)) signaler("S7-05", "Observation ou critère non déclaré.", e.id);
      observations.set(e.id, e);
    } else if (e.recordType === "submission") {
      if (soumissions.size >= definition.submissionPolicy.maxSubmissions) signaler("S7-06", "Nombre de soumissions autorisé dépassé.", e.id);
      let precedent = 0;
      const parCritere = new Map();
      for (const id of e.observations) {
        const o = observations.get(id);
        if (!o || o.sequence >= e.sequence || o.sequence <= precedent) { signaler("S7-05", "Observation source absente ou ordre incohérent.", e.id); continue; }
        precedent = o.sequence;
        const liste = parCritere.get(o.criterionId) || [];
        liste.push(o); parCritere.set(o.criterionId, liste);
        if (o.kind === "answer") {
          if (reponsesUtilisees.has(id)) signaler("S7-06", "Une réponse déjà soumise ne crée pas une nouvelle occurrence.", e.id);
          reponsesUtilisees.add(id);
        }
      }
      for (const c of criteres.values()) {
        const obs = parCritere.get(c.id) || [];
        const reponses = obs.filter(o => o.kind === "answer");
        if (reponses.length > 1) signaler("S7-05", "Plusieurs réponses pour le même critère dans une soumission.", e.id);
        const complet = obs.some(o => (o.kind === "answer" && o.responseState === "provided") || o.kind === "completion");
        if (!complet && !definition.submissionPolicy.allowPartial) signaler("S7-07", "Soumission partielle non autorisée, sans échec ni zéro implicite.", e.id);
      }
      soumissions.set(e.id, e);
    } else if (e.recordType === "closure") {
      if (e.reason === "completed" && !soumissions.size) signaler("S7-06", "Clôture complète sans soumission.", e.id);
      ferme = true;
    } else if (e.recordType === "decision") {
      const modele = contexte.resolveDefinition(e.definition);
      const c = modele?.criteria.find(v => v.id === e.criterionId);
      const s = soumissions.get(e.submissionId);
      const precedent = e.supersedes ? decisions.get(e.supersedes) : null;
      const cle = e.submissionId + ":" + e.criterionId;
      const derniere = dernieres.get(cle);
      if (!s || !c || !referenceEgale(modele, e.definition) || !referenceEgale(e.experience, tentative.experience) ||
          !referenceEgale(modele?.experience, e.experience) || modele.id !== definition.id ||
          (!referenceEgale(e.definition, tentative.definition) && e.state !== "revised" &&
            !(e.state === "invalidated" && referenceEgale(e.definition, precedent?.definition)))) {
        signaler("S7-02", "Décision sans soumission, critère ou révision explicite compatible.", e.id);
      }
      if (!c || !s) continue;
      if (!memeContenu(c.method, e.method) || !methodeConnue(e.method)) signaler("S7-08", "Méthode de décision incompatible.", e.id);
      const preuves = e.evidence.map(id => observations.get(id));
      if (preuves.some(o => !o || !s.observations.includes(o.id) || o.criterionId !== c.id))
        signaler("S7-12", "Preuve de diagnostic absente ou étrangère au critère.", e.id);
      const prouvable = preuves.some(o => o && ((o.kind === "answer" && ["provided", "partial"].includes(o.responseState)) ||
        (o.kind === "completion" && e.method.mode !== "deterministic")));
      if (["success", "failure", "partial"].includes(e.outcome) && !prouvable) signaler("S7-12", "Conclusion sans preuve exploitable.", e.id);
      if (e.producer === "human") {
        let autorise = false;
        try { autorise = contexte.authorizeReviewer?.(e.actorRef, { definition: modele, criterionId: c.id, state: e.state,
          day: e.day, decisionId: e.id, sequence: e.sequence }) === true; } catch { /* Refus explicite si l'autorité ne peut être vérifiée. */ }
        if (!autorise)
          signaler("S7-09", "Auteur de revue non habilité pour cette décision.", e.id);
        if (e.reviewMethod?.id !== "human-review" || e.reviewMethod.version !== 1 || e.reviewMethod.mode !== "human")
          signaler("S7-09", "Méthode de revue humaine explicite requise.", e.id);
      } else if (e.reviewMethod) signaler("S7-09", "Méthode humaine déclarée par un producteur non humain.", e.id);
      if (e.producer === "client-assertion" && e.state !== "proposed") signaler("S7-09", "Une affirmation cliente ne peut être confirmée par elle-même.", e.id);
      if (e.producer === "local-evaluator" && e.state !== "proposed" && e.method.mode !== "deterministic") signaler("S7-09", "Confirmation automatique d'une correction non déterministe.", e.id);
      if (e.producer !== "human" && preuves.some(o => o?.origin !== "local-evaluator") && e.state !== "proposed")
        signaler("S7-09", "Origine des preuves insuffisante pour une confirmation locale.", e.id);
      if (e.method.mode === "human" && e.state !== "proposed" && e.producer !== "human") signaler("S7-09", "Décision humaine non confirmée par un acteur habilité.", e.id);
      if (e.method.mode === "deterministic" && e.producer === "human" && e.state === "confirmed" && !precedent)
        signaler("S7-09", "Une dérogation humaine au correcteur déterministe doit réviser une décision tracée.", e.id);
      if (derniere && (!precedent || derniere.id !== precedent.id)) signaler("S7-14", "Décision concurrente ou prédécesseur non courant.", e.id);
      if (e.supersedes && (!precedent || precedent.submissionId !== e.submissionId || precedent.criterionId !== e.criterionId))
        signaler("S7-14", "Prédécesseur absent ou étranger à la décision.", e.id);
      if (["revised", "invalidated"].includes(e.state) && (!precedent || e.producer !== "human")) signaler("S7-14", "Révision ou invalidation sans décision humaine liée.", e.id);
      if (precedent?.state === "invalidated" || (e.state === "confirmed" && precedent && precedent.state !== "proposed") ||
          (e.state === "proposed" && precedent)) signaler("S7-14", "Transition de décision interdite.", e.id);
      if (e.state === "invalidated" && (e.outcome !== "indeterminate" || e.score !== undefined || e.reason !== "invalidation"))
        signaler("S7-14", "Invalidation ambiguë : ni score ni conclusion active ne sont conservés dans la nouvelle décision.", e.id);
      if (e.state === "revised" && e.reason !== "revision") signaler("S7-14", "Motif de révision explicite requis.", e.id);
      if (e.state !== "invalidated") {
        try {
          const attendu = scoreDeclare(c, e.outcome, e.producer === "human" ? e.score : undefined);
          if (attendu !== e.score || (c.scoring?.kind === "human" && ["success", "failure", "partial"].includes(e.outcome) && e.score === undefined))
            signaler("S7-10", "Score absent ou incompatible avec le barème déclaré.", e.id);
        } catch { signaler("S7-10", "Score hors barème ou non fini.", e.id); }
      }
      const n = e.diagnostic.matches.length;
      if ((e.diagnostic.state === "matched" && n !== 1) || (e.diagnostic.state === "ambiguous" && n < 2) || (e.diagnostic.state === "indeterminate" && n))
        signaler("S7-12", "Qualification du diagnostic incompatible avec ses motifs.", e.id);
      if (n && !prouvable) signaler("S7-12", "Motif sans preuve exploitable.", e.id);
      if (n) {
        let permis;
        try { permis = contexte.knownPatterns?.(c); } catch { /* Source de motif indisponible : aucune affirmation de conformité. */ }
        if (!permis || e.diagnostic.matches.some(id => !permis.has(id))) signaler("S7-12", "Motif non déclaré par les sources préparées de cette révision.", e.id);
      }
      if (e.replayability === "synthetic") {
        if (tentative.origin !== "synthetic" || e.producer !== "local-evaluator" || !contexte.replaySynthetic)
          signaler("S7-17", "Rejeu déclaré sans source synthétique contrôlée.", e.id);
        else {
          let r;
          try { r = contexte.replaySynthetic(e, c); } catch { /* Une panne de rejeu n'est pas un PASS. */ }
          if (!r || r.outcome !== e.outcome || r.reason !== e.reason || !memeContenu(r.diagnostic, e.diagnostic)) signaler("S7-08", "Rejeu synthétique divergent ou entrée absente.", e.id);
        }
      } else {
        if (e.producer === "human" && e.replayability !== "human-judgment") signaler("S7-17", "Limite du jugement humain non déclarée.", e.id);
        signaler("S7-17-LIMIT", "Résultat auditable par provenance, non rejouable depuis ces seules traces.", e.id, "WARNING");
      }
      decisions.set(e.id, e); dernieres.set(cle, e);
    }
  }
  return issues;
}

/** Corrige uniquement une réponse effectivement observée et soumise. L'entrée n'est jamais copiée dans la trace. */
export function evaluerCritereSoumis(journal, { id, day, submissionId, criterionId, entree }, contexte) {
  const definition = contexte.resolveDefinition(journal.attempt.definition);
  const c = definition?.criteria.find(v => v.id === criterionId);
  const soumission = journal.events.find(e => e.recordType === "submission" && e.id === submissionId);
  if (!c || !soumission) throw new Error("S7-02 : soumission ou critère introuvable.");
  const preuves = journal.events.filter(o => o.recordType === "observation" && o.criterionId === c.id && soumission.observations.includes(o.id));
  const reponses = preuves.filter(o => o.kind === "answer");
  const completionHumaine = c.method.mode !== "deterministic" && preuves.some(o => o.kind === "completion");
  if ((!completionHumaine && reponses.length !== 1) || (reponses.length && reponses[0].responseState !== entree?.responseState))
    throw new Error("S7-07 : aucune réponse explicitement observée correspondant à cette correction.");
  if (typeof contexte.prepareDe !== "function") throw new Error("S7-08 : lecteur des règles préparées obligatoire.");
  const prepare = contexte.prepareDe(c.unit);
  const r = corrigerCritere(c, prepare, entree);
  const confirmation = c.method.mode === "deterministic" && preuves.every(o => o.origin === "local-evaluator");
  const decision = { id, recordType: "decision", attemptId: journal.attempt.id, sequence: journal.events.length + 1, day,
    submissionId, criterionId, definition: { id: definition.id, version: definition.version }, experience: structuredClone(journal.attempt.experience),
    method: structuredClone(c.method), state: confirmation ? "confirmed" : "proposed", outcome: r.outcome,
    evidence: preuves.map(o => o.id), diagnostic: r.diagnostic, producer: "local-evaluator", reason: r.reason,
    replayability: journal.attempt.origin === "synthetic" && contexte.replaySynthetic ? "synthetic" : "input-not-retained" };
  const score = scoreDeclare(c, r.outcome);
  if (score !== undefined) decision.score = score;
  const ctx = { ...contexte, knownPatterns: contexte.knownPatterns || (critere => motifsPrepares(contexte.prepareDe(critere.unit))) };
  return ajouterEvenementEvaluation(journal, decision, ctx);
}

/** Aucun effet de bord : retry exact sans ajout ; un ID divergent ou une opération invalide est refusé. */
export function ajouterEvenementEvaluation(journal, evenement, contexte) {
  if (typeof contexte.validateJournal !== "function") throw new Error("Validateur structurel S7 obligatoire.");
  if (!contexte.validateJournal(journal)) throw new Error("S7-01 : journal initial hors schéma.");
  const initial = verifierSemantiqueJournal(journal, contexte);
  if (initial.some(i => i.severity === "ERROR")) throw Object.assign(new Error("Journal initial invalide."), { issues: initial });
  const existant = journal.events.find(e => e.id === evenement?.id);
  if (existant) {
    if (!memeContenu(existant, evenement)) throw new Error("S7-06 : identité d'occurrence en conflit.");
    return { journal: structuredClone(journal), duplicate: true, issues: initial };
  }
  const suivant = structuredClone(journal);
  suivant.events.push(structuredClone(evenement));
  if (!contexte.validateJournal(suivant)) throw new Error("S7-01 : événement ou limite de journal hors schéma.");
  const issues = verifierSemantiqueJournal(suivant, contexte);
  if (issues.some(i => i.severity === "ERROR")) throw Object.assign(new Error("Événement S7 refusé."), { issues });
  return { journal: suivant, duplicate: false, issues };
}
