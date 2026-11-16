import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
import { chargerSchemasReferentiel, erreursStructure } from "../../scripts/lib/referentiel-structure.mjs";

const lire = (chemin) => readFile(new URL(chemin, import.meta.url), "utf8");
const cas = JSON.parse(await lire("../fixtures/referentiel/structures.json"));
const schemas = await chargerSchemasReferentiel();
const catalogue = await lire("../../referentiel/RULE_CATALOG.csv");
const regles = new Set(catalogue.trim().split("\n").slice(1).map((ligne) => ligne.split('"')[1]));

for (const { name, contrat, objet, rule } of cas) {
  test(name, () => {
    const erreurs = erreursStructure(schemas.get(contrat), objet);
    if (rule) {
      assert.deepEqual([...new Set(erreurs.map((erreur) => erreur.rule))], [rule]);
      assert.ok(erreurs.every((erreur) => erreur.severity === "ERROR" && regles.has(erreur.rule)));
    } else {
      assert.deepEqual(erreurs, []);
    }
  });
}
