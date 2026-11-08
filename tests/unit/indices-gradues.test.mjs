import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validerContenu, compterIndices, indicesDe, MAX_INDICES } from "../../scripts/lib/gabarit.mjs";

// Indices gradués sans IA (feuille de route, phase 3 ; issue #190).
const racine = new URL("../..", import.meta.url).pathname;
const base = () => ({
  niveaux: [{ titre: "A", niveau: "6e", paragraphes: ["x"] }, { titre: "B", niveau: "5e", paragraphes: ["y"] }],
  application: { exercices: Array.from({ length: 3 }, () => ({ type: "qcm", question: "q", choix: ["a", "b", "c"], bonne: 0, explication: "e" })) },
  situation: { titre: "t", histoire: ["h"], conclusion: "c", etapes: Array.from({ length: 2 }, () => ({ type: "nombre", question: "q", reponse: 15, indices: ["i"], solution: "s" })) }
});
const avec = (modifier) => { const c = base(); modifier(c); return c; };

test("schéma : 1 à 3 indices par exercice (QCM et nombre), l'ancien « indice » d'un QCM reste accepté", () => {
  assert.equal(MAX_INDICES, 3);
  assert.doesNotThrow(() => validerContenu(avec((c) => {
    c.application.exercices[0].indices = ["léger", "plus précis", "presque la méthode"];
    c.application.exercices[1].indice = "ancien format";
    c.situation.etapes[0].indices = ["un", "deux", "trois"];
  })));
  const casse = (modifier, motif) => assert.throws(() => validerContenu(avec(modifier)), motif);
  casse((c) => { c.application.exercices[0].indices = ["a", "b", "c", "d"]; }, /3 « indices » au plus/);
  casse((c) => { c.application.exercices[0].indices = []; }, /liste de 1 à 3 textes/);
  casse((c) => { c.application.exercices[0].indices = ["a", " "]; }, /liste de 1 à 3 textes/);
  casse((c) => { c.application.exercices[0].indices = ["même", "même "]; }, /deux « indices » identiques/);
  casse((c) => { Object.assign(c.application.exercices[0], { indice: "x", indices: ["y"] }); }, /« indice » et « indices » ensemble/);
  casse((c) => { c.application.exercices[0].indice = ""; }, /« indice » vide/);
  casse((c) => { delete c.situation.etapes[0].indices; }, /au moins un « indices » requis/);
  casse((c) => { c.situation.etapes[0].indices = ["a", "b", "c", "d"]; }, /3 « indices » au plus/);
});

test("couverture : exercices avec au moins un indice et avec les 3 indices gradués", () => {
  assert.deepEqual(indicesDe({ indice: "x" }), ["x"]);
  assert.deepEqual(indicesDe({ indices: ["a", "b"] }), ["a", "b"]);
  assert.deepEqual(indicesDe({}), []);
  const c = avec((x) => { x.application.exercices[0].indices = ["a", "b", "c"]; x.application.exercices[1].indice = "d"; });
  assert.deepEqual(compterIndices(c), { exercices: 5, avecIndice: 4, complets: 1 });
});

test("notions pilotes : chaque exercice de Pythagore et des fractions a ses 3 indices gradués", async () => {
  for (const id of ["pythagore", "fractions"]) {
    const contenu = JSON.parse(await readFile(`${racine}catalogue/${id}/contenu.json`, "utf8"));
    const { exercices, complets } = compterIndices(contenu);
    assert.equal(complets, exercices, id);
    // Le dernier indice ne donne jamais la réponse d'un exercice « nombre ».
    for (const ex of [...contenu.application.exercices, ...contenu.situation.etapes].filter((e) => e.type === "nombre")) {
      const reponse = String(ex.reponse).replace(".", ",");
      assert.ok(!ex.indices.at(-1).includes(`= ${reponse}`) && !ex.indices.at(-1).endsWith(` ${reponse}.`), `${id} : « ${ex.question} »`);
    }
  }
});
