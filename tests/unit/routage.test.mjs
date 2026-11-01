import { test } from "node:test";
import assert from "node:assert/strict";
import { routerLocal } from "../../worker/src/router.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";

const index = CATALOGUE.index;

test("non-régression : chaque question d'exemple est routée vers sa maquette", () => {
  for (const m of index.maquettes) {
    for (const q of m.questions) assert.equal(routerLocal(q, index), m.id, `« ${q} » → ${m.id}`);
  }
});

test("déterminisme : même question, même résultat", () => {
  const r = Array.from({ length: 20 }, () => routerLocal("C'est quoi le SINUS ?", index));
  assert.ok(r.every((x) => x === "trigo-cercle"));
});

test("questions non couvertes → aucune maquette", () => {
  for (const q of ["c'est quoi le théorème de Pythagore ?", "bonjour", "j'ai une sinusite", "explique la photosynthèse"]) {
    assert.equal(routerLocal(q, index), null, q);
  }
});

test("insensible aux accents et à la ponctuation", () => {
  assert.equal(routerLocal("TRIGONOMÉTRIE!!!", index), "trigo-cercle");
  assert.equal(routerLocal("le cercle-trigonométrique", index), "trigo-cercle");
});

test("les suggestions de secours de l'accueil (web/i18n) ouvrent toutes une page du catalogue", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const langue of ["fr", "en"]) {
    const textes = JSON.parse(await readFile(new URL(`../../web/i18n/${langue}.json`, import.meta.url), "utf8"));
    for (const cle of ["suggestion1", "suggestion2", "suggestion3", "suggestion4"]) {
      assert.ok(routerLocal(textes[cle], index), `${langue}.${cle} « ${textes[cle]} » ne mène à aucune page`);
    }
  }
});
