import { test } from "node:test";
import assert from "node:assert/strict";
import * as P from "../../web/progression.js";

test("progression : la première question donne de l'XP, démarre la série et le badge « premier pas »", () => {
  const r = P.enregistrerQuestion(P.etatInitial(), "2026-11-01");
  assert.equal(r.p.questions, 1);
  assert.equal(r.p.xp, P.XP_QUESTION);
  assert.equal(r.p.serie, 1);
  assert.deepEqual(r.nouveaux.map((b) => b.id), ["premier-pas"]);
});

test("progression : la série augmente le lendemain, reste stable le même jour, repart à 1 après un trou", () => {
  let p = P.enregistrerQuestion(P.etatInitial(), "2026-10-30").p;
  p = P.enregistrerQuestion(p, "2026-10-30").p;
  assert.equal(p.serie, 1);
  p = P.enregistrerQuestion(p, "2026-10-31").p;
  p = P.enregistrerQuestion(p, "2026-11-01").p;
  assert.equal(p.serie, 3);
  assert.ok(p.badges.includes("serie-3"));
  assert.equal(P.serieCourante(p, "2026-11-02"), 3);
  assert.equal(P.serieCourante(p, "2026-11-03"), 0);
  p = P.enregistrerQuestion(p, "2026-11-05").p;
  assert.equal(p.serie, 1);
  assert.equal(p.serieMax, 3);
});

test("progression : une notion ne rapporte qu'une fois et le niveau monte tous les 100 XP", () => {
  let r = P.enregistrerNotion(P.etatInitial(), "trigo-cercle");
  assert.equal(r.xpGagne, P.XP_NOTION);
  assert.ok(r.nouvelleNotion);
  r = P.enregistrerNotion(r.p, "trigo-cercle");
  assert.equal(r.xpGagne, 0);
  let p = r.p;
  let monte = false;
  for (let i = 0; i < 8; i += 1) { const q = P.enregistrerQuestion(p, "2026-11-01"); monte ||= q.niveauGagne; p = q.p; }
  assert.equal(p.xp, 105);
  assert.ok(monte);
  assert.deepEqual(P.niveau(p), { niveau: 2, xpDansNiveau: 5, xpParNiveau: 100 });
});

test("progression : un stockage corrompu ou indisponible n'empêche pas de démarrer", () => {
  const faux = (valeur) => ({ getItem: () => valeur, setItem: () => { throw new Error("plein"); } });
  assert.deepEqual(P.charger(faux("{pas du json")), P.etatInitial());
  assert.deepEqual(P.charger(null), P.etatInitial());
  const relu = P.charger(faux(JSON.stringify({ questions: -3, xp: "beaucoup", notions: ["a", "a", 4], badges: ["inconnu", "curieux"], dernierJour: "hier" })));
  assert.equal(relu.questions, 0);
  assert.equal(relu.xp, 0);
  assert.deepEqual(relu.notions, ["a"]);
  assert.deepEqual(relu.badges, ["curieux"]);
  assert.equal(relu.dernierJour, null);
  assert.doesNotThrow(() => P.sauver(faux(null), relu));
});
