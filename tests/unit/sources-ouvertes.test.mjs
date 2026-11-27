import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  normaliserEvaluations, normaliserProgrammes, prioriserNotions, rattacherProgrammes, normaliserCalendrier, reperesNationaux, verifierCorrespondances
} from "../../scripts/lib/sources-ouvertes.mjs";
import { avecReperes } from "../../web/professeur.js";
import { prochainesVacances, zonesCalendrier } from "../../web/cahier-vacances.js";
import { DOSSIER, RAPPORT, construireRapport, lireFiches } from "../../scripts/sources-ouvertes.mjs";

// Sources ouvertes de l'Éducation nationale (ADR 0044) : fonctions pures, instantanés versionnés et rapport à jour.
const ligne = (annee, region, caracteristique, competence, taux, discipline = "Mathématiques") => ({
  annee, libelle_region_academique: region, caracteristique, competence, discipline, taux_de_maitrise: taux
});
const evaluationsBrutes = Object.fromEntries(["CP", "CE1", "CE2", "CM1", "CM2"].map((n) => [n, [
  ligne("2024", "NATIONAL", "Ensemble", "Résoudre des problèmes", 40),
  ligne("2025", "NATIONAL", "Ensemble", "Résoudre des problèmes", 47.66),
  ligne("2025", "NATIONAL", "Filles", "Résoudre des problèmes", 46),
  ligne("2025", "BRETAGNE", "Ensemble", "Résoudre des problèmes", 55),
  ligne("2025", "NATIONAL", "Ensemble", "Additionner", 80)
]]));

test("évaluations : dernière année, ligne NATIONAL, population Ensemble, tri par niveau", () => {
  const e = normaliserEvaluations(evaluationsBrutes);
  assert.equal(e.length, 10);
  assert.deepEqual(e[1], { niveau: "CP", annee: "2025", discipline: "Mathématiques", competence: "Résoudre des problèmes", taux: 47.7 });
  assert.deepEqual(e.map((x) => x.niveau).slice(0, 4), ["CP", "CP", "CE1", "CE1"]);
  assert.throws(() => normaliserEvaluations({ ...evaluationsBrutes, CM2: [] }), /CM2 : aucune ligne NATIONAL/);
  const doublon = { ...evaluationsBrutes, CP: [...evaluationsBrutes.CP, ligne("2025", "NATIONAL", "Ensemble", "Additionner", 81)] };
  assert.throws(() => normaliserEvaluations(doublon), /en double « Additionner »/);
});

test("programmes : textes en vigueur de l'école, du collège et du lycée général, sans doublon", () => {
  const brut = (niveau, discipline, abroge, voie = "-", contenu = `${niveau}-${discipline}.pdf`) => ({
    niveau_d_enseignement: niveau, discipline, abroge_a_la_rentree: abroge, voie, contenu_sur_le_site: contenu,
    texte_officiel: "arrêté", lien_vers_le_texte_officiel: "https://legifrance", entre_en_vigueur_a_la_rentree: "2020", descriptif: "Programme"
  });
  const p = normaliserProgrammes([
    brut("Terminale générale", "Philosophie", "-", "Générale"),
    brut("cycle 3", "-", "-"), brut("cycle 3", "-", "-"),
    brut("cycle 2", "-", "2020"),
    brut("Terminale STMG", "Droit", "-", "Technologique"),
    brut("Première professionnelle", "Français", "-", "Professionnelle")
  ]);
  assert.deepEqual(p.map((x) => `${x.niveau}|${x.discipline}`), ["cycle-3|", "terminale|Philosophie"]);
});

test("rattachement : texte du cycle à l'école et au collège, discipline au lycée, jeux ignorés", () => {
  const programmes = [
    { niveau: "cycle-3", discipline: "" }, { niveau: "terminale", discipline: "Philosophie" },
    { niveau: "premiere", discipline: "Numérique et sciences informatiques" }, { niveau: "premiere", discipline: "Mathématiques" }
  ];
  const r = rattacherProgrammes([
    { id: "nsi-algorithmes", sujet: "technologie/nsi-algorithmes", niveaux: ["premiere"] },
    { id: "verite", sujet: "philosophie/verite", niveaux: ["terminale"] },
    { id: "fractions-cm", sujet: "mathematiques/fractions-cm", niveaux: ["cycle-3"] },
    { id: "pendu", sujet: "jeux/pendu", niveaux: [] }
  ], programmes);
  assert.deepEqual(r.map((x) => [x.id, x.textes.map((t) => t.discipline || "cycle")]), [
    ["fractions-cm", ["cycle"]], ["nsi-algorithmes", ["Numérique et sciences informatiques"]], ["verite", ["Philosophie"]]
  ]);
});

test("correspondances et priorités : contrôles et classement par taux le plus bas", () => {
  const evaluations = [
    { niveau: "CE1", competence: "Additionner", taux: 62.3 }, { niveau: "CM2", competence: "Poser et calculer", taux: 45.9 }
  ];
  const table = { seuil: 60, correspondances: [
    { niveau: "CE1", competence: "Additionner", notions: ["addition-c2"] },
    { niveau: "CM2", competence: "Poser et calculer", notions: ["addition-c2", "division-euclidienne-cm"] }
  ] };
  assert.deepEqual(verifierCorrespondances(table, evaluations, new Set(["addition-c2", "division-euclidienne-cm"])), []);
  const fautive = { seuil: 0, correspondances: [
    { niveau: "CE1", competence: "Additionner", notions: ["fantome", "fantome"] },
    { niveau: "CE1", competence: "Inventée", notions: [] }
  ] };
  const erreurs = verifierCorrespondances(fautive, evaluations, new Set(["addition-c2"])).join(" | ");
  for (const motif of [/seuil/, /notion inconnue fantome/, /notion en double/, /compétence inconnue CE1 « Inventée »/, /compétence sans entrée CM2 « Poser et calculer »/]) {
    assert.match(erreurs, motif);
  }
  const p = prioriserNotions(table, evaluations);
  assert.deepEqual(p.map((x) => [x.notion, x.taux]), [["addition-c2", 45.9], ["division-euclidienne-cm", 45.9]]);
  assert.deepEqual(p[0].competences.map((c) => c.competence), ["Poser et calculer", "Additionner"]);
});

test("instantanés versionnés : provenance, licence et table de correspondance valide", async () => {
  const lire = async (nom) => JSON.parse(await readFile(`${DOSSIER}/${nom}`, "utf8"));
  const [evaluations, programmes, table] = await Promise.all([
    lire("evaluations-nationales.json"), lire("programmes.json"), lire("correspondances-evaluations.json")
  ]);
  for (const s of [evaluations.source, programmes.source]) {
    assert.equal(s.licence, "Licence Ouverte v2.0 (Etalab)");
    assert.match(s.extrait_le, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(s.jeux.length && s.jeux.every((j) => j.url.startsWith("https://data.education.gouv.fr/")));
  }
  assert.ok(evaluations.evaluations.length > 0 && programmes.programmes.length > 0);
  const fiches = await lireFiches();
  assert.deepEqual(verifierCorrespondances(table, evaluations.evaluations, new Set(fiches.map((f) => f.id))), []);
  const sansTexte = rattacherProgrammes(fiches, programmes.programmes).filter((r) => !r.textes.length).map((r) => r.id);
  assert.deepEqual(sansTexte, [], "chaque notion du catalogue doit avoir un texte officiel (règle de discipline manquante ?)");
});

test("rapport des sources ouvertes à jour (npm run sources:rapport)", async () => {
  assert.equal(await readFile(RAPPORT, "utf8"), await construireRapport(), "relancer npm run sources:rapport");
});

test("repères nationaux publiés : compétence la moins maîtrisée par notion, attachée aux notions à revoir", () => {
  const evaluations = [
    { niveau: "CE1", annee: "2025", competence: "Additionner", taux: 62.3 },
    { niveau: "CM2", annee: "2025", competence: "Poser et calculer", taux: 45.9 }
  ];
  const table = { statut: "proposition", seuil: 60, correspondances: [
    { niveau: "CE1", competence: "Additionner", notions: ["addition-c2"] },
    { niveau: "CM2", competence: "Poser et calculer", notions: ["addition-c2"] }
  ] };
  const publie = reperesNationaux(table, evaluations);
  assert.equal(publie.licence, "Licence Ouverte v2.0 (Etalab)");
  assert.equal(publie.statut, "proposition");
  assert.deepEqual(publie.reperes, { "addition-c2": { taux: 45.9, niveau: "CM2", competence: "Poser et calculer", annee: "2025" } });
  assert.deepEqual(avecReperes([{ id: "addition-c2", n: 3 }, { id: "thales", n: 1 }], publie.reperes), [
    { id: "addition-c2", n: 3, repere: publie.reperes["addition-c2"] }, { id: "thales", n: 1 }
  ]);
  assert.deepEqual(avecReperes([{ id: "thales", n: 1 }], undefined), [{ id: "thales", n: 1 }]);
});

test("calendrier scolaire : périodes des élèves, jours locaux, ponts et débuts ignorés, prochaine période d'une zone", () => {
  const l = (zones, description, start_date, end_date, population = "-", annee_scolaire = "2026-2027") => ({ zones, description, start_date, end_date, population, annee_scolaire });
  const periodes = normaliserCalendrier([
    l("Zone A", "Vacances de la Toussaint", "2026-10-16T22:00:00+00:00", "2026-11-01T23:00:00+00:00"),
    l("Zone A", "Vacances de la Toussaint", "2026-10-16T22:00:00+00:00", "2026-11-01T23:00:00+00:00"),
    l("Zone A", "Vacances d'Été", "2027-07-02T22:00:00+00:00", "2027-09-01T22:00:00+00:00", "Élèves"),
    l("Zone A", "Vacances d'Été", "2027-07-02T22:00:00+00:00", "2027-08-31T22:00:00+00:00", "Enseignants"),
    l("Zone A", "Pont de l'Ascension", "2027-05-06T22:00:00+00:00", "2027-05-09T22:00:00+00:00"),
    l("Réunion", "Début des Vacances d'Hiver austral", "2027-07-02T22:00:00+00:00", "2027-07-02T22:00:00+00:00"),
    l("Réunion", "Vacances d'Été austral", "2026-12-18T23:00:00+00:00", "2027-01-31T23:00:00+00:00"),
    l("Polynésie", "Vacances", "2026-10-10T10:00:00+00:00", "2026-10-26T10:00:00+00:00"),
    l("Zone A", "Vacances de Noël", "2025-12-19T23:00:00+00:00", "2026-01-04T23:00:00+00:00", "-", "2025-2026")
  ], "2026-11-27");
  assert.deepEqual(periodes, [
    { zone: "Polynésie", annee: "2026-2027", nom: "Vacances", debut: "2026-10-10", fin: "2026-10-25" },
    { zone: "Réunion", annee: "2026-2027", nom: "Vacances d'Été austral", debut: "2026-12-19", fin: "2027-01-31" },
    { zone: "Zone A", annee: "2026-2027", nom: "Vacances de la Toussaint", debut: "2026-10-17", fin: "2026-11-01" },
    { zone: "Zone A", annee: "2026-2027", nom: "Vacances d'Été", debut: "2027-07-03", fin: "2027-09-01" }
  ]);
  assert.deepEqual(zonesCalendrier([...periodes, { zone: "Corse" }, { zone: "Zone B" }]), ["Zone A", "Zone B", "Corse", "Polynésie", "Réunion"]);
  assert.deepEqual(prochainesVacances(periodes, "Zone A", "2026-11-27"), { nom: "Vacances d'Été", debut: "2027-07-03", fin: "2027-09-01" });
  assert.deepEqual(prochainesVacances(periodes, "Réunion", "2027-01-10"), { nom: "Vacances d'Été austral", debut: "2027-01-10", fin: "2027-01-31" });
  assert.equal(prochainesVacances(periodes, "Polynésie", "2026-11-27"), null);
});
