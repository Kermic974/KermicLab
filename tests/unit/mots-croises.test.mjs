import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { routerLocal } from "../../worker/src/router.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { lireMetaHtml } from "../../scripts/lib/catalogue.mjs";

const html = await readFile(new URL("../../catalogue/mots-croises/page.html", import.meta.url), "utf8");
const source = html.match(/<script id="moteur-mots-croises">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, "script du moteur présent");
const M = vm.runInNewContext(`${source}\nMoteurMotsCroises`, { Math, Object, Array, Number, String, Error });
const donnees = JSON.parse(html.match(/<script type="application\/json" id="donnees-mots-croises">([\s\S]*?)<\/script>/)[1]);

test("moteur pur, sans DOM ni stockage", () => {
  assert.doesNotMatch(source, /\b(document|window|localStorage|navigator)\b/);
});

test("cinq grilles progressives : mots, croisements et définitions valides", () => {
  assert.deepEqual(donnees.etapes.map((e) => e.nom), ["Noob", "Débutant", "Intermédiaire", "Avancé", "Pro"]);
  for (const etape of donnees.etapes) {
    const grille = M.creerGrille(etape);
    assert.equal(grille.mots.length, etape.verticale.mot.length + 1, etape.nom);
    assert.equal(grille.mots[0].direction, "vertical");
    for (const [i, mot] of etape.horizontales.entries()) {
      assert.equal(mot.mot[mot.croisement ?? 0], etape.verticale.mot[i], `${etape.nom}: croisement ${i}`);
      assert.ok(mot.indice.trim(), `${etape.nom}: définition ${mot.mot}`);
    }
    const saisie = grille.cases.map((rangee) => rangee.map((lettre) => lettre || ""));
    assert.equal(M.verifier(grille, saisie).resolu, true, etape.nom);
    const erronnee = grille.cases.map((rangee) => rangee.map((lettre) => lettre || ""));
    const { ligne, colonne } = grille.mots[1].cases[0];
    erronnee[ligne][colonne] = "Z";
    assert.equal(M.verifier(grille, erronnee).erreurs.length, 1, `${etape.nom}: erreur repérée`);
    const vide = grille.cases.map((rangee) => rangee.map(() => ""));
    const indice = M.prochainIndice(grille, vide, grille.mots[1]);
    assert.deepEqual([indice.ligne, indice.colonne, indice.lettre], [ligne, colonne, grille.mots[1].mot[0]]);
  }
  assert.ok(donnees.etapes.some((e) => e.horizontales.some((m) => m.croisement > 0)), "les grilles ont des croisements au milieu des mots");
});

test("moteur : rejette les croisements incohérents et normalise les accents", () => {
  assert.equal(M.normaliser("Équation"), "EQUATION");
  assert.throws(() => M.creerGrille({
    verticale: { mot: "AB", indice: "Vertical" },
    horizontales: [{ mot: "X", indice: "Horizontal" }, { mot: "B", indice: "Horizontal" }]
  }), /croisement invalide/);
});

test("catalogue : métadonnées du jeu et routage des questions d'exemple", () => {
  const meta = lireMetaHtml(html);
  assert.equal(meta.id, "mots-croises");
  assert.equal(meta.sujet, "jeux/mots-croises");
  for (const q of ["je veux jouer aux mots croisés", "propose-moi des mots croisés", "apprendre les mots croisés du débutant au pro"]) {
    assert.equal(routerLocal(q, CATALOGUE.index), "mots-croises", q);
  }
});
