import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab, capturer } from "./outils.mjs";
import { gererApiCompteLocal, genererMotDePasseProvisoire, remplacerMotDePasse } from "../../worker/src/compte-local.js";
import { chiffrer, deriverSecrets } from "../../web/compte-local.js";
import { creerD1Complet } from "../helpers/d1-complet.mjs";

// Mon compte (ADR 0024) : compte facultatif sur l'appareil, puis synchronisation pseudonymisée entre deux appareils.
// Le vrai code du Worker répond (D1 en mémoire) : le test vérifie aussi ce que le serveur voit et garde.
let serveur, nav, htmlMaquette, api, env;
const corpsEnvoyes = [];
before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
  htmlMaquette = await readFile(`${racine}catalogue/trigo-cercle/page.html`, "utf8");
  api = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8")).apiUrl || serveur.url;
  env = { DB: creerD1Complet(), COMPTES_LOCAUX_SECRET: "e".repeat(40) };
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
  // Espace famille (ADR 0029) : hors du périmètre de ce test, un compte solo sans rôle parent.
  await page.route(`${api}/api/famille/**`, (route) => route.fulfill({
    status: 200, contentType: "application/json", headers: cors(),
    body: JSON.stringify({ role: "visiteur", parent: false, enfants: 0, enfant: null, invitation: null })
  }));
  // Expérience Professeur (ADR 0030) : hors du périmètre, un compte sans rôle Professeur qui ne suit aucun professeur.
  await page.route(`${api}/api/professeur/**`, (route) => route.fulfill({
    status: 200, contentType: "application/json", headers: cors(),
    body: JSON.stringify({ role: "visiteur", professeur: false, profil: null, professeurs: 0 })
  }));
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
  await page.click(".barre-laterale .profil-carte[data-action=profil]");
  await page.click("#entree-compte");
  await page.locator("#compte-creation").waitFor();
  await page.fill("#compte-identifiant", IDENTIFIANT);
  await page.fill("#compte-mdp", MDP);
  await page.fill("#compte-mdp2", MDP);
  await page.click("#formulaire-compte-creer button[type=submit]");
  await page.locator("#compte-ouvert").waitFor();
}

/** Retrouve la synchronisation d'un autre appareil : code d'appairage, clé de récupération ou phrase (ancienne méthode). */
async function retrouverSynchro(page, secret) {
  await page.click("#synchro-retrouver summary");
  await page.fill("#synchro-rt-mdp", MDP);
  await page.fill("#synchro-rt-secret", secret);
  await page.click("#formulaire-synchro-retrouver button[type=submit]");
}

test("compte facultatif : site utilisable sans compte, aucun appel tant que la synchronisation n'est pas activée", async () => {
  const { page, contexte, erreurs } = await appareil("Léa");
  const appels = [];
  page.on("request", (r) => { if (r.url().includes("/api/compte-local/")) appels.push(r.url()); });
  await page.click(".barre-laterale .profil-carte[data-action=profil]");
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

test("synchronisation par clé : rien à mémoriser, appairage chiffré de bout en bout, kit de récupération", async () => {
  // Appareil 1 : création, activation par une clé de synchronisation créée sur l'appareil.
  const a = await appareil("Léa");
  await creerCompte(a.page);
  await a.page.fill("#synchro-mdp", MDP);
  await a.page.click("#formulaire-synchro-activer button[type=submit]");
  assert.match(await a.page.locator("#synchro-compris-erreur").textContent(), /Coche la case/);
  await a.page.check("#synchro-compris");
  await a.page.click("#formulaire-synchro-activer button[type=submit]");
  await a.page.locator("#synchro-actions").waitFor();
  assert.match(await a.page.locator("#synchro-message").textContent(), /Synchronisation activée/);
  await a.page.locator("#synchro-kit-zone").waitFor();
  const kit = await a.page.locator("#synchro-cle-recuperation").textContent();
  assert.match(kit, /^([0-9A-HJKMNP-TV-Z]{4}-){13}[0-9A-HJKMNP-TV-Z]{4}$/, "kit de récupération affiché après l'activation");
  await capturer(a.page, "compte-local-synchro-active");

  // Ce que l'appareil et le serveur gardent : ni clé en clair, ni identifiant, ni pseudo lisible.
  const enregistrement = await a.page.evaluate(() => localStorage.getItem("kermiclab:compte-local"));
  assert.equal(enregistrement.includes(kit.replace(/-/g, "")), false);
  assert.match(enregistrement, /"mode":"cle".*"enveloppe"/, "clé gardée sous une enveloppe chiffrée par le mot de passe");
  assert.equal(corpsEnvoyes.some((c) => c.includes(kit) || c.includes(kit.replace(/-/g, ""))), false, "la clé n'est jamais envoyée");
  const donnees = env.DB.sqlite.prepare("SELECT * FROM donnees_pseudonymes").all();
  assert.equal(donnees.length, 1);
  assert.equal(JSON.stringify(donnees).includes("Léa") || JSON.stringify(donnees).includes(IDENTIFIANT), false);
  assert.equal(JSON.stringify(env.DB.sqlite.prepare("SELECT * FROM comptes_locaux").all()).includes(IDENTIFIANT), false);

  // Appareil 2 : même identifiant et mot de passe ; le code d'appairage de l'appareil 1 transmet la clé.
  await a.page.click("#synchro-appairer");
  await a.page.locator("#synchro-appairage-zone").waitFor();
  const code = await a.page.locator("#synchro-code").textContent();
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  assert.match(await a.page.locator("#synchro-code-aide").textContent(), /une seule fois/);
  const boite = env.DB.sqlite.prepare("SELECT * FROM appairages").get();
  assert.equal(JSON.stringify(boite).includes(code), false, "le serveur ne voit pas le code");
  const b = await appareil("Tom");
  await creerCompte(b.page);
  await retrouverSynchro(b.page, code.toLowerCase().replace(/-/g, " "));
  await b.page.locator("#synchro-actions").waitFor();
  assert.match(await b.page.locator("#synchro-message").textContent(), /Des données en ligne ont été trouvées/);
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM appairages").get().n, 0, "code à usage unique");
  await b.page.click("#synchro-recuperer");
  assert.equal(await b.page.locator("#synchro-recuperer").textContent(), "Remplacer les données de cet appareil ?");
  await Promise.all([b.page.waitForEvent("load"), b.page.click("#synchro-recuperer")]);
  await b.page.locator("#salut").waitFor();
  assert.equal(await b.page.evaluate(() => localStorage.getItem("kermiclab:pseudo")), "Léa", "pseudo de l'appareil 1 récupéré");

  // Appareil 3 : le kit de récupération ; une faute de frappe est reconnue sans appel au serveur.
  const c = await appareil("Zoé");
  await creerCompte(c.page);
  const faute = kit.slice(0, 7) + (kit[7] === "A" ? "B" : "A") + kit.slice(8);
  const avant = corpsEnvoyes.length;
  await retrouverSynchro(c.page, faute);
  await c.page.locator("#synchro-rt-erreur:not(:empty)").waitFor();
  assert.match(await c.page.locator("#synchro-rt-erreur").textContent(), /faute de frappe/);
  assert.equal(corpsEnvoyes.length, avant, "rien n'est demandé au serveur pour une clé erronée");
  await c.page.fill("#synchro-rt-secret", kit);
  await c.page.click("#formulaire-synchro-retrouver button[type=submit]");
  await c.page.locator("#synchro-actions").waitFor();
  assert.match(await c.page.locator("#synchro-message").textContent(), /Des données en ligne ont été trouvées/);

  // Appareil 1, nouvel onglet : le mot de passe suffit, la synchronisation est déverrouillée d'office.
  await a.page.click("#compte-deconnexion");
  await a.page.fill("#compte-connexion-mdp", MDP);
  await a.page.click("#formulaire-compte-connexion button[type=submit]");
  await a.page.locator("#synchro-actions").waitFor();
  assert.match(await a.page.locator("#synchro-statut").textContent(), /clé de synchronisation/);

  // Suppression : données en ligne puis compte en ligne effacés.
  await a.page.click("#compte-suppression summary");
  await a.page.fill("#compte-suppr-mdp", MDP);
  await a.page.click("#formulaire-compte-supprimer button[type=submit]");
  await a.page.locator("#compte-creation").waitFor();
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM donnees_pseudonymes").get().n, 0);
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM comptes_locaux").get().n, 0);
  assert.deepEqual(a.erreurs, []);
  // Seule erreur attendue : le 409 de l'inscription (identifiant déjà en ligne), suivi de la connexion.
  for (const x of [b, c]) assert.deepEqual(x.erreurs.filter((e) => !/status of 409/.test(e)), []);
  for (const x of [a, b, c]) await x.contexte.close();
});

test("phrase secrète (ancienne méthode) : données retrouvées, puis remplacées par une clé", async () => {
  // Données synchronisées avant la clé : écrites sous le pseudonyme dérivé de la phrase.
  const identifiant = "ancien.compte";
  const appelApi = async (route, corps, jeton) => (await gererApiCompteLocal(new Request(`https://api.test/api/compte-local/${route}`, {
    method: route === "donnees" ? "PUT" : "POST", headers: { "content-type": "application/json", ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) }, body: JSON.stringify(corps)
  }), env)).json();
  const { jeton } = await appelApi("inscription", { identifiant, motDePasse: MDP });
  const s = await deriverSecrets(PHRASE, identifiant);
  const boite = await chiffrer(s.cle, s.pseudonyme, { v: 1, donnees: { "kermiclab:pseudo": "Ancien" } });
  await appelApi("donnees", { pseudonyme: s.pseudonyme, jeton: s.jeton, versionAttendue: 0, ...boite }, jeton);

  const { page, contexte, erreurs } = await appareil("Neuf");
  try {
    await page.click(".barre-laterale .profil-carte[data-action=profil]");
    await page.click("#entree-compte");
    await page.fill("#compte-identifiant", identifiant);
    await page.fill("#compte-mdp", MDP);
    await page.fill("#compte-mdp2", MDP);
    await page.click("#formulaire-compte-creer button[type=submit]");
    await page.locator("#compte-ouvert").waitFor();
    await retrouverSynchro(page, "une phrase oubliée");
    await page.locator("#synchro-rt-erreur:not(:empty)").waitFor();
    assert.match(await page.locator("#synchro-rt-erreur").textContent(), /Aucune donnée en ligne avec cette phrase/);
    await page.fill("#synchro-rt-secret", PHRASE);
    await page.click("#formulaire-synchro-retrouver button[type=submit]");
    await page.locator("#synchro-actions").waitFor();
    assert.equal(await page.locator("#synchro-actions-cle").isVisible(), false, "pas d'appairage avec une phrase");

    await page.click("#synchro-migration summary");
    await page.fill("#synchro-mg-mdp", MDP);
    await page.click("#formulaire-synchro-migrer button[type=submit]");
    await page.locator("#synchro-kit-zone").waitFor();
    assert.match(await page.locator("#synchro-message").textContent(), /remplacée par une clé/);
    const lignes = env.DB.sqlite.prepare("SELECT pseudonyme, version FROM donnees_pseudonymes").all();
    assert.equal(lignes.length, 1, "ancienne copie effacée");
    assert.notEqual(lignes[0].pseudonyme, s.pseudonyme);
    assert.equal(await page.locator("#synchro-actions-cle").isVisible(), true);
    assert.deepEqual(erreurs.filter((e) => !/status of (409|404)/.test(e)), []);
  } finally {
    await contexte.close();
  }
});

test("support : mot de passe provisoire à remplacer, identifiant unique dans « Ce que Kermiclab sait de moi »", async () => {
  const identifiant = "sam.oubli";
  const { page, contexte } = await appareil("Sam");
  try {
    await page.click(".barre-laterale .profil-carte[data-action=profil]");
    await page.click("#entree-compte");
    await page.fill("#compte-identifiant", identifiant);
    await page.fill("#compte-mdp", MDP);
    await page.fill("#compte-mdp2", MDP);
    await page.check("#liaison-creer-d1");
    await page.click("#formulaire-compte-creer button[type=submit]");
    await page.locator("#compte-ouvert").waitFor();

    // Libre-service : l'identifiant unique affiché est celui de la base, sans identifiant de connexion côté serveur.
    await page.click("#moi-afficher");
    await page.locator("#moi-id:not(:text('—'))").waitFor();
    const id = await page.locator("#moi-id").textContent();
    const ligne = env.DB.sqlite.prepare("SELECT id FROM comptes_locaux WHERE id = ?").get(id);
    assert.ok(ligne, "identifiant unique du compte en ligne");
    assert.match(await page.locator("#moi-identifiant").textContent(), /empreinte/);
    assert.equal(await page.locator("#moi-details").isHidden(), false);
    await capturer(page, "compte-local-moi");

    // Le support réinitialise le mot de passe (back-office) : sessions fermées, mot de passe provisoire.
    const provisoire = genererMotDePasseProvisoire();
    await remplacerMotDePasse(env, id, provisoire, { provisoire: true });
    await page.click("#compte-deconnexion");
    await page.fill("#compte-connexion-mdp", provisoire);
    await page.click("#formulaire-compte-connexion button[type=submit]");
    await page.locator("#compte-provisoire").waitFor();
    assert.equal(await page.locator("#compte-ouvert").isHidden(), true, "rien d'autre avant le changement");
    await page.fill("#provisoire-mdp", provisoire);
    await page.fill("#provisoire-mdp2", provisoire);
    await page.click("#formulaire-compte-provisoire button[type=submit]");
    await page.locator("#provisoire-mdp-erreur:not(:empty)").waitFor();
    assert.match(await page.locator("#provisoire-mdp-erreur").textContent(), /différent/);
    const nouveau = "Nouveau-Depart-21";
    await page.fill("#provisoire-mdp", nouveau);
    await page.fill("#provisoire-mdp2", nouveau);
    await page.click("#formulaire-compte-provisoire button[type=submit]");
    await page.locator("#compte-ouvert").waitFor();
    assert.equal(env.DB.sqlite.prepare("SELECT mdp_provisoire FROM comptes_locaux WHERE id = ?").get(id).mdp_provisoire, 0);

    // Le nouveau mot de passe sert ensuite, sur l'appareil comme en ligne.
    await page.click("#compte-deconnexion");
    await page.fill("#compte-connexion-mdp", nouveau);
    await page.click("#formulaire-compte-connexion button[type=submit]");
    await page.getByText(`Connecté au compte en ligne : ${identifiant}.`, { exact: true }).waitFor();
  } finally {
    await contexte.close();
  }
});

test("connexion en ligne : fournisseurs en attente, identité D1 stable sans synchronisation", async () => {
  const { page, contexte } = await appareil("Nina");
  try {
    await page.click("#ouvrir-connexion");
    for (const fournisseur of ["Microsoft", "Google", "Apple"]) {
      await page.locator("#compte nav").getByRole("button", { name: new RegExp(fournisseur) }).click();
      await page.locator("#connexion-en-cours-titre").waitFor();
      assert.equal(new URL(page.url()).hash, "#connexion-en-cours");
      await page.locator("#connexion-en-cours button").click();
    }
    const identifiant = "nina.d1";
    await page.fill("#compte-identifiant", identifiant);
    await page.fill("#compte-mdp", MDP);
    await page.fill("#compte-mdp2", MDP);
    await page.check("#liaison-creer-d1");
    await page.click("#formulaire-compte-creer button[type=submit]");
    await page.getByText(`Connecté au compte en ligne : ${identifiant}.`, { exact: true }).waitFor();
    const ids = () => env.DB.sqlite.prepare("SELECT id FROM comptes_locaux ORDER BY id").all().map((c) => c.id);
    const avant = ids();
    assert.ok(avant.length > 0);
    await page.click("#compte-deconnexion");
    await page.fill("#compte-connexion-mdp", MDP);
    const verification = page.waitForResponse((r) => r.url().endsWith("/api/compte-local/connexion") && r.status() === 200);
    await page.click("#formulaire-compte-connexion button[type=submit]");
    await verification;
    await page.getByText(`Connecté au compte en ligne : ${identifiant}.`, { exact: true }).waitFor();
    assert.deepEqual(ids(), avant);
    assert.equal(await page.locator("#synchro-actions").isVisible(), false);
  } finally {
    await contexte.close();
  }
});

test("mon abonnement : niveau et rôles affichés, changement de niveau à la demande (paiement acquis en phase de dev)", async () => {
  const identifiant = "eva.abo";
  const { page, contexte, erreurs } = await appareil("Eva");
  try {
    await page.click(".barre-laterale .profil-carte[data-action=profil]");
    await page.click("#entree-compte");
    await page.fill("#compte-identifiant", identifiant);
    await page.fill("#compte-mdp", MDP);
    await page.fill("#compte-mdp2", MDP);
    await page.check("#liaison-creer-d1");
    await page.click("#formulaire-compte-creer button[type=submit]");
    await page.locator("#compte-souscription").waitFor();
    await page.locator("#souscription-actuelle:not(:empty)").waitFor();
    assert.equal(await page.locator("#souscription-actuelle").textContent(), "Niveau actuel : Gratuit (gratuit).");
    assert.match(await page.locator("#souscription-roles").textContent(), /Visiteur/);
    assert.equal(await page.locator("#souscription-dev").isVisible(), true, "phase de développement signalée");

    await page.click("#souscription-changer summary");
    const parent = page.locator("#souscription-offres li", { hasText: "Parent" });
    assert.match(await parent.textContent(), /TTC par mois/);
    await parent.locator("button").click();
    assert.match(await parent.locator("button").textContent(), /Confirmer : passer à Parent/);
    await parent.locator("button").click();
    await page.locator("#souscription-message", { hasText: "Ton abonnement est maintenant : Parent." }).waitFor();
    assert.match(await page.locator("#souscription-actuelle").textContent(), /^Niveau actuel : Parent \(/);
    assert.match(await page.locator("#souscription-roles").textContent(), /Parent/, "le rôle de l'offre se cumule");
    const id = env.DB.sqlite.prepare("SELECT id FROM comptes_locaux ORDER BY rowid DESC").get().id;
    assert.equal(env.DB.sqlite.prepare("SELECT niveau FROM attributions_roles WHERE compte_id = ?").get(id).niveau, "parent");
    assert.deepEqual({ ...env.DB.sqlite.prepare("SELECT de, vers, paiement FROM souscriptions_changements WHERE compte_id = ?").get(id) }, { de: "gratuit", vers: "parent", paiement: "dev" });
    await capturer(page, "compte-local-abonnement");
    assert.deepEqual(erreurs, []);
  } finally {
    await contexte.close();
  }
});
