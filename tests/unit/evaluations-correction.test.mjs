import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { corrigerCritere, lireNombreEvaluation, scoreDeclare } from "../../web/evaluation-correction-v1.js";
import { copieEvaluation } from "../evaluation-fixtures.mjs";

const critere = format => ({ method: { id: format === "qcm" ? "catalogue-qcm" : "catalogue-number", version: 1, mode: "deterministic" } });
const fourni = value => ({ responseState: "provided", value });

test("S7-08 : QCM déterministe, motif explicite, absence de diagnostic causal inventé", () => {
  const b = copieEvaluation(), c = b.definition.criteria[0];
  assert.equal(corrigerCritere(c, b.prepared, fourni(1)).outcome, "success");
  assert.deepEqual(corrigerCritere(c, b.prepared, fourni(0)).diagnostic, { state: "matched", matches: ["choice-0"] });
  assert.deepEqual(corrigerCritere(c, b.prepared, fourni(2)).diagnostic, { state: "indeterminate", matches: [] });
  for (const entree of ["1", -1, 4, 1.2, null]) assert.equal(corrigerCritere(c, b.prepared, fourni(entree)).outcome, "indeterminate");
  assert.throws(() => corrigerCritere({ method: { ...c.method, version: 9 } }, b.prepared, fourni(1)), /inconnue/);
  assert.throws(() => corrigerCritere(c, { type: "qcm", choix: ["a"], bonne: 4 }, fourni(0)), /incompatible/);
});

test("S7-07 : absent, vide, partiel et revue différée conservent leur sens sans score", () => {
  const b = copieEvaluation(), c = b.definition.criteria[0];
  for (const responseState of ["empty", "absent"]) {
    const r = corrigerCritere(c, b.prepared, { responseState });
    assert.equal(r.outcome, "absent"); assert.equal(r.score, undefined);
  }
  assert.equal(corrigerCritere(c, b.prepared, { responseState: "partial" }).outcome, "partial");
  for (const mode of ["human", "assisted"]) {
    const method = { id: mode === "human" ? "human-review" : "assisted-review", version: 1, mode };
    const r = corrigerCritere({ method }, null, fourni("entrée éphémère synthétique"));
    assert.equal(r.outcome, "indeterminate"); assert.equal(r.reason, "awaiting-confirmation");
  }
});

test("S7-08 : nombres à virgule, fractions irréductibles, tolérances et entrées impossibles", () => {
  const c = critere("number"), p = { type: "nombre", reponse: 0.75, fractionIrreductible: true };
  assert.equal(corrigerCritere(c, p, fourni("3/4")).outcome, "success");
  assert.equal(corrigerCritere(c, p, fourni("-3/-4")).outcome, "success");
  for (const entree of ["6/8", "0,75"]) assert.deepEqual(corrigerCritere(c, p, fourni(entree)).diagnostic.matches, ["fraction-not-reduced"]);
  const t = { type: "nombre", reponse: 2, tolerance: 0.1 };
  assert.equal(corrigerCritere(c, t, fourni(" 2,05 ")).outcome, "success");
  assert.equal(corrigerCritere(c, t, fourni("2.2")).outcome, "failure");
  for (const entree of ["", "1/0", "1e3", "NaN", "Infinity", "1".repeat(500), "1/" + "2".repeat(500), {}, null]) {
    assert.equal(lireNombreEvaluation(entree), null);
    assert.equal(corrigerCritere(c, t, fourni(entree)).outcome, "indeterminate");
  }
});

test("S7-11 : aides contextualisées sans malus et score seulement si barème déclaré", () => {
  const b = copieEvaluation(), c = b.definition.criteria[0];
  assert.deepEqual(corrigerCritere(c, b.prepared, fourni(1)), corrigerCritere(c, b.prepared, { ...fourni(1), helpRank: 3 }));
  assert.equal(scoreDeclare(c, "success"), undefined);
  c.scoring = { kind: "outcome-values", min: 0, max: 2, rounding: "none", thresholds: [], values: { success: 2, failure: 0, partial: 1 } };
  assert.equal(scoreDeclare(c, "success"), 2); assert.equal(scoreDeclare(c, "partial"), 1);
  for (const outcome of ["absent", "indeterminate"]) assert.equal(scoreDeclare(c, outcome), undefined);
  c.scoring.values.success = Infinity;
  assert.throws(() => scoreDeclare(c, "success"), /barème/);
});

test("S7-12 : correspondances multiples visibles, sans départage arbitraire de diagnostic", () => {
  const p = { type: "nombre", reponse: 5, erreurs: [{ experienceId: "erreur-a", reponse: 2 }, { experienceId: "erreur-b", reponse: 2 }] };
  const r = corrigerCritere(critere("number"), p, fourni("2"));
  assert.equal(r.outcome, "failure");
  assert.deepEqual(r.diagnostic, { state: "ambiguous", matches: ["erreur-a", "erreur-b"] });
});

test("S7-16 : aucune saisie brute n'est retournée par la correction, même humaine ou invalide", () => {
  const secret = "saisie synthétique qui ne doit pas être conservée";
  for (const c of [critere("number"), { method: { id: "human-review", version: 1, mode: "human" } }]) {
    const r = corrigerCritere(c, { type: "nombre", reponse: 3 }, fourni(secret));
    assert.deepEqual(Object.keys(r).sort(), ["diagnostic", "outcome", "reason"]);
    assert.equal(JSON.stringify(r).includes(secret), false);
  }
});

test("S7-19 : chaque QCM et réponse numérique du corpus public est corrigé selon son contenu préparé", async () => {
  let total = 0;
  for (const dossier of await readdir(new URL("../../catalogue/", import.meta.url), { withFileTypes: true })) {
    if (!dossier.isDirectory()) continue;
    let c;
    try { c = JSON.parse(await readFile(new URL("../../catalogue/" + dossier.name + "/contenu.json", import.meta.url), "utf8")); }
    catch (e) { if (e.code === "ENOENT") continue; throw e; }
    for (const ex of [...(c.application?.exercices || []), ...(c.situation?.etapes || [])]) {
      const methode = critere(ex.type === "qcm" ? "qcm" : "number");
      let entree = ex.bonne;
      if (ex.type === "nombre") {
        entree = String(ex.reponse).replace(".", ",");
        if (ex.fractionIrreductible) {
          let fraction = null;
          for (let d = 1; d <= 1000; d++) {
            const n = Math.round(ex.reponse * d);
            if (Math.abs(n / d - ex.reponse) < 1e-9) { fraction = `${n}/${d}`; break; }
          }
          assert.ok(fraction, dossier.name + " : fraction attendue représentable"); entree = fraction;
        }
      }
      assert.equal(corrigerCritere(methode, ex, fourni(entree)).outcome, "success", dossier.name + " : " + ex.question);
      const faux = ex.type === "qcm" ? (ex.bonne + 1) % ex.choix.length : String(ex.reponse + Math.max(1, (ex.tolerance ?? 0) * 3));
      assert.equal(corrigerCritere(methode, ex, fourni(faux)).outcome, "failure", dossier.name + " : une réponse fausse reste fausse");
      total++;
    }
  }
  assert.ok(total >= 2800, "le test parcourt l'ensemble du corpus public, pas seulement les exemples pilotes");
});
