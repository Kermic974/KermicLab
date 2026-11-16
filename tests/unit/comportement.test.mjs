import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { lireConfiguration } from "../../worker/src/configuration.js";
import {
  PROFIL_ANONYME, actualiserProfil, compteursProfil, enregistrerActivite, etatProfil, evaluerProfil, profilDeLaRequete,
  profilDuCompte, purgerSignaux
} from "../../worker/src/comportement.js";
import { creerD1Complet } from "../helpers/d1-complet.mjs";

const SECRET = "secret-factice-de-test-de-plus-de-32-caracteres";
const config = lireConfiguration({});
let env;
beforeEach(() => { env = { DB: creerD1Complet(), LLM_SESSION_SECRET: SECRET }; });

test("catégorisation : comportements retenus, score pondéré et état, sans jamais suspendre automatiquement", () => {
  assert.deepEqual(evaluerProfil({}, config), { etat: "normal", score: 0, comportements: [] });
  assert.deepEqual(evaluerProfil({ signaux: { "donnees-personnelles": 1 } }, config), { etat: "normal", score: 1, comportements: [] }, "une seule maladresse ne marque pas un profil");
  assert.deepEqual(evaluerProfil({ signaux: { "donnees-personnelles": 3 } }, config), { etat: "surveille", score: 3, comportements: ["messages-personnels"] });
  assert.deepEqual(evaluerProfil({ signaux: { "injection-directe": 1 } }, config), { etat: "surveille", score: 3, comportements: ["injection-directe"] });
  const cumul = evaluerProfil({ signaux: { sexuel: 2, "injection-indirecte": 1, "contenu-dangereux": 1 } }, config);
  assert.deepEqual(cumul, { etat: "restreint", score: 11, comportements: ["contenu-sexuel", "contenu-dangereux", "injection-indirecte"] });
  assert.equal(evaluerProfil({ signaux: { sexuel: 500, "injection-directe": 500 } }, config).etat, "restreint", "la suspension reste une décision humaine");
});

test("détresse : signalée, jamais sanctionnée", () => {
  assert.deepEqual(evaluerProfil({ signaux: { detresse: 5 } }, config), { etat: "normal", score: 0, comportements: ["detresse"] });
});

test("consommation : élevée puis surconsommation, selon la plus forte journée", () => {
  assert.deepEqual(evaluerProfil({ requetesJourMax: config.SEUIL_CONSO_ELEVEE - 1 }, config).comportements, []);
  assert.deepEqual(evaluerProfil({ requetesJourMax: config.SEUIL_CONSO_ELEVEE }, config), { etat: "surveille", score: 0, comportements: ["consommation-elevee"] });
  assert.deepEqual(evaluerProfil({ requetesJourMax: config.SEUIL_SURCONSOMMATION }, config), { etat: "restreint", score: 0, comportements: ["surconsommation"] });
});

test("profil de la requête : anonyme sans cookie, pseudonyme stable avec une session, jamais d'IP", async () => {
  const requete = (entetes = {}) => new Request("https://api.test/api/chat", { method: "POST", headers: { "cf-connecting-ip": "203.0.113.7", ...entetes } });
  assert.equal(await profilDeLaRequete(requete(), env), PROFIL_ANONYME);
  assert.equal(await profilDeLaRequete(requete({ cookie: "__Host-kermiclab_llm=faux.jeton.invalide" }), env), PROFIL_ANONYME, "cookie falsifié");
  const maintenant = Math.floor(Date.now() / 1000);
  const jeton = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("session-123").setIssuer("kermiclab-llm").setAudience("kermiclab-llm")
    .setIssuedAt(maintenant).setExpirationTime(maintenant + 3600).sign(new TextEncoder().encode(SECRET));
  const a = await profilDeLaRequete(requete({ cookie: `__Host-kermiclab_llm=${jeton}` }), env);
  const b = await profilDeLaRequete(requete({ cookie: `autre=1; __Host-kermiclab_llm=${jeton}`, "cf-connecting-ip": "198.51.100.9" }), env);
  assert.match(a, /^[0-9a-f]{20}$/);
  assert.equal(a, b, "même session, même profil, quelle que soit l'IP");
  assert.doesNotMatch(a, /session-123/);
  assert.equal(await profilDeLaRequete(requete({ cookie: `__Host-kermiclab_llm=${jeton}` }), { DB: env.DB }), PROFIL_ANONYME, "sans secret, aucun profil");
});

test("profil d'un compte connecté : celui que le back-office recalcule pour ce compte", async () => {
  env.DB.sqlite.exec(`INSERT INTO comptes (id, email_hash) VALUES ('c1', 'h1');
    INSERT INTO sessions (id, compte_id, expires_at) VALUES ('s1', 'c1', datetime('now', '+1 day'))`);
  const profil = await profilDeLaRequete(new Request("https://api.test/api/chat", { headers: { cookie: "session=s1" } }), env);
  assert.equal(profil, await profilDuCompte(env, "compte", "c1"));
  assert.notEqual(profil, await profilDuCompte(env, "compte-local", "c1"));
});

test("compteurs : agrégés par jour, catégorie et module ; aucune ligne par requête", async () => {
  const t = Date.UTC(2026, 10, 16, 10);
  for (let i = 0; i < 5; i += 1) await enregistrerActivite(env, { profil: "p1", module: "chat", categories: i < 2 ? ["injection-directe"] : [] }, t);
  await enregistrerActivite(env, { profil: "p1", module: "idee", categories: ["donnees-personnelles"] }, t - 86400000);
  const lignes = env.DB.sqlite.prepare("SELECT jour, categorie, module, n FROM signaux_securite ORDER BY jour, categorie, module").all().map((l) => ({ ...l }));
  assert.deepEqual(lignes, [
    { jour: "2026-11-15", categorie: "donnees-personnelles", module: "idee", n: 1 },
    { jour: "2026-11-15", categorie: "requete", module: "idee", n: 1 },
    { jour: "2026-11-16", categorie: "injection-directe", module: "chat", n: 2 },
    { jour: "2026-11-16", categorie: "requete", module: "chat", n: 5 }
  ]);
  assert.deepEqual(await compteursProfil(env, "p1", t), { signaux: { "donnees-personnelles": 1, "injection-directe": 2 }, requetesJourMax: 5 });
  assert.deepEqual(await compteursProfil(env, "p1", t + 8 * 86400000), { signaux: {}, requetesJourMax: 0 }, "hors fenêtre de 7 jours");
});

test("état d'un profil : monte seul, ne remplace jamais une décision d'administrateur, expire", async () => {
  const t = Date.UTC(2026, 10, 16, 10);
  await enregistrerActivite(env, { profil: "p1", module: "chat", categories: ["injection-directe"] }, t);
  assert.equal((await actualiserProfil(env, "p1", t)).etat, "surveille");
  assert.equal(await etatProfil(env, "p1", t), "surveille");
  for (let i = 0; i < 3; i += 1) await enregistrerActivite(env, { profil: "p1", module: "chat", categories: ["sexuel"] }, t);
  await actualiserProfil(env, "p1", t);
  assert.equal(await etatProfil(env, "p1", t), "restreint");
  const ligne = env.DB.sqlite.prepare("SELECT motifs, decide_par, expire_le FROM profils_securite WHERE profil = 'p1'").get();
  assert.deepEqual(JSON.parse(ligne.motifs), ["contenu-sexuel", "injection-directe"]);
  assert.equal(ligne.decide_par, "auto");
  assert.equal(ligne.expire_le, "2026-11-23");
  assert.equal(await etatProfil(env, "p1", t + 9 * 86400000), "normal", "état expiré");

  env.DB.sqlite.exec("UPDATE profils_securite SET etat = 'normal', decide_par = 'admin', expire_le = '2026-12-31' WHERE profil = 'p1'");
  await actualiserProfil(env, "p1", t);
  assert.equal(await etatProfil(env, "p1", t), "normal", "la levée par un administrateur tient jusqu'à son expiration");

  await enregistrerActivite(env, { profil: PROFIL_ANONYME, module: "chat", categories: ["sexuel", "sexuel"] }, t);
  assert.equal(await actualiserProfil(env, PROFIL_ANONYME, t), null, "le trafic anonyme n'a pas d'état");
  assert.equal(await etatProfil(env, PROFIL_ANONYME, t), "normal");
});

test("purge : signaux au-delà de la conservation et états expirés", async () => {
  const t = Date.UTC(2026, 10, 16, 10);
  await enregistrerActivite(env, { profil: "p1", module: "chat" }, t - 40 * 86400000);
  await enregistrerActivite(env, { profil: "p1", module: "chat" }, t);
  env.DB.sqlite.exec("INSERT INTO profils_securite (profil, etat, expire_le) VALUES ('vieux', 'surveille', '2026-11-01'), ('actif', 'surveille', '2026-11-30')");
  assert.deepEqual(await purgerSignaux(env, 30, t), { signaux: 1, profils: 1 });
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM signaux_securite").get().n, 1);
});

test("sans base ou sans table : aucune erreur, aucun état", async () => {
  await enregistrerActivite({}, { profil: "p1", module: "chat" });
  await enregistrerActivite({ DB: { prepare: () => { throw new Error("table absente"); } } }, { profil: "p1", module: "chat" });
  assert.equal(await etatProfil({}, "p1"), "normal");
  assert.equal(await actualiserProfil({ DB: { prepare: () => { throw new Error("table absente"); } } }, "p1"), null);
});
