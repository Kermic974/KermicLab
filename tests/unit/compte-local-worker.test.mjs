import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker, { _reinitialiser } from "../../worker/src/index.js";
import {
  gererApiCompteLocal, purgerCompteLocal, compteDeSession, genererMotDePasseProvisoire, remplacerMotDePasse, ECHECS_AVANT_BLOCAGE, CONSERVATION_JOURS
} from "../../worker/src/compte-local.js";
import {
  chiffrer, dechiffrer, deriverAppairage, deriverSecrets, genererCleSynchro, genererCodeAppairage, sha256Hex, validerMotDePasse
} from "../../web/compte-local.js";
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
  assert.deepEqual(Object.keys(ligne).sort(), ["chiffre", "iv", "jeton_hash", "maj_le", "pseudonyme", "version", "vu_le"], "aucune colonne de compte");
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
  await purgerCompteLocal(env, Date.now() + 13 * 3600 * 1000);
  assert.equal(sqlite().prepare("SELECT count(*) AS n FROM sessions_locales").get().n, 0);
});

test("mot de passe provisoire (back-office) : session restreinte jusqu'au changement, conforme aux règles", async () => {
  for (let i = 0; i < 50; i++) assert.equal(validerMotDePasse(genererMotDePasseProvisoire()).ok, true, "toujours conforme aux règles");
  await inscrire();
  const id = sqlite().prepare("SELECT id FROM comptes_locaux").get().id;
  const provisoire = genererMotDePasseProvisoire();
  await remplacerMotDePasse(env, id, provisoire, { provisoire: true });
  assert.equal(sqlite().prepare("SELECT count(*) AS n FROM sessions_locales").get().n, 0, "sessions fermées");
  assert.equal((await appel("connexion", { corps: { identifiant: "lea.martin", motDePasse: MDP } })).status, 401, "l'ancien mot de passe ne sert plus");

  const ouverte = await (await appel("connexion", { corps: { identifiant: "lea.martin", motDePasse: provisoire } })).json();
  assert.equal(ouverte.provisoire, true);
  const s = await secretsRapides();
  const lire = (jeton) => appel("donnees/lire", { jeton, corps: { pseudonyme: s.pseudonyme, jeton: s.jeton } });
  assert.deepEqual(await (await lire(ouverte.jeton)).json(), { erreur: "mot-de-passe-provisoire" });
  const requete = new Request("https://api.test/", { headers: { authorization: `Bearer ${ouverte.jeton}` } });
  assert.equal(await compteDeSession(requete, env), null, "Espace famille, Professeur, contributions : session refusée");
  assert.equal((await appel("moi", { methode: "GET", jeton: ouverte.jeton })).status, 200, "ses données restent consultables");

  const changer = (corps) => appel("mot-de-passe", { jeton: ouverte.jeton, corps: { identifiant: "lea.martin", motDePasse: provisoire, ...corps } });
  assert.equal((await changer({ identifiant: "quelquun", nouveau: "Nouveau-Secret-77" })).status, 401, "identifiant d'un autre compte");
  assert.equal((await changer({ motDePasse: MDP, nouveau: "Nouveau-Secret-77" })).status, 401, "mot de passe actuel exigé");
  assert.deepEqual(await (await changer({ nouveau: "faible" })).json(), { erreur: "mot-de-passe-court" });
  assert.deepEqual(await (await changer({ nouveau: "Lea.Martin-Secret-7" })).json(), { erreur: "mot-de-passe-identifiant" });
  assert.deepEqual(await (await changer({ nouveau: provisoire })).json(), { erreur: "mot-de-passe-identique" });
  const change = await changer({ nouveau: "Nouveau-Secret-77" });
  assert.equal(change.status, 200);
  const { jeton, provisoire: encore } = await change.json();
  assert.equal(encore, undefined);
  assert.equal(sqlite().prepare("SELECT mdp_provisoire FROM comptes_locaux").get().mdp_provisoire, 0);
  assert.equal((await lire(ouverte.jeton)).status, 401, "la session provisoire est fermée");
  assert.equal((await lire(jeton)).status, 200);
  assert.equal((await appel("connexion", { corps: { identifiant: "lea.martin", motDePasse: "Nouveau-Secret-77" } })).status, 200);
});

test("moi : identifiant unique et données du compte, sans secret ni identifiant de connexion", async () => {
  const { jeton } = await (await inscrire()).json();
  assert.equal((await appel("moi", { methode: "GET" })).status, 401);
  const moi = await (await appel("moi", { methode: "GET", jeton })).json();
  const { id, cree_le: creeLe } = sqlite().prepare("SELECT id, cree_le FROM comptes_locaux").get();
  assert.equal(moi.id, id);
  assert.deepEqual(moi.compte, { id, cree_le: creeLe, mot_de_passe_provisoire: false, sessions_actives: 1 });
  assert.match(moi.note, /chiffrées dans le navigateur/);
  assert.doesNotMatch(JSON.stringify(moi), /lea|identifiant_hmac|mdp_hash|mdp_sel/, "ni identifiant de connexion ni secret");
});

test("appairage : clé chiffrée de bout en bout, même compte, usage unique, 10 minutes", async () => {
  const { jeton } = await (await inscrire()).json();
  const { jeton: autre } = await (await inscrire("tom.dupont")).json();
  const code = genererCodeAppairage();
  const a = await deriverAppairage(code, "lea.martin");
  const cleSynchro = genererCleSynchro();
  const boite = await chiffrer(a.cle, a.boite, { v: 1, cle: cleSynchro });
  const deposer = (j = jeton, extra = {}) => appel("appairage", { methode: "PUT", jeton: j, corps: { boite: a.boite, jeton: a.jeton, ...boite, ...extra } });
  const retirer = (j = jeton, preuve = a.jeton) => appel("appairage/lire", { jeton: j, corps: { boite: a.boite, jeton: preuve } });

  assert.equal((await deposer(null)).status, 401);
  assert.equal((await deposer(jeton, { chiffre: "A".repeat(2000) })).status, 413);
  assert.equal((await deposer()).status, 200);
  const ligne = sqlite().prepare("SELECT * FROM appairages").get();
  assert.equal(JSON.stringify(ligne).includes(cleSynchro) || JSON.stringify(ligne).includes(code), false, "ni la clé ni le code");
  assert.ok(ligne.expire_a <= Date.now() / 1000 + 600);

  assert.equal((await retirer(autre)).status, 404, "un autre compte ne retire pas la boîte, même avec le code");
  assert.equal((await retirer(jeton, (await deriverAppairage(genererCodeAppairage(), "lea.martin")).jeton)).status, 404);
  const lu = await (await retirer()).json();
  assert.deepEqual(await dechiffrer(a.cle, a.boite, lu), { v: 1, cle: cleSynchro });
  assert.equal((await retirer()).status, 404, "usage unique");

  await deposer();
  await deposer();
  assert.equal(sqlite().prepare("SELECT count(*) AS n FROM appairages").get().n, 1, "une seule boîte par compte");
  assert.equal((await purgerCompteLocal(env, Date.now() + 601 * 1000)).appairages, 1, "expirée, effacée par le cron");
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

test("conservation : données ni lues ni écrites depuis 365 jours effacées, une lecture repousse l'échéance", async () => {
  assert.equal(CONSERVATION_JOURS, 365);
  const { jeton } = await (await inscrire()).json();
  const s = await secretsRapides();
  const boite = await chiffrer(s.cle, s.pseudonyme, { v: 1, donnees: {} });
  await appel("donnees", { methode: "PUT", jeton, corps: { pseudonyme: s.pseudonyme, jeton: s.jeton, versionAttendue: 0, ...boite } });
  const vieillir = (jours) => sqlite().prepare("UPDATE donnees_pseudonymes SET maj_le = date('now', ?), vu_le = date('now', ?)").run(`-${jours} days`, `-${jours} days`);
  const nombre = () => sqlite().prepare("SELECT count(*) AS n FROM donnees_pseudonymes").get().n;

  vieillir(365);
  assert.deepEqual(await purgerCompteLocal(env), { sessions: 0, donnees: 0, appairages: 0 }, "365 jours pile : conservée");
  vieillir(400);
  await appel("donnees/lire", { jeton, corps: { pseudonyme: s.pseudonyme, jeton: s.jeton } });
  const ligne = sqlite().prepare("SELECT maj_le, vu_le FROM donnees_pseudonymes").get();
  assert.equal(ligne.vu_le, new Date().toISOString().slice(0, 10), "lecture = activité");
  assert.notEqual(ligne.maj_le, ligne.vu_le, "la date de mise à jour affichée reste celle de la dernière écriture");
  assert.equal((await purgerCompteLocal(env)).donnees, 0);
  assert.equal(nombre(), 1);

  vieillir(366);
  assert.deepEqual(await purgerCompteLocal(env), { sessions: 0, donnees: 1, appairages: 0 }, "inactive depuis plus de 365 jours : effacée");
  assert.equal(nombre(), 0);
  env.COMPTES_LOCAUX_SECRET = "";
  assert.equal(await purgerCompteLocal(env), null, "sans configuration, rien n'est touché");
});
