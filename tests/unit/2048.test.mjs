import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { routerLocal } from "../../worker/src/router.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { lireMetaHtml } from "../../scripts/lib/catalogue.mjs";

const html = await readFile(new URL("../../catalogue/2048/page.html", import.meta.url), "utf8");
const source = html.match(/<script id="moteur-2048">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, "moteur présent dans la page");
const M = vm.runInNewContext(`${source}\nMoteur2048`, { Object, Array, Number, Math, Error });
const hasard = (...nombres) => {
  let i = 0;
  return () => nombres[i++ % nombres.length];
};

test("moteur pur, sans DOM ni stockage", () => {
  assert.doesNotMatch(source, /\b(document|window|localStorage|fetch|XMLHttpRequest)\b/);
});

test("création reproductible et apparition de tuiles 2 ou 4", () => {
  const partie = M.creerPartie(hasard(0, 0, 0, 0.95));
  assert.equal(partie.grille.length, 16);
  assert.equal(partie.grille.filter(Boolean).length, 2);
  assert.deepEqual([...partie.grille], [...M.creerPartie(hasard(0, 0, 0, 0.95)).grille]);
  assert.deepEqual([...new Set(partie.grille.filter(Boolean))], [2, 4]);
});

test("fusionne une fois par coup, met à jour le score et ajoute une tuile", () => {
  const partie = { grille: [2, 2, 2, 0, ...Array(12).fill(0)], score: 0, terminee: false };
  const resultat = M.deplacer(partie, "left", () => 0);
  assert.deepEqual([...partie.grille.slice(0, 4)], [4, 2, 2, 0]);
  assert.equal(resultat.deplace, true);
  assert.equal(resultat.fusionne, 4);
  assert.equal(resultat.score, 4);
  assert.equal(partie.grille.filter(Boolean).length, 3);
});

test("les quatre directions déplacent correctement et les coups nuls ne créent pas de tuile", () => {
  const partie = { grille: [0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], score: 0 };
  for (const direction of ["left", "right", "up", "down"]) {
    partie.grille.fill(0); partie.grille[5] = 2;
    assert.equal(M.deplacer(partie, direction, () => 0).deplace, true, direction);
  }
  const bloque = { grille: [2, 4, 8, 16, 4, 8, 16, 2, 8, 16, 2, 4, 16, 2, 4, 8], score: 0 };
  assert.equal(M.peutBouger(bloque.grille), false);
  assert.equal(M.deplacer(bloque, "left", () => 0).terminee, true);
  assert.throws(() => M.deplacer(bloque, "diagonal"), /direction inconnue/);
});

test("les cinq grades progressent de Noob à Pro", () => {
  assert.deepEqual(Array.from(M.NIVEAUX, (n) => n.nom), ["Noob", "Débutant", "Intermédiaire", "Avancé", "Pro"]);
  assert.deepEqual(Array.from(M.NIVEAUX, (n) => n.cible), [16, 32, 64, 128, 2048]);
});

test("catalogue : métadonnées et routage des demandes de 2048", () => {
  const meta = lireMetaHtml(html);
  assert.equal(meta.id, "2048");
  assert.equal(meta.sujet, "jeux/2048");
  for (const question of ["je veux jouer au 2048", "comment jouer au 2048 ?", "apprendre le 2048 du débutant au pro"]) {
    assert.equal(routerLocal(question, CATALOGUE.index), "2048", question);
  }
});
