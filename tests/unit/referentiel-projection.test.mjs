import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projeterFiches, synchroniserProjectionV0 } from "../../scripts/lib/referentiel-projection.mjs";

const a = "notion.maths.fractions";
const b = "notion.maths.division";
const c = "notion.maths.entiers";
const m = "microskill.maths.comparer";
const p = "curriculum.maths.fr";
const q = "curriculum.maths.autre";
const e3 = "stage.maths.cycle-3";
const e4 = "stage.maths.cycle-4";
const eq = "stage.maths.autre-seconde";
const objet = (id, type, props = {}) => ({ id, type, status: "draft", ...props });
const objets = [objet(a, "notion"), objet(b, "notion"), objet(c, "notion"), objet(m, "microskill"),
  objet(p, "curriculum"), objet(q, "curriculum"), objet(e3, "stage", { curriculum: p, code: "cycle-3" }),
  objet(e4, "stage", { curriculum: p, code: "cycle-4" }), objet(eq, "stage", { curriculum: q, code: "seconde" }),
  objet("relation.maths.division", "requires", { source: a, target: b }),
  objet("relation.maths.entiers", "requires", { source: a, target: c }),
  objet("relation.maths.comparer", "teaches", { source: a, target: m }),
  objet("curriculum-mapping.maths.c4", "curriculum-mapping", { object: a, curriculum: p, stage: e4 }),
  objet("curriculum-mapping.maths.c4-autre-role", "curriculum-mapping", { object: a, curriculum: p, stage: e4 }),
  objet("curriculum-mapping.maths.c3", "curriculum-mapping", { object: a, curriculum: p, stage: e3 }),
  objet("curriculum-mapping.maths.autre-seconde", "curriculum-mapping", { object: a, curriculum: q, stage: eq })
];
const config = { curriculum: p, notions: { fractions: a, division: b, entiers: c }, competences: { [m]: "comparer-fractions" },
  fiches: { fractions: { prerequis: ["entiers", "division"], competences: ["comparer-fractions"] }, division: { prerequis: [] }, entiers: {} } };

test("projection des brouillons, ordre V0, dédoublonnage des stages et sélection du programme", () => {
  const resultat = projeterFiches(config, objets);
  assert.deepEqual(resultat, projeterFiches(config, [...objets].reverse()));
  assert.deepEqual(resultat.get("fractions"), {
    prerequis: ["entiers", "division"], competences: ["comparer-fractions"], niveaux: ["cycle-3", "cycle-4"]
  });
  assert.deepEqual(resultat.get("division"), { prerequis: [] });
  assert.deepEqual(resultat.get("entiers"), {});
});

test("rejette les correspondances manquantes, ambiguës et un ordre périmé", () => {
  assert.throws(() => projeterFiches({ ...config, competences: {} }, objets), /aucune correspondance/);
  assert.throws(() => projeterFiches({ ...config, notions: { ...config.notions, alias: a } }, objets), /ambiguë/);
  const fiches = { fractions: { prerequis: ["division"], competences: ["comparer-fractions"] } };
  assert.throws(() => projeterFiches({ ...config, fiches }, objets), /ordre prerequis/);
});

async function dossierTest(t) {
  const racine = await mkdtemp(join(tmpdir(), "kermiclab-projection-"));
  t.after(() => rm(racine, { recursive: true, force: true }));
  const eols = "\r\n";
  const chemins = new Map();
  for (const nom of ["fractions", "division", "entiers", "ancienne"]) {
    const dossier = join(racine, "catalogue", nom);
    await mkdir(dossier, { recursive: true });
    const chemin = join(dossier, "fiche.md");
    chemins.set(nom, chemin);
    const extra = nom === "fractions" ? ["prerequis:", "  - division", "  - entiers", "# Conserver", "niveaux: cycle-4, cycle-3"] :
      nom === "division" ? [] : ["prerequis:"];
    await writeFile(chemin, ["---", "id: " + nom, ...extra, "duree: 25", "---", "Texte éditorial", ""].join(eols));
  }
  const dossier = join(racine, "referentiel", "objets", "maths");
  await mkdir(dossier, { recursive: true });
  await writeFile(join(racine, "referentiel", "projection-v0.json"), JSON.stringify(config));
  await Promise.all(objets.map((o, i) => writeFile(join(dossier, i + ".json"), JSON.stringify(o))));
  return { racine, chemins };
}

test("le contrôle ne modifie rien et le build réécrit seulement les champs générés", async t => {
  const { racine, chemins } = await dossierTest(t);
  const lire = nom => readFile(chemins.get(nom), "utf8");
  const initial = await Promise.all([...chemins.keys()].map(lire));
  const attendus = ["fractions", "division", "entiers"].map(n => "catalogue/" + n + "/fiche.md");
  assert.deepEqual(await synchroniserProjectionV0(racine), attendus);
  assert.deepEqual(await Promise.all([...chemins.keys()].map(lire)), initial);
  assert.deepEqual(await synchroniserProjectionV0(racine, { ecrire: true }), attendus);
  assert.deepEqual(await synchroniserProjectionV0(racine), []);
  assert.deepEqual(await synchroniserProjectionV0(racine, { ecrire: true }), []);
  assert.match(await lire("fractions"), /# Conserver\r\nduree: 25\r\nprerequis: entiers, division\r\nniveaux: cycle-3, cycle-4\r\ncompetences: comparer-fractions\r\n---\r\nTexte éditorial/);
  assert.match(await lire("division"), /prerequis:\r\n/);
  assert.doesNotMatch(await lire("entiers"), /prerequis:/);
  assert.equal(await lire("ancienne"), initial[3]);
});

test("sans configuration, la projection est inactive", async t => {
  const { racine } = await dossierTest(t);
  await rm(join(racine, "referentiel", "projection-v0.json"));
  assert.deepEqual(await synchroniserProjectionV0(racine, { ecrire: true }), []);
});
