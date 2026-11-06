import { test } from "node:test";
import assert from "node:assert/strict";
import * as comptes from "../../web/comptes.js";
import { validerPseudo } from "../../web/profil.js";

const enfants = [{ id: "e1", prenom_affiche: "Léa", age_tranche: "6-10" }];

test("mode : connexion désactivée → profil local uniquement, quel que soit l'état", () => {
  assert.equal(comptes.modeCompte({ connexionActive: false, compte: { id: "p" }, enfants, enfantActifId: "e1" }), "desactive");
  assert.equal(comptes.modeCompte(), "desactive");
});

test("mode : local sans parent, parent connecté, profil enfant actif", () => {
  assert.equal(comptes.modeCompte({ connexionActive: true }), "local");
  assert.equal(comptes.modeCompte({ connexionActive: true, compte: { id: "p" }, enfants }), "parent");
  assert.equal(comptes.modeCompte({ connexionActive: true, compte: { id: "p" }, enfants, enfantActifId: "e1" }), "enfant");
});

test("mode : un enfant actif qui n'appartient pas au parent est ignoré", () => {
  assert.equal(comptes.modeCompte({ connexionActive: true, compte: { id: "p" }, enfants, enfantActifId: "autre" }), "parent");
  assert.equal(comptes.enfantActif(null, "e1"), null);
});

test("profil enfant : un enfant ne peut pas être créé sans compte parent (pas de mode « local » qui crée)", () => {
  // La création n'est proposée qu'en mode parent : le mode local n'a pas de liste d'enfants.
  assert.notEqual(comptes.modeCompte({ connexionActive: true, enfants, enfantActifId: "e1" }), "enfant");
});

test("validation : prénom (règles du pseudo), tranche connue, consentement obligatoire", () => {
  const ok = comptes.validerEnfant({ prenom: "  Léa  ", tranche: "6-10", consentement: true }, 0, validerPseudo);
  assert.deepEqual(ok, { ok: true, enfant: { prenom_affiche: "Léa", age_tranche: "6-10", consentement_version: comptes.VERSION_CONSENTEMENT } });

  const ko = comptes.validerEnfant({ prenom: "Léa 0612345678", tranche: "8-12", consentement: false }, 0, validerPseudo);
  assert.equal(ko.ok, false);
  assert.equal(ko.erreurs.prenom, "chiffres");
  assert.equal(ko.erreurs.tranche, true);
  assert.equal(ko.erreurs.consentement, true);

  assert.equal(comptes.validerEnfant({ prenom: "Léa", tranche: "6-10", consentement: "true" }, 0, validerPseudo).ok, false,
    "le consentement doit être un vrai booléen coché");
});

test("validation : plafond de profils enfants", () => {
  const r = comptes.validerEnfant({ prenom: "Léa", tranche: "6-10", consentement: true }, comptes.MAX_ENFANTS, validerPseudo);
  assert.equal(r.ok, false);
  assert.equal(r.erreurs.quota, true);
});

test("normalisation de la liste des enfants renvoyée par l'API", () => {
  assert.deepEqual(comptes.normaliserEnfants([
    { id: "e1", prenom_affiche: " Léa ", age_tranche: "6-10", parent_id: "secret" },
    { id: "e2", prenom_affiche: "Tom", age_tranche: "11-13" },
    { id: 3, prenom_affiche: "X" }, { id: "e4", prenom_affiche: "  " }, null
  ]), [
    { id: "e1", prenom_affiche: "Léa", age_tranche: "6-10" },
    { id: "e2", prenom_affiche: "Tom", age_tranche: null }
  ]);
  assert.deepEqual(comptes.normaliserEnfants({}), []);
});

test("clés i18n du type de profil existent en français et en anglais", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const langue of ["fr", "en"]) {
    const textes = JSON.parse(await readFile(new URL(`../../web/i18n/${langue}.json`, import.meta.url), "utf8"));
    for (const mode of ["desactive", "local", "parent", "enfant"]) {
      assert.ok(textes[comptes.cleTypeProfil(mode)], `${langue} ${mode}`);
      assert.ok(textes[comptes.cleAideProfil(mode)], `${langue} ${mode}`);
    }
    for (const tranche of comptes.TRANCHES_AGE) assert.ok(textes[`tranche_${tranche}`], `${langue} ${tranche}`);
  }
});
