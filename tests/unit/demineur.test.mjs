// Moteur du Démineur : extrait de la page (catalogue/demineur/page.html) et exécuté dans un contexte sans DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { routerLocal } from "../../worker/src/router.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { lireMetaHtml } from "../../scripts/lib/catalogue.mjs";

const html = await readFile(new URL("../../catalogue/demineur/page.html", import.meta.url), "utf8");
const source = html.match(/<script id="moteur-demineur">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, "script du moteur présent");
// Contexte vide : ni window, ni document. Le moteur doit fonctionner sans DOM.
const M = vm.runInNewContext(`${source}\nMoteurDemineur`, { Math, Object, Array, Set, Number, String, Error });

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function graine(n) {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const compterMines = (p) => p.cases.filter((c) => c.mine).length;

test("moteur : aucune dépendance au DOM", () => {
  assert.doesNotMatch(source, /\b(document|window|localStorage|navigator)\b/);
});

test("niveaux : dimensions et nombre de mines classiques", () => {
  const attendus = { debutant: [9, 9, 10], intermediaire: [16, 16, 40], expert: [30, 16, 99] };
  assert.deepEqual(Object.keys(M.NIVEAUX), Object.keys(attendus));
  for (const [id, [colonnes, lignes, mines]] of Object.entries(attendus)) {
    const p = M.creerPartie(id);
    assert.equal(p.colonnes, colonnes, id);
    assert.equal(p.lignes, lignes, id);
    assert.equal(p.cases.length, colonnes * lignes, id);
    assert.equal(p.mines, mines, id);
    assert.equal(p.statut, "pret", id);
    assert.equal(compterMines(p), 0, `${id} : aucune mine avant le premier coup`);
  }
  assert.throws(() => M.creerPartie("impossible"), /niveau inconnu/);
  assert.throws(() => M.creerPartie({ colonnes: 3, lignes: 3, mines: 9 }), /mines/);
});

test("placement : nombre exact de mines et premier coup sûr, sur de nombreuses parties", () => {
  for (const id of Object.keys(M.NIVEAUX)) {
    for (let n = 0; n < 200; n++) {
      const p = M.creerPartie(id);
      const premier = (n * 37) % p.cases.length;
      M.reveler(p, premier, graine(n));
      assert.equal(compterMines(p), p.mines, `${id} #${n}`);
      assert.notEqual(p.statut, "perdu", `${id} #${n} : premier coup perdant`);
      assert.equal(p.cases[premier].mine, false);
      // La grille le permet à chaque niveau : le premier coup est une case vide, qui ouvre une zone.
      assert.equal(p.cases[premier].voisines, 0, `${id} #${n}`);
      for (const v of M.voisins(p, premier)) assert.equal(p.cases[v].mine, false);
    }
  }
});

test("placement : grille trop petite pour épargner les voisines, seule la case jouée est protégée", () => {
  const p = M.creerPartie({ id: "mini", colonnes: 3, lignes: 3, mines: 8 });
  M.reveler(p, 4, graine(1));
  assert.equal(compterMines(p), 8);
  assert.equal(p.cases[4].mine, false);
  assert.equal(p.statut, "victoire");
});

test("placement : hasard toujours en limite haute, sans débordement", () => {
  const p = M.creerPartie("expert");
  M.reveler(p, 0, () => 0.9999999999);
  assert.equal(compterMines(p), 99);
});

test("voisines : comptage des mines adjacentes, diagonales comprises", () => {
  const p = M.depuisModele([
    "*..",
    ".o.",
    "..*"
  ]);
  assert.equal(p.cases[4].voisines, 2);
  assert.equal(p.cases[1].voisines, 1);
  assert.equal(p.cases[2].voisines, 0);
  assert.equal(p.cases[5].voisines, 1);
  assert.deepEqual([...M.voisins(p, 0)].sort(), [1, 3, 4]);
  assert.equal(M.voisins(p, 4).length, 8);
});

test("révélation : une case vide ouvre sa zone, s'arrête aux chiffres et respecte les drapeaux", () => {
  const p = M.depuisModele([
    ".....",
    ".....",
    "....*",
    "....."
  ]);
  M.basculerDrapeau(p, 0);
  const ouvertes = M.reveler(p, 10);
  assert.ok(ouvertes.length > 1, "propagation");
  assert.equal(p.cases[0].revelee, false, "une case avec drapeau ne s'ouvre pas");
  assert.equal(p.cases[14].revelee, false, "la mine reste fermée");
  assert.equal(p.cases[9].revelee, true, "chiffre au bord de la zone ouvert");
  assert.equal(p.cases[9].voisines, 1);
  assert.equal(p.revelees, ouvertes.length);
  assert.deepEqual([...M.reveler(p, 10)], [], "rouvrir une case ne fait rien");
});

test("drapeaux : pose, retrait, compteur, et impossibles sur une case ouverte", () => {
  const p = M.depuisModele(["*.", "o."]);
  assert.equal(M.minesRestantes(p), 1);
  assert.equal(M.basculerDrapeau(p, 1), true);
  assert.equal(p.drapeaux, 1);
  assert.equal(M.minesRestantes(p), 0);
  assert.equal(M.basculerDrapeau(p, 0), true);
  assert.equal(M.minesRestantes(p), -1, "le compteur peut devenir négatif si on pose trop de drapeaux");
  assert.equal(M.basculerDrapeau(p, 1), true);
  assert.equal(p.cases[1].drapeau, false);
  assert.equal(M.basculerDrapeau(p, 2), false, "case ouverte");
  assert.deepEqual([...M.reveler(p, 0)], [], "une case avec drapeau ne s'ouvre pas");
  assert.equal(p.statut, "en-cours");
});

test("victoire : toutes les cases sans mine ouvertes, mines marquées, plus aucun coup possible", () => {
  const p = M.depuisModele(["*.", ".."]);
  M.reveler(p, 1); M.reveler(p, 2);
  assert.equal(p.statut, "en-cours");
  M.reveler(p, 3);
  assert.equal(p.statut, "victoire");
  assert.equal(p.cases[0].drapeau, true);
  assert.equal(M.minesRestantes(p), 0);
  assert.equal(M.estTerminee(p), true);
  assert.equal(M.basculerDrapeau(p, 0), false);
});

test("victoire : une partie complète jouée case par case", () => {
  const p = M.creerPartie("intermediaire");
  M.reveler(p, 0, graine(42));
  for (let i = 0; i < p.cases.length && p.statut === "en-cours"; i++) if (!p.cases[i].mine) M.reveler(p, i);
  assert.equal(p.statut, "victoire");
  assert.equal(p.revelees, p.cases.length - 40);
});

test("défaite : ouvrir une mine termine la partie", () => {
  const p = M.depuisModele(["*.", ".."]);
  assert.deepEqual([...M.reveler(p, 0)], [0]);
  assert.equal(p.statut, "perdu");
  assert.equal(p.explosion, 0);
  assert.deepEqual([...M.reveler(p, 1)], [], "plus aucun coup après la défaite");
});

test("ouverture autour d'un chiffre : seulement si ses drapeaux sont tous posés", () => {
  const p = M.depuisModele(["*..", ".o.", "..."]);
  assert.deepEqual([...M.revelerAutour(p, 4)], [], "aucun drapeau : rien ne se passe");
  M.basculerDrapeau(p, 0);
  M.revelerAutour(p, 4);
  assert.equal(p.statut, "victoire");
  const q = M.depuisModele(["*..", ".o.", "..."]);
  M.basculerDrapeau(q, 1);
  M.revelerAutour(q, 4);
  assert.equal(q.statut, "perdu", "un drapeau mal placé fait perdre");
});

test("changement de difficulté et nouvelle partie : état neuf et indépendant", () => {
  const p = M.creerPartie("debutant");
  M.reveler(p, 40, graine(3));
  M.basculerDrapeau(p, p.cases.findIndex((c) => !c.revelee));
  const q = M.creerPartie("expert");
  assert.equal(q.cases.length, 480);
  assert.equal(q.mines, 99);
  assert.equal(q.revelees + q.drapeaux, 0);
  assert.equal(q.statut, "pret");
  const r = M.creerPartie("debutant");
  assert.equal(r.statut, "pret");
  assert.ok(r.cases.every((c) => !c.mine && !c.revelee && !c.drapeau), "nouvelle partie vierge");
  assert.notEqual(r.cases, p.cases);
});

test("hasard : deux parties de même graine sont identiques, de graines différentes non", () => {
  const plan = (n) => { const p = M.creerPartie("expert"); M.reveler(p, 200, graine(n)); return p.cases.map((c) => (c.mine ? 1 : 0)).join(""); };
  assert.equal(plan(7), plan(7));
  assert.notEqual(plan(7), plan(8));
});

test("modèle : refuse une grille irrégulière ou un signe inconnu", () => {
  assert.throws(() => M.depuisModele(["**", "*"]), /modèle invalide/);
  assert.throws(() => M.depuisModele(["*x"]), /modèle invalide/);
});

test("catalogue : métadonnées du jeu et routage des questions d'exemple", () => {
  const meta = lireMetaHtml(html);
  assert.equal(meta.id, "demineur");
  assert.equal(meta.sujet, "jeux/demineur");
  assert.equal(meta.langue, "fr");
  for (const q of ["je veux jouer au démineur", "Le DÉMINEUR", "minesweeper"]) assert.equal(routerLocal(q, CATALOGUE.index), "demineur", q);
});

test("règles : l'illustration des chiffres respecte le comptage du moteur", () => {
  const bloc = html.match(/<div class="exemple"[\s\S]*?<\/div>\s*<\/div>/)?.[0];
  assert.ok(bloc, "illustration présente");
  const lignes = [...bloc.matchAll(/<div class="rangee">([\s\S]*?)<\/div>/g)]
    .map(([, rangee]) => [...rangee.matchAll(/data-etat="([^"]+)">([^<]*)</g)].map(([, etat, texte]) => ({ etat, texte })));
  const p = M.depuisModele(lignes.map((l) => l.map((c) => (c.etat === "mine" ? "*" : "o")).join("")));
  lignes.flat().forEach(({ etat, texte }, i) => {
    if (etat === "mine") return;
    const n = p.cases[i].voisines;
    assert.equal(etat, n ? `n${n}` : "vide", `case ${i}`);
    assert.equal(texte, n ? String(n) : "", `case ${i}`);
  });
});
