import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALPHABET_CODE
} from "../../web/famille.js";
import {
  LONGUEUR_CODE_PROF, MATIERES_PROF, NIVEAUX_PROF, VERSION_ACCORD_ELEVE, afficherCodeProf, bilanPourProfesseur, filtrerEleves,
  lienInvitation, lireProfilProf, matieresSuivies, niveauCatalogue, normaliserCodeProf, notionsARevoir, syntheseEleves, tirerCodeProf,
  validerAdhesion, validerClasse, validerDemandeInvitation, validerProfilProf
} from "../../web/professeur.js";
import { validerPseudo } from "../../web/profil.js";

// Règles de l'expérience Professeur (ADR 0030), partagées par le Worker, l'interface et la démonstration.
const profil = { nomAffiche: "M. Martin", matieres: ["mathematiques", "svt"], niveaux: ["4e", "3e"] };

test("profil : nom affiché borné, matières et niveaux en listes fermées, ordre canonique", () => {
  const r = validerProfilProf({ nomAffiche: "  Mme   Diallo ", matieres: ["svt", "mathematiques", "jeux", "svt"], niveaux: ["3e", "6e"] });
  assert.deepEqual(r, { ok: true, profil: { nomAffiche: "Mme Diallo", matieres: ["mathematiques", "svt"], niveaux: ["6e", "3e"] } });
  assert.equal(validerProfilProf({ ...profil, nomAffiche: "M" }).code, "nom-court");
  assert.equal(validerProfilProf({ ...profil, nomAffiche: "x".repeat(41) }).code, "nom-long");
  assert.equal(validerProfilProf({ ...profil, nomAffiche: "prof@ecole.fr" }).code, "nom-caracteres");
  assert.equal(validerProfilProf({ ...profil, nomAffiche: "M. 06 12 34 56 78" }).code, "nom-chiffres");
  assert.equal(validerProfilProf({ ...profil, matieres: [] }).code, "matieres-invalides");
  assert.equal(validerProfilProf({ ...profil, matieres: ["jeux"] }).code, "matieres-invalides");
  assert.equal(validerProfilProf({ ...profil, matieres: MATIERES_PROF.slice(0, 6) }).code, "matieres-invalides");
  assert.equal(validerProfilProf({ ...profil, niveaux: ["cp"] }).code, "niveaux-invalides");
  assert.deepEqual(lireProfilProf({ nom_affiche: "M. Martin", matieres: '["svt"]', niveaux: '["4e"]' }), { nomAffiche: "M. Martin", matieres: ["svt"], niveaux: ["4e"] });
  assert.equal(lireProfilProf({ nom_affiche: "M. Martin", matieres: "{", niveaux: '["4e"]' }), null);
  assert.equal(lireProfilProf(null), null);
});

test("niveaux : chaque niveau d'enseignement correspond à un niveau du catalogue", () => {
  for (const n of NIVEAUX_PROF) assert.ok(niveauCatalogue(n), n);
  assert.equal(niveauCatalogue("4e"), "college");
  assert.equal(niveauCatalogue("terminale"), "terminale");
  assert.equal(niveauCatalogue("cp"), null);
});

test("classe : nom court, matière et niveau pris dans le profil", () => {
  assert.deepEqual(validerClasse({ nom: " 4e B ", matiere: "svt", niveau: "4e" }, profil), { ok: true, classe: { nom: "4e B", matiere: "svt", niveau: "4e" } });
  assert.equal(validerClasse({ nom: "4e B", matiere: "svt", niveau: "4e" }, null).code, "profil-requis");
  assert.equal(validerClasse({ nom: "", matiere: "svt", niveau: "4e" }, profil).code, "classe-court");
  assert.equal(validerClasse({ nom: "x".repeat(31), matiere: "svt", niveau: "4e" }, profil).code, "classe-long");
  assert.equal(validerClasse({ nom: "4e B", matiere: "histoire", niveau: "4e" }, profil).code, "matiere-hors-profil");
  assert.equal(validerClasse({ nom: "4e B", matiere: "svt", niveau: "seconde" }, profil).code, "niveau-hors-profil");
});

test("invitation : mode, durée et classe contrôlés", () => {
  assert.deepEqual(validerDemandeInvitation({ mode: "particulier" }), { ok: true, invitation: { mode: "particulier", classeId: null, dureeJours: 7 } });
  assert.deepEqual(validerDemandeInvitation({ mode: "classe", classeId: "abc-1", dureeJours: 30 }).invitation, { mode: "classe", classeId: "abc-1", dureeJours: 30 });
  assert.equal(validerDemandeInvitation({ mode: "autre" }).code, "mode-invalide");
  assert.equal(validerDemandeInvitation({ mode: "classe" }).code, "classe-requise");
  assert.equal(validerDemandeInvitation({ mode: "particulier", dureeJours: 365 }).code, "duree-invalide");
});

test("codes : tirage dans l'alphabet sans ambiguïté, lecture d'un code ou d'un lien collé", () => {
  let n = 0;
  const code = tirerCodeProf((k) => Uint8Array.from({ length: k }, () => (n++ * 37) % 256));
  assert.equal(code.length, LONGUEUR_CODE_PROF);
  assert.ok([...code].every((c) => ALPHABET_CODE.includes(c)));
  assert.equal(normaliserCodeProf(afficherCodeProf(code).toLowerCase()), code);
  const lien = lienInvitation("https://www.kermiclab.online", code);
  assert.equal(lien, `https://www.kermiclab.online/?rejoindre=${code}`);
  assert.equal(normaliserCodeProf(lien), code);
  assert.equal(normaliserCodeProf("ABCDE"), null);
  assert.equal(normaliserCodeProf("ABCDEFGHI0"), null); // 0 hors alphabet
});

test("adhésion : pseudo de l'élève et accord explicite au partage", () => {
  assert.deepEqual(validerAdhesion({ pseudo: "Léa", accord: VERSION_ACCORD_ELEVE }, { validerPseudo }), { ok: true, pseudo: "Léa" });
  assert.equal(validerAdhesion({ pseudo: "Léa" }, { validerPseudo }).code, "accord-requis");
  assert.equal(validerAdhesion({ pseudo: "L", accord: VERSION_ACCORD_ELEVE }, { validerPseudo }).code, "pseudo-court");
});

const bilan = (jour, notions, dernierJour = jour) => ({
  v: 1, jour, xp: 120, niveau: 3, serie: 2, questions: 4, tempsMin: 50, dernierJour, badges: ["premier-pas"],
  jours: [{ jour, xp: 40, min: 20, q: 2 }], notions, cahiers: [{ famille: "11111111-1111-1111-1111-111111111111", reussis: 1, total: 2 }]
});

test("bilan vu par le professeur : seulement les notions des matières suivies, ni badges ni cahiers", () => {
  const matiere = (id) => ({ pythagore: "mathematiques", cellule: "svt", revolution: "histoire" })[id] ?? null;
  const b = bilanPourProfesseur(bilan("2026-11-17", {
    pythagore: { etat: "maitrisee", tentes: 3, reussis: 3 }, cellule: { etat: "a-revoir", tentes: 2, reussis: 0 }, revolution: { etat: "en-cours", tentes: 1, reussis: 1 }
  }), ["mathematiques", "svt"], matiere);
  assert.deepEqual(Object.keys(b.notions), ["pythagore", "cellule"]);
  assert.deepEqual(b.badges, []);
  assert.deepEqual(b.cahiers, []);
  assert.equal(bilanPourProfesseur({ pas: "un bilan" }, ["svt"], matiere), null);
  const classes = [{ id: "c1", matiere: "svt" }];
  assert.deepEqual(matieresSuivies({ classeId: "c1" }, classes, profil), ["svt"]);
  assert.deepEqual(matieresSuivies({ classeId: null }, classes, profil), ["mathematiques", "svt"]);
});

test("synthèse : effectif, actifs, alertes, notions à revoir et filtres", () => {
  const eleves = [
    { id: "a", classeId: "c1", bilan: bilan("2026-11-17", { cellule: { etat: "a-revoir", tentes: 2, reussis: 0 } }, "2026-11-16") },
    { id: "b", classeId: "c1", bilan: bilan("2026-11-01", { cellule: { etat: "a-revoir", tentes: 1, reussis: 0 }, pythagore: { etat: "a-revoir", tentes: 1, reussis: 0 } }, "2026-11-01") },
    { id: "c", classeId: null, bilan: null }
  ];
  const s = syntheseEleves(eleves, "2026-11-17");
  assert.equal(s.eleves, 3);
  assert.equal(s.actifs, 1);
  assert.deepEqual(s.alertes.map((a) => `${a.eleve}:${a.type}`), ["a:a-revoir", "b:inactif", "b:a-revoir", "c:jamais"]);
  assert.equal(s.aRevoir, 3);
  assert.deepEqual(notionsARevoir(eleves), [{ id: "cellule", n: 2 }, { id: "pythagore", n: 1 }]);
  assert.deepEqual(filtrerEleves(eleves, "particulier").map((e) => e.id), ["c"]);
  assert.deepEqual(filtrerEleves(eleves, "c1").map((e) => e.id), ["a", "b"]);
  assert.equal(filtrerEleves(eleves, "tous").length, 3);
});
