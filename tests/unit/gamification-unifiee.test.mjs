import { test } from "node:test";
import assert from "node:assert/strict";
import * as P from "../../web/progression.js";
import * as Ev from "../../web/evenements.js";
import { creerRegistre } from "../../web/experiences.js";
import { verifierGraphePrerequis } from "../../scripts/lib/catalogue.mjs";
import { lireReferentiel } from "../../scripts/lib/fiche-catalogue.mjs";

// Gamification unifiée (ADR 0031) : l'XP récompense l'apprentissage, les jeux sont reliés aux notions.
const J1 = "2026-11-18";
const J2 = "2026-11-25";
const ev = (evenement, donnees = {}) => ({ type: "kermiclab:evenement", v: 1, notion: "pythagore", version: "1.0.0", evenement, ...donnees });

function rejouer(etat, e, jour = J1) {
  const apres = Ev.enregistrer(etat, e, jour);
  return { apres, gains: Ev.gainsApprentissage(etat, apres, e) };
}

test("gains : première réussite d'un exercice, du premier coup ou après des essais, une seule fois", () => {
  let etat = Ev.etatInitial();
  let r = rejouer(etat, ev("reponse", { exercice: "app-1", correct: true, essai: 1 }));
  assert.deepEqual(r.gains, { exercice: "premier-coup", validation: null });
  etat = r.apres;
  r = rejouer(etat, ev("reponse", { exercice: "app-1", correct: true, essai: 1 }));
  assert.deepEqual(r.gains, { exercice: null, validation: null }, "un exercice déjà réussi ne rapporte plus rien");
  r = rejouer(etat, ev("reponse", { exercice: "app-2", correct: false, essai: 1 }));
  assert.deepEqual(r.gains, { exercice: null, validation: null }, "une erreur ne rapporte rien");
  r = rejouer(r.apres, ev("reponse", { exercice: "app-2", correct: true, essai: 2 }));
  assert.equal(r.gains.exercice, "apres-essais");
});

test("gains : validation la première fois, puis révision un autre jour, au plus une par jour", () => {
  let r = rejouer(Ev.etatInitial(), ev("termine"));
  assert.equal(r.gains.validation, "premiere");
  assert.equal(rejouer(r.apres, ev("termine")).gains.validation, null, "le même jour : pas de seconde validation");
  r = rejouer(r.apres, ev("termine"), J2);
  assert.equal(r.gains.validation, "revision");
  assert.deepEqual(Ev.gainsApprentissage(null, null, null), { exercice: null, validation: null });
});

test("XP : le barème récompense l'apprentissage plus que l'exploration", () => {
  const p0 = P.etatInitial();
  assert.equal(P.XP_NOTION, 10);
  const ouverture = P.enregistrerNotion(p0, "pythagore", J1).xpGagne;
  const exercice = P.enregistrerApprentissage(p0, { exercice: "premier-coup", validation: null }, J1);
  assert.equal(exercice.xpGagne, 10);
  assert.ok(exercice.xpGagne >= ouverture);
  assert.equal(P.enregistrerApprentissage(p0, { exercice: "apres-essais", validation: "premiere" }, J1).xpGagne, 35);
  assert.equal(P.enregistrerApprentissage(p0, { exercice: null, validation: "revision" }, J1).xpGagne, 15);
  const r = P.enregistrerApprentissage(p0, { exercice: null, validation: "premiere" }, J1);
  assert.equal(r.p.xp, 30);
  assert.equal(r.p.jours[J1].xp, 30);
  assert.equal(r.p.serie, 1, "un gain d'apprentissage compte comme un jour actif");
  const rien = P.enregistrerApprentissage(p0, { exercice: null, validation: null }, J1);
  assert.equal(rien.xpGagne, 0);
  assert.equal(rien.p, p0, "sans gain, la progression est inchangée");
});

test("registre : notions d'un jeu et jeux d'une notion, limités au catalogue", () => {
  const registre = creerRegistre([
    { id: "probabilites", titre: "Probabilités", matiere: "mathematiques" },
    { id: "poker", titre: "Poker", matiere: "jeux", notionsLiees: ["probabilites", "inconnue", "belote"] },
    { id: "belote", titre: "Belote", matiere: "jeux", notionsLiees: ["probabilites"] },
    { id: "sudoku", titre: "Sudoku", matiere: "jeux" }
  ]);
  assert.deepEqual(registre.notionsDuJeu("poker").map((n) => n.id), ["probabilites"], "ni inconnue, ni jeu");
  assert.deepEqual(registre.notionsDuJeu("sudoku"), []);
  assert.deepEqual(registre.jeuxDeLaNotion("probabilites").map((j) => j.id), ["poker", "belote"]);
  assert.deepEqual(registre.jeuxDeLaNotion("absente"), []);
});

test("build : notions-liees lu, borné et réservé aux jeux vers des notions connues", () => {
  assert.deepEqual(lireReferentiel({ id: "poker", "notions-liees": ["probabilites"] }).notionsLiees, ["probabilites"]);
  assert.throws(() => lireReferentiel({ id: "poker", "notions-liees": ["a", "a"] }), /doublon/);
  assert.throws(() => lireReferentiel({ id: "poker", "notions-liees": ["A B"] }), /identifiant/);
  assert.throws(() => lireReferentiel({ id: "poker", "notions-liees": ["a", "b", "c", "d", "e", "f", "g"] }), /6 notions/);
  const proba = { id: "probabilites", sujet: "mathematiques/probabilites" };
  assert.deepEqual(verifierGraphePrerequis([proba, { id: "poker", sujet: "jeux/poker", notionsLiees: ["probabilites"] }]), []);
  assert.deepEqual(verifierGraphePrerequis([proba, { id: "pythagore", sujet: "mathematiques/pythagore", notionsLiees: ["probabilites"] }]),
    ["pythagore : « notions-liees » est réservé aux jeux"]);
  assert.deepEqual(verifierGraphePrerequis([{ id: "poker", sujet: "jeux/poker", notionsLiees: ["absente", "belote"] }, { id: "belote", sujet: "jeux/belote" }]),
    ["poker : notion liée « absente » inconnue", "poker : notion liée « belote » est un jeu, pas une notion"]);
});

test("synchronisation (ADR 0031 §5) : l'agrégat est facultatif, allégé s'il est trop grand, jamais effacé par un ancien instantané", async () => {
  const { instantane, restaurer, alleger, TAILLE_MAX_INSTANTANE } = await import("../../web/compte-local.js");
  const cles = ["kermiclab:progression", "kermiclab:evenements"];
  const facultatives = ["kermiclab:evenements"];
  const zone = new Map([["kermiclab:progression", "{}"], ["kermiclab:evenements", "{\"v\":1}"]]);
  const inst = instantane((c) => zone.get(c) ?? null, cles);
  assert.deepEqual(alleger(inst, facultatives), inst, "un instantané qui tient est inchangé");
  const gros = { v: 1, donnees: { "kermiclab:progression": "{}", "kermiclab:evenements": "x".repeat(TAILLE_MAX_INSTANTANE) } };
  assert.deepEqual(Object.keys(alleger(gros, facultatives).donnees), ["kermiclab:progression"], "l'agrégat est écarté, la progression reste");
  const enorme = { v: 1, donnees: { "kermiclab:progression": "x".repeat(TAILLE_MAX_INSTANTANE) } };
  assert.ok(alleger(enorme, facultatives).donnees["kermiclab:progression"], "une clé indispensable n'est jamais retirée");

  const ecrits = new Map(); const effaces = [];
  assert.ok(restaurer({ v: 1, donnees: { "kermiclab:progression": "{\"xp\":5}" } }, cles, (c, v) => ecrits.set(c, v), (c) => effaces.push(c), facultatives));
  assert.deepEqual([...ecrits.keys()], ["kermiclab:progression"]);
  assert.deepEqual(effaces, [], "un ancien instantané sans agrégat garde la maîtrise locale");
  restaurer({ v: 1, donnees: {} }, cles, () => {}, (c) => effaces.push(c), facultatives);
  assert.deepEqual(effaces, ["kermiclab:progression"], "une clé indispensable absente reste effacée");
});
