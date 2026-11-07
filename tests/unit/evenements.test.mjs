import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliserEvenement, enregistrer, charger, sauver, etatInitial, CLE_STOCKAGE, TYPES } from "../../web/evenements.js";

// Contrat d'événements pédagogiques v1 (ADR 0025), côté tableau de bord.
const base = { type: "kermiclab:evenement", v: 1, notion: "pythagore", version: "1.2.0" };
const ev = (evenement, extra = {}) => ({ ...base, evenement, ...extra });

test("événements : les quatre types valides sont normalisés, sans champ superflu", () => {
  assert.deepEqual(TYPES, ["demarre", "indice", "reponse", "termine"]);
  assert.deepEqual(normaliserEvenement(ev("demarre"), "pythagore"), { notion: "pythagore", version: "1.2.0", evenement: "demarre" });
  assert.deepEqual(normaliserEvenement(ev("indice", { exercice: "app-2", rang: 1 }), "pythagore"),
    { notion: "pythagore", version: "1.2.0", evenement: "indice", exercice: "app-2", rang: 1 });
  assert.deepEqual(normaliserEvenement(ev("reponse", { exercice: "defi-1", correct: false, essai: 3 }), "pythagore"),
    { notion: "pythagore", version: "1.2.0", evenement: "reponse", exercice: "defi-1", correct: false, essai: 3 });
  assert.ok(normaliserEvenement(ev("termine"), "pythagore"));
});

test("événements : tout message hors schéma est refusé", () => {
  const refuses = [
    [null, "pythagore"], ["texte", "pythagore"],
    [{ ...ev("demarre"), type: "autre" }, "pythagore"],
    [{ ...ev("demarre"), v: 2 }, "pythagore"],
    [ev("demarre"), "fractions"], // une page ne parle que pour elle-même
    [{ ...ev("demarre"), version: "1.2" }, "pythagore"],
    [ev("abandon"), "pythagore"],
    [ev("demarre", { texte: "réponse libre de l'élève" }), "pythagore"], // aucun champ en plus
    [ev("reponse", { exercice: "app-1", correct: "oui", essai: 1 }), "pythagore"],
    [ev("reponse", { exercice: "app-1", correct: true, essai: 0 }), "pythagore"],
    [ev("reponse", { exercice: "App 1", correct: true, essai: 1 }), "pythagore"],
    [ev("indice", { exercice: "app-1", rang: 11 }), "pythagore"],
    [ev("indice", { exercice: "app-1" }), "pythagore"],
    [ev("termine", { exercice: "app-1" }), "pythagore"]
  ];
  for (const [brut, notion] of refuses) assert.equal(normaliserEvenement(brut, notion), null, JSON.stringify(brut));
});

test("événements : agrégation par notion et par exercice (ouvertures, indices, réussite après indice, terminé)", () => {
  const suite = [
    ev("demarre"), ev("reponse", { exercice: "app-1", correct: false, essai: 1 }), ev("indice", { exercice: "app-1", rang: 1 }),
    ev("reponse", { exercice: "app-1", correct: true, essai: 2 }), ev("reponse", { exercice: "app-2", correct: true, essai: 1 }),
    ev("termine"), ev("demarre")
  ].map((brut) => normaliserEvenement(brut, "pythagore"));
  const avant = etatInitial();
  const etat = suite.reduce((e, x) => enregistrer(e, x, "2026-11-07"), avant);
  assert.deepEqual(avant, etatInitial(), "fonction pure : l'état reçu n'est pas modifié");
  assert.deepEqual(etat, { v: 1, notions: { pythagore: {
    version: "1.2.0", ouvertures: 2, dernierJour: "2026-11-07", termine: true, exercices: {
      "app-1": { reponses: 2, reussi: true, indice: 1, apresIndice: true },
      "app-2": { reponses: 1, reussi: true, indice: 0, apresIndice: false }
    }
  } } });
});

test("événements : relecture du stockage robuste, entrées invalides ignorées, aller-retour sans perte", () => {
  const memoire = new Map();
  const zone = { getItem: (k) => memoire.get(k) ?? null, setItem: (k, v) => memoire.set(k, v) };
  assert.deepEqual(charger(zone), etatInitial());
  const etat = enregistrer(etatInitial(), normaliserEvenement(ev("demarre"), "pythagore"), "2026-11-07");
  sauver(zone, etat);
  assert.deepEqual(charger(zone), etat);
  memoire.set(CLE_STOCKAGE, JSON.stringify({ v: 1, notions: {
    pythagore: etat.notions.pythagore, "Mauvais Id": etat.notions.pythagore,
    fractions: { ...etat.notions.pythagore, ouvertures: -1 }
  } }));
  assert.deepEqual(Object.keys(charger(zone).notions), ["pythagore"]);
  memoire.set(CLE_STOCKAGE, "{pas du json");
  assert.deepEqual(charger(zone), etatInitial());
  assert.deepEqual(charger(null), etatInitial(), "stockage indisponible");
});

test("événements : résumé affichable d'une notion pour « Mes trophées » (issue #183)", async () => {
  const { resumerNotion } = await import("../../web/evenements.js");
  assert.equal(resumerNotion(undefined), null);
  const etat = [
    ev("demarre"), ev("demarre"),
    ev("reponse", { exercice: "app-1", correct: false, essai: 1 }), ev("indice", { exercice: "app-1", rang: 1 }),
    ev("reponse", { exercice: "app-1", correct: true, essai: 2 }),
    ev("reponse", { exercice: "app-2", correct: true, essai: 1 }),
    ev("reponse", { exercice: "app-3", correct: false, essai: 1 }),
    ev("indice", { exercice: "app-4", rang: 1 }) // indice affiché sans réponse : pas un exercice tenté
  ].map((brut) => normaliserEvenement(brut, "pythagore")).reduce((e, x) => enregistrer(e, x, "2026-11-07"), etatInitial());
  assert.deepEqual(resumerNotion(etat.notions.pythagore), { ouvertures: 2, tentes: 3, reussis: 2, apresIndice: 1, termine: false });
});
