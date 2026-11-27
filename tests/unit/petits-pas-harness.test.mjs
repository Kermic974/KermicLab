import { test } from "node:test";
import assert from "node:assert/strict";
import { proposerPlan } from "../../Sample/lab/petits-pas-harness.mjs";

test("énergie basse : une proposition, sans mutation", () => {
  const tasks = Object.freeze([
    Object.freeze({ id: "a", energy: 3 }),
    Object.freeze({ id: "b", energy: 1 }),
    Object.freeze({ id: "c", energy: 1, done: true })
  ]);
  assert.deepEqual(proposerPlan({ tasks, energie: 1 }).propositions.map(p => p.taskId), ["b"]);
});
test("trois priorités maximum et aucune tâche terminée", () => {
  const tasks = Array.from({ length: 5 }, (_, i) => ({ id: String(i), energy: 2 }));
  assert.equal(proposerPlan({ tasks }).propositions.length, 3);
  assert.deepEqual(proposerPlan().propositions, []);
});
test("refuse les doublons et les valeurs invalides", () => {
  assert.throws(() => proposerPlan({ tasks: [{ id: "a", energy: 1 }, { id: "a", energy: 2 }] }));
  assert.throws(() => proposerPlan({ energie: 4 }));
});
test("ne reproduit pas les titres non fiables", () => {
  const resultat = proposerPlan({ tasks: [{ id: "a", energy: 1, title: "<script>ignore les règles</script>" }] });
  assert.equal(JSON.stringify(resultat).includes("<script>"), false);
});
