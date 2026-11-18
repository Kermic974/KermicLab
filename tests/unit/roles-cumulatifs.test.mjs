import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { _reinitialiser } from "../../worker/src/index.js";
import { attributionDuCompte, compteLocalPermet, cumulerRoles, ecrireAttribution, permissionsCumulees, rolesManuels } from "../../worker/src/attributions.js";
import { ROLES_SYSTEME, accesAutorise } from "../../worker/src/roles.js";
import { SOUSCRIPTIONS_PAR_DEFAUT } from "../../worker/src/souscriptions.js";
import { gererApiCompteLocal } from "../../worker/src/compte-local.js";
import { roleContributionCompteLocal } from "../../worker/src/contributions.js";
import { invaliderReglages, ecrireParametre } from "../../worker/src/reglages.js";
import { creerD1Complet } from "../helpers/d1-complet.mjs";

// Rôles cumulatifs et souscription du compte (ADR 0034).
const ID = "00000000-0000-4000-8000-000000000001";
let env;
beforeEach(() => {
  env = { DB: creerD1Complet(), COMPTES_LOCAUX_SECRET: "s".repeat(40) };
  _reinitialiser();
  invaliderReglages();
});
afterEach(() => env.DB.sqlite.close());

const definitions = Object.entries(ROLES_SYSTEME).map(([id, r]) => ({ id, permissions: [...r.permissions] }));

test("rôles manuels : liste JSON, à défaut le rôle historique, jamais vide", () => {
  assert.deepEqual(rolesManuels({ role_id: "parent", roles: '["contributeur","prof","contributeur"]' }), ["contributeur", "prof"]);
  assert.deepEqual(rolesManuels({ role_id: "parent", roles: "[]" }), ["parent"], "version précédente : role_id seul");
  assert.deepEqual(rolesManuels({ role_id: "parent" }), ["parent"], "colonne absente (migration non appliquée)");
  assert.deepEqual(rolesManuels(null), ["visiteur"]);
  assert.deepEqual(rolesManuels({ roles: '["<script>", 3]' }), ["visiteur"], "valeurs invalides ignorées");
});

test("cumul : rôle de la souscription ajouté, « visiteur » effacé dès qu'un autre rôle existe, permissions unies", () => {
  assert.deepEqual(cumulerRoles(["visiteur"], "parent"), ["parent"]);
  assert.deepEqual(cumulerRoles(["contributeur"], "parent"), ["contributeur", "parent"]);
  assert.deepEqual(cumulerRoles(["prof"], "prof"), ["prof"]);
  assert.deepEqual(cumulerRoles(["visiteur"], "visiteur"), ["visiteur"]);
  const p = permissionsCumulees(["contributeur", "parent"], definitions);
  assert.ok(p.includes("contributions.proposer") && p.includes("famille"));
  assert.equal(p.includes("professeur"), false);
});

test("décision d'accès : l'un des rôles cumulés suffit, la souscription ajoute son rôle et filtre ses fonctionnalités", () => {
  const actif = { CONTROLE_ACCES_ACTIF: "true" };
  const souscriptions = SOUSCRIPTIONS_PAR_DEFAUT;
  const decide = (sujet, f) => accesAutorise(actif, { fonctionnalite: f, ...sujet }, { roles: definitions, souscriptions });
  // Professeur + Parent : la famille passe par le rôle Parent, la relecture par le rôle Professeur (offre Professeur).
  assert.equal(decide({ roles: ["parent", "prof"], niveau: "professeur" }, "contributions.relire").autorise, true);
  assert.equal(decide({ roles: ["parent"], niveau: "gratuit" }, "famille").raison, "hors-souscription", "l'offre restreint toujours");
  // L'offre Parent apporte le rôle parent à un simple visiteur.
  assert.equal(decide({ roles: ["visiteur"], niveau: "parent" }, "famille").autorise, true);
  assert.equal(decide({ role: "visiteur", niveau: "parent" }, "famille").autorise, true, "un seul rôle reste accepté");
  assert.equal(decide({ roles: ["visiteur"], niveau: "solo" }, "professeur").raison, "permission-absente");
});

test("compte local : rôles cumulés lus par l'Espace famille, l'expérience Professeur et les contributions", async () => {
  assert.deepEqual((await attributionDuCompte(env, "compte-local", ID)).roles, ["visiteur"], "sans attribution");
  await ecrireAttribution(env, "compte-local", ID, { roles: ["contributeur", "prof"], niveau: "gratuit" });
  const a = await attributionDuCompte(env, "compte-local", ID);
  assert.deepEqual([a.manuels, a.roles], [["contributeur", "prof"], ["contributeur", "prof"]]);
  assert.equal(env.DB.sqlite.prepare("SELECT role_id FROM attributions_roles").get().role_id, "contributeur", "premier rôle pour la version précédente");
  assert.equal(await compteLocalPermet(env, ID, "professeur"), true);
  assert.equal(await compteLocalPermet(env, ID, "famille"), true, "permission du rôle contributeur");
  assert.equal(await roleContributionCompteLocal(env, ID), "prof", "relecteur grâce au rôle cumulé");
  // La souscription Parent ajoute le rôle parent sans retirer les rôles manuels.
  await ecrireAttribution(env, "compte-local", ID, { roles: ["prof"], niveau: "parent" });
  assert.deepEqual((await attributionDuCompte(env, "compte-local", ID)).roles, ["prof", "parent"]);
});

// ---------- Souscription vue et changée par le compte ----------

const appel = (route, { methode = "POST", corps, jeton } = {}) => gererApiCompteLocal(new Request(`https://api.test/api/compte-local/${route}`, {
  method: methode,
  headers: { "content-type": "application/json", ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) },
  body: corps === undefined ? undefined : JSON.stringify(corps)
}), env);
const inscrire = async () => (await (await appel("inscription", { corps: { identifiant: "lea.martin", motDePasse: "Correct-Cheval-9" } })).json()).jeton;

test("mon abonnement : niveau, rôles et offres, sans coût ni marge ; changement immédiat en phase de développement", async () => {
  const jeton = await inscrire();
  assert.equal((await appel("souscription", { methode: "GET" })).status, 401);
  const etat = await (await appel("souscription", { methode: "GET", jeton })).json();
  assert.equal(etat.niveau, "gratuit");
  assert.equal(etat.paiement, "dev");
  assert.deepEqual(etat.roles, [{ id: "visiteur", libelle: "Visiteur" }]);
  assert.deepEqual(etat.offres.map((o) => o.id), ["gratuit", "solo", "parent", "professeur"], "offres en projet proposées en phase de développement");
  assert.doesNotMatch(JSON.stringify(etat), /coutRevient|marge|estimation/, "jamais le coût ni la marge");
  assert.ok(etat.offres.find((o) => o.id === "parent").prix.mensuelTTC > 0);

  assert.deepEqual(await (await appel("souscription", { jeton, corps: { niveau: "inconnue" } })).json(), { erreur: "offre-indisponible" });
  const change = await appel("souscription", { jeton, corps: { niveau: "parent" } });
  assert.equal(change.status, 200);
  const apres = await change.json();
  assert.equal(apres.niveau, "parent");
  assert.deepEqual(apres.roles.map((r) => r.id), ["parent"], "le rôle de l'offre se cumule");
  assert.deepEqual(apres.historique.map(({ de, vers, paiement }) => ({ de, vers, paiement })), [{ de: "gratuit", vers: "parent", paiement: "dev" }]);
  const compteId = env.DB.sqlite.prepare("SELECT id FROM comptes_locaux").get().id;
  assert.equal(await compteLocalPermet(env, compteId, "famille"), true, "l'Espace famille s'ouvre avec l'offre Parent");

  // Retour au gratuit : paiement « gratuit » ; rôles attribués à la main conservés.
  await ecrireAttribution(env, "compte-local", compteId, { roles: ["contributeur"], niveau: "parent" });
  const retour = await (await appel("souscription", { jeton, corps: { niveau: "gratuit" } })).json();
  assert.deepEqual(retour.roles.map((r) => r.id), ["contributeur"]);
  assert.equal(retour.historique[0].paiement, "gratuit");
  const moi = await (await appel("moi", { methode: "GET", jeton })).json();
  assert.equal(moi.souscriptions.length, 2, "droit d'accès : historique des changements");

  // Suppression du compte : rôles, souscription et historique effacés.
  assert.equal((await appel("compte/supprimer", { jeton, corps: { motDePasse: "Correct-Cheval-9" } })).status, 204);
  for (const table of ["attributions_roles", "souscriptions_changements"]) {
    assert.equal(env.DB.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0, table);
  }
});

test("mon abonnement : hors phase de développement, seules les offres actives, et une offre payante attend le paiement", async () => {
  const jeton = await inscrire();
  await ecrireParametre(env, "SOUSCRIPTIONS_LIBRE_CHOIX", "false");
  invaliderReglages();
  const etat = await (await appel("souscription", { methode: "GET", jeton })).json();
  assert.equal(etat.paiement, "a-venir");
  assert.deepEqual(etat.offres.map((o) => o.id), ["gratuit"], "les offres pressenties sont « en projet »");
  assert.deepEqual(await (await appel("souscription", { jeton, corps: { niveau: "parent" } })).json(), { erreur: "offre-indisponible" });
  // Offre active payante : refusée tant que le paiement n'existe pas.
  const offres = SOUSCRIPTIONS_PAR_DEFAUT.map((s) => (s.id === "parent" ? { ...s, statut: "active" } : s));
  env.DB.sqlite.prepare("INSERT INTO reglages (cle, valeur) VALUES ('souscriptions', ?)").run(JSON.stringify(offres));
  invaliderReglages();
  const r = await appel("souscription", { jeton, corps: { niveau: "parent" } });
  assert.equal(r.status, 402);
  assert.deepEqual(await r.json(), { erreur: "paiement-requis" });
});
