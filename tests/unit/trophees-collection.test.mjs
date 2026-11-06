import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { collectionTrophees } from "../../scripts/lib/trophees.mjs";
import { lireCollection } from "../../web/trophees.js";

test("collection : objectifs issus des vrais parcours, sans réussite ni XP inventés", () => {
  const c = lireCollection(JSON.parse(JSON.stringify(collectionTrophees(CATALOGUE))));
  assert.equal(c.echecs.badges.length, 17);
  assert.equal(c.echecs.gradesTotal, 6);
  assert.equal(c.echecs.leconsTotal, 20);
  assert.equal(c.echecs.etoilesTotal, 60);
  assert.equal(c.pythagore.etoilesTotal, 10);
  assert.equal(c.sudoku.badges.length, 5);
  assert.equal(c["2048"].badges.length, 5);
  assert.equal(c["mini-cercle"].etoilesTotal, 2);
  for (const m of Object.values(c)) {
    assert.ok(m.badges.every((b) => !b.obtenu && b.actuel === 0));
    for (const cle of ["xp", "etoiles", "grades", "lecons", "record"]) {
      if (m[cle] !== undefined) assert.equal(m[cle], 0);
    }
  }
  assert.equal(c["poker-texas-holdem"].leconsTotal, 6);
  assert.equal(c["poker-texas-holdem"].gradesTotal, 3);
  assert.equal(c["poker-texas-holdem"].badges.length, 14);
});

test("collection : le fichier statique livré reflète le catalogue compilé", async () => {
  const brut = JSON.parse(await readFile(new URL("../../dist/trophees.json", import.meta.url), "utf8"));
  assert.deepEqual(brut, JSON.parse(JSON.stringify(collectionTrophees(CATALOGUE))));
  for (const m of CATALOGUE.index.maquettes.filter((m) => CATALOGUE.pages[m.id].fr.includes('id="kermiclab-contenu"'))) {
    assert.ok(brut.modules.some((entree) => entree.id === m.id), `${m.id} fait partie de la collection`);
  }
});

test("collection : les données malformées et doublons sont signalés", () => {
  for (const brut of [null, {}, { modules: [{}] }, { modules: Array(201).fill({}) }]) {
    assert.throws(() => lireCollection(brut), /collection|module invalide/);
  }
  const m = { id: "test", titre: "Test", progression: { genre: "notions", etat: [], etoiles: 0, etoilesTotal: 10, badges: [] } };
  assert.throws(() => lireCollection({ modules: [m, m] }), /module invalide/);
  assert.throws(() => lireCollection({ modules: [{ ...m, titre: null }] }), /module invalide/);
});
