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

test("progression : historique par jour, dernière notion et activité de la semaine", () => {
  let p = P.enregistrerQuestion(P.etatInitial(), "2026-11-02").p;
  p = P.enregistrerNotion(p, "trigo-cercle", "2026-11-03").p;
  p = P.enregistrerNotion(p, "pythagore", "2026-11-03").p;
  p = P.enregistrerNotion(p, "trigo-cercle", "2026-11-03").p;
  assert.equal(p.derniereNotion, "trigo-cercle", "une notion déjà vue redevient « à reprendre »");
  assert.deepEqual(p.jours["2026-11-03"], { q: 0, n: 2, xp: 2 * P.XP_NOTION });
  const semaine = P.activite(p, "2026-11-03");
  assert.equal(semaine.length, 7);
  assert.equal(semaine[0].jour, "2026-10-28");
  assert.deepEqual(semaine.slice(-2).map((j) => j.xp), [P.XP_QUESTION, 2 * P.XP_NOTION]);
});

test("progression : le défi express rapporte 5 XP par bonne réponse, une fois par jour, et entretient la série", () => {
  let r = P.enregistrerDefi(P.etatInitial(), 4, "2026-11-03");
  assert.equal(r.xpGagne, 4 * P.XP_DEFI_BONNE);
  assert.equal(r.p.serie, 1);
  r = P.enregistrerDefi(r.p, 5, "2026-11-03");
  assert.equal(r.xpGagne, 0);
  r = P.enregistrerDefi(r.p, 9, "2026-11-04");
  assert.equal(r.xpGagne, 5 * P.XP_DEFI_BONNE, "au plus 5 bonnes réponses");
  assert.equal(r.p.serie, 2);
});

test("progression : un historique corrompu est nettoyé et limité à 31 jours", () => {
  const jours = { "pas-une-date": { q: 1 }, "2026-01-01": { q: -3, n: "x", xp: 4 } };
  for (let i = 1; i <= 40; i += 1) jours[`2026-03-${String(i).padStart(2, "0")}`] = { q: 1, n: 0, xp: 10 };
  const p = P.normaliser({ jours, derniereNotion: 42, defiJour: "hier" });
  assert.equal(Object.keys(p.jours).length, 31);
  assert.ok(!("pas-une-date" in p.jours));
  assert.equal(p.derniereNotion, null);
  assert.equal(p.defiJour, null);
  assert.deepEqual(P.normaliser({ jours: { "2026-01-01": { q: -3, n: "x", xp: 4 } } }).jours, { "2026-01-01": { q: 0, n: 0, xp: 4 } });
});
