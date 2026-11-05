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
const dictionnaire = JSON.parse(html.match(/<script type="application\/json" id="dictionnaire-pendu">([\s\S]*?)<\/script>/)[1]);
const sourceOrthographe = html.match(/<script id="moteur-orthographe">([\s\S]*?)<\/script>/)[1];
const O = vm.runInNewContext(`${sourceOrthographe}\nMoteurOrthographe`);
const creerPartie = (id, hasard = () => 0, precedent = null) => M.creerPartie(id, dictionnaire, hasard, precedent);

test("moteur pur : aucune dépendance au DOM, au stockage ni au réseau", () => {
  assert.doesNotMatch(source, /\b(document|window|localStorage|fetch|XMLHttpRequest)\b/);
  assert.doesNotMatch(sourceOrthographe, /\b(document|window|localStorage|fetch|XMLHttpRequest)\b/);
});

test("exactement 100 mots par niveau, 500 mots uniques avec définitions et repères", () => {
  const tous = [];
  for (const niveau of M.NIVEAUX) {
    const mots = M.motsDuNiveau(dictionnaire, niveau.id);
    assert.equal(mots.length, 100, niveau.id);
    assert.equal(new Set(mots.map((m) => M.normaliserMot(m.mot))).size, 100, niveau.id);
    for (const [i, entree] of mots.entries()) {
      assert.equal(O.analyserListe(entree.mot)[0], entree.mot);
      assert.ok(entree.indice.length > 10, entree.mot);
      assert.ok(entree.repere.length > 20, entree.mot);
      const partie = creerPartie(niveau.id, () => (i + 0.5) / 100);
      assert.equal(partie.orthographe, entree.mot, "chaque mot peut être tiré");
      for (const lettre of new Set(partie.mot)) if (M.LETTRES.includes(lettre)) M.jouerLettre(partie, lettre);
      assert.equal(partie.resultat, "victoire", entree.mot);
    }
    tous.push(...mots.map((m) => M.normaliserMot(m.mot)));
  }
  assert.equal(tous.length, 500);
  assert.equal(new Set(tous).size, 500, "aucun doublon entre niveaux");
});

test("la complexité prime sur la longueur ; tirage reproductible sans répétition immédiate", () => {
  assert.ok(M.motsDuNiveau(dictionnaire, "noob").some((m) => m.mot === "pantalon"));
  assert.ok(M.motsDuNiveau(dictionnaire, "pro").some((m) => m.mot === "août"));
  assert.equal(creerPartie("noob").mot, "CHAT");
  assert.equal(creerPartie("noob").mot, creerPartie("noob").mot);
  assert.notEqual(creerPartie("noob", () => 0, "chat").mot, "CHAT");
  assert.throws(() => creerPartie("impossible"), /niveau inconnu/);
  for (const valeur of [1, -1, NaN, Infinity, "0"]) assert.throws(() => creerPartie("noob", () => valeur), /entre 0 inclus/);
});

test("saisie : normalise les accents et refuse une lettre déjà jouée ou invalide", () => {
  assert.equal(M.normaliserLettre("é"), "E");
  assert.equal(M.normaliserLettre("7"), "");
  assert.equal(M.normaliserLettre("chat"), "");
  const partie = creerPartie("noob");
  assert.equal(M.jouerLettre(partie, "é"), "rate");
  assert.equal(M.jouerLettre(partie, "E"), "deja-jouee");
  assert.equal(M.jouerLettre(partie, "7"), "invalide");
  assert.equal(partie.erreurs, 1);
});

test("une partie est gagnée quand toutes les lettres du mot ont été trouvées", () => {
  const partie = creerPartie("noob");
  assert.equal(M.jouerLettre(partie, "c"), "trouve");
  assert.equal(M.jouerLettre(partie, "h"), "trouve");
  assert.equal(M.jouerLettre(partie, "a"), "trouve");
  assert.equal(M.jouerLettre(partie, "t"), "victoire");
  assert.equal(partie.terminee, true);
  assert.equal(partie.resultat, "victoire");
  assert.equal(M.jouerLettre(partie, "Z"), "terminee");
});

test("une partie est perdue après six erreurs, le dessin et l'indice suivent le mot", () => {
  const partie = creerPartie("noob");
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

test("le pendu conserve les accents et développe les ligatures sans les confondre avec l’orthographe exacte", () => {
  const mots = M.motsDuNiveau(dictionnaire, "pro");
  const tirer = (mot) => creerPartie("pro", () => (mots.findIndex((m) => m.mot === mot) + 0.5) / 100);
  const aout = tirer("août");
  assert.equal(aout.mot, "AOUT");
  assert.equal(aout.graphie, "AOÛT");
  assert.equal(aout.orthographe, "août");
  const coeur = tirer("cœur");
  assert.equal(coeur.mot, "COEUR");
  assert.equal(coeur.graphie, "COEUR");
  assert.equal(coeur.orthographe, "cœur");
});

test("listes éditables : limites, accents, mots composés, doublons et entrées interdites", () => {
  assert.deepEqual([...O.analyserListe("  école \r\n\narc-en-ciel\naujourd’hui\n")], ["école", "arc-en-ciel", "aujourd’hui"]);
  for (const invalide of ["", "  ", "bonjour\nBONJOUR", "école\ne\u0301cole", "123", "<script>", "deux mots", "a".repeat(41), "a".repeat(5001)]) {
    assert.throws(() => O.analyserListe(invalide), undefined, invalide.slice(0, 40));
  }
  const mots = M.motsDuNiveau(dictionnaire, "noob").map((m) => m.mot);
  assert.equal(O.analyserListe(mots.join("\n")).length, 100);
  assert.throws(() => O.analyserListe([...mots, "supplément"].join("\n")), /1 à 100/);
  assert.throws(() => O.creerSession(null), /liste de mots/);
});

test("test d’orthographe : cacher avant de répondre, correction stricte, bilan et reprise des erreurs", () => {
  const session = O.creerSession(["école", "chat", "cœur", "aujourd’hui"]);
  assert.throws(() => O.repondre(session, "école"), /Cache le mot/);
  O.cacher(session);
  assert.throws(() => O.suivant(session), /Vérifie la réponse/);
  assert.equal(O.repondre(session, "ecole").juste, false, "les accents comptent");
  assert.throws(() => O.repondre(session, "école"), /Cache le mot/, "pas de double comptage");
  O.suivant(session); O.cacher(session);
  assert.equal(O.repondre(session, "  CHAT  ").juste, true, "casse et espaces externes ignorés");
  O.suivant(session); O.cacher(session);
  assert.equal(O.repondre(session, "coeur").juste, false, "la ligature compte");
  O.suivant(session); O.cacher(session);
  assert.equal(O.repondre(session, "aujourd'hui").juste, true, "les deux apostrophes sont acceptées");
  O.suivant(session);
  assert.equal(session.phase, "termine");
  const bilan = O.bilan(session);
  assert.equal(bilan.justes, 2);
  assert.equal(bilan.total, 4);
  assert.deepEqual([...bilan.aRevoir], ["école", "cœur"]);
  const reprise = O.creerSession(bilan.aRevoir);
  assert.equal(reprise.mots.length, 2);
  assert.equal(reprise.resultats.length, 0);
  O.cacher(reprise);
  assert.equal(O.repondre(reprise, "e\u0301cole").juste, true, "Unicode décomposé accepté");
});

test("test d’orthographe : passer un mot et gérer les bornes sans modifier la session en cas d’erreur", () => {
  const session = O.creerSession(["chat"]);
  O.cacher(session);
  assert.throws(() => O.repondre(session, "a".repeat(41)), /trop longue/);
  assert.equal(session.resultats.length, 0);
  assert.equal(O.repondre(session, "").juste, false);
  O.suivant(session);
  assert.equal(O.bilan(session).justes, 0);
  assert.equal(session.phase, "termine");
  assert.throws(() => O.cacher(session), /Observe d’abord/);
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
  for (const question of ["je veux jouer au pendu", "comment jouer au pendu ?", "jeu du pendu du débutant au pro", "je veux tester ma liste de mots au pendu"]) {
    assert.equal(routerLocal(question, CATALOGUE.index), "pendu", question);
  }
});
