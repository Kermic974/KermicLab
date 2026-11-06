import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../../web/experiences.js";
import * as P from "../../web/progression.js";

const J = "2026-11-06";
const CATALOGUE = [
  { id: "pythagore", titre: "Pythagore", version: "1.0.0", niveau: "college", matiere: "mathematiques" },
  { id: "thales", titre: "Thalès", version: "1.0.0", niveau: "college", matiere: "mathematiques" },
  { id: "derivation", titre: "Dérivation", version: "1.0.0", niveau: "premiere", matiere: "mathematiques" },
  { id: "la-cellule", titre: "La cellule", version: "1.0.0", niveau: "seconde", matiere: "svt" },
  { id: "demineur", titre: "Démineur", version: "1.1.0", niveau: "autres", matiere: "jeux", resume: "Révèle les cases." },
  { id: "sudoku", titre: "Sudoku", version: "1.0.0", niveau: "autres", matiere: "jeux" }
];
const registre = E.creerRegistre(CATALOGUE);
const ORDRE = ["mathematiques", "svt", "jeux"];
const finis = (o) => Object.values(o).every((v) => Number.isInteger(v) && v >= 0);

test("registre : le type vient de la catégorie du catalogue, sans liste codée en dur", () => {
  assert.deepEqual(registre.deType("jeu").map((e) => e.id), ["demineur", "sudoku"]);
  assert.equal(registre.deType("notion").length, 4);
  assert.equal(registre.typeDe("demineur"), "jeu");
  assert.equal(registre.typeDe("pythagore"), "notion");
  assert.equal(registre.typeDe("inconnu"), null);
  assert.equal(registre.trouver("demineur").resume, "Révèle les cases.");
  assert.equal("resume" in registre.trouver("sudoku"), false, "aucun résumé inventé");
  // Un nouveau jeu publié apparaît sans modifier le code.
  const plus = E.creerRegistre([...CATALOGUE, { id: "nouveau-jeu", titre: "Nouveau", matiere: "jeux" }]);
  assert.equal(plus.typeDe("nouveau-jeu"), "jeu");
  assert.deepEqual(E.creerRegistre(null).entrees, []);
  assert.deepEqual(E.creerRegistre([null, { id: 3 }, { titre: "sans id" }]).entrees, []);
});

test("Éducation : arbre Niveau > Matière > Notions issu des métadonnées, sans les jeux", () => {
  const arbre = E.arbreEducation(registre, ORDRE);
  assert.deepEqual(arbre.map((n) => n.niveau), ["college", "seconde", "premiere"]);
  assert.deepEqual(arbre[0].matieres.map((m) => [m.matiere, m.notions.map((n) => n.id)]), [["mathematiques", ["pythagore", "thales"]]]);
  assert.ok(arbre.every((n) => n.matieres.every((m) => m.matiere !== "jeux")));
  assert.deepEqual(E.arbreEducation(E.creerRegistre([]), ORDRE), []);
});

test("compteurs : état vide → zéros, jamais NaN, null ni undefined", () => {
  const c = E.compteurs(P.etatInitial(), registre);
  assert.deepEqual(c, { tempsActif: 0, notions: 0, matieres: 0, jeux: 0, questions: 0, badges: 0 });
  assert.ok(finis(E.compteurs(undefined, registre)));
  assert.ok(finis(E.compteurs({ tempsActif: { total: NaN }, badges: "x" }, registre)));
});

test("progression : Éducation seulement", () => {
  let p = P.etatInitial();
  for (const id of ["pythagore", "thales", "la-cellule"]) p = P.enregistrerNotion(p, id, J).p;
  const c = E.compteurs(p, registre);
  assert.deepEqual([c.notions, c.matieres, c.jeux], [3, 2, 0]);
  assert.deepEqual(E.progressionParMatiere(p, registre, ORDRE), [
    { matiere: "mathematiques", explorees: 2, total: 3 },
    { matiere: "svt", explorees: 1, total: 1 }
  ]);
  assert.deepEqual(E.experiencesDecouvertes(p, registre, "jeu"), []);
});

test("progression : Jeux seulement — aucune statistique avant le premier lancement", () => {
  let p = P.etatInitial();
  assert.deepEqual(E.experiencesDecouvertes(p, registre, "jeu"), [], "Démineur jamais lancé : rien");
  p = P.enregistrerExperience(p, "jeu", "demineur", J).p;
  const c = E.compteurs(p, registre);
  assert.deepEqual([c.notions, c.matieres, c.jeux], [0, 0, 1]);
  assert.deepEqual(E.progressionParMatiere(p, registre, ORDRE), []);
  const [demineur] = E.experiencesDecouvertes(p, registre, "jeu");
  assert.deepEqual(demineur, { type: "jeu", id: "demineur", titre: "Démineur", matiere: "jeux", disponible: true, premiere: J, ouvertures: 1, tempsActif: 0 });
});

test("progression : plusieurs types, temps attribué par expérience, expérience retirée du catalogue conservée", () => {
  let p = P.etatInitial();
  p = P.enregistrerNotion(p, "derivation", J).p;
  p = P.enregistrerExperience(p, "jeu", "sudoku", J).p;
  p = P.enregistrerExperience(p, "jeu", "demineur", J).p;
  p = P.decouvrir(p, "section", "jeux", J).p;
  p = P.ajouterTemps(p, { total: 300_000, sections: { jeux: 300_000 }, experiences: { "jeu:demineur": 200_000, "jeu:sudoku": 100_000 } }, J).p;
  p = P.enregistrerExperience(p, "jeu", "ancien-jeu", J).p;
  const jeux = E.experiencesDecouvertes(p, registre, "jeu");
  assert.deepEqual(jeux.map((j) => [j.id, j.tempsActif, j.disponible]), [["demineur", 200_000, true], ["sudoku", 100_000, true], ["ancien-jeu", 0, false]]);
  assert.equal(jeux[2].titre, "ancien-jeu");
  assert.deepEqual(E.compteurs(p, registre), { tempsActif: 300_000, notions: 1, matieres: 1, jeux: 3, questions: 0, badges: p.badges.length });
});

test("durée : heures et minutes sans secondes, jamais négative", () => {
  assert.deepEqual(E.decomposerDuree(0), { heures: 0, minutes: 0 });
  assert.deepEqual(E.decomposerDuree(59_999), { heures: 0, minutes: 0 });
  assert.deepEqual(E.decomposerDuree((2 * 60 + 14) * 60_000 + 59_000), { heures: 2, minutes: 14 });
  assert.deepEqual(E.decomposerDuree(-5), { heures: 0, minutes: 0 });
  assert.deepEqual(E.decomposerDuree(NaN), { heures: 0, minutes: 0 });
});
