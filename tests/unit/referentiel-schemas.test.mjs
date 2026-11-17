import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
import { chargerSchemasReferentiel, erreursStructure } from "../../scripts/lib/referentiel-structure.mjs";
import { verifierCouverture } from "../preuves-referentiel.mjs";

const lire = (chemin) => readFile(new URL(chemin, import.meta.url), "utf8");
const cas = JSON.parse(await lire("../fixtures/referentiel/structures.json"));
const schemas = await chargerSchemasReferentiel();
const couverture = verifierCouverture("tests/fixtures/referentiel/structures.json");

for (const { name, contrat, objet, rule } of cas) {
  test(name, () => {
    const erreurs = erreursStructure(schemas.get(contrat), objet);
    couverture(erreurs, name);
    if (rule) {
      assert.deepEqual([...new Set(erreurs.map((erreur) => erreur.rule))], [rule]);
      assert.ok(erreurs.every((erreur) => erreur.severity === "ERROR"));
    } else {
      assert.deepEqual(erreurs, []);
    }
  });
}
