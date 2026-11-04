// Moteur des échecs : extrait de la page (catalogue/echecs/page.html) et exécuté dans un contexte sans DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { routerLocal } from "../../worker/src/router.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { lireMetaHtml } from "../../scripts/lib/catalogue.mjs";

const html = await readFile(new URL("../../catalogue/echecs/page.html", import.meta.url), "utf8");
const source = html.match(/<script id="moteur-echecs">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, "script du moteur présent");
const M = vm.runInNewContext(`${source}\nMoteurEchecs`, { Math, Object, Array, Set, Map, Number, String, Error, Infinity });
const ENIGMES = JSON.parse(html.match(/<script type="application\/json" id="enigmes-echecs">([\s\S]*?)<\/script>/)[1]);

/** Joue une suite de coups écrits « e2e4 » (et « e7e8q » pour une promotion). */
function partie(coups, fen = M.FEN_INITIALE) {
  let p = M.depuisFEN(fen);
  for (const c of coups.split(" ").filter(Boolean)) {
    const promotion = c[4] ? (p.trait === "w" ? c[4].toUpperCase() : c[4]) : undefined;
    p = M.jouer(p, { de: M.indexCase(c.slice(0, 2)), vers: M.indexCase(c.slice(2, 4)), promotion });
  }
  return p;
}
const coupDe = (p, de, vers) => M.coupsLegaux(p).find((c) => M.nomCase(c.de) === de && M.nomCase(c.vers) === vers);
const graine = (n) => { let a = n >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

test("moteur : aucune dépendance au DOM", () => {
  assert.doesNotMatch(source, /\b(document|window|localStorage|navigator)\b/);
});

test("perft : nombre exact de positions sur cinq positions de référence", () => {
  // Valeurs de référence publiques (Chess Programming Wiki, « Perft Results »).
  const references = [
    ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [20, 400, 8902, 197281]],
    ["r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862]],
    ["8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238]],
    ["r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
    ["rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486, 62379]]
  ];
  for (const [fen, attendus] of references) {
    const p = M.depuisFEN(fen);
    attendus.forEach((n, d) => assert.equal(M.perft(p, d + 1), n, `${fen} profondeur ${d + 1}`));
  }
});

test("FEN : aller-retour, et refus des positions impossibles", () => {
  for (const fen of [M.FEN_INITIALE, "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", "8/8/8/3pP3/8/8/8/k6K w - d6 0 3"]) {
    assert.equal(M.versFEN(M.depuisFEN(fen)), fen);
  }
  for (const fen of ["8/8/8/8/8/8/8/8 w - - 0 1", "7k/8/6K1/8/8/8/8/Q7 w - - 0 1", "k7/8/8/8/8/8/8/K6P w - - 0 1", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1", "9/8/8/8/8/8/8/k6K w - - 0 1"]) {
    assert.throws(() => M.depuisFEN(fen), /FEN invalide/, fen);
  }
});

test("roque : petit et grand roque, déplacement de la tour, perte des droits", () => {
  const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
  const petit = M.jouer(M.depuisFEN(fen), coupDe(M.depuisFEN(fen), "e1", "g1"));
  assert.equal(M.versFEN(petit), "r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1");
  const grand = M.jouer(petit, coupDe(petit, "e8", "c8"));
  assert.equal(M.versFEN(grand), "2kr3r/8/8/8/8/8/8/R4RK1 w - - 2 2");
  assert.equal(M.notation(M.depuisFEN(fen), coupDe(M.depuisFEN(fen), "e1", "c1")), "O-O-O");
  // Une tour qui bouge fait perdre le roque de son côté.
  assert.equal(partie("h1h2 a8a7", fen).roques, "Qk");
});

test("roque interdit : en échec, en traversant ou en arrivant sur une case attaquée, ou pièce entre les deux", () => {
  const interdit = (fen, vers) => assert.equal(coupDe(M.depuisFEN(fen), "e1", vers), undefined, `${fen} → ${vers}`);
  interdit("4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1", "g1"); // roi en échec
  interdit("4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1", "c1");
  interdit("5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1", "g1"); // f1 attaquée
  interdit("1k4r1/8/8/8/8/8/8/R3K2R w KQ - 0 1", "g1"); // g1 attaquée
  interdit("3r2k1/8/8/8/8/8/8/R3K2R w KQ - 0 1", "c1"); // d1 attaquée
  interdit("6k1/8/8/8/8/8/8/RN2K1NR w KQ - 0 1", "g1"); // cavalier entre roi et tour
  interdit("6k1/8/8/8/8/8/8/RN2K1NR w KQ - 0 1", "c1");
  // b1 attaquée n'empêche pas le grand roque (seul le roi doit être en sécurité).
  assert.ok(coupDe(M.depuisFEN("1r4k1/8/8/8/8/8/8/R3K2R w KQ - 0 1"), "e1", "c1"));
  interdit("6k1/8/8/8/8/8/8/R3K2R w - - 0 1", "g1"); // plus de droit de roque
});

test("prise en passant : seulement juste après l'avance de deux cases, et le pion pris disparaît", () => {
  const p = partie("e2e4 a7a6 e4e5 d7d5");
  assert.equal(M.nomCase(p.enPassant), "d6");
  const coup = coupDe(p, "e5", "d6");
  assert.ok(coup?.enPassant);
  assert.equal(M.notation(p, coup), "exd6");
  const apres = M.jouer(p, coup);
  assert.equal(apres.plateau[M.indexCase("d5")], null, "pion d5 retiré");
  assert.equal(apres.plateau[M.indexCase("d6")], "P");
  const tard = partie("e2e4 a7a6 e4e5 d7d5 b1c3 a6a5");
  assert.equal(coupDe(tard, "e5", "d6"), undefined, "trop tard");
  // Prise en passant interdite si elle découvre son propre roi.
  const clouee = M.depuisFEN("8/8/8/KPp4r/8/8/8/6k1 w - c6 0 1");
  assert.equal(coupDe(clouee, "b5", "c6"), undefined);
});

test("promotion : quatre choix, notation et pièce créée", () => {
  const p = M.depuisFEN("8/P6k/8/8/8/8/8/K7 w - - 0 1");
  const promotions = M.coupsLegaux(p).filter((c) => c.promotion);
  assert.deepEqual([...promotions.map((c) => c.promotion)].sort(), ["B", "N", "Q", "R"]);
  const dame = promotions.find((c) => c.promotion === "Q");
  assert.equal(M.notation(p, dame), "a8=D");
  assert.equal(M.jouer(p, dame).plateau[0], "Q");
  assert.throws(() => M.jouer(p, { de: M.indexCase("a7"), vers: M.indexCase("a8") }), /illégal/, "la pièce doit être choisie");
});

test("échec et mat, pat et coups illégaux", () => {
  const mat = partie("f2f3 e7e5 g2g4 d8h4");
  assert.deepEqual({ ...M.statut(mat) }, { fin: true, etat: "mat", gagnant: "b", echec: true });
  const pat = M.depuisFEN("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  assert.equal(M.statut(pat).etat, "pat");
  assert.equal(M.statut(pat).gagnant, null);
  const echec = partie("e2e4 f7f6 d1h5");
  assert.equal(M.statut(echec).etat, "echec");
  assert.ok(M.coupsLegaux(echec).every((c) => !M.enEchec(M.appliquer(echec, c), "b")), "tout coup légal pare l'échec");
  assert.throws(() => M.jouer(echec, { de: M.indexCase("a7"), vers: M.indexCase("a6") }), /illégal/);
  // Pièce clouée : elle ne peut pas quitter la ligne de son roi.
  const cloue = M.depuisFEN("4r1k1/8/8/8/8/8/4N3/4K3 w - - 0 1");
  assert.deepEqual([...M.coupsLegaux(cloue, M.indexCase("e2"))], []);
});

test("nulles : répétition, règle des 50 coups, matériel insuffisant", () => {
  const aller = "g1f3 g8f6 f3g1 f6g8";
  assert.equal(M.statut(partie(aller)).fin, false, "deux fois seulement");
  const rep = M.statut(partie(`${aller} ${aller}`));
  assert.equal(rep.etat, "nulle");
  assert.equal(rep.raison, "repetition");
  assert.equal(M.statut(M.depuisFEN("4k3/8/8/8/8/8/8/R3K3 w - - 100 80")).raison, "cinquante-coups");
  assert.equal(M.statut(M.depuisFEN("4k3/8/8/8/8/8/8/R3K3 w - - 99 80")).fin, false);
  // Insuffisant : roi seul, roi + fou, roi + cavalier, fous tous sur la même couleur de case (f8 et c1).
  for (const fen of ["4k3/8/8/8/8/8/8/4K3 w - - 0 1", "4k3/8/8/8/8/8/8/2B1K3 w - - 0 1", "4k3/8/8/8/8/8/8/1N2K3 w - - 0 1", "4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1"]) {
    assert.equal(M.statut(M.depuisFEN(fen)).raison, "materiel", fen);
  }
  // Suffisant : fous de couleurs différentes (c8 et c1), un pion, deux cavaliers.
  for (const fen of ["2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1", "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", "4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1"]) {
    assert.equal(M.statut(M.depuisFEN(fen)).fin, false, fen);
  }
});

test("notation : lettres françaises, prises, échecs, mats et précision entre deux pièces", () => {
  const p = M.positionInitiale();
  assert.equal(M.notation(p, coupDe(p, "g1", "f3")), "Cf3");
  assert.equal(M.notation(p, coupDe(p, "e2", "e4")), "e4");
  const mat = partie("f2f3 e7e5 g2g4");
  assert.equal(M.notation(mat, coupDe(mat, "d8", "h4")), "Dh4#");
  const echec = partie("e2e4 f7f6");
  assert.equal(M.notation(echec, coupDe(echec, "d1", "h5")), "Dh5+");
  const deuxCavaliers = M.depuisFEN("4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1");
  assert.equal(M.notation(deuxCavaliers, coupDe(deuxCavaliers, "b1", "d2")), "Cbd2");
  const deuxTours = M.depuisFEN("4k3/R7/8/8/8/8/R7/4K3 w - - 0 1");
  assert.equal(M.notation(deuxTours, coupDe(deuxTours, "a2", "a5")), "T2a5");
  const prise = partie("e2e4 d7d5");
  assert.equal(M.notation(prise, coupDe(prise, "e4", "d5")), "exd5");
});

test("ordinateur : coup légal, prend une pièce offerte, trouve un mat en un, reproductible", () => {
  const p = M.positionInitiale();
  for (const niveau of ["facile", "moyen"]) {
    const coup = M.choisirCoup(p, { niveau, hasard: graine(1) });
    assert.ok(M.coupsLegaux(p).some((c) => c.de === coup.de && c.vers === coup.vers), niveau);
  }
  const dameOfferte = M.depuisFEN("4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1");
  for (const niveau of ["facile", "moyen"]) {
    for (let n = 0; n < 5; n++) assert.equal(M.nomCase(M.choisirCoup(dameOfferte, { niveau, hasard: graine(n) }).vers), "d5", `${niveau} #${n}`);
  }
  for (const { fen } of ENIGMES) {
    const q = M.depuisFEN(fen), coup = M.choisirCoup(q, { niveau: "moyen", hasard: graine(2) });
    assert.equal(M.statut(M.jouer(q, coup)).etat, "mat", fen);
  }
  const plan = (n) => M.nomCase(M.choisirCoup(p, { niveau: "facile", hasard: graine(n) }).vers);
  assert.equal(plan(5), plan(5));
  assert.equal(M.choisirCoup(M.depuisFEN("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")), null, "aucun coup en cas de pat");
});

test("ordinateur : une partie complète se termine, chaque coup en moins d'une seconde", () => {
  let p = M.positionInitiale(), n = 0, pire = 0;
  while (!M.statut(p).fin && n < 300) {
    const debut = Date.now();
    const coup = M.choisirCoup(p, { niveau: n % 2 ? "moyen" : "facile", hasard: graine(n) });
    pire = Math.max(pire, Date.now() - debut);
    p = M.jouer(p, coup); n += 1;
  }
  assert.ok(M.statut(p).fin || n === 300);
  assert.ok(pire < 1000, `coup le plus long : ${pire} ms`);
});

test("énigmes : positions valides, aux Blancs, avec exactement un coup qui fait mat", () => {
  assert.ok(ENIGMES.length >= 3);
  for (const e of ENIGMES) {
    for (const champ of ["titre", "fen", "indice", "explication"]) assert.ok(e[champ]?.trim(), `${e.titre} : ${champ}`);
    const p = M.depuisFEN(e.fen);
    assert.equal(p.trait, "w", e.titre);
    assert.equal(M.statut(p).fin, false, e.titre);
    const mats = M.coupsLegaux(p).filter((c) => M.statut(M.jouer(p, c)).etat === "mat").map((c) => M.notation(p, c));
    assert.equal(mats.length, 1, `${e.titre} : ${mats}`);
    assert.ok(e.explication.startsWith(mats[0].replace("#", "")), `${e.titre} : l'explication annonce ${mats[0]}`);
  }
});

test("catalogue : métadonnées du jeu et routage des questions d'exemple", () => {
  const meta = lireMetaHtml(html);
  assert.equal(meta.id, "echecs");
  assert.equal(meta.sujet, "jeux/echecs");
  for (const q of ["je veux jouer aux échecs", "c'est quoi le roque ?", "un ÉCHIQUIER", "chess"]) assert.equal(routerLocal(q, CATALOGUE.index), "echecs", q);
});
