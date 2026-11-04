import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../../catalogue/sudoku/page.html", import.meta.url), "utf8");
const source = html.match(/<script id="moteur-sudoku">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, "script du moteur présent");
const M = vm.runInNewContext(`${source}\nMoteurSudoku`, { Math, Object, Array, Number, Error });

function graine(n) {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("moteur pur, sans DOM ni stockage", () => {
  assert.doesNotMatch(source, /\b(document|window|localStorage|navigator)\b/);
});

test("le compteur de solutions détecte une grille résolue, une solution unique et les conflits", () => {
  const puzzle = [
    "530070000", "600195000", "098000060", "800060003", "400803001",
    "700020006", "060000280", "000419005", "000080079"
  ].join("").split("").map(Number);
  const solution = [
    "534678912", "672195348", "198342567", "859761423", "426853791",
    "713924856", "961537284", "287419635", "345286179"
  ].join("").split("").map(Number);
  assert.equal(M.compterSolutions(puzzle), 1);
  assert.equal(M.compterSolutions(solution), 1);
  assert.equal(M.compterSolutions([...puzzle.slice(0, 1), 5, ...puzzle.slice(2)]), 0);
});

test("chaque grade génère une grille valide, reproductible et à solution unique", () => {
  for (const [i, niveau] of M.ETAPES.entries()) {
    const partie = M.creerPartie(niveau.id, graine(100 + i));
    const memePartie = M.creerPartie(niveau.id, graine(100 + i));
    assert.deepEqual([...partie.solution], [...memePartie.solution], `${niveau.id} solution stable`);
    assert.deepEqual([...partie.depart], [...memePartie.depart], `${niveau.id} grille stable`);
    assert.equal(partie.solution.length, 81);
    assert.equal(partie.depart.length, 81);
    assert.equal(partie.depart.filter((n) => !n).length, niveau.vides, `${niveau.id} difficulté annoncée`);
    assert.equal(M.compterSolutions(partie.depart), 1, `${niveau.id} solution unique`);
    assert.ok(partie.indicesFixes.length >= 17, `${niveau.id} assez de chiffres de départ`);
    for (let i = 0; i < 81; i++) {
      assert.ok(partie.solution[i] >= 1 && partie.solution[i] <= 9);
      if (partie.depart[i]) assert.equal(partie.depart[i], partie.solution[i], `${niveau.id} indice ${i}`);
    }
  }
  for (let seed = 0; seed < 10; seed++) {
    const pro = M.creerPartie("pro", graine(seed));
    assert.equal(pro.depart.filter((n) => !n).length, 56, `pro seed ${seed}`);
  }
  assert.throws(() => M.creerPartie("impossible"), /niveau inconnu/);
});

test("saisie : refuse les conflits et les chiffres donnés, accepte l'effacement et valide la solution", () => {
  const partie = M.creerPartie("novice", graine(42));
  const fixe = partie.indicesFixes[0];
  assert.equal(M.placer(partie, fixe, 0), "fixe");
  const vide = partie.depart.findIndex((n) => !n);
  const chiffreInterdit = partie.grille.find((n, i) => n && (Math.floor(i / 9) === Math.floor(vide / 9) || i % 9 === vide % 9
    || (Math.floor(i / 27) === Math.floor(vide / 27) && Math.floor(i % 9 / 3) === Math.floor(vide % 9 / 3))));
  assert.equal(M.placer(partie, vide, chiffreInterdit), "conflit");
  assert.equal(M.placer(partie, vide, partie.solution[vide]), "ok");
  assert.equal(M.placer(partie, vide, 0), "ok");
  assert.equal(M.revelerIndice(partie, graine(1)) !== null, true);
  assert.equal(partie.aides, 1);
  assert.deepEqual([...M.verifier(partie).erreurs], []);
});
