import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker, { _reinitialiser } from "../../worker/src/index.js";
import { gererApiCompteLocal, purgerSessionsLocales, ECHECS_AVANT_BLOCAGE } from "../../worker/src/compte-local.js";
import { chiffrer, deriverSecrets, sha256Hex } from "../../web/compte-local.js";
import { creerD1Comptes } from "../helpers/d1-comptes.mjs";

// Compte local et synchronisation pseudonymisée côté Worker (ADR 0024) : l'interface n'est jamais la seule protection.
const ORIGINE = "https://www.kermiclab.online";
const SECRET = "s".repeat(40);
let env;
beforeEach(() => { env = { DB: creerD1Comptes("schema-compte-local.sql"), COMPTES_LOCAUX_SECRET: SECRET, ORIGINES_AUTORISEES: ORIGINE }; });
afterEach(() => env.DB.sqlite.close());

const MDP = "Correct-Cheval-9";
const appel = (route, { methode = "POST", corps, jeton, options } = {}) => gererApiCompteLocal(new Request(`https://api.test/api/compte-local/${route}`, {
  method: methode,
  headers: { "content-type": "application/json", ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) },
  body: corps === undefined ? undefined : JSON.stringify(corps)
}), env, options);
const inscrire = async (identifiant = "lea.martin", motDePasse = MDP) => appel("inscription", { corps: { identifiant, motDePasse } });
const sqlite = () => env.DB.sqlite;
const secretsRapides = (phrase = "le chat dort sur le toit", identifiant = "lea.martin") => deriverSecrets(phrase, identifiant, { iterations: 100000 });

test("état : indisponible sans secret ou sans base, aucune autre route ne répond alors", async () => {
  assert.deepEqual(await (await appel("etat", { methode: "GET" })).json(), { disponible: true });
  env.COMPTES_LOCAUX_SECRET = "court";
  assert.deepEqual(await (await appel("etat", { methode: "GET" })).json(), { disponible: false });
  assert.equal((await inscrire()).status, 503);
});

test("inscription : règles partagées, identifiant et mot de passe jamais stockés en clair", async () => {
  assert.deepEqual(await (await inscrire("lea@exemple.fr")).json(), { erreur: "identifiant-caracteres" });
  assert.deepEqual(await (await inscrire("lea.martin", "trop-simple")).json(), { erreur: "mot-de-passe-court" });
  assert.deepEqual(await (await inscrire("lea.martin", "toutenminuscule1")).json(), { erreur: "mot-de-passe-complexite" });

  const r = await inscrire(" Lea.Martin ");
  assert.equal(r.status, 201);
  const { jeton, expire } = await r.json();
  assert.match(jeton, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(expire > Date.now() / 1000);
  const ligne = sqlite().prepare("SELECT * FROM comptes_locaux").get();
  const tout = JSON.stringify(ligne);
  assert.equal(tout.includes("lea"), false, "identifiant absent en clair");
  assert.equal(tout.includes("Cheval"), false, "mot de passe absent en clair");
  assert.match(ligne.cree_le, /^\d{4}-\d{2}-\d{2}$/, "date au jour près");
  assert.equal(sqlite().prepare("SELECT jeton_hash FROM sessions_locales").get().jeton_hash, await sha256Hex(jeton), "seule l'empreinte du jeton est gardée");

  const doublon = await inscrire("lea.martin");
  assert.equal(doublon.status, 409);
  assert.deepEqual(await doublon.json(), { erreur: "identifiant-pris" });
});

test("connexion : identifiants vérifiés, réponse identique pour un compte inconnu, blocage après trop d'échecs", async () => {
  await inscrire();
  assert.equal((await appel("connexion", { corps: { identifiant: "LEA.MARTIN", motDePasse: MDP } })).status, 200);
  const inconnu = await appel("connexion", { corps: { identifiant: "personne", motDePasse: MDP } });
  const mauvais = await appel("connexion", { corps: { identifiant: "lea.martin", motDePasse: "Correct-Cheval-8" } });
  assert.equal(inconnu.status, 401);
  assert.deepEqual(await inconnu.json(), await mauvais.json(), "pas d'énumération des comptes");

  for (let i = 1; i < ECHECS_AVANT_BLOCAGE; i++) await appel("connexion", { corps: { identifiant: "lea.martin", motDePasse: "faux" } });
  const bloque = await appel("connexion", { corps: { identifiant: "lea.martin", motDePasse: MDP } });
  assert.equal(bloque.status, 429, "bon mot de passe refusé pendant le blocage");
});

test("limitation de débit : inscriptions et connexions refusées au-delà du quota de l'IP", async () => {
  let n = 0;
  const options = { autoriser: () => ++n <= 1, ip: "1.2.3.4" };
  assert.equal((await appel("connexion", { corps: { identifiant: "lea.martin", motDePasse: MDP }, options })).status, 401);
  assert.equal((await appel("connexion", { corps: { identifiant: "lea.martin", motDePasse: MDP }, options })).status, 429);
});

test("données : session obligatoire, preuve de possession, pseudonyme sans lien avec le compte", async () => {
  const { jeton } = await (await inscrire()).json();
  const s = await secretsRapides();
  const boite = await chiffrer(s.cle, s.pseudonyme, { v: 1, donnees: { "kermiclab:pseudo": "Léa" } });
  const ecrire = (versionAttendue, extra = {}, j = jeton) => appel("donnees", { methode: "PUT", jeton: j, corps: { pseudonyme: s.pseudonyme, jeton: s.jeton, versionAttendue, ...boite, ...extra } });

  assert.equal((await ecrire(0, {}, null)).status, 401, "sans session");
  assert.equal((await ecrire(0, { pseudonyme: "abc" })).status, 400);
  assert.deepEqual(await (await ecrire(0)).json(), { version: 1 });

  const ligne = sqlite().prepare("SELECT * FROM donnees_pseudonymes").get();
  assert.deepEqual(Object.keys(ligne).sort(), ["chiffre", "iv", "jeton_hash", "maj_le", "pseudonyme", "version"], "aucune colonne de compte");
  assert.equal(ligne.jeton_hash, await sha256Hex(s.jeton));
  assert.equal(ligne.chiffre.includes("Léa"), false);

  const lu = await (await appel("donnees/lire", { jeton, corps: { pseudonyme: s.pseudonyme, jeton: s.jeton } })).json();
  assert.equal(lu.version, 1);
  assert.equal(lu.chiffre, boite.chiffre);

  const intrus = await secretsRapides("une autre phrase secrète");
  const vol = await appel("donnees/lire", { jeton, corps: { pseudonyme: s.pseudonyme, jeton: intrus.jeton } });
  assert.equal(vol.status, 403, "connaître le pseudonyme ne suffit pas");
  assert.deepEqual(await (await appel("donnees/lire", { jeton, corps: { pseudonyme: intrus.pseudonyme, jeton: intrus.jeton } })).json(), { version: 0 }, "rien sous ce pseudonyme");
});

test("données : écriture conditionnelle à la version, taille bornée", async () => {
  const { jeton } = await (await inscrire()).json();
  const s = await secretsRapides();
  const boite = await chiffrer(s.cle, s.pseudonyme, { v: 1, donnees: {} });
  const ecrire = (versionAttendue, extra = {}) => appel("donnees", { methode: "PUT", jeton, corps: { pseudonyme: s.pseudonyme, jeton: s.jeton, versionAttendue, ...boite, ...extra } });
  await ecrire(0);
  assert.deepEqual(await (await ecrire(1)).json(), { version: 2 });
  const conflit = await ecrire(1);
  assert.equal(conflit.status, 409);
  assert.deepEqual(await conflit.json(), { erreur: "version-conflit", version: 2 }, "un autre appareil a écrit entre-temps");
  assert.equal((await ecrire(2, { chiffre: "A".repeat(350004) })).status, 413);
  assert.equal((await ecrire(2, { iv: "pas un iv" })).status, 400);
});

test("effacement : données par preuve de possession, compte par mot de passe ; données orphelines conservées sinon", async () => {
  const { jeton } = await (await inscrire()).json();
  const s = await secretsRapides();
  const boite = await chiffrer(s.cle, s.pseudonyme, { v: 1, donnees: {} });
  await appel("donnees", { methode: "PUT", jeton, corps: { pseudonyme: s.pseudonyme, jeton: s.jeton, versionAttendue: 0, ...boite } });

  assert.equal((await appel("compte/supprimer", { jeton, corps: { motDePasse: "faux" } })).status, 401);
  assert.equal((await appel("compte/supprimer", { jeton, corps: { motDePasse: MDP } })).status, 204);
  assert.equal(sqlite().prepare("SELECT count(*) AS n FROM comptes_locaux").get().n, 0);
  assert.equal(sqlite().prepare("SELECT count(*) AS n FROM sessions_locales").get().n, 0);
  assert.equal(sqlite().prepare("SELECT count(*) AS n FROM donnees_pseudonymes").get().n, 1, "les données ne sont pas reliées au compte");

  const { jeton: j2 } = await (await inscrire()).json();
  assert.equal((await appel("donnees/supprimer", { jeton: j2, corps: { pseudonyme: s.pseudonyme, jeton: s.jeton } })).status, 204);
  assert.equal(sqlite().prepare("SELECT count(*) AS n FROM donnees_pseudonymes").get().n, 0);
});

test("déconnexion et purge : jeton révoqué, sessions expirées effacées", async () => {
  const { jeton } = await (await inscrire()).json();
  assert.equal((await appel("deconnexion", { jeton })).status, 204);
  assert.equal((await appel("deconnexion", { jeton })).status, 401);
  const { jeton: j2 } = await (await appel("connexion", { corps: { identifiant: "lea.martin", motDePasse: MDP } })).json();
  assert.ok(j2);
  await purgerSessionsLocales(env, Date.now() + 13 * 3600 * 1000);
  assert.equal(sqlite().prepare("SELECT count(*) AS n FROM sessions_locales").get().n, 0);
});

test("Worker : CORS avec en-tête Authorization, origine inconnue refusée, base absente en 503", async () => {
  _reinitialiser();
  const preflight = await worker.fetch(new Request("https://api.test/api/compte-local/connexion", { method: "OPTIONS", headers: { origin: ORIGINE } }), env, {});
  assert.match(preflight.headers.get("access-control-allow-headers"), /authorization/);
  assert.match(preflight.headers.get("access-control-allow-methods"), /PUT/);

  const etranger = await worker.fetch(new Request("https://api.test/api/compte-local/etat", { headers: { origin: "https://pirate.example" } }), env, {});
  assert.equal(etranger.status, 403);

  const ok = await worker.fetch(new Request("https://api.test/api/compte-local/etat", { headers: { origin: ORIGINE } }), env, {});
  assert.equal(ok.headers.get("access-control-allow-origin"), ORIGINE);

  const sansTables = { ...env, DB: creerD1Comptes("schema.sql") };
  const r = await worker.fetch(new Request("https://api.test/api/compte-local/inscription", {
    method: "POST", headers: { origin: ORIGINE, "content-type": "application/json" }, body: JSON.stringify({ identifiant: "lea.martin", motDePasse: MDP })
  }), sansTables, {});
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { erreur: "synchro-indisponible" });
  sansTables.DB.sqlite.close();
});
