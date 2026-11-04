import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { routerLocal } from "../../worker/src/router.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { lireMetaHtml } from "../../scripts/lib/catalogue.mjs";

const html = await readFile(new URL("../../catalogue/poker-texas-holdem/page.html", import.meta.url), "utf8");
const source = html.match(/<script id="moteur-poker-texas-holdem">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, "moteur présent dans la page");
const M = vm.runInNewContext(`${source}\nMoteurPoker`, { Math, Object, Array, Set, Map, Number, String, Error, RangeError, TypeError });
const main = (texte) => texte.split(" ").map((code) => ({
  rang: ({ V: 11, D: 12, R: 13, A: 14 }[code[0]] ?? Number(code.slice(0, -1))),
  couleur: code.at(-1)
}));
const graine = (depart = 42) => {
  let etat = depart >>> 0;
  return () => { etat = (etat * 1664525 + 1013904223) >>> 0; return etat / 4294967296; };
};

test("moteur pur : aucune dépendance au DOM, au stockage ni au réseau", () => {
  assert.doesNotMatch(source, /\b(document|window|localStorage|fetch|XMLHttpRequest)\b/);
});

test("classe les neuf combinaisons du poker dans le bon ordre", () => {
  const mains = [
    "2♣ 5♦ 7♥ 9♠ V♣",
    "2♣ 2♦ 7♥ 9♠ V♣",
    "2♣ 2♦ 7♥ 7♠ V♣",
    "2♣ 2♦ 2♥ 9♠ V♣",
    "2♣ 3♦ 4♥ 5♠ 6♣",
    "2♥ 5♥ 7♥ 9♥ V♥",
    "2♣ 2♦ 2♥ 7♠ 7♣",
    "2♣ 2♦ 2♥ 2♠ V♣",
    "2♥ 3♥ 4♥ 5♥ 6♥"
  ].map(main).map(M.evaluerMain);
  for (let i = 0; i < mains.length - 1; i++) assert.equal(M.comparerScores(mains[i], mains[i + 1]), -1, `combinaison ${i}`);
});

test("départage les mêmes combinaisons par leurs cartes restantes", () => {
  assert.equal(M.comparerScores(M.evaluerMain(main("A♣ A♦ R♥ 9♠ 2♣")), M.evaluerMain(main("R♣ R♦ D♥ 9♠ 2♣"))), 1);
  assert.equal(M.comparerScores(M.evaluerMain(main("A♣ A♦ R♥ 9♠ 2♣")), M.evaluerMain(main("A♥ A♠ R♣ 9♦ 2♥"))), 0);
});

test("détecte la quinte à l'as bas et évalue la meilleure combinaison sur sept cartes", () => {
  assert.equal(M.nomMain(M.evaluerMain(main("A♣ 2♦ 3♥ 4♠ 5♣ 9♦ R♥"))), "quinte");
  assert.equal(M.nomMain(M.evaluerMain(main("A♣ 2♣ 3♣ 4♣ 5♣ 9♦ R♥"))), "quinte flush");
});

test("refuse les cartes invalides, les doublons et les tailles de main impossibles", () => {
  assert.throws(() => M.evaluerMain(main("2♣ 3♦ 4♥ 5♠")), /5 à 7 cartes/);
  assert.throws(() => M.evaluerMain(main("2♣ 2♣ 4♥ 5♠ 6♦")), /même carte/);
  assert.throws(() => M.evaluerMain([{ rang: 15, couleur: "♣" }, ...main("3♦ 4♥ 5♠ 6♦")]), /carte invalide/);
});

test("distribution : 52 cartes uniques, deux mains de deux cartes et blinds équilibrées", () => {
  const p = M.creerPartie(graine());
  const cartes = [...p.joueur.main, ...p.ordinateur.main, ...p.paquet];
  assert.equal(cartes.length, 52);
  assert.equal(new Set(cartes.map((c) => `${c.rang}${c.couleur}`)).size, 52);
  assert.equal(p.pot, 30);
  assert.equal(p.joueur.pile, 990);
  assert.equal(p.ordinateur.pile, 980);
  assert.equal(p.communes.length, 0);
});

test("une manche complète révèle les cinq cartes et attribue le pot au gagnant", () => {
  const p = M.creerPartie(graine(8));
  M.agir(p, "suivre", () => .99);
  assert.equal(p.phase, "flop");
  assert.equal(p.communes.length, 3);
  M.agir(p, "parole", () => .99);
  assert.equal(p.phase, "turn");
  M.agir(p, "parole", () => .99);
  assert.equal(p.phase, "river");
  M.agir(p, "parole", () => .99);
  assert.equal(p.statut, "terminee");
  assert.equal(p.communes.length, 5);
  assert.ok(p.resultat.scoreJoueur);
  assert.ok(p.resultat.scoreOrdi);
  assert.equal(p.joueur.pile + p.ordinateur.pile, 2000);
});

test("se coucher termine la manche et attribue les jetons sans montrer la main adverse", () => {
  const p = M.creerPartie(graine(5));
  M.agir(p, "coucher");
  assert.equal(p.statut, "terminee");
  assert.equal(p.resultat.gagnant, "ordinateur");
  assert.equal(p.ordinateur.pile, 1010);
  assert.equal(p.resultat.scoreOrdi, null);
});

test("l'ordinateur peut se coucher et le pot revient au joueur", () => {
  const p = M.creerPartie(graine(5));
  p.ordinateur.main = main("2♣ 3♦");
  M.agir(p, "relancer", () => 0);
  assert.equal(p.statut, "terminee");
  assert.equal(p.resultat.gagnant, "joueur");
  assert.equal(p.joueur.pile, 1020);
  assert.equal(p.ordinateur.pile, 980);
  assert.equal(p.joueur.pile + p.ordinateur.pile, 2000);
});

test("une égalité partage équitablement le pot et ne départage pas par la couleur", () => {
  const p = M.creerPartie(graine());
  p.phase = "river";
  p.communes = main("10♥ V♥ D♥ R♥ A♥");
  p.joueur.main = main("2♣ 3♣");
  p.ordinateur.main = main("4♦ 5♦");
  p.joueur.pile = 900;
  p.ordinateur.pile = 899;
  p.joueur.mise = p.ordinateur.mise = p.miseHaute = 0;
  p.pot = 201;
  M.agir(p, "parole");
  assert.equal(p.resultat.gagnant, "egalite");
  assert.equal(p.joueur.pile, 1000);
  assert.equal(p.ordinateur.pile, 1000);
});

test("une mise non suivie est rendue avant l'abattage lorsque l'adversaire est à tapis", () => {
  const p = M.creerPartie(graine());
  p.joueur.main = main("2♣ 3♣");
  p.ordinateur.main = main("4♦ 5♦");
  p.joueur.pile = 5;
  p.ordinateur.pile = 985;
  p.joueur.mise = 10;
  p.ordinateur.mise = p.miseHaute = 40;
  p.pot = 1010;
  M.agir(p, "suivre");
  assert.equal(p.statut, "terminee");
  assert.equal(p.joueur.pile + p.ordinateur.pile, 2000);
  assert.equal(p.joueur.mise, p.ordinateur.mise, "la mise excédentaire est rendue");
});

test("affiche les quintes flush royales et ne distribue pas de petites blindes impossibles", () => {
  assert.equal(M.nomMain(M.evaluerMain(main("10♥ V♥ D♥ R♥ A♥ 2♣ 3♦"))), "quinte flush royale");
  assert.equal(M.creerPartie(Math.random, { joueur: 19, ordinateur: 100 }).statut, "fin-de-partie");
});

test("actions illégales refusées et relance limitée à une par tour", () => {
  const p = M.creerPartie(graine());
  p.ordinateur.main = main("A♣ A♦");
  assert.throws(() => M.agir(p, "parole"), /suivre ou te coucher/);
  M.agir(p, "relancer", () => .99);
  assert.equal(p.phase, "flop", "la manche avance après la réponse de l'ordinateur");
  assert.equal(p.relanceFaite, false, "une nouvelle relance est permise au tour suivant");
  M.agir(p, "relancer", () => .99);
  assert.equal(p.phase, "turn");
  assert.throws(() => M.agir(p, "inconnue"), /action inconnue/);
});

test("hasard injectable et piles invalides", () => {
  assert.throws(() => M.creerPartie(() => 1), /hasard/);
  assert.throws(() => M.creerPartie(Math.random, { joueur: -1, ordinateur: 100 }), /piles/);
  assert.equal(M.creerPartie(Math.random, { joueur: 0, ordinateur: 100 }).statut, "fin-de-partie");
});

test("catalogue : métadonnées et routage des demandes poker", () => {
  const meta = lireMetaHtml(html);
  assert.equal(meta.id, "poker-texas-holdem");
  assert.equal(meta.sujet, "jeux/poker-texas-holdem");
  for (const question of ["je veux jouer au poker", "Texas Hold'em", "quelles sont les combinaisons au poker ?", "Pocker Texas Hold them"]) {
    assert.equal(routerLocal(question, CATALOGUE.index), "poker-texas-holdem", question);
  }
});
