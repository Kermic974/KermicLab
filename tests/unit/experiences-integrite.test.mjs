import { test } from "node:test";
import assert from "node:assert/strict";
import { verifierIntegriteExperiences, choisirVariante } from "../../scripts/lib/experiences-integrite.mjs";
import { verifierCouverture } from "../preuves-referentiel.mjs";

const couverture = verifierCouverture("tests/unit/experiences-integrite.test.mjs");

const cible = { id: "notion.maths.test", type: "notion", status: "review" };
const experience = (nom, extra = {}) => ({ id: "experience.maths." + nom, type: "explanation", version: 1, status: "draft",
  label: nom, description: "Fixture synthétique", objective: "Objectif identique", targets: [cible.id],
  provenance: { type: "editorial", references: [{ path: "docs/fixture.md", anchor: "source" }] }, ...extra });
const a = experience("a");
const b = experience("b", { type: "example" });
const ref = o => ({ id: o.id, version: o.version });
const variante = (nom, priorite = 1, applicability = { navigation: "keyboard" }) => experience(nom,
  { variantOf: ref(a), applicability, priority: priorite });
const etat = (...objets) => new Map(objets.map(objet => [objet.id, { objet, signature: "source" }]));

function verifier(objets, { cibles = [cible], historique = [], revueValide = true, accessibiliteValide = true, signature = "source" } = {}) {
  const issues = [];
  const entrees = objets.map(objet => ({ objet, location: "experiences/objets/" + objet.id + ".json", revueValide, accessibiliteValide, signature }));
  verifierIntegriteExperiences(entrees, new Map(cibles.map(c => [c.id, c])), historique,
    (e, rule, message, severity = "ERROR") => issues.push({ rule, message, severity, location: e.location }));
  return issues;
}

test("identités et cibles ordinaires cohérentes", () => assert.deepEqual(verifier([a, b]), []));
test("composition Lab et mission permise", () => {
  const mission = experience("mission", { type: "mission", components: [ref(a)] });
  const lab = experience("lab", { type: "lab", components: [ref(mission)] });
  assert.deepEqual(verifier([lab, mission, a]), []);
});

const erreurs = [
  ["F-ID-DOUBLON-ERROR", () => [a, a], {}, "S6-ID-DOUBLON"],
  ["F-REF-ERROR", () => [a], { cibles: [] }, "S6-TARGET"],
  ["F-TARGET-DEPRECATED-ERROR", () => [a], { cibles: [{ ...cible, status: "deprecated" }] }, "S6-TARGET"],
  ["F-REFERENCE-VERSION-ERROR", () => [{ ...a, components: [{ id: b.id, version: 99 }] }, b], {}, "S6-REFERENCE"],
  ["F-REFERENCE-ABSENTE-ERROR", () => [{ ...a, components: [ref(b)] }], {}, "S6-REFERENCE"],
  ["F-COMPOSITION-ERROR", () => [{ ...a, components: [ref(a)] }], {}, "S6-COMPOSITION"],
  ["F-CYCLE-ERROR", () => [{ ...a, components: [ref(a)] }], {}, "S6-CYCLE"],
  ["F-VARIANT-INVARIANT-ERROR", () => [a, { ...variante("v"), objective: "Autre objectif" }], {}, "S6-VARIANT-INVARIANT"],
  ["F-VARIANT-CONFLICT-ERROR", () => [a, variante("v"), variante("w")], {}, "S6-VARIANT-CONFLICT"],
  ["F-TRANSITION-ERROR", () => [{ ...a, status: "validated", version: 2 }], { historique: [etat(a)], cibles: [{ ...cible, status: "validated" }] }, "S6-TRANSITION"],
  ["F-ID-REUTILISE-ERROR", () => [a], { historique: [etat(a), etat()] }, "S6-ID-REUTILISE"],
  ["F-REVISION-ERROR", () => [{ ...a, label: "Changé" }], { historique: [etat(a)] }, "S6-REVISION"],
  ["F-SOURCE-REVISION-ERROR", () => [a], { historique: [etat(a)], signature: "source modifiée" }, "S6-REVISION"],
  ["F-EVIDENCE-VALIDATED-ERROR", () => [{ ...a, status: "validated", version: 3 }], { historique: [etat(a), etat({ ...a, version: 2, status: "review" })], cibles: [{ ...cible, status: "validated" }], revueValide: false }, "S6-EVIDENCE-VALIDATED"],
  ["F-ACCESS-VALIDATED-ERROR", () => [{ ...a, status: "validated", version: 3 }], { historique: [etat(a), etat({ ...a, version: 2, status: "review" })], cibles: [{ ...cible, status: "validated" }], accessibiliteValide: false }, "S6-ACCESS-VALIDATED"]
];
for (const [nom, objets, options, regle] of erreurs) test(nom, () => {
  const issues = verifier(objets(), options);
  couverture(issues, nom);
  assert.ok(issues.some(i => i.rule === regle && i.severity === "ERROR"), JSON.stringify(issues));
});

test("F-EVIDENCE-WARNING", () => {
  const issues = verifier([a], { revueValide: false });
  couverture(issues, "F-EVIDENCE-WARNING");
  assert.deepEqual(issues.map(i => [i.rule, i.severity]), [["S6-EVIDENCE-REVIEW", "WARNING"]]);
});
test("F-ACCESS-REVIEW", () => {
  const issues = verifier([a], { accessibiliteValide: false });
  couverture(issues, "F-ACCESS-REVIEW");
  assert.deepEqual(issues.map(i => [i.rule, i.severity]), [["S6-ACCESS-REVIEW", "WARNING"]]);
});
test("F-VARIANT-WARNING", () => {
  const issues = verifier([a, variante("v")], { revueValide: false });
  couverture(issues, "F-VARIANT-WARNING");
  assert.ok(issues.every(i => i.rule === "S6-EVIDENCE-REVIEW" && i.severity === "WARNING"));
});

test("les variantes se replient sur la base sans contexte et choisissent la priorité maximale", () => {
  const v = variante("v"), w = variante("w", 10);
  assert.equal(choisirVariante(a, [v, w]), a);
  assert.equal(choisirVariante(a, [v, w], {}), a);
  assert.equal(choisirVariante(a, [v, w], { navigation: "standard" }), a);
  assert.equal(choisirVariante(a, [v, w], { navigation: "keyboard" }), w);
  assert.equal(choisirVariante(a, [w, v], { navigation: "keyboard" }), w);
  assert.throws(() => choisirVariante(a, [v, variante("egal")], { navigation: "keyboard" }), /Conflit/);
  assert.throws(() => choisirVariante(a, [v], { diagnosis: "interdit" }), /invalide/);
  assert.throws(() => choisirVariante(a, [v], { language: "fr\n" }), /invalide/);
});
test("une priorité supérieure masque un conflit inférieur, les contextes exclusifs ne sont pas ambigus", () => {
  assert.deepEqual(verifier([a, variante("v"), variante("w"), variante("prioritaire", 2)]), []);
  assert.deepEqual(verifier([a, variante("v", 1, { navigation: "keyboard" }), variante("w", 1, { navigation: "standard" })]), []);
});
test("les révisions suffisantes, migrations identifiées et transitions autorisées passent", () => {
  const review = { ...a, version: 2, status: "review" };
  assert.deepEqual(verifier([review], { historique: [etat(a)] }), []);
  assert.deepEqual(verifier([{ ...a, version: 2 }], { historique: [etat(a)], signature: "source changée" }), []);
  assert.deepEqual(verifier([{ ...a, status: "review", provenance: { ...a.provenance, type: "legacy-v0" } }]), []);
});
test("les graphes partagés et l’ordre des fichiers ne changent pas les diagnostics", () => {
  const quiz = experience("quiz", { type: "quiz", components: [ref(experience("ex", { type: "exercise" }))] });
  const ex = experience("ex", { type: "exercise" });
  const lab = experience("lab", { type: "lab", components: [ref(quiz), ref(ex)] });
  assert.deepEqual(verifier([lab, quiz, ex]), []);
  assert.deepEqual(verifier([ex, quiz, lab]), []);
});
