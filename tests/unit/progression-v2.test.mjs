import { test } from "node:test";
import assert from "node:assert/strict";
import * as P from "../../web/progression.js";

const J = "2026-11-06";
const memoire = (contenu) => {
  const donnees = new Map(contenu === undefined ? [] : [[P.CLE_STOCKAGE, contenu]]);
  return { getItem: (c) => donnees.get(c) ?? null, setItem: (c, v) => donnees.set(c, v), donnees };
};
const sansNaN = (valeur) => JSON.stringify(valeur, (_, v) => {
  assert.ok(v !== undefined && !(typeof v === "number" && !Number.isFinite(v)), "valeur non finie");
  return v;
});

test("migration : aucune donnée → état v2 vide, sans NaN ni undefined", () => {
  const p = P.charger(memoire());
  assert.equal(p.version, 2);
  assert.deepEqual(p.tempsActif, { total: 0, sections: {}, experiences: {} });
  assert.deepEqual(p.decouvertes, {});
  assert.equal(p.derniere, null);
  sansNaN(p);
});

test("migration : une progression v1 valide est conservée et ses notions deviennent des découvertes", () => {
  const v1 = {
    version: 1, questions: 4, xp: 140, notions: ["pythagore", "thales"], serie: 2, serieMax: 5, dernierJour: "2026-11-05",
    badges: ["premier-pas", "explorateur"], jours: { "2026-11-05": { q: 1, n: 1, xp: 35 } }, derniereNotion: "thales", defiJour: null
  };
  const p = P.charger(memoire(JSON.stringify(v1)));
  assert.equal(p.version, 2);
  for (const cle of ["questions", "xp", "notions", "serie", "serieMax", "dernierJour", "badges", "derniereNotion"]) assert.deepEqual(p[cle], v1[cle]);
  assert.deepEqual(p.jours, v1.jours);
  // Aucune date ni nombre d'ouvertures inventés.
  assert.deepEqual(p.decouvertes, { notion: { pythagore: { premiere: null, ouvertures: 0 }, thales: { premiere: null, ouvertures: 0 } } });
  assert.deepEqual(p.derniere, { type: "notion", id: "thales" });
  sansNaN(p);
});

test("migration : une progression v2 est relue à l'identique", () => {
  let p = P.etatInitial();
  p = P.enregistrerNotion(p, "pythagore", J).p;
  p = P.enregistrerExperience(p, "jeu", "demineur", J).p;
  p = P.ajouterTemps(p, { total: 90_000, sections: { jeux: 90_000 }, experiences: { "jeu:demineur": 60_000 } }, J).p;
  const s = memoire();
  P.sauver(s, p);
  assert.deepEqual(P.charger(s), p);
});

test("migration : champs manquants, invalides ou d'une version partiellement ancienne", () => {
  const brut = {
    version: 2, xp: 50, notions: ["pythagore"],
    tempsActif: { total: "beaucoup", sections: { education: -5, jeux: 12_000, "Pas Valide": 3 }, experiences: { "jeu:demineur": NaN, "jeu:echecs": 4000, nimporte: 9 } },
    decouvertes: { jeu: { demineur: { premiere: "hier", ouvertures: -2 }, "": {} }, "Type Invalide": { a: {} }, notion: "cassé" },
    derniere: { type: "jeu", id: "../../etc" },
    jours: { "2026-11-05": { q: 1, s: "x" } }
  };
  const p = P.normaliser(brut);
  assert.deepEqual(p.tempsActif, { total: 0, sections: { jeux: 12_000 }, experiences: { "jeu:echecs": 4000 } });
  assert.deepEqual(p.decouvertes, { jeu: { demineur: { premiere: null, ouvertures: 0 } }, notion: { pythagore: { premiere: null, ouvertures: 0 } } });
  assert.deepEqual(p.derniere, null);
  assert.deepEqual(p.jours, { "2026-11-05": { q: 1, n: 0, xp: 0 } });
  sansNaN(p);
});

test("découverte générique : n'importe quel type et identifiant, premier jour et ouvertures", () => {
  let p = P.etatInitial();
  const cas = [["section", "education"], ["matiere", "svt"], ["notion", "pythagore"], ["jeu", "sudoku"], ["jeu", "demineur"], ["lab", "cercle"]];
  for (const [type, id] of cas) {
    assert.equal(P.estDecouverte(p, type, id), false);
    const r = P.decouvrir(p, type, id, J);
    assert.equal(r.nouvelle, true);
    p = r.p;
    assert.equal(P.estDecouverte(p, type, id), true);
  }
  const encore = P.decouvrir(p, "jeu", "sudoku", "2026-11-07");
  assert.equal(encore.nouvelle, false);
  assert.deepEqual(encore.p.decouvertes.jeu.sudoku, { premiere: J, ouvertures: 2 });
  // Un identifiant ou un type hors format est ignoré sans rien casser.
  for (const [type, id] of [["jeu", "../x"], ["JEU", "x"], ["jeu", ""], [null, "x"]]) assert.equal(P.decouvrir(p, type, id, J).p, p);
});

test("expérience non scolaire : retenue pour « Reprendre », XP la première fois seulement, jamais comptée comme notion", () => {
  const p0 = P.etatInitial();
  const r1 = P.enregistrerExperience(p0, "jeu", "demineur", J);
  assert.equal(r1.xpGagne, P.XP_NOTION);
  assert.equal(r1.nouvelle, true);
  assert.deepEqual(r1.p.derniere, { type: "jeu", id: "demineur" });
  assert.deepEqual(r1.p.notions, []);
  const r2 = P.enregistrerExperience(r1.p, "jeu", "demineur", J);
  assert.equal(r2.xpGagne, 0);
  assert.equal(r2.p.decouvertes.jeu.demineur.ouvertures, 2);
  // Une notion passe par le chemin habituel (XP, notions[], derniereNotion).
  const r3 = P.enregistrerExperience(r2.p, "notion", "pythagore", J);
  assert.deepEqual(r3.p.notions, ["pythagore"]);
  assert.equal(r3.p.derniereNotion, "pythagore");
  assert.deepEqual(r3.p.derniere, { type: "notion", id: "pythagore" });
});

test("temps actif cumulé : total, ventilations, jour, et badge « assidu » à 1 h", () => {
  let p = P.etatInitial();
  const r = P.ajouterTemps(p, { total: 20 * 60_000, sections: { education: 20 * 60_000 }, experiences: {} }, J);
  p = r.p;
  assert.equal(p.tempsActif.total, 20 * 60_000);
  assert.equal(p.jours[J].s, 20 * 60_000);
  assert.deepEqual(r.nouveaux, []);
  const r2 = P.ajouterTemps(p, { total: 40 * 60_000, sections: { jeux: 40 * 60_000 }, experiences: { "jeu:demineur": 40 * 60_000 } }, J);
  assert.deepEqual(r2.nouveaux.map((b) => b.id), ["assidu"]);
  assert.equal(r2.p.tempsActif.total, 60 * 60_000);
  assert.deepEqual(r2.p.tempsActif.sections, { education: 20 * 60_000, jeux: 40 * 60_000 });
  // Relevés vides, négatifs ou aberrants : ignorés.
  for (const releve of [null, {}, { total: 0 }, { total: -5 }, { total: NaN }, { total: 48 * 3600_000 }]) assert.equal(P.ajouterTemps(p, releve, J).p, p);
  // Une ventilation ne peut pas dépasser le total du relevé.
  const r3 = P.ajouterTemps(P.etatInitial(), { total: 1000, sections: { jeux: 5000 } }, J);
  assert.equal(r3.p.tempsActif.sections.jeux, 1000);
});

test("activité de la semaine : le temps actif du jour vaut 0 pour un jour ancien", () => {
  const jours = P.activite(P.normaliser({ jours: { [J]: { q: 1, n: 0, xp: 10 } } }), J);
  assert.equal(jours.at(-1).s, 0);
  assert.equal(jours[0].s, 0);
});

test("reclassement : un jeu enregistré comme notion (v1) devient un jeu, sans perte d'XP ni de badge", () => {
  const v1 = { version: 1, xp: 75, notions: ["pythagore", "demineur", "inconnue"], badges: ["explorateur"], derniereNotion: "demineur" };
  const p = P.normaliser(v1);
  const typeDe = (id) => ({ pythagore: "notion", demineur: "jeu" })[id] ?? null;
  const q = P.reclasser(p, typeDe);
  assert.deepEqual(q.notions, ["pythagore", "inconnue"], "un identifiant inconnu du catalogue n'est pas touché");
  assert.deepEqual(Object.keys(q.decouvertes.notion).sort(), ["inconnue", "pythagore"]);
  assert.deepEqual(q.decouvertes.jeu, { demineur: { premiere: null, ouvertures: 0 } });
  assert.deepEqual(q.derniere, { type: "jeu", id: "demineur" });
  assert.equal(q.xp, 75);
  assert.deepEqual(q.badges, ["explorateur"]);
  assert.equal(P.reclasser(q, typeDe), q, "idempotent");
});

test("synchronisation : seules les notions partent, et la fusion distante n'efface ni n'invente rien", () => {
  let p = P.enregistrerNotion(P.etatInitial(), "pythagore", J).p;
  p = P.ajouterTemps(p, { total: 5000 }, J).p;
  assert.deepEqual(P.pourSynchronisation(p), { notions: { pythagore: {} } });
  const f = P.fusionnerNotionsDistantes(p, ["thales", "pythagore", 42, "../x", "thales"]);
  assert.deepEqual(f.notions, ["pythagore", "thales"]);
  assert.equal(f.xp, p.xp);
  assert.deepEqual(f.decouvertes.notion.thales, { premiere: null, ouvertures: 0 });
  assert.equal(f.tempsActif.total, 5000);
  assert.equal(P.fusionnerNotionsDistantes(p, null), p);
});

test("badges : avancement borné, sans grille verrouillée à afficher", () => {
  const p = P.normaliser({ questions: 3, notions: ["a"], serieMax: 1, badges: ["premier-pas", "explorateur"], tempsActif: { total: 30 * 60_000 } });
  const avance = P.avancementBadges(p);
  assert.deepEqual(avance.map((b) => b.id), P.BADGES.map((b) => b.id));
  const parId = Object.fromEntries(avance.map((b) => [b.id, b]));
  assert.deepEqual([parId.curieux.actuel, parId.curieux.cible, parId.curieux.obtenu], [3, 5, false]);
  assert.deepEqual([parId.assidu.actuel, parId.assidu.cible], [30, 60]);
  assert.deepEqual([parId["premier-pas"].actuel, parId["premier-pas"].obtenu], [1, true]);
  for (const b of avance) assert.ok(b.actuel >= 0 && b.actuel <= b.cible);
});
