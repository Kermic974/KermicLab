import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker, { _reinitialiser } from "../../worker/src/index.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { gererApiRelectures } from "../../worker/src/relectures.js";
import { ecrireAttribution } from "../../worker/src/attributions.js";
import { GRILLES, empreinteContenu } from "../../web/relectures.js";
import { creerD1Complet } from "../helpers/d1-complet.mjs";

// Relecture humaine (ADR 0039) : session de compte, rôle à la main, empreinte serveur, journal append-only.
const ORIGINE = "https://www.kermiclab.online";
const MDP = "Correct-Cheval-9";
const CLE = "cle-de-test-du-back-office-de-plus-de-32-caracteres";
const NOTION = CATALOGUE.index.maquettes.find((m) => m.id === "pythagore")?.id ?? CATALOGUE.index.maquettes.find((m) => !m.sujet.startsWith("jeux/")).id;
const JEU = CATALOGUE.index.maquettes.find((m) => m.sujet.startsWith("jeux/"))?.id;

let env;
beforeEach(() => {
  env = { DB: creerD1Complet(), COMPTES_LOCAUX_SECRET: "s".repeat(40), ORIGINES_AUTORISEES: ORIGINE, BACKOFFICE_JETON: CLE };
  _reinitialiser();
});
afterEach(() => env.DB.sqlite.close());

const sql = () => env.DB.sqlite;
async function appeler(chemin, { methode = "POST", corps, jeton, ip = "1.2.3.4", authorization } = {}) {
  const r = await worker.fetch(new Request(`https://api.test${chemin}`, {
    method: methode,
    headers: {
      origin: ORIGINE, "cf-connecting-ip": ip, "content-type": "application/json",
      ...(jeton ? { authorization: `Bearer ${jeton}` } : {}),
      ...(authorization ? { authorization } : {})
    },
    body: corps === undefined ? undefined : JSON.stringify(corps)
  }), env, { waitUntil: () => {} });
  let donnees = null;
  try { donnees = await r.json(); } catch { /* 204 */ }
  return { statut: r.status, donnees };
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
const donnerRole = async (jeton, role) => sql().prepare(
  "INSERT INTO attributions_roles (type_compte, compte_id, role_id) VALUES ('compte-local', ?, ?)"
).run(await compteId(jeton), role);

const coches = (grille, sauf = []) => Object.fromEntries(GRILLES[grille].map((id) => [id, !sauf.includes(id)]));
const confirmer = (jeton, extra = {}) => appeler("/api/relectures", {
  jeton, corps: {
    notion_id: NOTION, criteres: coches("v1"), decision: "conforme",
    empreinte: "0".repeat(64), notion_version: "9.9.9", role: "admin", created_at: "1999-01-01", ...extra
  }
});

test("statut public : non relue, puis relue, sans identifiant ni commentaire", async () => {
  const avant = await appeler(`/api/relectures/statut?notion=${NOTION}`, { methode: "GET" });
  assert.equal(avant.statut, 200);
  assert.equal(avant.donnees.statut, "non-relue");
  assert.equal(avant.donnees.code, null);
  assert.equal((await appeler("/api/relectures/statut?notion=inconnue", { methode: "GET" })).statut, 404);

  const visiteur = await inscrire("simple.visiteur");
  assert.equal((await confirmer(visiteur)).donnees.erreur, "role-requis");
  const prof = await inscrire("m.martin");
  await donnerRole(prof, "prof");
  const cree = await confirmer(prof, { commentaire: "Définitions justes." });
  assert.equal(cree.statut, 201, JSON.stringify(cree.donnees));
  const ligne = sql().prepare("SELECT * FROM relectures_humaines").get();
  assert.equal(ligne.empreinte, await empreinteContenu(CATALOGUE.pages[NOTION]));
  assert.equal(ligne.notion_version, CATALOGUE.index.maquettes.find((m) => m.id === NOTION).version);
  assert.notEqual(ligne.notion_version, "9.9.9");
  assert.equal(ligne.role, "prof");
  assert.notEqual(ligne.created_at.slice(0, 4), "1999");
  assert.equal(ligne.commentaire, "Définitions justes.");
  const apres = await appeler(`/api/relectures/statut?notion=${NOTION}`, { methode: "GET" });
  assert.equal(apres.donnees.statut, "relue");
  assert.equal(apres.donnees.code, ligne.code_relecteur);
  assert.equal(JSON.stringify(apres.donnees).includes(ligne.relecteur_id), false);
  assert.equal(JSON.stringify(apres.donnees).includes("Définitions"), false);

  const miennes = await appeler("/api/relectures?vue=miennes", { methode: "GET", jeton: prof });
  assert.equal(miennes.donnees.length, 1);
  assert.equal(miennes.donnees[0].commentaire, "Définitions justes.");
  assert.equal(miennes.donnees[0].statut, "relue");
  assert.equal(JSON.stringify(miennes.donnees).includes(ligne.relecteur_id), false);
});

test("écriture : sans session 401, clé du back-office 401, souscription seule 403, donnée personnelle refusée", async () => {
  assert.equal((await confirmer(undefined)).donnees.erreur, "non-connecte");
  const avecCle = await appeler("/api/relectures", { authorization: `Bearer ${CLE}`, corps: { notion_id: NOTION, decision: "conforme", commentaire: "fuite@example.org" } });
  assert.equal(avecCle.donnees.erreur, "non-connecte");
  assert.equal(sql().prepare("SELECT count(*) AS n FROM relectures_humaines").get().n, 0);

  const jeton = await inscrire("offre.prof");
  await ecrireAttribution(env, "compte-local", await compteId(jeton), { roles: ["visiteur"], niveau: "professeur" });
  assert.equal((await confirmer(jeton)).donnees.erreur, "role-requis", "la souscription Professeur n'est pas un rôle attribué à la main");

  const prof = await inscrire("m.martin");
  await donnerRole(prof, "prof");
  const perso = await confirmer(prof, { commentaire: "Écrire à lea@example.org" });
  assert.equal(perso.donnees.erreur, "donnees-personnelles");
  assert.equal(sql().prepare("SELECT count(*) AS n FROM relectures_humaines").get().n, 0);
  assert.equal((await confirmer(prof, { criteres: coches("v1", ["exactitude"]) })).donnees.details.decision, "criteres-manquants");
  assert.equal((await confirmer(prof, { decision: "a_corriger" })).donnees.details.decision, "deja-conforme");
});

test("journal append-only : une correction est une nouvelle ligne ; l'effacement retire le lien", async () => {
  const prof = await inscrire("m.martin");
  await donnerRole(prof, "prof");
  assert.equal((await confirmer(prof)).statut, 201);
  const correction = await confirmer(prof, { decision: "a_corriger", criteres: coches("v1", ["exercices"]), commentaire: "Un indice donne la réponse." });
  assert.equal(correction.statut, 201);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM relectures_humaines").get().n, 2);
  assert.equal((await appeler(`/api/relectures/statut?notion=${NOTION}`, { methode: "GET" })).donnees.statut, "a-corriger");
  assert.throws(() => sql().prepare("DELETE FROM relectures_humaines").run(), /journal-append-only/);
  assert.throws(() => sql().prepare("UPDATE relectures_humaines SET decision = 'conforme'").run(), /journal-append-only/);
  assert.throws(() => sql().prepare("UPDATE relectures_humaines SET commentaire = 'modifié'").run(), /journal-append-only/);

  const id = await compteId(prof);
  assert.equal((await appeler("/api/compte-local/compte/supprimer", { jeton: prof, corps: { motDePasse: MDP } })).statut, 204);
  const lignes = sql().prepare("SELECT relecteur_id, decision, code_relecteur FROM relectures_humaines ORDER BY rowid").all();
  assert.equal(lignes.length, 2);
  assert.deepEqual(lignes.map((l) => l.relecteur_id), [null, null]);
  assert.deepEqual(lignes.map((l) => l.decision), ["conforme", "a_corriger"]);
  assert.ok(lignes.every((l) => l.code_relecteur && l.code_relecteur !== id));
  assert.equal((await appeler("/api/relectures?vue=miennes", { methode: "GET", jeton: prof })).donnees.erreur, "non-connecte");
});

test("compte OAuth : prof et admin confirment, un parent non ; un jeu prend la grille jeux-v1", async () => {
  sql().prepare("INSERT INTO comptes (id, email_hash, role) VALUES ('parent-1', 'h1', 'parent'), ('prof-1', 'h2', 'prof'), ('admin-1', 'h3', 'admin')").run();
  const appel = (compteId, corps) => gererApiRelectures(
    new Request("https://api.test/api/relectures", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) }),
    env, { compteId, origine: "oauth" }, { catalogue: CATALOGUE }
  );
  assert.equal((await (await appel("parent-1", { notion_id: NOTION, criteres: coches("v1"), decision: "conforme" })).json()).erreur, "role-requis");
  const prof = await appel("prof-1", { notion_id: NOTION, criteres: coches("v1"), decision: "conforme" });
  assert.equal(prof.status, 201);
  assert.equal(sql().prepare("SELECT origine, role FROM relectures_humaines").get().origine, "oauth");
  const admin = await appel("admin-1", { notion_id: NOTION, criteres: coches("v1", ["neutralite"]), decision: "a_corriger", commentaire: "Une source manque." });
  assert.equal(admin.status, 201);
  assert.equal(sql().prepare("SELECT role FROM relectures_humaines WHERE relecteur_id = 'admin-1'").get().role, "admin");

  sql().prepare("INSERT INTO roles (id, libelle, permissions) VALUES ('prof', 'Professeur', ?)").run(JSON.stringify(["chat"]));
  const retire = await appel("prof-1", { notion_id: NOTION, criteres: coches("v1"), decision: "conforme" });
  assert.equal((await retire.json()).erreur, "role-requis", "permission retirée du rôle prof");
  sql().prepare("DELETE FROM roles WHERE id = 'prof'").run();

  sql().prepare("INSERT INTO roles (id, libelle, permissions) VALUES ('relecteur-svt', 'Relecteur SVT', ?)").run(JSON.stringify(["relecture.humaine"]));
  sql().prepare("INSERT INTO comptes (id, email_hash, role) VALUES ('parent-2', 'h4', 'parent')").run();
  sql().prepare("INSERT INTO attributions_roles (type_compte, compte_id, role_id, roles) VALUES ('compte', 'parent-2', 'relecteur-svt', ?)").run(JSON.stringify(["relecteur-svt"]));
  const perso = await appel("parent-2", { notion_id: NOTION, criteres: coches("v1", ["donnees"]), decision: "a_corriger", commentaire: "Une question personnelle reste." });
  assert.equal(perso.status, 201, JSON.stringify(await perso.clone().json()));
  assert.equal(sql().prepare("SELECT role FROM relectures_humaines WHERE relecteur_id = 'parent-2'").get().role, "relecteur-svt");

  if (!JEU) return;
  const jeu = await appel("prof-1", { notion_id: JEU, criteres: coches("v1"), decision: "conforme" });
  assert.equal((await jeu.json()).details.criteres, "incomplets");
  const bon = await appel("prof-1", { notion_id: JEU, criteres: coches("jeux-v1"), decision: "conforme" });
  assert.equal(bon.status, 201, JSON.stringify(await bon.clone().json()));
  assert.equal(sql().prepare("SELECT grille FROM relectures_humaines WHERE notion_id = ?").get(JEU).grille, "jeux-v1");
});
