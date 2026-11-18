import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
import { chargerSchemasExperiences, typesExperience } from "../../scripts/lib/experiences-structure.mjs";
import { chargerSchemasReferentiel } from "../../scripts/lib/referentiel-structure.mjs";

const lire = async nom => JSON.parse(await readFile(new URL("../fixtures/experiences/" + nom + ".json", import.meta.url), "utf8"));
const valides = await lire("structures-valides");
const refuses = await lire("structures-refusees");
const schemas = await chargerSchemasExperiences();
const bases = new Map(valides.map(cas => [cas.name, cas]));

function modifier(objet, { pointer, value, remove }) {
  const champs = pointer.slice(1).split("/");
  const dernier = champs.pop();
  let cible = objet;
  for (const champ of champs) cible = cible[champ];
  if (remove) delete cible[dernier];
  else cible[dernier] = structuredClone(value);
}

test("les onze familles S6 ont chacune un cas accepté et un cas refusé nommé", () => {
  assert.equal(typesExperience.length, 11);
  const noms = [...valides, ...refuses].map(cas => cas.name);
  assert.equal(new Set(noms).size, noms.length);
  assert.deepEqual(new Set(valides.map(cas => cas.contract)), new Set(typesExperience));
  for (const type of typesExperience) {
    assert.ok(refuses.some(cas => bases.get(cas.base)?.contract === type));
  }
});

for (const { name, contract, object } of valides) {
  test(name, () => {
    const schema = schemas.get(contract);
    assert.equal(schema(object), true, JSON.stringify(schema.errors));
  });
}

for (const cas of refuses) {
  test(cas.name, () => {
    const base = bases.get(cas.base);
    assert.ok(base, "La mutation doit désigner une fixture acceptée.");
    const objet = structuredClone(base.object);
    modifier(objet, cas);
    const schema = schemas.get(base.contract);
    assert.equal(schema(objet), false, "La mutation interdite a été acceptée.");
    assert.ok(schema.errors.some(erreur => erreur.keyword === cas.keyword), JSON.stringify(schema.errors));
  });
}

test("S6 garde une frontière de schéma avec le Knowledge Core S4", async () => {
  const s4 = await chargerSchemasReferentiel();
  for (const { object } of valides) {
    for (const validateur of s4.values()) assert.equal(validateur(object), false);
  }
  assert.equal(schemas.get("explanation")({ id: "notion.mathematiques.pythagore", type: "notion", version: 1, status: "review", label: "Pythagore" }), false);
});

test("les variantes peuvent adapter la langue et les modalités sans données personnelles", () => {
  const objet = structuredClone(bases.get("F-SCHEMA-VARIANT-VALID").object);
  objet.applicability = { language: "fr", reading: "simplified", duration: "short", presentation: "text", navigation: "keyboard", response: "keyboard" };
  objet.accessibility = { modalities: ["text", "keyboard"], alternatives: [{ modality: "visual", source: objet.sources[0] }] };
  const schema = schemas.get(objet.type);
  assert.equal(schema(objet), true, JSON.stringify(schema.errors));
});

test("les deux autres formats de tâche expriment des références préparées, sans fonction exécutable", () => {
  const base = bases.get("F-SCHEMA-EXERCISE-VALID").object;
  const schema = schemas.get("exercise");
  for (const format of ["number", "action"]) {
    const objet = structuredClone(base);
    objet.task.format = format;
    if (format === "action") {
      objet.task.actions = objet.sources[0];
      objet.task.parameters = objet.sources[0];
    }
    assert.equal(schema(objet), true, JSON.stringify(schema.errors));
    objet.task.check = "() => true";
    assert.equal(schema(objet), false);
  }
});

test("un contrat structurel ne prétend pas résoudre une source, une cible ou une base", () => {
  // Ces références sont bien formées mais non résolues dans cette PR : contrôle PR 03/05.
  const objet = structuredClone(bases.get("F-SCHEMA-VARIANT-VALID").object);
  objet.targets = ["notion.mathematiques.cible-inexistante"];
  objet.variantOf.version = 999;
  assert.equal(schemas.get(objet.type)(objet), true);
});

test("les liaisons HTML et modules restent dans les sources publiques autorisées", () => {
  const schema = schemas.get("explanation");
  const objet = structuredClone(valides[0].object);
  for (const source of [
    { path: "catalogue/echecs/page.html", anchor: "academie", format: "html" },
    { path: "Sample/lab/systeme-solaire.html", anchor: "panneau-explication", format: "html" },
    { path: "src/pedagogy/lessons.js", anchor: "premiere-lecon", format: "module-data" }
  ]) {
    objet.sources = [source];
    assert.equal(schema(objet), true, JSON.stringify(schema.errors));
  }
  for (const path of ["catalogue-prive/test/page.html", "worker/src/app.js", "catalogue/%2e%2e/page.html", "catalogue/test//page.html", "catalogue/test/./page.html", "catalogue/test/page.html\n"]) {
    objet.sources = [{ path, anchor: "academie", format: "html" }];
    assert.equal(schema(objet), false, path);
  }
});

test("les composants exigent des références versionnées et les variantes un contexte complet", () => {
  const objet = structuredClone(bases.get("F-SCHEMA-QUIZ-VALID").object);
  const schema = schemas.get("quiz");
  delete objet.components[0].version;
  assert.equal(schema(objet), false);
  const variante = structuredClone(bases.get("F-SCHEMA-VARIANT-VALID").object);
  variante.applicability = {};
  assert.equal(schemas.get(variante.type)(variante), false);
});
