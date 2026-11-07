import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recommander } from "../../web/recommandation.js";

// Recommandation déterministe (feuille de route, phase 2 ; issue #186).
const racine = new URL("../..", import.meta.url).pathname;
const notions = [
  { id: "fractions", titre: "Les fractions", matiere: "mathematiques", niveaux: ["cycle-3", "cycle-4"], prerequis: [] },
  { id: "nombres-decimaux", titre: "Les nombres décimaux", matiere: "mathematiques", niveaux: ["cycle-3"], prerequis: [] },
  { id: "proportionnalite", titre: "La proportionnalité", matiere: "mathematiques", niveaux: ["cycle-3", "cycle-4"], prerequis: ["fractions", "nombres-decimaux"] },
  { id: "thales", titre: "Le théorème de Thalès", matiere: "mathematiques", niveaux: ["cycle-4"], prerequis: ["proportionnalite"] },
  { id: "probabilites", titre: "Les probabilités", matiere: "mathematiques", niveaux: ["cycle-4", "seconde"], prerequis: ["fractions"] },
  { id: "chimie", titre: "La chimie", matiere: "physique-chimie", niveaux: ["cycle-4"], prerequis: ["fractions"] },
  { id: "sudoku", titre: "Sudoku", matiere: "jeux", prerequis: ["fractions"] }
];
const etats = (table) => (id) => table[id] ?? { etat: "non-commencee", revision: null };
const maitrisee = (revision = "2026-11-14") => ({ etat: "maitrisee", revision });

test("recommandation : rien de maîtrisé → aucune proposition (l'accueil garde sa suggestion)", () => {
  assert.equal(recommander({ notions, maitrise: etats({}) }), null);
  assert.equal(recommander({ notions: [], maitrise: etats({}) }), null);
  assert.equal(recommander({ notions: undefined, maitrise: etats({}) }), null);
});

test("recommandation : prochaine notion dont tous les prérequis sont maîtrisés, avec la raison", () => {
  const r = recommander({ notions, maitrise: etats({ fractions: maitrisee() }), matiere: "mathematiques" });
  assert.equal(r.notion.id, "probabilites", "proportionnalité exige aussi les décimaux ; le jeu n'est jamais proposé");
  assert.deepEqual(r.raison, { cle: "recoPrerequis", variables: { prerequis: ["Les fractions"] } });
  const deux = recommander({ notions, maitrise: etats({ fractions: maitrisee(), "nombres-decimaux": { etat: "a-revoir", revision: "2026-11-01" } }) });
  assert.equal(deux.raison.cle, "recoRevision", "une révision due passe avant une nouvelle notion");
});

test("recommandation : départage par matière de la dernière notion, puis niveau de début, puis ordre du catalogue", () => {
  const base = etats({ fractions: maitrisee(), "nombres-decimaux": maitrisee() });
  const maths = recommander({ notions, maitrise: base, matiere: "mathematiques" });
  assert.equal(maths.notion.id, "proportionnalite", "cycle 3 avant cycle 4");
  assert.deepEqual(maths.raison.variables.prerequis, ["Les fractions", "Les nombres décimaux"]);
  assert.equal(recommander({ notions, maitrise: base, matiere: "physique-chimie" }).notion.id, "chimie");
  const acquises = etats({ fractions: maitrisee(), "nombres-decimaux": maitrisee(), proportionnalite: maitrisee(), probabilites: maitrisee(), chimie: maitrisee() });
  assert.equal(recommander({ notions, maitrise: acquises }).notion.id, "thales");
  const tout = etats(Object.fromEntries(notions.map((n) => [n.id, maitrisee()])));
  assert.equal(recommander({ notions, maitrise: tout }), null, "tout est maîtrisé et rien n'est à revoir");
});

test("recommandation : révision la plus ancienne d'abord, puis par identifiant", () => {
  const r = recommander({ notions, maitrise: etats({
    thales: { etat: "a-revoir", revision: "2026-11-10" }, fractions: { etat: "a-revoir", revision: "2026-11-03" },
    probabilites: { etat: "a-revoir", revision: "2026-11-03" }
  }) });
  assert.deepEqual(r.raison, { cle: "recoRevision", variables: { titre: "Les fractions", date: "2026-11-03" } });
});

test("recommandation : mêmes données, même proposition, quel que soit l'appel", () => {
  const donnees = { notions, maitrise: etats({ fractions: maitrisee(), "nombres-decimaux": maitrisee() }), matiere: "mathematiques" };
  const premiere = recommander(donnees);
  for (let i = 0; i < 5; i++) assert.deepEqual(recommander(donnees), premiere);
  assert.deepEqual(notions.map((n) => n.id), ["fractions", "nombres-decimaux", "proportionnalite", "thales", "probabilites", "chimie", "sudoku"], "catalogue non modifié");
});

test("recommandation : raisons traduites en français et en anglais", async () => {
  for (const langue of ["fr", "en"]) {
    const textes = JSON.parse(await readFile(`${racine}web/i18n/${langue}.json`, "utf8"));
    assert.match(textes.recoPrerequis, /\{prerequis\}/, langue);
    assert.match(textes.recoRevision, /\{titre\}.*\{date\}/, langue);
    for (const cle of ["recoRevisionSurTitre", "recoReviser", "recoNote"]) assert.ok(textes[cle], `${langue} : ${cle}`);
  }
});
