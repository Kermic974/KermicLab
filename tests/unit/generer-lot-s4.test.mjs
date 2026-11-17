import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { preparerLotS4 } from "../../scripts/generer-lot-s4.mjs";

const racine = fileURLToPath(new URL("../../", import.meta.url));
const lire = async n => JSON.parse(await readFile(new URL("../../" + n, import.meta.url), "utf8"));
const config = await lire("referentiel/projection-v0.json");
const fiche = "fractions";
const idSkill = "skill.mathematiques.raisonner-avec-des-fractions-fixture";
const provenance = { type: "editorial", ref: "catalogue/fractions/fiche.md" };
const base = { status: "draft", version: 1, provenance };
const objets = [
  { ...base, type: "skill", id: idSkill, label: "Raisonner avec des fractions" },
  ...config.fiches[fiche].competences.map(n => ({
    ...base, type: "contributesTo", id: "relation.mathematiques.fixture-fractions-" + n,
    source: "microskill.mathematiques." + n, target: idSkill
  }))
];
const proposition = { discipline: "mathematiques", objets, projection: {
  notions: {}, competences: {}, fiches: { [fiche]: config.fiches[fiche] }
}, journal: { [fiche]: "Fixture éditoriale — catalogue/fractions/fiche.md" } };
const preparer = p => preparerLotS4(racine, p, async () => []);

test("le lot produit des JSON en brouillon et reproduit la fiche pilote", async () => {
  const a = await preparer(proposition);
  const b = await preparer(proposition);
  assert.deepEqual(a, b);
  assert.equal(a.sortie.size, objets.length);
  assert.deepEqual(a.rapport.fiches[0].avant, a.rapport.fiches[0].apres);
  assert.equal(a.rapport.warnings.length, 0);
});

test("le lot refuse une projection existante contradictoire et une référence rompue", async () => {
  const modifiee = structuredClone(proposition);
  modifiee.projection.fiches[fiche].competences.reverse();
  await assert.rejects(preparer(modifiee), /conflit pour fractions/);
  const rompe = structuredClone(proposition);
  rompe.objets[1].target = "skill.mathematiques.introuvable";
  await assert.rejects(preparer(rompe), /S4-REFERENCE-ABSENTE/);
});

test("l’inventaire public v0.5 couvre 165 fiches sur neuf disciplines", async () => {
  const { disciplines } = await lire("referentiel/inventaire-v0.5.json");
  const fiches = Object.values(disciplines).flat();
  assert.equal(Object.keys(disciplines).length, 9);
  assert.equal(fiches.length, 165);
  assert.equal(new Set(fiches).size, 165);
  assert.ok(!Object.hasOwn(disciplines, "jeux"));
});
