import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { lireFrontMatter } from "../../scripts/lib/catalogue.mjs";
import { validerContenu } from "../../scripts/lib/gabarit.mjs";
import { routerLocal } from "../../worker/src/router.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";

const NOTIONS = ["devoir", "etat", "justice-philosophie", "liberte-philosophie", "langage", "raison", "science", "technique", "verite"];
const racine = new URL("../../catalogue/", import.meta.url);
const texteNonVide = (texte) => assert.ok(typeof texte === "string" && texte.trim().length > 0);
const cles = (objet, attendues) => assert.deepEqual(Object.keys(objet).sort(), [...attendues].sort());

for (const id of NOTIONS) {
  test(`philosophie : ${id} respecte le contrat et propose une progression corrigée`, async () => {
    const fiche = lireFrontMatter(await readFile(new URL(`${id}/fiche.md`, racine), "utf8"));
    const contenu = JSON.parse(await readFile(new URL(`${id}/contenu.json`, racine), "utf8"));
    assert.equal(fiche.id, id);
    assert.equal(fiche.sujet, `philosophie/${id}`);
    assert.equal(fiche.niveau, "terminale");
    assert.equal(fiche.langues, "fr");
    const maquette = CATALOGUE.index.maquettes.find((m) => m.id === id);
    assert.ok(maquette, `${id} présent dans le catalogue construit`);
    for (const question of fiche.questions) assert.equal(routerLocal(question, CATALOGUE.index), id, question);

    assert.doesNotThrow(() => validerContenu(contenu, id));
    cles(contenu, ["titresOnglets", "intro", "niveaux", "application", "situation"]);
    cles(contenu.titresOnglets, ["explication", "application", "mise-en-situation"]);
    Object.values(contenu.titresOnglets).forEach(texteNonVide);
    texteNonVide(contenu.intro);
    assert.ok(contenu.niveaux.length >= 3);
    assert.match(contenu.niveaux[0].titre, /^Intuition/);
    assert.match(contenu.niveaux.at(-1).titre, /^Formaliser/);
    assert.match(contenu.niveaux.at(-1).niveau, /terminale/);
    for (const niveau of contenu.niveaux) {
      cles(niveau, ["titre", "niveau", "paragraphes", "exemple", "aRetenir"]);
      texteNonVide(niveau.aRetenir);
      cles(niveau.exemple, ["titre", "etapes"]);
      texteNonVide(niveau.exemple.titre);
      assert.ok(niveau.exemple.etapes.length >= 2);
      niveau.exemple.etapes.forEach(texteNonVide);
    }
    cles(contenu.application, ["intro", "exercices"]);
    texteNonVide(contenu.application.intro);
    cles(contenu.situation, ["titre", "histoire", "etapes", "conclusion"]);
    contenu.situation.histoire.forEach(texteNonVide);
    for (const ex of [...contenu.application.exercices, ...contenu.situation.etapes]) {
      cles(ex, ["type", "question", "choix", "bonne", "indice", "explication"]);
      assert.equal(ex.type, "qcm");
      assert.equal(new Set(ex.choix).size, ex.choix.length, "choix distincts");
      texteNonVide(ex.indice);
    }
  });
}

test("philosophie : les mots partagés ne détournent pas les notions scientifiques existantes", () => {
  for (const [question, id] of [
    ["c'est quoi un changement d'état ?", "etats-de-la-matiere"],
    ["explique l'état de la matière", "etats-de-la-matiere"],
    ["quelle est la raison d'une suite ?", "suites"],
    ["comment faire un raisonnement par récurrence ?", "recurrence"]
  ]) assert.equal(routerLocal(question, CATALOGUE.index), id, question);
});
