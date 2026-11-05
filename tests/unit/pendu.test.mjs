import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { routerLocal } from "../../worker/src/router.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { lireMetaHtml } from "../../scripts/lib/catalogue.mjs";

const html = await readFile(new URL("../../catalogue/pendu/page.html", import.meta.url), "utf8");
const source = html.match(/<script id="moteur-pendu">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, "moteur présent dans la page");
const M = vm.runInNewContext(`${source}\nMoteurPendu`, { Object, Array, Number, Error, Math, String });

test("moteur pur : aucune dépendance au DOM, au stockage ni au réseau", () => {
  assert.doesNotMatch(source, /\b(document|window|localStorage|fetch|XMLHttpRequest)\b/);
});

test("les cinq grades proposent des mots de longueur croissante et un tirage reproductible", () => {
  let longueurPrecedente = 0;
  for (const niveau of M.NIVEAUX) {
    const partie = M.creerPartie(niveau.id, () => 0);
    assert.ok(partie.mot.length >= longueurPrecedente, niveau.id);
    assert.ok(/^[A-Z]+$/.test(partie.mot), `${niveau.id} : lettres simples`);
    assert.equal(M.creerPartie(niveau.id, () => 0).mot, partie.mot, `${niveau.id} : tirage reproductible`);
    longueurPrecedente = partie.mot.length;
  }
  assert.equal(M.creerPartie("noob", () => 0).mot, "CHAT");
  assert.equal(M.creerPartie("noob", () => 0.99).mot, "POMME");
  assert.throws(() => M.creerPartie("impossible"), /niveau inconnu/);
  assert.throws(() => M.creerPartie("noob", () => 1), /entre 0 inclus/);
});

test("saisie : normalise les accents et refuse une lettre déjà jouée ou invalide", () => {
  assert.equal(M.normaliserLettre("é"), "E");
  assert.equal(M.normaliserLettre("7"), "");
  const partie = M.creerPartie("noob", () => 0);
  assert.equal(M.jouerLettre(partie, "é"), "rate");
  assert.equal(M.jouerLettre(partie, "E"), "deja-jouee");
  assert.equal(M.jouerLettre(partie, "7"), "invalide");
  assert.equal(partie.erreurs, 1);
});

test("une partie est gagnée quand toutes les lettres du mot ont été trouvées", () => {
  const partie = M.creerPartie("noob", () => 0);
  assert.equal(M.jouerLettre(partie, "c"), "trouve");
  assert.equal(M.jouerLettre(partie, "h"), "trouve");
  assert.equal(M.jouerLettre(partie, "a"), "trouve");
  assert.equal(M.jouerLettre(partie, "t"), "victoire");
  assert.equal(partie.terminee, true);
  assert.equal(partie.resultat, "victoire");
  assert.equal(M.jouerLettre(partie, "Z"), "terminee");
});

test("une partie est perdue après six erreurs, le dessin et l'indice suivent le mot", () => {
  const partie = M.creerPartie("noob", () => 0);
  assert.equal(M.revelerIndice(partie), "Un animal qui miaule");
  for (const lettre of "BDEFGI") {
    const resultat = M.jouerLettre(partie, lettre);
    if (partie.erreurs < M.MAX_ERREURS) assert.equal(resultat, "rate");
  }
  assert.equal(partie.erreurs, M.MAX_ERREURS);
  assert.equal(partie.resultat, "defaite");
  assert.equal(partie.terminee, true);
  assert.equal(M.DESSINS[partie.erreurs].includes(" / \\ "), true);
});

test("Académie : cinq grades complets avec des QCM dont les réponses sont valides", () => {
  const parcours = JSON.parse(html.match(/<script type="application\/json" id="parcours-pendu">([\s\S]*?)<\/script>/)[1]);
  assert.equal(parcours.grades.length, 5);
  assert.deepEqual(parcours.grades.map((g) => g.nom), ["Noob", "Débutant", "Intermédiaire", "Expert", "Pro"]);
  for (const grade of parcours.grades) {
    assert.ok(grade.lecons.length > 0, grade.id);
    for (const lecon of grade.lecons) for (const exo of lecon.exercices) {
      assert.equal(exo.type, "qcm");
      assert.ok(exo.choix[exo.bonne], `${grade.id}/${lecon.id}`);
    }
  }
});

test("catalogue : métadonnées et routage des demandes du pendu", () => {
  const meta = lireMetaHtml(html);
  assert.equal(meta.id, "pendu");
  assert.equal(meta.sujet, "jeux/pendu");
  for (const question of ["je veux jouer au pendu", "comment jouer au pendu ?", "jeu du pendu du débutant au pro"]) {
    assert.equal(routerLocal(question, CATALOGUE.index), "pendu", question);
  }
});
