import { test } from "node:test";
import assert from "node:assert/strict";
import { copieEvaluation, schemasEvaluation, journalDe, idOccurrence } from "../evaluation-fixtures.mjs";

test("S7-01 : les sept contrats acceptent les occurrences synthétiques et refusent les données supplémentaires", () => {
  const b = copieEvaluation();
  const cas = { definition: b.definition, attempt: b.attempt, observation: b.observation, submission: b.submission,
    decision: b.decision, closure: { recordType: "closure", id: idOccurrence("closure", 1), attemptId: b.attempt.id,
      sequence: 4, day: "2026-11-24", reason: "completed" }, journal: journalDe(b) };
  for (const [type, objet] of Object.entries(cas)) {
    const schema = schemasEvaluation.get(type);
    assert.equal(schema(objet), true, type + " : " + JSON.stringify(schema.errors));
    for (const cle of ["studentAnswer", "learnerId", "accountId", "timestamp", "obtainedScore", "unknown"]) {
      assert.equal(schema({ ...objet, [cle]: "donnée interdite" }), false, type + "/" + cle);
    }
  }
  const methode = structuredClone(b.definition);
  methode.criteria[0].method.callback = "code";
  assert.equal(schemasEvaluation.get("definition")(methode), false);
  const cible = structuredClone(b.definition);
  cible.criteria[0].bindings[0].target.weight = 0.5;
  assert.equal(schemasEvaluation.get("definition")(cible), false);
});

test("S7-01 : cardinalités, identités opaques et champs conditionnels sont fermés", () => {
  const b = copieEvaluation();
  const observation = schemasEvaluation.get("observation");
  assert.equal(observation({ ...b.observation, kind: "help", helpRank: 1 }), false, "l'état de réponse n'est pas une aide");
  const aide = { ...b.observation, kind: "help", helpRank: 1 }; delete aide.responseState;
  assert.equal(observation(aide), true);
  assert.equal(observation({ ...aide, helpRank: 0 }), false);
  assert.equal(observation({ ...b.observation, id: "observation.pseudo-personnel" }), false);
  for (const valeur of [0, -1, 1.5, NaN, Infinity]) assert.equal(observation({ ...b.observation, sequence: valeur }), false);
  const d = schemasEvaluation.get("definition");
  for (const criteria of [[], Array.from({ length: 101 }, (_, i) => ({ ...b.definition.criteria[0], id: "c-" + i }))])
    assert.equal(d({ ...b.definition, criteria }), false);
  const decision = schemasEvaluation.get("decision");
  assert.equal(decision({ ...b.decision, actorRef: "reviewer.synthese" }), false);
  assert.equal(decision({ ...b.decision, reviewMethod: { id: "human-review", version: 1, mode: "human" } }), false);
  assert.equal(decision({ ...b.decision, producer: "human", actorRef: "reviewer.synthese" }), false);
});
