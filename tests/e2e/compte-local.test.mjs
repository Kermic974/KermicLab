import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab, capturer } from "./outils.mjs";
import { gererApiCompteLocal } from "../../worker/src/compte-local.js";
import { creerD1Comptes } from "../helpers/d1-comptes.mjs";

// Mon compte (ADR 0024) : compte facultatif sur l'appareil, puis synchronisation pseudonymisée entre deux appareils.
// Le vrai code du Worker répond (D1 en mémoire) : le test vérifie aussi ce que le serveur voit et garde.
let serveur, nav, htmlMaquette, api, env;
const corpsEnvoyes = [];
before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
  htmlMaquette = await readFile(`${racine}catalogue/trigo-cercle/page.html`, "utf8");
  api = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8")).apiUrl || serveur.url;
  env = { DB: creerD1Comptes("schema-compte-local.sql"), COMPTES_LOCAUX_SECRET: "e".repeat(40) };
});
after(async () => { await nav?.close(); await serveur?.fermer(); env?.DB.sqlite.close(); });

const IDENTIFIANT = "lea.k";
const MDP = "Soleil-Levant-42";
const PHRASE = "mon chat aime la pluie";

/** Ouvre un « appareil » (contexte de navigateur isolé) dont l'API du compte local est le vrai Worker. */
async function appareil(pseudo) {
  const session = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  const { page } = session;
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette });
  await page.route(`${api}/api/compte-local/**`, async (route) => {
    const r = route.request();
    if (r.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors() });
    const corps = r.postData() ?? undefined;
    if (corps) corpsEnvoyes.push(corps);
    const reponse = await gererApiCompteLocal(new Request(r.url(), { method: r.method(), headers: r.headers(), body: corps }), env);
    return route.fulfill({ status: reponse.status, headers: { ...Object.fromEntries(reponse.headers), ...cors() }, body: await reponse.text() });
  });
  await page.goto(serveur.url);
  await page.locator("#dialogue-pseudo[open]").waitFor();
  await page.fill("#pseudo", pseudo);
  await page.check("#pseudo-memoriser");
  await page.click("#formulaire-pseudo button[type=submit]");
  await page.locator("#dialogue-pseudo").waitFor({ state: "hidden" });
  return session;
}
const cors = () => ({ "access-control-allow-origin": serveur.url, "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "GET, POST, PUT" });

async function creerCompte(page) {
  await page.click(".barre-laterale [data-nav=profil]");
  await page.click("#entree-compte");
  await page.locator("#compte-creation").waitFor();
  await page.fill("#compte-identifiant", IDENTIFIANT);
  await page.fill("#compte-mdp", MDP);
  await page.fill("#compte-mdp2", MDP);
  await page.click("#formulaire-compte-creer button[type=submit]");
  await page.locator("#compte-ouvert").waitFor();
}

async function activerSynchro(page, phrase = PHRASE) {
  await page.fill("#synchro-mdp", MDP);
  await page.fill("#synchro-phrase", phrase);
  await page.fill("#synchro-phrase2", phrase);
  await page.check("#synchro-compris");
  await page.click("#formulaire-synchro-activer button[type=submit]");
  await page.locator("#synchro-actions").waitFor();
}

test("compte facultatif : site utilisable sans compte, aucun appel tant que la synchronisation n'est pas activée", async () => {
  const { page, contexte, erreurs } = await appareil("Léa");
  const appels = [];
  page.on("request", (r) => { if (r.url().includes("/api/compte-local/")) appels.push(r.url()); });
  await page.click(".barre-laterale [data-nav=profil]");
  await page.click("#entree-compte");
  await page.locator("#compte-creation").waitFor();
  assert.match(await page.locator("#compte-creation").textContent(), /sans compte/);

  // Identifiant sans email, mot de passe complexe de 12 caractères minimum.
  await page.fill("#compte-identifiant", "lea@exemple.fr");
  await page.click("#formulaire-compte-creer button[type=submit]");
  assert.match(await page.locator("#compte-identifiant-erreur").textContent(), /sans « @ »/);
  await page.fill("#compte-identifiant", IDENTIFIANT);
  await page.fill("#compte-mdp", "soleillevant");
  assert.equal(await page.locator("#compte-mdp-regles [data-regle=longueur]").getAttribute("data-ok"), "true");
  assert.equal(await page.locator("#compte-mdp-regles [data-regle=majuscule]").getAttribute("data-ok"), "false");
  await page.click("#formulaire-compte-creer button[type=submit]");
  assert.equal(await page.locator("#compte-mdp-erreur").textContent(), "Il manque : une majuscule, un chiffre, un caractère spécial.");
  await page.fill("#compte-mdp", MDP);
  await page.fill("#compte-mdp2", "Autre-Chose-42");
  await page.click("#formulaire-compte-creer button[type=submit]");
  assert.match(await page.locator("#compte-mdp2-erreur").textContent(), /pas identiques/);
  await page.fill("#compte-mdp2", MDP);
  await page.click("#formulaire-compte-creer button[type=submit]");
  await page.locator("#compte-ouvert").waitFor();
  assert.equal(await page.locator("#compte-ouvert-texte").textContent(), `Connecté en tant que « ${IDENTIFIANT} ».`);
  assert.match(await page.locator("#synchro-statut").textContent(), /Désactivée/);

  const enregistrement = await page.evaluate(() => localStorage.getItem("kermiclab:compte-local"));
  assert.equal(enregistrement.includes(MDP), false, "mot de passe jamais stocké, seulement son vérificateur");

  // Déconnexion puis connexion locale : le mot de passe est vérifié sur l'appareil.
  await page.click("#compte-deconnexion");
  await page.locator("#compte-connexion").waitFor();
  await page.fill("#compte-connexion-mdp", "Mauvais-Mot-42");
  await page.click("#formulaire-compte-connexion button[type=submit]");
  await page.locator("#compte-connexion-erreur:not(:empty)").waitFor();
  assert.equal(await page.locator("#compte-connexion-erreur").textContent(), "Mot de passe incorrect.");
  await page.fill("#compte-connexion-mdp", MDP);
  await page.click("#formulaire-compte-connexion button[type=submit]");
  await page.locator("#compte-ouvert").waitFor();
  await capturer(page, "compte-local-connecte");

  // Suppression du compte de l'appareil, sans synchronisation : rien n'est envoyé.
  await page.click("#compte-suppression summary");
  await page.fill("#compte-suppr-mdp", MDP);
  await page.click("#formulaire-compte-supprimer button[type=submit]");
  await page.locator("#compte-creation").waitFor();
  assert.deepEqual(appels, []);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("synchronisation : données pseudonymisées et chiffrées, récupérées sur un autre appareil avec la phrase secrète", async () => {
  // Appareil 1 : création, activation, envoi.
  const a = await appareil("Léa");
  await creerCompte(a.page);
  await a.page.fill("#synchro-mdp", MDP);
  await a.page.fill("#synchro-phrase", "court");
  await a.page.click("#formulaire-synchro-activer button[type=submit]");
  assert.match(await a.page.locator("#synchro-phrase-erreur").textContent(), /au moins 12 caractères/);
  await a.page.fill("#synchro-phrase", MDP);
  await a.page.click("#formulaire-synchro-activer button[type=submit]");
  assert.match(await a.page.locator("#synchro-phrase-erreur").textContent(), /différente de ton mot de passe/);
  await a.page.fill("#synchro-phrase", PHRASE);
  await a.page.fill("#synchro-phrase2", PHRASE);
  await a.page.click("#formulaire-synchro-activer button[type=submit]");
  assert.match(await a.page.locator("#synchro-compris-erreur").textContent(), /Coche la case/);
  await a.page.check("#synchro-compris");
  await a.page.click("#formulaire-synchro-activer button[type=submit]");
  await a.page.locator("#synchro-actions").waitFor();
  assert.match(await a.page.locator("#synchro-message").textContent(), /Synchronisation activée/);
  await capturer(a.page, "compte-local-synchro-active");

  // Ce que le serveur a reçu et garde : ni phrase secrète, ni identifiant en clair, ni pseudo lisible.
  assert.ok(corpsEnvoyes.length > 0);
  assert.equal(corpsEnvoyes.some((c) => c.includes(PHRASE)), false, "la phrase secrète n'est jamais envoyée");
  const donnees = env.DB.sqlite.prepare("SELECT * FROM donnees_pseudonymes").all();
  assert.equal(donnees.length, 1);
  assert.equal(JSON.stringify(donnees).includes("Léa") || JSON.stringify(donnees).includes(IDENTIFIANT), false);
  assert.equal(JSON.stringify(env.DB.sqlite.prepare("SELECT * FROM comptes_locaux").all()).includes(IDENTIFIANT), false);

  // Appareil 2 : même identifiant et mot de passe, autre pseudo local ; la phrase secrète retrouve les données.
  const b = await appareil("Tom");
  await creerCompte(b.page);
  await activerSynchro(b.page);
  assert.match(await b.page.locator("#synchro-message").textContent(), /Des données en ligne ont été trouvées/);
  await b.page.click("#synchro-recuperer");
  assert.equal(await b.page.locator("#synchro-recuperer").textContent(), "Remplacer les données de cet appareil ?");
  await Promise.all([b.page.waitForEvent("load"), b.page.click("#synchro-recuperer")]);
  await b.page.locator("#salut").waitFor();
  assert.equal(await b.page.evaluate(() => localStorage.getItem("kermiclab:pseudo")), "Léa", "pseudo de l'appareil 1 récupéré");

  // Appareil 1, nouvel onglet : synchronisation verrouillée ; une phrase erronée est reconnue sur l'appareil.
  await a.page.click("#compte-deconnexion");
  await a.page.fill("#compte-connexion-mdp", MDP);
  await a.page.click("#formulaire-compte-connexion button[type=submit]");
  await a.page.locator("#synchro-deverrouillage").waitFor();
  const avant = corpsEnvoyes.length;
  await a.page.fill("#synchro-dv-mdp", MDP);
  await a.page.fill("#synchro-dv-phrase", "une phrase oubliée");
  await a.page.click("#formulaire-synchro-deverrouiller button[type=submit]");
  await a.page.locator("#synchro-dv-erreur:not(:empty)").waitFor();
  assert.match(await a.page.locator("#synchro-dv-erreur").textContent(), /n'est pas la phrase secrète/);
  assert.equal(corpsEnvoyes.length, avant, "rien n'est demandé au serveur pour une phrase erronée");
  await a.page.fill("#synchro-dv-phrase", PHRASE);
  await a.page.click("#formulaire-synchro-deverrouiller button[type=submit]");
  await a.page.locator("#synchro-actions").waitFor();

  // Suppression : données en ligne puis compte en ligne effacés.
  await a.page.click("#compte-suppression summary");
  await a.page.fill("#compte-suppr-mdp", MDP);
  await a.page.click("#formulaire-compte-supprimer button[type=submit]");
  await a.page.locator("#compte-creation").waitFor();
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM donnees_pseudonymes").get().n, 0);
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM comptes_locaux").get().n, 0);
  assert.deepEqual(a.erreurs, []);
  // Seule erreur attendue : le 409 de l'inscription (identifiant déjà en ligne), suivi de la connexion.
  assert.deepEqual(b.erreurs.filter((e) => !/status of 409/.test(e)), []);
  await a.contexte.close();
  await b.contexte.close();
});
