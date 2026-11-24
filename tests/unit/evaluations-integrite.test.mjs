import { test } from "node:test";
import assert from "node:assert/strict";
import { copieEvaluation, contexteDefinitions } from "../evaluation-fixtures.mjs";
import { verifierIntegriteEvaluations, verifierHistoriqueEvaluations } from "../../scripts/lib/evaluations-integrite.mjs";
import { verifierCouverture } from "../preuves-referentiel.mjs";
const couverture = verifierCouverture("tests/unit/evaluations-integrite.test.mjs");

async function verifier(b, modifier = () => {}, cas) {
  const contexte = contexteDefinitions(b), issues = [];
  modifier(contexte);
  const e = { objet: b.definition, location: "evaluations/objets/demo.json" };
  await verifierIntegriteEvaluations([e], contexte, (_e, rule, message, severity = "ERROR") => issues.push({ rule, message, severity }));
  if (cas) couverture(issues, cas);
  return { issues, e };
}
const erreur = (r, id) => r.issues.some(i => i.rule === id && i.severity === "ERROR");

test("S7-02 : définition et unité exactement liées ; aucune substitution de version courante", async t => {
  const b = copieEvaluation();
  const valide = await verifier(b);
  assert.equal(valide.issues.some(i => i.severity === "ERROR"), false);
  assert.match(valide.e.signature, /^[a-f0-9]{64}$/);
  assert.ok(valide.issues.some(i => i.rule === "S7-15-REVIEW"));
  b.definition.experience.version = 2;
  assert.ok(erreur(await verifier(b, undefined, t.name), "S7-02"));
  const autre = copieEvaluation(); autre.definition.criteria[0].unit.id = "experience.maths.autre";
  assert.ok(erreur(await verifier(autre), "S7-02"));
});

test("S7-03 : cible exacte de MicroSkill ; Notion, cible implicite, périmée ou répétée refusées", async t => {
  for (const modifier of [
    b => { b.targets[0].type = "notion"; }, b => { b.targets[0].version = 2; },
    b => { b.targets[0].status = "deprecated"; }, b => { b.experience.targets = []; },
    b => { b.definition.criteria[0].bindings.push(structuredClone(b.definition.criteria[0].bindings[0])); }
  ]) { const b = copieEvaluation(); modifier(b); assert.ok(erreur(await verifier(b, undefined, t.name), "S7-03")); }
});

test("S7-04 : Skill directe justifiée et contribution qualifiée, sans poids ou score propagé", async t => {
  const b = copieEvaluation();
  const skill = { target: { id: "skill.maths.calcul", version: 1 }, relation: "direct" };
  b.definition.criteria[0].bindings = [skill];
  assert.ok(erreur(await verifier(b, undefined, t.name), "S7-04"));
  skill.justification = "Critère synthétique dédié au raisonnement global.";
  assert.equal(erreur(await verifier(b), "S7-04"), false);
  const c = copieEvaluation();
  c.definition.criteria[0].bindings.push({ ...skill, relation: "contributive", via: { id: "relation.maths.calcul-vers-skill", version: 1 } });
  assert.ok(erreur(await verifier(c), "S7-04"));
  const conforme = await verifier(c, ctx => ctx.relations.push({ id: "relation.maths.calcul-vers-skill", version: 1, type: "contributesTo", source: "microskill.maths.calculer", target: "skill.maths.calcul", status: "review" }));
  assert.equal(erreur(conforme, "S7-04"), false);
  assert.equal(conforme.e.objet.criteria[0].scoring, undefined);
});

test("S7-08 : méthode versionnée et format de tâche compatibles", async () => {
  for (const modifier of [
    b => { b.definition.criteria[0].method.version = 2; },
    b => { b.experience.task.format = "action"; },
    b => { b.definition.criteria[0].observationKinds = ["completion"]; }
  ]) { const b = copieEvaluation(); modifier(b); assert.ok(erreur(await verifier(b), "S7-08")); }
});

test("S7-10 : score uniquement dans une échelle déclarée, sans formule ou pondération implicite", async () => {
  const b = copieEvaluation();
  b.definition.criteria[0].scoring = { kind: "outcome-values", min: 0, max: 2, rounding: "none", thresholds: [], values: { success: 2, failure: 0, partial: 1 } };
  assert.equal(erreur(await verifier(b), "S7-10"), false);
  b.definition.criteria[0].scoring.values.success = 3;
  assert.ok(erreur(await verifier(b), "S7-10"));
});

test("S7-13 : feedback facultatif absent permis ; références fournies et remédiation vérifiées", async t => {
  const b = copieEvaluation();
  assert.equal(erreur(await verifier(b), "S7-13"), false);
  b.definition.criteria[0].feedback = { source: b.experience.task.prompt, required: false };
  assert.ok(erreur(await verifier(b, ctx => { ctx.lecteur.source = async () => { throw new Error("absent"); }; }, t.name), "S7-13"));
  b.definition.criteria[0].remediation = { id: "experience.maths.absente", version: 1 };
  assert.ok(erreur(await verifier(b), "S7-13"));
});

test("S7-15 : revue de la version exacte et référence documentaire exigées avant validated", async t => {
  const b = copieEvaluation(); b.definition.status = "validated"; b.experience.status = "validated";
  assert.ok(erreur(await verifier(b, undefined, t.name), "S7-15"));
  b.definition.review = { source: b.definition.provenance[0], day: "2026-02-30", version: 1 };
  assert.ok(erreur(await verifier(b), "S7-15"));
  b.definition.review.day = "2026-11-24";
  assert.equal(erreur(await verifier(b), "S7-15"), false);
  assert.ok(erreur(await verifier(b, ctx => { ctx.lecteur.document = async () => { throw new Error(); }; }), "S7-15"));
});

test("S7-15 : définition et source évoluent par révision ; histoire et identité conservées", () => {
  const b = copieEvaluation();
  const e = { objet: b.definition, location: "demo", signature: "a" };
  const historique = [new Map([[b.definition.id, structuredClone(e)]])];
  const verifier = (entrees, etats = historique) => {
    const issues = []; verifierHistoriqueEvaluations(entrees, etats, (_e, rule) => issues.push(rule)); return issues;
  };
  assert.deepEqual(verifier([e]), []);
  assert.ok(verifier([{ ...e, signature: "b" }]).includes("S7-15"));
  const suivant = structuredClone(e); suivant.objet.version = 2; suivant.signature = "b";
  assert.deepEqual(verifier([suivant]), []);
  assert.ok(verifier([suivant], [...historique, new Map()]).includes("S7-15"));
  const interdit = structuredClone(e); interdit.objet.status = "validated"; interdit.objet.version = 2;
  assert.ok(verifier([interdit]).includes("S7-01"));
  assert.ok(verifier([interdit], []).includes("S7-01"));
});

test("S7-15 : seule la section documentaire référencée participe à l'empreinte de la définition", async () => {
  const b = copieEvaluation();
  const calculer = texte => verifier(b, ctx => { ctx.lecteur.document = async () => texte; });
  const a = await calculer("# fixture\nRègle de référence.\n# Autre\nHors périmètre.\n");
  const autre = await calculer("# fixture\nRègle de référence.\n# Autre\nMise à jour distincte.\n");
  assert.equal(a.e.signature, autre.e.signature);
  const change = await calculer("# fixture\nRègle modifiée.\n# Autre\nHors périmètre.\n");
  assert.notEqual(a.e.signature, change.e.signature);
});

test("S7-08 : mode humain ou assisté exige des critères préparés réellement définis", async () => {
  const b = copieEvaluation(); b.definition.criteria[0].method = { id: "human-review", version: 1, mode: "human" };
  assert.ok(erreur(await verifier(b), "S7-08"));
  b.definition.criteria[0].rubric = b.experience.task.expected;
  assert.equal(erreur(await verifier(b), "S7-08"), false);
  assert.ok(erreur(await verifier(b, ctx => { ctx.lecteur.source = async () => ({ type: "qcm" }); }), "S7-08"));
});
