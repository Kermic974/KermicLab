// Démineur : solveur de déductions (comparé à une recherche exhaustive) et parcours de l'Académie, sans DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../../catalogue/demineur/page.html", import.meta.url), "utf8");
const extraire = (id) => html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)</script>`))?.[1];
const contexte = { Math, Object, Array, Set, Map, Number, String, Error, Infinity, Date, JSON };
const M = vm.runInNewContext(`${extraire("moteur-demineur")}\nMoteurDemineur`, { ...contexte });
const G = vm.runInNewContext(`${extraire("progression-jeux")}\nProgressionJeux`, { ...contexte });
const P = JSON.parse(html.match(/<script type="application\/json" id="parcours-demineur">([\s\S]*?)<\/script>/)[1]);
const A = G.creer(P);
const lecons = P.grades.flatMap((g) => g.lecons);
const local = (x) => JSON.parse(JSON.stringify(x));
const J = "2026-11-04";

function construire({ mines, ouvrir, drapeaux = [] }) {
  const p = M.depuisModele(mines);
  for (const [l, c] of ouvrir) M.reveler(p, l * p.colonnes + c);
  for (const [l, c] of drapeaux) M.basculerDrapeau(p, l * p.colonnes + c);
  return p;
}
const graine = (n) => { let a = n >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** Référence : toutes les dispositions de mines des cases fermées compatibles avec les chiffres (et le total si demandé). */
function exhaustif(p, compterMines) {
  const fermees = p.cases.map((c, i) => i).filter((i) => !p.cases[i].revelee);
  const valides = [];
  for (let masque = 0; masque < 2 ** fermees.length; masque++) {
    const mine = new Set(fermees.filter((_, k) => masque & (1 << k)));
    if (compterMines && mine.size !== p.mines) continue;
    const ok = p.cases.every((c, i) => !c.revelee || M.voisins(p, i).filter((v) => mine.has(v)).length === c.voisines);
    if (ok) valides.push(mine);
  }
  return {
    sures: fermees.filter((i) => valides.every((m) => !m.has(i))),
    mines: fermees.filter((i) => valides.every((m) => m.has(i)))
  };
}

test("solveur : identique à la recherche exhaustive sur 300 positions aléatoires (avec et sans compter les mines)", () => {
  const h = graine(7);
  let testees = 0, avecDeduction = 0;
  for (let n = 0; testees < 300 && n < 5000; n++) {
    const L = 3 + Math.floor(h() * 3), C = 3 + Math.floor(h() * 3), nb = 1 + Math.floor(h() * 4);
    const g = Array.from({ length: L }, () => Array(C).fill("."));
    for (let k = 0; k < nb;) { const i = Math.floor(h() * L * C); if (g[Math.floor(i / C)][i % C] === ".") { g[Math.floor(i / C)][i % C] = "*"; k += 1; } }
    const depart = g.flat().findIndex((x) => x === ".");
    const p = construire({ mines: g.map((r) => r.join("")), ouvrir: [[Math.floor(depart / C), depart % C]] });
    const fermees = p.cases.filter((c) => !c.revelee).length;
    if (p.statut !== "en-cours" || fermees > 14) continue;
    testees += 1;
    for (const compterMines of [false, true]) {
      const attendu = exhaustif(p, compterMines), obtenu = local(M.deduire(p, { compterMines }));
      assert.deepEqual(obtenu, attendu, `${JSON.stringify(g.map((r) => r.join("")))} compterMines=${compterMines}`);
      if (obtenu.sures.length) avecDeduction += 1;
    }
  }
  assert.equal(testees, 300);
  assert.ok(avecDeduction > 100, "beaucoup de positions ont des déductions");
});

test("solveur : ne se fie pas aux drapeaux du joueur, et reste rapide sur une grande grille", () => {
  const p = construire({ mines: ["....", "....", "...*", "...."], ouvrir: [[0, 0]], drapeaux: [[3, 3]] });
  const d = local(M.deduire(p));
  assert.ok(d.sures.includes(15), "un faux drapeau sur une case sûre ne trompe pas le solveur");
  assert.ok(d.mines.includes(11));
  const e = M.creerPartie("expert");
  M.reveler(e, 200, graine(3));
  const debut = Date.now();
  M.deduire(e); M.deduire(e, { compterMines: true });
  assert.ok(Date.now() - debut < 1500, `${Date.now() - debut} ms sur une grille Expert`);
});

test("parcours du démineur : cinq grades, textes complets, QCM valides", () => {
  assert.deepEqual(P.grades.map((g) => g.nom), ["Apprenti", "Éclaireur", "Logicien", "Stratège", "Expert"]);
  assert.equal(new Set(lecons.map((l) => l.id)).size, lecons.length);
  assert.equal(new Set(A.EMBLEMES).size, P.grades.length);
  for (const l of lecons) {
    assert.ok(P.themes[l.theme] && l.titre && l.texte && l.retenir && l.exercices.length, l.id);
    for (const e of l.exercices) {
      assert.ok(e.explication?.trim(), `${l.id} : explication`);
      if (e.type === "qcm") assert.ok(e.choix.length >= 2 && e.bonne < e.choix.length && new Set(e.choix).size === e.choix.length, `${l.id} : QCM`);
      else assert.equal(e.type, "grille", l.id);
    }
  }
  assert.doesNotMatch(JSON.stringify(P), /\b(fetch|eval)\s*\(|<\/script/i);
});

test("parcours du démineur : chaque grille est une vraie position de jeu, et son but est atteignable sans deviner", () => {
  for (const l of lecons) for (const e of l.exercices.filter((x) => x.type === "grille")) {
    const p = construire(e.grille), opts = { compterMines: !!e.compterMines };
    assert.equal(p.statut, "en-cours", l.id);
    // Réalisme : une case vide ouverte n'a jamais de voisine fermée (le jeu l'aurait ouverte).
    assert.ok(!p.cases.some((c, i) => c.revelee && c.voisines === 0 && M.voisins(p, i).some((v) => !p.cases[v].revelee)), `${l.id} : position réaliste`);
    // Les drapeaux de départ sont de vraies mines.
    assert.ok(p.cases.every((c) => !c.drapeau || c.mine), `${l.id} : drapeaux justes`);
    const d = M.deduire(p, opts);
    assert.ok(d.sures.every((i) => !p.cases[i].mine) && d.mines.every((i) => p.cases[i].mine), `${l.id} : déductions exactes`);
    if (e.but === "sure") assert.ok(d.sures.length >= 1, l.id);
    if (e.but === "mine" || e.but === "drapeaux") assert.ok(d.mines.filter((i) => !p.cases[i].drapeau).length >= 1, l.id);
    if (e.but === "accord") {
      const complets = p.cases.map((c, i) => i).filter((i) => p.cases[i].revelee && p.cases[i].voisines > 0
        && M.voisins(p, i).filter((v) => p.cases[v].drapeau).length === p.cases[i].voisines && M.voisins(p, i).some((v) => !p.cases[v].revelee && !p.cases[v].drapeau));
      assert.ok(complets.length >= 1, `${l.id} : au moins un chiffre complet`);
    }
    if (e.but === "deblayer") {
      // En n'ouvrant que des cases sûres, on finit la grille sans jamais deviner.
      for (let n = 0; n < 100; n++) {
        const s = M.deduire(p, opts).sures.filter((i) => !p.cases[i].revelee);
        if (!s.length) break;
        M.reveler(p, s[0]);
        assert.notEqual(p.statut, "perdu", l.id);
      }
      assert.equal(p.statut, "victoire", `${l.id} : grille entièrement déminée par déduction`);
    }
  }
});

test("parcours du démineur : la leçon « Compter les mines » ne se résout qu'en comptant", () => {
  const e = lecons.find((l) => l.id === "compter").exercices[0];
  assert.equal(e.compterMines, true);
  const p = construire(e.grille);
  assert.match(e.consigne, new RegExp(`${p.mines} mines`), "la consigne annonce le bon nombre de mines");
  const avec = M.deduire(p, { compterMines: true }).sures, sans = M.deduire(p).sures;
  assert.ok(avec.some((i) => !sans.includes(i)), "compter apporte une case sûre de plus");
});

test("parcours du démineur : les motifs enseignés sont bien ceux des grilles", () => {
  const ligne = (p, l) => Array.from({ length: p.colonnes }, (_, c) => p.cases[l * p.colonnes + c].voisines).join("");
  const p121 = construire(lecons.find((l) => l.id === "motif-121").exercices[0].grille);
  assert.equal(ligne(p121, 2), "121");
  assert.deepEqual(local(M.deduire(p121)), { sures: [10], mines: [9, 11] }, "mines sous les 1, case sûre sous le 2");
  const p1221 = construire(lecons.find((l) => l.id === "motif-1221").exercices[0].grille);
  assert.equal(ligne(p1221, 2), "1221");
  assert.deepEqual(local(M.deduire(p1221)), { sures: [12, 15], mines: [13, 14] }, "mines sous les deux 2");
});

test("progression du démineur : parties, records et badges propres au jeu", () => {
  let e = A.etatInitial();
  let r = A.enregistrerPartie(e, { resultat: "victoire", niveau: "debutant", jour: J, temps: 75 }); e = r.etat;
  assert.equal(r.gains.xp, 30);
  assert.equal(r.gains.record, true);
  assert.deepEqual(local(r.gains.badges).map((b) => b.id), ["premier-deminage"]);
  r = A.enregistrerPartie(e, { resultat: "victoire", niveau: "debutant", jour: J, temps: 58 }); e = r.etat;
  assert.deepEqual(local(r.gains.badges).map((b) => b.id), ["eclair"], "moins d'une minute");
  assert.equal(e.parties.debutant.meilleur, 58);
  r = A.enregistrerPartie(e, { resultat: "victoire", niveau: "debutant", jour: J, temps: 90 }); e = r.etat;
  assert.equal(r.gains.record, false);
  assert.equal(e.parties.debutant.meilleur, 58);
  assert.throws(() => A.enregistrerPartie(e, { resultat: "nulle", niveau: "debutant", jour: J }), /invalide/, "pas de nulle au démineur");
  const champion = local(A.badges(e)).find((b) => b.id === "champion");
  assert.deepEqual([champion.actuel, champion.cible, champion.obtenu], [3, 10, false], "avancement d'un badge");
  assert.ok(A.reglesXP().some((x) => x.texte === "Partie Expert : victoire" && x.xp === 200));
});

test("progression commune : activité des 7 derniers jours, série encore valable, badges communs", () => {
  let e = A.etatInitial();
  e = A.enregistrerExercice(e, { id: "lire-chiffre/0", jour: "2026-11-02" }).etat;
  e = A.enregistrerExercice(e, { id: "lire-chiffre/1", jour: "2026-11-03" }).etat;
  assert.deepEqual(local(A.activite(e, J)).map((a) => a.exercices), [0, 0, 0, 0, 1, 1, 0]);
  assert.equal(A.activite(e, J).at(-1).jour, J);
  assert.equal(A.serieActuelle(e, J), 2, "hier actif : la série continue aujourd'hui");
  assert.equal(A.serieActuelle(e, "2026-11-05"), 0, "un jour sans activité casse la série");
  const ids = local(A.badges(e)).map((b) => b.id);
  for (const id of ["premiers-pas", "sans-faute", "perfectionniste", "pro", "serie-3", "serie-7", "regulier", "memoire", "bibliotheque", "defis"]) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length);
  assert.throws(() => G.creer({ ...P, badges: [{ id: "x", condition: { type: "inconnue" } }] }), /inconnue/);
  assert.throws(() => G.creer({ ...P, badges: [...P.badges, P.badges[0]] }), /double/);
});

test("modules partagés : la progression n'utilise pas le DOM, l'interface n'utilise jamais innerHTML", async () => {
  const progression = await readFile(new URL("../../gabarit/jeux/progression.js", import.meta.url), "utf8");
  const vue = await readFile(new URL("../../gabarit/jeux/academie.js", import.meta.url), "utf8");
  assert.doesNotMatch(progression, /\b(document|window|localStorage|navigator)\b/);
  assert.doesNotMatch(vue, /\.(innerHTML|outerHTML)\b|insertAdjacentHTML|document\.write/);
  // Les deux jeux embarquent exactement la même copie des modules (recopiés par le build).
  for (const page of ["demineur", "echecs"]) {
    const h = await readFile(new URL(`../../catalogue/${page}/page.html`, import.meta.url), "utf8");
    assert.ok(h.includes(progression.trimEnd()), `${page} : progression.js à jour`);
    assert.ok(h.includes(vue.trimEnd()), `${page} : academie.js à jour`);
  }
});
