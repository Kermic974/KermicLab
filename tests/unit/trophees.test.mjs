import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliser, charger, sauver, CLE_STOCKAGE } from "../../web/trophees.js";

const module = () => ({
  genre: "jeux", etat: { xp: 70 }, xp: 70, niveau: 1, etoiles: 3, etoilesTotal: 60,
  badges: [{ id: "premiers-pas", nom: "Premiers pas", description: "Une leçon.", icone: "★", actuel: 1, cible: 1, obtenu: true }]
});

test("trophées : conserve les données utiles et ignore les champs étrangers", () => {
  const brut = { ...module(), type: "message", inconnu: "ignoré" };
  assert.deepEqual(normaliser(brut), module());
  assert.equal(normaliser({ genre: "notions", etat: ["app-1"], etoiles: 1, etoilesTotal: 10, badges: [] }).etoiles, 1);
});

test("trophées : rejette les instantanés malformés ou trop volumineux", () => {
  for (const valeur of [null, [], { ...module(), xp: -1 }, { ...module(), niveau: Infinity },
    { ...module(), genre: "inconnu" }, { ...module(), badges: [{}] }, { ...module(), etat: null },
    { ...module(), etat: { texte: "a".repeat(100001) } },
    { ...module(), badges: [{ ...module().badges[0], cible: 0 }] }]) {
    assert.equal(normaliser(valeur), null);
  }
  const cyclique = {}; cyclique.soi = cyclique;
  assert.equal(normaliser({ ...module(), etat: cyclique }), null);
});

test("trophées : stockage local validé, sans dépendance au navigateur", () => {
  const donnees = new Map();
  const stockage = { getItem: (c) => donnees.get(c), setItem: (c, v) => donnees.set(c, v) };
  sauver(stockage, { echecs: module() });
  assert.deepEqual(charger(stockage), { echecs: module() });
  stockage.setItem(CLE_STOCKAGE, JSON.stringify({ echecs: module(), corrompu: {} }));
  assert.deepEqual(charger(stockage), { echecs: module() });
  stockage.setItem(CLE_STOCKAGE, "{");
  assert.deepEqual(charger(stockage), {});
  assert.deepEqual(charger(null), {});
  assert.doesNotThrow(() => sauver(null, {}));
});
