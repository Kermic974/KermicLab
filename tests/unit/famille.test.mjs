import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALPHABET_CODE, LONGUEUR_CODE, afficherCode, appliquerCalibrage, construireBilan, lireCalibrage, normaliserCode,
  repartitionNotions, resumerConsommations, semaineBilan, syntheseFamille, tirerCode, validerBilan, validerProfilEnfant
} from "../../web/famille.js";
import { validerPseudo } from "../../web/profil.js";
import { TRANCHES_AGE, VERSION_CONSENTEMENT } from "../../web/comptes.js";
import * as progression from "../../web/progression.js";

// Règles de l'Espace famille (ADR 0029), partagées par l'interface et le Worker.

test("codes d'invitation : alphabet sans caractère ambigu, saisie tolérante, tirage sans biais", () => {
  for (const c of "ILOU01") assert.equal(ALPHABET_CODE.includes(c), false, c);
  assert.equal(normaliserCode("abcd-efgh"), "ABCDEFGH");
  assert.equal(normaliserCode(" ab cd ef gh "), "ABCDEFGH");
  assert.equal(normaliserCode("ABCD-EFG"), null);
  assert.equal(normaliserCode("ABCD-EFG0"), null, "0 refusé");
  assert.equal(afficherCode("ABCDEFGH"), "ABCD-EFGH");
  const vus = new Set();
  for (let i = 0; i < 200; i++) {
    const code = tirerCode((n) => crypto.getRandomValues(new Uint8Array(n)));
    assert.equal(code.length, LONGUEUR_CODE);
    assert.equal(normaliserCode(code), code);
    vus.add(code);
  }
  assert.equal(vus.size, 200);
  // Octets ≥ 240 écartés (pas de biais de modulo).
  assert.equal(tirerCode((n) => new Uint8Array(n).fill(250).map((v, i) => (i % 2 ? 0 : v))), "AAAAAAAA");
});

test("profil d'enfant : règles du pseudo, tranche connue, consentement versionné", () => {
  const regles = { validerPrenom: validerPseudo, tranches: TRANCHES_AGE, versionConsentement: VERSION_CONSENTEMENT };
  assert.deepEqual(validerProfilEnfant({ prenom: "  Noé ", trancheAge: "11-14", consentement: VERSION_CONSENTEMENT }, regles), { ok: true, prenom: "Noé", tranche: "11-14" });
  assert.equal(validerProfilEnfant({ prenom: "0612345678", trancheAge: "11-14", consentement: VERSION_CONSENTEMENT }, regles).code, "prenom-caracteres");
  assert.equal(validerProfilEnfant({ prenom: "Noé", trancheAge: "18-99", consentement: VERSION_CONSENTEMENT }, regles).code, "tranche-invalide");
  assert.equal(validerProfilEnfant({ prenom: "Noé", trancheAge: "11-14" }, regles).code, "consentement-requis");
  assert.equal(validerProfilEnfant({ prenom: "Noé", trancheAge: "11-14" }, { ...regles, consentementRequis: false }).ok, true);
});

test("bilan : construit depuis la progression, sans pseudo ni texte libre, borné", () => {
  let p = progression.etatInitial();
  p = progression.enregistrerQuestion(p, "2026-11-16").p;
  p = progression.enregistrerNotion(p, "pythagore", "2026-11-17").p;
  const bilan = construireBilan({ ...p, pseudo: "Noé" }, {
    jour: "2026-11-17", niveau: 1, serie: 2, semaine: progression.activite(p, "2026-11-17", 14),
    notions: { pythagore: { etat: "en-cours", tentes: 3, reussis: 5 } }, cahiers: [{ famille: "0".repeat(8) + "-0000-0000-0000-" + "0".repeat(12), reussis: 1, total: 4, titre: "secret" }]
  });
  assert.equal(JSON.stringify(bilan).includes("Noé"), false);
  assert.equal(JSON.stringify(bilan).includes("secret"), false);
  assert.equal(bilan.notions.pythagore.reussis, 3, "réussis ≤ tentés");
  assert.equal(bilan.jours.length, 14);
  assert.equal(bilan.xp, p.xp);
  assert.equal(validerBilan({ jour: "hier" }), null);
  assert.equal(validerBilan([]), null);
  const enorme = validerBilan({ jour: "2026-11-17", notions: Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`n${i}`, { etat: "decouverte" }])) });
  assert.equal(Object.keys(enorme.notions).length, 200);
});

test("synthèse : totaux de la semaine et points d'attention", () => {
  const jour = "2026-11-17";
  const actif = validerBilan({ jour, dernierJour: jour, jours: [{ jour, xp: 50, min: 20 }, { jour: "2026-11-01", xp: 999, min: 999 }], notions: { a: { etat: "a-revoir" }, b: { etat: "maitrisee" } } });
  const inactif = validerBilan({ jour: "2026-11-01", dernierJour: "2026-11-01" });
  assert.deepEqual(semaineBilan(actif, jour), { xp: 50, minutes: 20, joursActifs: 1 });
  assert.deepEqual(repartitionNotions(actif), { decouverte: 0, "en-cours": 0, maitrisee: 1, "a-revoir": 1 });
  const s = syntheseFamille([
    { id: "e1", bilan: actif, cahiers: [{ id: "c1", statut: "en-cours" }, { id: "c2", statut: "assigne", creeLe: "2026-11-10 10:00:00" }] },
    { id: "e2", bilan: inactif, cahiers: [] },
    { id: "e3", bilan: null, cahiers: [] }
  ], jour);
  assert.equal(s.enfants, 3);
  assert.equal(s.xp, 50);
  assert.equal(s.cahiersEnCours, 1);
  assert.deepEqual(s.alertes.map((a) => `${a.enfant}:${a.type}`), ["e1:a-revoir", "e1:cahier-attente", "e2:inactif", "e3:jamais"]);
});

test("calibrage : notions acquises en approfondissement, à la fin, sans exercices faciles", () => {
  const ex = (niveau) => ({ genre: "exercice", niveau, texte: "x" });
  const cahier = { sections: [
    { notion: "a", blocs: [{ genre: "explication", texte: "e" }, ex(1), ex(2), ex(3)] },
    { notion: "b", blocs: [ex(1)] },
    { notion: "c", blocs: [ex(1), ex(2)] }
  ] };
  const resultats = lireCalibrage({ a: true, b: true, z: true }, ["a", "b", "c"]);
  assert.deepEqual(resultats, { a: true, b: true, c: false });
  const r = appliquerCalibrage(cahier, resultats);
  assert.deepEqual(r.sections.map((s) => s.notion), ["c", "a", "b"]);
  assert.deepEqual(r.sections[1].blocs.map((b) => b.niveau ?? b.genre), ["explication", 2, 3]);
  assert.equal(r.sections[2].blocs.length, 1, "aucun autre exercice : le facile est gardé");
  assert.equal(cahier.sections[0].blocs.length, 4, "cahier d'origine intact");
});

test("consommations : regroupées par membre et par module, inconnus ignorés", () => {
  const { parMembre, total } = resumerConsommations([
    { compte: "p", module: "cahier-famille", appels: 1, tokens: 1500 },
    { compte: "e", module: "chat", appels: 2, tokens: 300 },
    { compte: "e", module: "chat", appels: 1, tokens: 100 },
    { compte: "intrus", module: "chat", appels: 9, tokens: 9 },
    { compte: "e", module: "inconnu", appels: 9, tokens: 9 }
  ], ["p", "e"]);
  assert.deepEqual(parMembre.e.modules.chat, { appels: 3, tokens: 400 });
  assert.equal(total.appels, 4);
  assert.equal(total.tokens, 1900);
});

test("comptes suivis : enfants puis élèves par classe et cours particuliers, triés, sans compte invalide", async () => {
  const { comptesSuivis } = await import("../../web/famille.js");
  const libelles = { famille: "Ma famille", particuliers: "Cours particuliers" };
  assert.deepEqual(comptesSuivis({ libelles }), [], "ni enfant ni élève : rien à proposer");
  const bilan = { jour: "2026-11-20", xp: 40 };
  const groupes = comptesSuivis({
    libelles,
    enfants: [{ id: "e1", prenom: "Léo", bilan }, { id: "e2", prenom: "Maya" }, null, { prenom: "sans id" }],
    eleves: {
      classes: [{ id: "c1", nom: "4e B" }, { id: "c2", nom: "3e A" }],
      eleves: [{ id: "s2", pseudo: "Nova", classeId: "c1" }, { id: "s1", pseudo: "Cosinus", classeId: "c1", bilan }, { id: "s3", pseudo: "Kepler", classeId: null }],
    },
  });
  assert.deepEqual(groupes.map((g) => [g.groupe, g.comptes.map((c) => c.cle)]), [
    ["Ma famille", ["famille:e1", "famille:e2"]],
    ["4e B", ["eleve:s1", "eleve:s2"]],
    ["Cours particuliers", ["eleve:s3"]],
  ], "classe vide (3e A) absente, élèves triés par pseudo");
  assert.equal(groupes[0].comptes[0].bilan, bilan);
  assert.equal(groupes[0].comptes[1].bilan, null, "sans bilan : null, jamais undefined");
  assert.equal(groupes[1].comptes[0].origine, "eleve");
});
