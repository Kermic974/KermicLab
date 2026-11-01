import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validerContenu } from "../../scripts/lib/gabarit.mjs";
import { lireFrontMatter, lireMetaHtml } from "../../scripts/lib/catalogue.mjs";
import { routerLocal } from "../../worker/src/router.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";

const NOTIONS = [
  ["premiere-guerre-mondiale", /1914/, /1918/, /1919/, /arrêt des combats/i],
  ["totalitarismes", /1922/, /1933/, /1937-1938/, /répression/i],
  ["seconde-guerre-mondiale", /1939/, /1941/, /1945/, /ONU/],
  ["guerre-froide", /1947/, /1989/, /1991/, /dissolution/i],
  ["decolonisation", /1947/, /1955/, /1962/, /institutions/i],
  ["construction-europeenne", /1951/, /1993/, /2002/, /1999/],
  ["ve-republique", /1958/, /1962/, /2000/, /camps opposés/i],
  ["monde-depuis-1990", /1991/, /2001/, /2015/, /réchauffement/i]
];

for (const [id, ...reperes] of NOTIONS) {
  test(`${id} : catalogue, progression et exercices d'histoire`, async () => {
    const dossier = new URL(`../../catalogue/${id}/`, import.meta.url);
    const fiche = lireFrontMatter(await readFile(new URL("fiche.md", dossier), "utf8"));
    const contenu = JSON.parse(await readFile(new URL("contenu.json", dossier), "utf8"));
    assert.equal(fiche.id, id);
    assert.equal(fiche.sujet, `histoire/${id}`);
    assert.equal(fiche.langues, "fr");
    assert.doesNotThrow(() => validerContenu(contenu, id));
    assert.equal(contenu.niveaux[0].niveau, "pour démarrer");
    assert.ok(contenu.niveaux.some((n) => /3e/.test(n.niveau)));
    assert.ok(contenu.niveaux.some((n) => /lycée/.test(n.niveau)));
    const explication = contenu.niveaux.flatMap((n) => n.paragraphes).join(" ");
    for (const repere of reperes.slice(0, 3)) assert.match(explication, repere);
    assert.equal(contenu.application.exercices.length, 4);
    assert.match(contenu.application.exercices[0].titre, /Causes|Transformation/);
    assert.equal(contenu.application.exercices[1].titre, "Acteurs");
    assert.equal(contenu.situation.etapes.length, 3);
    for (const ex of [...contenu.application.exercices, ...contenu.situation.etapes]) {
      assert.equal(ex.type, "qcm");
      assert.ok(ex.indice.trim().length > 0);
      assert.equal(new Set(ex.choix).size, ex.choix.length);
      assert.ok(ex.explication.trim().length > 0);
    }
    const consequence = contenu.application.exercices[3];
    assert.match(consequence.choix[consequence.bonne], reperes[3]);
    const maquette = CATALOGUE.index.maquettes.find((m) => m.id === id);
    assert.ok(maquette, `${id} figure dans l'index généré`);
    for (const question of maquette.questions) {
      assert.equal(routerLocal(question, CATALOGUE.index), id, question);
    }
    const html = await readFile(new URL("page.html", dossier), "utf8");
    const meta = lireMetaHtml(html, id);
    assert.equal(meta.id, id);
    assert.equal(meta.version, fiche.version);
    assert.equal(meta.langue, "fr");
    assert.match(html, /connect-src 'none'/);
  });
}

test("histoire : ne pas confondre causes, dates de réforme et étapes des conflits", async () => {
  const lire = async (id) => JSON.parse(await readFile(new URL(`../../catalogue/${id}/contenu.json`, import.meta.url), "utf8"));
  const totalitarismes = await lire("totalitarismes");
  const cause = totalitarismes.application.exercices[0];
  assert.equal(cause.choix[cause.bonne], "Parce que 1929 vient après 1922");
  const republique = await lire("ve-republique");
  const reforme = republique.situation.etapes[0];
  assert.equal(reforme.choix[reforme.bonne], "La réforme est adoptée en 1962 et appliquée pour la première fois en 1965");
  const monde = await lire("monde-depuis-1990");
  const ukraine = monde.situation.etapes[1];
  assert.equal(ukraine.choix[ukraine.bonne], "Le conflit commence en 2014 ; la Russie lance une invasion à grande échelle en février 2022");
});
