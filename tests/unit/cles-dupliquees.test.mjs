import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { clesDupliquees } from "../../scripts/cles-dupliquees.mjs";

const dossierI18n = new URL("../../web/i18n/", import.meta.url);

test("aucune clé en double dans un JSON sans répétition", () => {
  assert.deepEqual(clesDupliquees('{\n  "a": 1,\n  "b": { "a": 2 },\n  "c": [{ "a": 3 }, { "a": 4 }]\n}'), []);
});

test("détecte une clé répétée au premier niveau, avec ses lignes", () => {
  const texte = '{\n  "navEspaces": "Mes espaces",\n  "autre": "x",\n  "navEspaces": "Mes espaces"\n}';
  assert.deepEqual(clesDupliquees(texte), [{ chemin: "", cle: "navEspaces", lignes: [2, 4] }]);
});

test("détecte une clé répétée dans un objet imbriqué ou dans un tableau", () => {
  const texte = '{"o": {"k": 1, "k": 2}, "t": [{"x": 1}, {"x": 1, "x": 2}]}';
  assert.deepEqual(clesDupliquees(texte), [
    { chemin: "o", cle: "k", lignes: [1, 1] },
    { chemin: "t[1]", cle: "x", lignes: [1, 1] },
  ]);
});

test("ignore les valeurs identiques à une clé et les guillemets échappés", () => {
  const texte = '{"a": "a", "b": "\\"a\\"", "c": ["a", "a"], "d\\"": 1, "d": 2}';
  assert.deepEqual(clesDupliquees(texte), []);
});

test("les fichiers web/i18n/*.json n'ont aucune clé en double", async () => {
  const langues = (await readdir(dossierI18n)).filter((f) => f.endsWith(".json"));
  assert.ok(langues.includes("fr.json"));
  for (const l of langues) {
    assert.deepEqual(clesDupliquees(await readFile(new URL(l, dossierI18n), "utf8")), [], l);
  }
});
