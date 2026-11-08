// Révisions de Leitner étendues aux exercices des notions et au défi express (feuille de route, phase 2 ; issue #187).
// Une seule source : le module partagé des jeux (gabarit/jeux/progression.js, ADR 0015), pas de second moteur.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { normaliserEvenement, enregistrer, reviser, revisionsDues, charger, etatInitial, CLE_STOCKAGE } from "../../web/evenements.js";

const source = await readFile(new URL("../../gabarit/jeux/progression.js", import.meta.url), "utf8");
const G = vm.runInNewContext(`${source}\nProgressionJeux`, { Math, Object, Array, Set, Map, Number, String, Error, Date, JSON });
// Objets créés dans le contexte vm : recopiés pour comparer sans tenir compte du prototype.
const local = (x) => JSON.parse(JSON.stringify(x));
const planifier = (...a) => local(G.planifierCarte(...a));
const cartesDues = (...a) => local(G.cartesDues(...a));
const ev = (evenement, extra = {}) => normaliserEvenement({ type: "kermiclab:evenement", v: 1, notion: "pythagore", version: "1.1.0", evenement, ...extra }, "pythagore");

test("module partagé : boîtes de Leitner (1, 2, 4, 8, 16 jours) et cartes dues, identiques pour les jeux et les notions", () => {
  assert.deepEqual(local(G.INTERVALLES), [1, 2, 4, 8, 16]);
  assert.deepEqual(planifier(undefined, true, "2026-11-08"), { boite: 1, prochaine: "2026-11-09" }, "première réussite : boîte 1");
  assert.deepEqual(planifier({ boite: 1, prochaine: "2026-11-09" }, true, "2026-11-09"), { boite: 2, prochaine: "2026-11-11" });
  assert.deepEqual(planifier({ boite: 5, prochaine: "2026-12-01" }, true, "2026-12-01"), { boite: 5, prochaine: "2026-12-17" }, "plafond");
  assert.deepEqual(planifier({ boite: 4, prochaine: "2026-11-20" }, false, "2026-11-20"), { boite: 1, prochaine: "2026-11-21" }, "erreur : boîte 1");
  const cartes = { a: { boite: 2, prochaine: "2026-11-10" }, b: { boite: 1, prochaine: "2026-11-08" }, c: { boite: 1, prochaine: "2026-11-30" }, d: { boite: 1, prochaine: "2026-11-10" } };
  assert.deepEqual(cartesDues(cartes, "2026-11-10"), ["b", "d", "a"], "plus en retard d'abord, puis boîte la plus basse");
  // Les jeux passent par la même fonction : une réussite parfaite fait monter la carte d'une boîte.
  const P = { grades: [{ embleme: "x", lecons: [{ id: "l1", theme: "t", exercices: [{}] }] }], themes: { t: "T" }, badges: [] };
  const A = G.creer(P);
  let e = A.enregistrerExercice(A.etatInitial(), { id: "l1/0", jour: "2026-11-08" }).etat;
  e = A.enregistrerExercice(e, { id: "l1/0", jour: "2026-11-09" }).etat;
  assert.deepEqual(local(e.cartes["l1/0"]), planifier(planifier(undefined, true, "2026-11-08"), true, "2026-11-09"));
  assert.deepEqual(local(A.revisionsDues(e, "2026-11-11")), cartesDues(e.cartes, "2026-11-11"));
});

test("notions : une réponse juste crée ou fait avancer la carte de l'exercice, une réponse fausse n'y touche pas", () => {
  let etat = enregistrer(etatInitial(), ev("reponse", { exercice: "app-1", correct: false, essai: 1 }), "2026-11-08", { planifier });
  assert.equal(etat.notions.pythagore.exercices["app-1"].boite, undefined, "pas de carte avant une réussite");
  etat = enregistrer(etat, ev("reponse", { exercice: "app-1", correct: true, essai: 2 }), "2026-11-08", { planifier });
  assert.deepEqual([etat.notions.pythagore.exercices["app-1"].boite, etat.notions.pythagore.exercices["app-1"].prochaine], [1, "2026-11-09"]);
  etat = enregistrer(etat, ev("reponse", { exercice: "app-1", correct: true, essai: 1 }), "2026-11-09", { planifier });
  assert.deepEqual([etat.notions.pythagore.exercices["app-1"].boite, etat.notions.pythagore.exercices["app-1"].prochaine], [2, "2026-11-11"]);
  etat = enregistrer(etat, ev("reponse", { exercice: "app-1", correct: true, essai: 3 }), "2026-11-11", { planifier });
  assert.equal(etat.notions.pythagore.exercices["app-1"].boite, 1, "réussi après plusieurs essais : retour en boîte 1");
  const sans = enregistrer(etatInitial(), ev("reponse", { exercice: "app-1", correct: true, essai: 1 }), "2026-11-08");
  assert.equal(sans.notions.pythagore.exercices["app-1"].boite, undefined, "sans module de planification : aucun effet");
});

test("défi express : révisions dues dans l'ordre du module partagé, puis replanifiées par la réponse", () => {
  let etat = etatInitial();
  for (const [exercice, jour] of [["app-1", "2026-11-01"], ["app-2", "2026-11-03"], ["defi-1", "2026-11-07"]]) {
    etat = enregistrer(etat, ev("reponse", { exercice, correct: true, essai: 1 }), jour, { planifier });
  }
  assert.deepEqual(revisionsDues(etat, "2026-11-08", cartesDues), [
    { notion: "pythagore", exercice: "app-1" }, { notion: "pythagore", exercice: "app-2" }, { notion: "pythagore", exercice: "defi-1" }
  ]);
  assert.deepEqual(revisionsDues(etat, "2026-11-02", cartesDues), [{ notion: "pythagore", exercice: "app-1" }]);
  const avant = structuredClone(etat);
  const juste = reviser(etat, { notion: "pythagore", exercice: "app-1", correct: true, jour: "2026-11-08", planifier });
  assert.deepEqual(etat, avant, "fonction pure");
  assert.deepEqual([juste.notions.pythagore.exercices["app-1"].boite, juste.notions.pythagore.exercices["app-1"].prochaine], [2, "2026-11-10"]);
  const faux = reviser(etat, { notion: "pythagore", exercice: "app-2", correct: false, jour: "2026-11-08", planifier });
  assert.deepEqual([faux.notions.pythagore.exercices["app-2"].boite, faux.notions.pythagore.exercices["app-2"].prochaine], [1, "2026-11-09"]);
  assert.equal(reviser(etat, { notion: "thales", exercice: "app-1", correct: true, jour: "2026-11-08", planifier }), etat, "sans carte : inchangé");
  assert.deepEqual(revisionsDues(juste, "2026-11-08", cartesDues).map((r) => r.exercice), ["app-2", "defi-1"], "révisée : plus due aujourd'hui");
});

test("stockage : cartes relues avec l'agrégat ; carte incomplète ou invalide écartée, faits de l'exercice conservés", () => {
  const memoire = new Map();
  const zone = { getItem: (k) => memoire.get(k) ?? null, setItem: (k, v) => memoire.set(k, v) };
  const base = { reponses: 1, reussi: true, indice: 0, apresIndice: false };
  memoire.set(CLE_STOCKAGE, JSON.stringify({ v: 1, notions: { pythagore: {
    version: "1.1.0", ouvertures: 1, dernierJour: "2026-11-08", termine: false, validations: 0, derniereValidation: null,
    exercices: { "app-1": { ...base, boite: 2, prochaine: "2026-11-10" }, "app-2": { ...base, boite: 2 }, "app-3": { ...base, boite: 0, prochaine: "2026-11-10" }, "app-4": base }
  } } }));
  const ex = charger(zone).notions.pythagore.exercices;
  assert.deepEqual(Object.keys(ex).sort(), ["app-1", "app-2", "app-3", "app-4"]);
  assert.deepEqual([ex["app-1"].boite, ex["app-1"].prochaine], [2, "2026-11-10"]);
  for (const id of ["app-2", "app-3", "app-4"]) {
    assert.deepEqual(ex[id], base, `${id} : sans carte`);
  }
});
