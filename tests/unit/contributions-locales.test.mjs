import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker, { _reinitialiser } from "../../worker/src/index.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { roleDeContribution } from "../../worker/src/contributions.js";
import { VERSION_CHARTE } from "../../web/contributions.js";
import { creerD1Complet } from "../helpers/d1-complet.mjs";

// Contributions des comptes locaux (ADR 0023 §6 ter) : session porteuse, rôle attribué dans le back-office,
// table `contributions_locales`. Le parcours OAuth (cookie, table `contributions`) reste inchangé.
const ORIGINE = "https://www.kermiclab.online";
const MDP = "Correct-Cheval-9";
const NOTION = CATALOGUE.index.maquettes.find((m) => m.id === "pythagore") ? "pythagore" : CATALOGUE.index.maquettes[0].id;

let env;
beforeEach(() => {
  env = { DB: creerD1Complet(), COMPTES_LOCAUX_SECRET: "s".repeat(40), ORIGINES_AUTORISEES: ORIGINE };
  _reinitialiser();
});
afterEach(() => env.DB.sqlite.close());

const sql = () => env.DB.sqlite;
async function appeler(chemin, { methode = "POST", corps, jeton, ip = "1.2.3.4" } = {}) {
  const r = await worker.fetch(new Request(`https://api.test${chemin}`, {
    method: methode,
    headers: { origin: ORIGINE, "cf-connecting-ip": ip, "content-type": "application/json", ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) },
    body: corps === undefined ? undefined : JSON.stringify(corps)
  }), env, { waitUntil: () => {} });
  let donnees = null;
  try { donnees = await r.json(); } catch { /* 204 */ }
  return { statut: r.status, donnees, entetes: r.headers };
}
async function inscrire(identifiant) {
  const r = await appeler("/api/compte-local/inscription", { corps: { identifiant, motDePasse: MDP }, ip: `ip-${identifiant}` });
  assert.equal(r.statut, 201, JSON.stringify(r.donnees));
  return r.donnees.jeton;
}
const compteId = async (jeton) => {
  const { sha256Hex } = await import("../../web/compte-local.js");
  return sql().prepare("SELECT compte_id FROM sessions_locales WHERE jeton_hash = ?").get(await sha256Hex(jeton)).compte_id;
};
const donnerRole = async (jeton, role) => sql().prepare("INSERT INTO attributions_roles (type_compte, compte_id, role_id) VALUES ('compte-local', ?, ?)").run(await compteId(jeton), role);
const proposition = (extra = {}) => ({
  notion_id: NOTION, chemin: "intro", nature: "modification", type: "clarification",
  texte_actuel: "Texte actuel.", texte_propose: "Texte actuel, plus clair.", motif: "Guider les débutants.", charte_version: VERSION_CHARTE, ...extra
});

test("rôle de contribution déduit des permissions du rôle", () => {
  assert.equal(roleDeContribution("admin", []), "admin");
  assert.equal(roleDeContribution("prof", ["contributions.proposer", "contributions.relire"]), "prof");
  assert.equal(roleDeContribution("beta-testeur", ["contributions.proposer"]), "contributeur");
  assert.equal(roleDeContribution("parent", ["famille"]), null);
});

test("compte local : sans session 401, sans rôle 403, contributeur propose, prof relit à quatre yeux", async () => {
  assert.equal((await appeler("/api/contributions?vue=miennes", { methode: "GET", jeton: "x".repeat(43) })).statut, 401);
  const visiteur = await inscrire("simple.visiteur");
  assert.equal((await appeler("/api/contributions?vue=miennes", { methode: "GET", jeton: visiteur })).donnees.erreur, "role-requis");

  const contributeur = await inscrire("c.contributeur");
  await donnerRole(contributeur, "contributeur");
  const cree = await appeler("/api/contributions", { jeton: contributeur, corps: proposition() });
  assert.equal(cree.statut, 201, JSON.stringify(cree.donnees));
  assert.equal(cree.entetes.get("access-control-allow-origin"), ORIGINE);
  const miennes = await appeler("/api/contributions?vue=miennes", { methode: "GET", jeton: contributeur });
  assert.equal(miennes.donnees.length, 1);
  assert.equal(miennes.donnees[0].auteur_id, await compteId(contributeur));
  assert.equal(sql().prepare("SELECT count(*) AS n FROM contributions_locales").get().n, 1);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM contributions").get().n, 0, "la table OAuth n'est pas touchée");
  assert.equal((await appeler("/api/contributions?vue=relecture", { methode: "GET", jeton: contributeur })).donnees.erreur, "role-requis");

  const prof = await inscrire("m.martin");
  await donnerRole(prof, "prof");
  const aRelire = await appeler("/api/contributions?vue=relecture", { methode: "GET", jeton: prof });
  assert.equal(aRelire.donnees.length, 1);
  const propre = await appeler("/api/contributions", { jeton: prof, corps: proposition({ texte_propose: "Autre texte proposé." }) });
  assert.equal((await appeler(`/api/contributions/${propre.donnees.id}`, { methode: "PATCH", jeton: prof, corps: { action: "reviser", commentaire: "Moi-même." } })).donnees.erreur, "relecture-quatre-yeux");
  const revision = await appeler(`/api/contributions/${cree.donnees.id}`, { methode: "PATCH", jeton: prof, corps: { action: "reviser", commentaire: "Ajoute un exemple." } });
  assert.equal(revision.donnees.statut, "a_reviser");
  assert.equal(revision.donnees.commentaire, "Ajoute un exemple.");
});

test("compte local : la suppression du compte efface ses contributions et anonymise ses décisions", async () => {
  const contributeur = await inscrire("c.contributeur");
  await donnerRole(contributeur, "contributeur");
  const prof = await inscrire("m.martin");
  await donnerRole(prof, "prof");
  const { donnees } = await appeler("/api/contributions", { jeton: contributeur, corps: proposition() });
  await appeler(`/api/contributions/${donnees.id}`, { methode: "PATCH", jeton: prof, corps: { action: "reviser", commentaire: "Ajoute un exemple." } });
  await appeler("/api/contributions", { jeton: prof, corps: proposition({ texte_propose: "Proposition du prof." }) });

  assert.equal((await appeler("/api/compte-local/compte/supprimer", { jeton: prof, corps: { motDePasse: MDP } })).statut, 204);
  const restante = sql().prepare("SELECT relecteur_id FROM contributions_locales").all().map((l) => ({ ...l }));
  assert.deepEqual(restante, [{ relecteur_id: null }], "proposition du prof effacée, sa décision reste sans relecteur");
  assert.equal((await appeler("/api/compte-local/compte/supprimer", { jeton: contributeur, corps: { motDePasse: MDP } })).statut, 204);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM contributions_locales").get().n, 0);
});
