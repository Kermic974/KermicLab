import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { routerLocal } from "../../worker/src/router.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { lireMetaHtml } from "../../scripts/lib/catalogue.mjs";

const html = await readFile(new URL("../../catalogue/mots-fleches/page.html", import.meta.url), "utf8");
const source = html.match(/<script id="moteur-mots-fleches">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, "moteur présent dans la page");
const M = vm.runInNewContext(`${source}\nMoteurMotsFleches`, { Object, Array, Number, Error, Math, String });

test("moteur pur : aucune dépendance au DOM, au stockage ni au réseau", () => {
  assert.doesNotMatch(source, /\b(document|window|localStorage|fetch|XMLHttpRequest)\b/);
});

test("les cinq grades offrent des grilles croissantes avec des croisements cohérents", () => {
  let motsPrecedents = 0;
  for (const niveau of M.NIVEAUX) {
    const partie = M.creerPartie(niveau.id);
    assert.equal(partie.mots.length, niveau.couples * 2);
    assert.ok(partie.mots.length > motsPrecedents, niveau.id);
    motsPrecedents = partie.mots.length;
    for (const mot of partie.mots) {
      assert.equal(mot.indices.length, mot.longueur);
      assert.equal(mot.reponse.length, mot.longueur);
      assert.ok(mot.indices.every((i) => partie.cases[i]));
      assert.deepEqual([...new Set(mot.indices.map((i) => partie.cases[i].solution))], [...new Set(mot.reponse)]);
    }
    for (const c of partie.cases.filter(Boolean)) assert.ok(c.mots.length > 0);
    const croisements = partie.cases.filter((c) => c?.mots.length > 1);
    assert.equal(croisements.length, niveau.couples);
    for (const c of croisements) assert.equal(new Set(c.mots.map((id) => partie.mots.find((m) => m.id === id).reponse[
      partie.mots.find((m) => m.id === id).indices.indexOf(partie.cases.indexOf(c))
    ])).size, 1);
  }
  assert.throws(() => M.creerPartie("impossible"), /niveau inconnu/);
});

test("saisie clavier : normalise les accents et refuse les cases inexistantes", () => {
  assert.equal(M.normaliserLettre("é"), "E");
  assert.equal(M.normaliserLettre("7"), "");
  const partie = M.creerPartie("noob");
  const index = partie.mots.find((m) => m.id === "mot").indices[0];
  assert.equal(M.placer(partie, index, "m"), "ok");
  assert.equal(partie.cases[index].lettre, "M");
  assert.equal(M.placer(partie, 0, "X"), "invalide");
  assert.equal(M.placer(partie, -1, "X"), "invalide");
});

test("vérification : distingue les cases vides et les lettres fausses, valide une grille complète", () => {
  const partie = M.creerPartie("noob");
  const index = partie.mots.find((m) => m.id === "mot").indices[0];
  M.placer(partie, index, "X");
  assert.deepEqual([...M.verifier(partie).erreurs], [index]);
  assert.equal(M.verifier(partie).resolu, false);
  for (const [i, c] of partie.cases.entries()) if (c) M.placer(partie, i, c.solution);
  assert.deepEqual([...M.verifier(partie).vides], []);
  assert.deepEqual([...M.verifier(partie).erreurs], []);
  assert.equal(M.verifier(partie).resolu, true);
});

test("un indice révèle une lettre manquante ou erronée sans en inventer", () => {
  const partie = M.creerPartie("noob");
  const cible = partie.cases.findIndex(Boolean);
  assert.equal(M.revelerIndice(partie), cible);
  assert.equal(partie.cases[cible].lettre, partie.cases[cible].solution);
  assert.equal(partie.aides, 1);
  const second = M.revelerIndice(partie, cible);
  assert.notEqual(second, cible);
  assert.equal(partie.cases[second].lettre, partie.cases[second].solution);
  for (const [i, c] of partie.cases.entries()) if (c) M.placer(partie, i, c.solution);
  assert.equal(M.revelerIndice(partie), null);
});

test("Académie : cinq grades complets avec des QCM dont les réponses sont valides", async () => {
  const parcours = JSON.parse(html.match(/<script type="application\/json" id="parcours-mots-fleches">([\s\S]*?)<\/script>/)[1]);
  assert.equal(parcours.grades.length, 5);
  for (const grade of parcours.grades) {
    assert.ok(grade.lecons.length > 0, grade.id);
    for (const lecon of grade.lecons) for (const exo of lecon.exercices) {
      assert.equal(exo.type, "qcm");
      assert.ok(exo.choix[exo.bonne], `${grade.id}/${lecon.id}`);
    }
  }
});

test("catalogue : métadonnées et routage des demandes de mots fléchés", () => {
  const meta = lireMetaHtml(html);
  assert.equal(meta.id, "mots-fleches");
  assert.equal(meta.sujet, "jeux/mots-fleches");
  for (const question of ["je veux jouer aux mots fléchés", "comment jouer aux mots fléchés ?", "mots fléchés du débutant au pro"]) {
    assert.equal(routerLocal(question, CATALOGUE.index), "mots-fleches", question);
  }
});
