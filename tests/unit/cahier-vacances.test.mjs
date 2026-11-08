import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  joursActifs, choixPossibles, ordonnerNotions, notionsDiagnostic, creerPlan, terminerJournee, planning, validerPlan, ajouterJours
} from "../../web/cahier-vacances.js";

// Cahier de vacances local (feuille de route, phase 2 ; issue #188). Le 2026-07-06 est un lundi.
const notions = [
  { id: "thales", matiere: "mathematiques", niveaux: ["cycle-4", "seconde"], prerequis: ["proportionnalite"] },
  { id: "fractions", matiere: "mathematiques", niveaux: ["cycle-3", "cycle-4", "seconde"], prerequis: [] },
  { id: "proportionnalite", matiere: "mathematiques", niveaux: ["cycle-3", "cycle-4", "seconde"], prerequis: ["fractions", "nombres-decimaux"] },
  { id: "nombres-decimaux", matiere: "mathematiques", niveaux: ["cycle-3", "cycle-4", "seconde"], prerequis: [] },
  { id: "equations", matiere: "mathematiques", niveaux: ["cycle-4", "seconde"], prerequis: ["calcul-litteral"] },
  { id: "calcul-litteral", matiere: "mathematiques", niveaux: ["cycle-4", "seconde"], prerequis: [] },
  { id: "derivation", matiere: "mathematiques", niveaux: ["premiere"], prerequis: [] },
  { id: "volcans", matiere: "svt", prerequis: [] },
  { id: "sudoku", matiere: "jeux", niveaux: ["cycle-4"] }
];

test("jours de séance selon le rythme (3, 5 ou 7 jours par semaine), bornes incluses", () => {
  assert.deepEqual(joursActifs("2026-07-06", "2026-07-12", 7).length, 7);
  assert.deepEqual(joursActifs("2026-07-06", "2026-07-12", 5), ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10"]);
  assert.deepEqual(joursActifs("2026-07-06", "2026-07-12", 3), ["2026-07-06", "2026-07-08", "2026-07-10"]);
  assert.deepEqual(joursActifs("2026-07-12", "2026-07-06", 5), [], "période à l'envers");
  assert.deepEqual(joursActifs("2026-07-06", "2026-07-12", 4), [], "rythme inconnu");
});

test("choix possibles : matières et niveaux couverts par le référentiel, jeux exclus", () => {
  assert.deepEqual(choixPossibles(notions), { mathematiques: ["cycle-3", "cycle-4", "seconde", "premiere"] });
});

test("ordre d'apprentissage : chaque prérequis avant la notion qui en dépend, puis niveau de début, puis catalogue", () => {
  const ordre = ordonnerNotions(notions, { matiere: "mathematiques", niveau: "cycle-4" });
  // Thalès et le calcul littéral deviennent possibles en même temps (cycle 4) : l'ordre du catalogue les départage.
  assert.deepEqual(ordre, ["fractions", "nombres-decimaux", "proportionnalite", "thales", "calcul-litteral", "equations"]);
  for (const n of notions.filter((x) => ordre.includes(x.id))) {
    for (const p of n.prerequis.filter((x) => ordre.includes(x))) assert.ok(ordre.indexOf(p) < ordre.indexOf(n.id), `${p} avant ${n.id}`);
  }
  assert.deepEqual(ordonnerNotions(notions, { matiere: "mathematiques", niveau: "premiere" }), ["derivation"]);
  assert.deepEqual(ordonnerNotions(notions, { matiere: "svt", niveau: "cycle-4" }), [], "sans référentiel : rien");
  assert.deepEqual(notionsDiagnostic(ordonnerNotions(notions, { matiere: "mathematiques", niveau: "cycle-4" }), ["fractions"]),
    ["nombres-decimaux", "proportionnalite", "thales", "calcul-litteral", "equations"], "5 notions, sans celles déjà maîtrisées");
});

const plan = () => creerPlan({
  matiere: "mathematiques", niveau: "cycle-4", debut: "2026-07-06", fin: "2026-07-19", rythme: 5,
  ordre: ["fractions", "nombres-decimaux", "proportionnalite", "calcul-litteral", "thales", "equations"], acquises: ["fractions"]
});

test("planning : une notion par jour de séance, notions acquises écartées, jours en trop en révision", () => {
  const p = plan();
  assert.deepEqual(p.notions, ["nombres-decimaux", "proportionnalite", "calcul-litteral", "thales", "equations"]);
  assert.deepEqual(p.acquises, ["fractions"]);
  const lundi = planning(p, "2026-07-06");
  assert.equal(lundi.etat, "en-cours");
  assert.deepEqual(lundi.aujourdhui, { date: "2026-07-06", type: "notion", notion: "nombres-decimaux" });
  assert.deepEqual(lundi.jours.slice(0, 6).map((j) => [j.date, j.notion ?? j.type]), [
    ["2026-07-06", "nombres-decimaux"], ["2026-07-07", "proportionnalite"], ["2026-07-08", "calcul-litteral"],
    ["2026-07-09", "thales"], ["2026-07-10", "equations"], ["2026-07-13", "revision"]
  ]);
  assert.equal(lundi.horsPlanning, 0);
  assert.deepEqual(planning(p, "2026-07-11").aujourdhui, { type: "repos", prochain: "2026-07-13" }, "samedi : repos (rythme 5)");
  assert.deepEqual(planning(p, "2026-07-01").aujourdhui, { type: "avant", prochain: "2026-07-06" });
  assert.equal(planning(p, "2026-07-01").etat, "a-venir");
});

test("absence : le planning repart d'aujourd'hui sans pénalité, la suite se décale", () => {
  let p = terminerJournee(plan(), "nombres-decimaux", "2026-07-06");
  // Absent mardi et mercredi : jeudi, on reprend avec la notion suivante, sans rattrapage ni retard affiché.
  const jeudi = planning(p, "2026-07-09");
  assert.deepEqual(jeudi.aujourdhui, { date: "2026-07-09", type: "notion", notion: "proportionnalite" });
  assert.deepEqual(jeudi.jours.map((j) => j.notion ?? j.type), ["proportionnalite", "calcul-litteral", "thales", "equations", "revision", "revision", "revision"]);
  assert.equal(jeudi.faites, 1);
  p = terminerJournee(p, "proportionnalite", "2026-07-09");
  const apres = planning(p, "2026-07-09");
  assert.equal(apres.aujourdhui.type, "faite");
  assert.equal(apres.aujourdhui.notion, "proportionnalite");
  assert.deepEqual(apres.jours[0], { date: "2026-07-10", type: "notion", notion: "calcul-litteral" }, "la suite commence demain");
  assert.equal(terminerJournee(p, "proportionnalite", "2026-07-10"), p, "une journée ne se termine qu'une fois");
  assert.equal(terminerJournee(p, "inconnue", "2026-07-10"), p);
});

test("période trop courte : les notions en trop sont comptées, puis bilan à la fin de la période", () => {
  const court = { ...plan(), fin: "2026-07-07" };
  const r = planning(court, "2026-07-06");
  assert.equal(r.jours.length, 2);
  assert.equal(r.horsPlanning, 3);
  assert.equal(planning(court, "2026-07-08").etat, "periode-finie");
  let fini = plan();
  for (const id of fini.notions) fini = terminerJournee(fini, id, "2026-07-06");
  assert.equal(planning(fini, "2026-07-07").etat, "termine");
});

test("plan stocké : relu strictement (champs connus, dates valides, période bornée)", () => {
  const p = terminerJournee(plan(), "nombres-decimaux", "2026-07-06");
  assert.deepEqual(validerPlan(JSON.parse(JSON.stringify(p))), p);
  for (const casse of [null, { ...p, v: 2 }, { ...p, niveau: "cm2" }, { ...p, debut: "2026-02-30" }, { ...p, fin: "2026-07-01" },
    { ...p, fin: ajouterJours(p.debut, 200) }, { ...p, rythme: 4 }, { ...p, notions: "x" }]) {
    assert.equal(validerPlan(casse), null, JSON.stringify(casse)?.slice(0, 80));
  }
  const nettoye = validerPlan({ ...p, notions: [...p.notions, "Mauvais Id", "thales"], faites: { ...p.faites, inconnue: "2026-07-06", thales: "x" } });
  assert.deepEqual(nettoye.notions, p.notions);
  assert.deepEqual(nettoye.faites, { "nombres-decimaux": "2026-07-06" });
});

test("cahier de vacances : textes traduits en français et en anglais", async () => {
  const racine = new URL("../..", import.meta.url).pathname;
  const fr = JSON.parse(await readFile(`${racine}web/i18n/fr.json`, "utf8"));
  const en = JSON.parse(await readFile(`${racine}web/i18n/en.json`, "utf8"));
  const cles = Object.keys(fr).filter((k) => k.startsWith("vacances"));
  assert.ok(cles.length >= 20, `${cles.length} clés`);
  for (const k of cles) assert.ok(en[k], `en : ${k}`);
});
