import { test } from "node:test";
import assert from "node:assert/strict";
import { copieEvaluation, contexteJournal, journalDe, idOccurrence, schemasEvaluation } from "../evaluation-fixtures.mjs";
import { ajouterEvenementEvaluation, verifierSemantiqueJournal, evaluerCritereSoumis } from "../../web/evaluation-journal.js";
import { verifierCouverture } from "../preuves-referentiel.mjs";
const couverture = verifierCouverture("tests/unit/evaluations-journal.test.mjs");

function verifier(b, journal = journalDe(b), options, cas) {
  const issues = verifierSemantiqueJournal(journal, contexteJournal(b, options));
  if (cas) couverture(issues, cas);
  return issues;
}
const regle = (issues, rule) => issues.some(i => i.rule === rule && i.severity === "ERROR");
const humaine = (b, extra = {}) => ({ ...b.decision, id: idOccurrence("decision", 2), sequence: 4,
  state: "revised", outcome: "failure", supersedes: b.decision.id, producer: "human", actorRef: "reviewer.synthese",
  reviewMethod: { id: "human-review", version: 1, mode: "human" }, reason: "revision", replayability: "human-judgment", ...extra });

test("S7-05 : journal synthétique rattaché et ordonné ; observation orpheline, séquence et jour invalides refusés", t => {
  assert.deepEqual(verifier(copieEvaluation()), []);
  for (const modifier of [
    b => { b.observation.attemptId = idOccurrence("attempt", 9); }, b => { b.observation.sequence = 2; },
    b => { b.observation.day = "2026-02-30"; }, b => { b.submission.observations = [idOccurrence("observation", 8)]; },
    b => { b.observation.criterionId = "absent"; }
  ]) { const b = copieEvaluation(); modifier(b); assert.ok(regle(verifier(b, undefined, undefined, t.name), "S7-05")); }
});

test("S7-06 : retry identique idempotent, ID divergent refusé, journal source immuable", () => {
  const b = copieEvaluation(), contexte = contexteJournal(b);
  const initial = { formatVersion: 1, attempt: b.attempt, events: [] };
  const a = ajouterEvenementEvaluation(initial, b.observation, contexte);
  assert.equal(initial.events.length, 0);
  const s = ajouterEvenementEvaluation(a.journal, b.submission, contexte);
  const bis = ajouterEvenementEvaluation(s.journal, b.submission, contexte);
  assert.equal(bis.duplicate, true); assert.deepEqual(bis.journal, s.journal);
  assert.throws(() => ajouterEvenementEvaluation(s.journal, { ...b.submission, day: "2026-11-25" }, contexte), /conflit/);
  assert.throws(() => ajouterEvenementEvaluation(initial, { ...b.observation, studentAnswer: "secret" }, contexte), /schéma/);
  assert.throws(() => ajouterEvenementEvaluation(initial, b.observation, {}), /structurel/);
});

test("S7-06 : clôture interdit nouvelle activité mais permet une correction humaine différée", t => {
  const b = copieEvaluation(), j = journalDe(b);
  j.events.push({ recordType: "closure", id: idOccurrence("closure", 1), sequence: 4,
    attemptId: b.attempt.id, day: "2026-11-24", reason: "completed" });
  const suivant = ajouterEvenementEvaluation(j, humaine(b, { sequence: 5 }), contexteJournal(b));
  assert.equal(suivant.journal.events.length, 5);
  assert.deepEqual(suivant.journal.events[2], b.decision);
  assert.throws(() => ajouterEvenementEvaluation(j, { ...b.observation, id: idOccurrence("observation", 2), sequence: 5 }, contexteJournal(b)), e => {
    couverture(e.issues, t.name); return regle(e.issues, "S7-06");
  });
});

test("S7-07 : vide, absence et partiel ne produisent aucun zéro implicite ; politique de soumission explicite", t => {
  for (const responseState of ["empty", "absent", "partial"]) {
    const b = copieEvaluation(); b.observation.responseState = responseState;
    b.decision.outcome = responseState === "partial" ? "partial" : "absent";
    b.decision.reason = responseState === "partial" ? "partial-response" : "missing-response";
    const options = { replaySynthetic: () => ({ outcome: b.decision.outcome, reason: b.decision.reason, diagnostic: b.decision.diagnostic }) };
    assert.equal(verifier(b, journalDe(b), options).some(i => i.severity === "ERROR"), false, responseState);
    assert.equal(b.decision.score, undefined);
    b.definition.submissionPolicy.allowPartial = false;
    assert.ok(regle(verifier(b, journalDe(b), options, t.name), "S7-07"));
  }
});

test("S7-08 : résultat synthétique rejoué sous même méthode ; divergence et mauvaise version détectées", t => {
  const b = copieEvaluation();
  assert.ok(regle(verifier(b, journalDe(b), { replaySynthetic: () => ({ outcome: "failure", diagnostic: b.decision.diagnostic }) }, t.name), "S7-08"));
  b.decision.method.version = 2;
  assert.ok(regle(verifier(b), "S7-08"));
});

test("S7-09 : proposition assistée puis confirmation humaine habilitée ; aucune auto-confirmation", t => {
  const b = copieEvaluation();
  const methode = { id: "assisted-review", version: 1, mode: "assisted" };
  b.definition.criteria[0].method = methode; b.decision.method = methode;
  b.definition.criteria[0].rubric = b.experience.task.expected;
  Object.assign(b.decision, { state: "proposed", outcome: "indeterminate", reason: "awaiting-confirmation", replayability: "input-not-retained" });
  const j = journalDe(b);
  assert.equal(verifier(b).some(i => i.severity === "ERROR"), false);
  const confirmation = humaine(b, { state: "confirmed", outcome: "success", reason: "manual-review" });
  j.events.push(confirmation);
  assert.equal(verifier(b, j).some(i => i.severity === "ERROR"), false);
  confirmation.actorRef = "reviewer.inconnu";
  assert.ok(regle(verifier(b, j, undefined, t.name), "S7-09"));
  confirmation.actorRef = "reviewer.synthese"; confirmation.producer = "local-evaluator";
  assert.ok(regle(verifier(b, j), "S7-09"));
});

test("S7-09 : une origine cliente ne devient pas une correction certifiée par transport", () => {
  const b = copieEvaluation(); b.observation.origin = "client-assertion";
  assert.ok(regle(verifier(b), "S7-09"));
  b.decision.producer = "client-assertion";
  assert.ok(regle(verifier(b), "S7-09"));
});

test("S7-10 : résultat quantifié seulement selon les valeurs explicites du barème", t => {
  const b = copieEvaluation(); b.decision.score = 1;
  assert.ok(regle(verifier(b, undefined, undefined, t.name), "S7-10"));
  b.definition.criteria[0].scoring = { kind: "outcome-values", min: 0, max: 2, rounding: "none", thresholds: [], values: { success: 2, failure: 0 } };
  b.decision.score = 2;
  assert.equal(regle(verifier(b), "S7-10"), false);
  b.decision.score = 1;
  assert.ok(regle(verifier(b), "S7-10"));
});

test("S7-12 : diagnostic et résultat citent des preuves du même critère ; ambiguïté visible", t => {
  const b = copieEvaluation(); b.decision.evidence = [];
  assert.ok(regle(verifier(b, undefined, undefined, t.name), "S7-12"));
  const c = copieEvaluation(); c.decision.diagnostic = { state: "matched", matches: [] };
  assert.ok(regle(verifier(c), "S7-12"));
});

test("S7-14 : correction et invalidation sont ajoutées, liées et sans conflit ; ancien résultat intact", t => {
  const b = copieEvaluation(), j = journalDe(b), avant = structuredClone(j);
  j.events.push(humaine(b));
  assert.equal(verifier(b, j).some(i => i.severity === "ERROR"), false);
  assert.deepEqual(j.events.slice(0, 3), avant.events);
  const concurrente = humaine(b, { id: idOccurrence("decision", 3), sequence: 5 });
  j.events.push(concurrente);
  assert.ok(regle(verifier(b, j, undefined, t.name), "S7-14"));
  concurrente.supersedes = j.events[3].id;
  Object.assign(concurrente, { state: "invalidated", reason: "invalidation", outcome: "indeterminate" });
  assert.equal(verifier(b, j).some(i => i.severity === "ERROR"), false);
  concurrente.score = 0;
  assert.ok(regle(verifier(b, j), "S7-14"));
});

test("S7-15 : une nouvelle définition ne remplace pas silencieusement celle de la tentative", () => {
  const b = copieEvaluation(); b.definition.version = 2;
  assert.ok(regle(verifier(b), "S7-02"));
});

test("S7-16 : réponse brute et identité restent hors du schéma persistant", () => {
  const b = copieEvaluation(), j = journalDe(b);
  for (const key of ["studentAnswer", "answer", "learnerId", "accountId", "timestamp"]) {
    const c = structuredClone(j); c.events[0][key] = "donnée interdite";
    assert.equal(schemasEvaluation.get("journal")(c), false, key);
  }
});

test("S7-17 : entrée non conservée déclarée non rejouable ; affirmation de rejeu sans fixture refusée", t => {
  const b = copieEvaluation();
  assert.ok(regle(verifier(b, journalDe(b), { replaySynthetic: null }, t.name), "S7-17"));
  b.attempt.origin = "local-session"; b.decision.replayability = "input-not-retained";
  const issues = verifier(b, undefined, undefined, t.name);
  assert.equal(issues.some(i => i.severity === "ERROR"), false);
  assert.ok(issues.some(i => i.rule === "S7-17-LIMIT" && i.severity === "WARNING"));
});

test("S7-08 : la correction de bout en bout consomme la saisie éphémère et ajoute seulement une décision qualifiée", () => {
  const b = copieEvaluation(), j = journalDe(b); j.events.pop();
  const parametres = { id: b.decision.id, day: "2026-11-24", submissionId: b.submission.id, criterionId: "calcul", entree: { responseState: "provided", value: 1 } };
  const r = evaluerCritereSoumis(j, parametres, contexteJournal(b));
  assert.deepEqual(r.journal.events[2], b.decision);
  assert.equal(j.events.length, 2);
  assert.equal(Object.hasOwn(r.journal.events[2], "entree"), false);
  assert.equal(Object.hasOwn(r.journal.events[2], "value"), false);
  const absent = structuredClone(j); absent.events[1].observations = [];
  assert.throws(() => evaluerCritereSoumis(absent, parametres, contexteJournal(b)), /explicitement observée/);
  assert.throws(() => evaluerCritereSoumis(j, { ...parametres, entree: { responseState: "empty" } }, contexteJournal(b)), /correction/);
});
