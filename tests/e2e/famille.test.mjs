import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab, capturer } from "./outils.mjs";

// Comptes famille (ADR 0017) : profil local par défaut, compte parent nécessaire pour créer un profil enfant.
let serveur, nav, htmlMaquette, api, config;
before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
  htmlMaquette = await readFile(`${racine}catalogue/trigo-cercle/page.html`, "utf8");
  config = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8"));
  api = config.apiUrl || serveur.url;
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

const cors = () => ({ "access-control-allow-origin": serveur.url, "access-control-allow-credentials": "true" });

/** Ouvre le site ; `connexion` active les comptes (config.json) et simule le Worker des comptes. */
async function demarrer({ connexion = false, connecte = false, enfants = [] } = {}) {
  const session = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  const { page } = session;
  const appels = [];
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette });
  page.on("request", (r) => { if (/\/(auth|api\/eleves|api\/progres)/.test(r.url())) appels.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  if (connexion) {
    await page.route(`${serveur.url}/config.json`, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ ...config, connexionActive: true }) }));
    await page.route(`${api}/auth/me`, (r) => r.fulfill({
      status: connecte ? 200 : 401, contentType: "application/json", headers: cors(),
      body: JSON.stringify(connecte ? { connecte: true, compte: { id: "p1", role: "parent" } } : { connecte: false })
    }));
    await page.route(`${api}/api/eleves`, async (r) => {
      if (r.request().method() === "POST") {
        const corps = r.request().postDataJSON();
        const id = `e${enfants.length + 1}`;
        enfants.push({ id, prenom_affiche: corps.prenom_affiche, age_tranche: corps.age_tranche, consentement: corps.consentement_version });
        return r.fulfill({ status: 201, contentType: "application/json", headers: cors(), body: JSON.stringify({ id }) });
      }
      return r.fulfill({ contentType: "application/json", headers: cors(), body: JSON.stringify(enfants) });
    });
    await page.route(`${api}/api/progres**`, (r) => r.request().method() === "POST"
      ? r.fulfill({ status: 204, headers: cors() })
      : r.fulfill({ contentType: "application/json", headers: cors(), body: "[]" }));
  }
  await page.goto(serveur.url);
  await page.locator("#dialogue-pseudo[open]").waitFor();
  await page.fill("#pseudo", "Léa");
  await page.click("#formulaire-pseudo button[type=submit]");
  await page.locator("#dialogue-pseudo").waitFor({ state: "hidden" });
  return { ...session, appels, enfants };
}

test("connexion désactivée : aucun appel aux comptes, Espace famille et type de profil masqués", async () => {
  const { page, contexte, erreurs, appels } = await demarrer();
  assert.equal(config.connexionActive, false, "la connexion reste désactivée dans le site construit");
  assert.equal(await page.locator("#entree-famille").isHidden(), true);
  await page.click(".barre-laterale [data-ouvrir-profil]");
  assert.equal(await page.locator("#type-profil").isHidden(), true);
  await page.click("#fermer-profil");
  await page.goto(`${serveur.url}/#famille`);
  await page.locator("#salut").waitFor();
  assert.equal(await page.locator("#famille").isHidden(), true, "#famille n'est pas un écran tant que la connexion est désactivée");
  assert.deepEqual(appels, [], "ni /auth/me ni /api/eleves");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("sans compte parent : profil local complet et invitation réservée au parent", async () => {
  const { page, contexte, erreurs } = await demarrer({ connexion: true });
  await page.locator("#entree-famille").waitFor();
  await page.click(".barre-laterale [data-ouvrir-profil]");
  assert.equal(await page.locator("#type-profil-nom").textContent(), "Profil local, sur cet appareil");
  assert.match(await page.locator("#type-profil-aide").textContent(), /demande à un parent/);
  await page.click("#ouvrir-famille");
  await page.locator("#famille-invite").waitFor();
  assert.equal(await page.locator("#famille-parent").isHidden(), true, "aucun formulaire enfant sans compte parent");
  assert.match(await page.locator("#famille-invite .note-locale").textContent(), /profil local/);
  assert.equal(await page.locator("#connexion-google").isVisible(), true);
  assert.deepEqual(erreurs.filter((e) => !/401/.test(e)), []);
  await contexte.close();
});

test("parent connecté : création d'un profil enfant avec consentement obligatoire, puis mode enfant", async () => {
  const { page, contexte, erreurs, enfants } = await demarrer({ connexion: true, connecte: true });
  await page.click("#entree-famille");
  await page.locator("#famille-parent").waitFor();
  assert.equal(await page.locator("#famille-vide").isVisible(), true);
  await page.click("#famille-ajout summary");
  await page.fill("#enfant-prenom", "Tom");
  await page.check("input[name=enfant-tranche][value='11-14']");
  await page.click("#creer-enfant");
  assert.equal(await page.locator("#enfant-consentement-erreur").textContent(), "Ton accord est nécessaire pour créer le profil.");
  assert.equal(enfants.length, 0, "rien n'est envoyé sans consentement");

  await page.check("#enfant-consentement");
  await page.click("#creer-enfant");
  await page.locator(".famille-enfant").first().waitFor();
  assert.deepEqual(enfants, [{ id: "e1", prenom_affiche: "Tom", age_tranche: "11-14", consentement: "consentement-v1" }]);
  assert.match(await page.locator(".famille-enfant").textContent(), /Tom.*11 à 14 ans/);

  await page.click(".famille-enfant button.bouton");
  await page.locator("#famille-enfant").waitFor();
  assert.equal(await page.locator("#famille-enfant-texte").textContent(), "Cet appareil utilise le profil de Tom.");
  assert.equal(await page.locator("#famille-parent").isHidden(), true, "en mode enfant, la gestion des profils est masquée");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("démonstration (green card) : parcours parent → enfant sans OAuth ni appel au Worker, puis sortie", async () => {
  const { page, contexte, erreurs, appels } = await demarrer();
  await page.goto(`${serveur.url}/?demo=famille#famille`);
  const bandeau = page.locator("#bandeau-demo");
  await bandeau.waitFor({ state: "visible" });
  assert.match(await bandeau.textContent(), /rien n’est envoyé au serveur/);
  await page.locator("#famille-invite").waitFor({ state: "visible" });
  assert.equal(await page.locator("#essayer-demo").isVisible(), false);
  assert.equal(await page.locator("#famille-demo-note").isVisible(), true);
  await capturer(page, "famille-demo-invitation");
  await page.click("#connexion-google");
  await page.locator("#famille-parent").waitFor({ state: "visible" });
  await page.locator("#famille-ajout summary").click();
  await page.fill("#enfant-prenom", "Lou");
  await page.check("input[name=enfant-tranche][value='6-10']");
  await page.check("#enfant-consentement");
  await page.click("#creer-enfant");
  await page.locator("#famille-enfants li", { hasText: "Lou" }).waitFor();
  await capturer(page, "famille-demo-parent");
  await page.reload();
  await page.locator("#famille-enfants li", { hasText: "Lou" }).waitFor();
  assert.equal(await bandeau.isVisible(), true, "la démo survit au rechargement de l'onglet");
  await page.locator("#famille-enfants li", { hasText: "Lou" }).locator("button.bouton").click();
  await page.locator("#famille-enfant").waitFor({ state: "visible" });
  assert.match(await page.locator("#famille-enfant-texte").textContent(), /Lou/);
  assert.equal(await page.evaluate(() => Array.isArray(JSON.parse(sessionStorage.getItem("kermiclab:progression")).notions)), true,
    "la progression garde son tableau de notions après « Utiliser »");
  await capturer(page, "famille-demo-enfant");
  await page.click("#quitter-mode-enfant");
  await page.locator("#famille-invite").waitFor({ state: "visible" });
  await page.click("#quitter-demo");
  await page.waitForURL((url) => !url.search.includes("demo"));
  await page.locator("#grille-matieres .matiere-carte").first().waitFor();
  assert.equal(await bandeau.isVisible(), false);
  assert.equal(await page.locator("#entree-famille").isVisible(), false, "hors démo, l'Espace famille reste fermé (connexionActive = false)");
  assert.deepEqual(appels.filter((a) => !a.endsWith("/auth/me")), [], "aucun appel aux comptes pendant la démo");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("connexion réelle : fournisseur non configuré → message et proposition de démonstration, sans redirection", async () => {
  const { page, contexte } = await demarrer({ connexion: true });
  await page.route(`${api}/auth/fournisseurs`, (r) => r.fulfill({ contentType: "application/json", headers: cors(), body: JSON.stringify({ google: false, microsoft: false }) }));
  await page.goto(`${serveur.url}/#famille`);
  await page.locator("#famille-invite").waitFor({ state: "visible" });
  await page.click("#connexion-google");
  await page.locator("#famille-etat", { hasText: "pas encore ouverte" }).waitFor();
  await capturer(page, "famille-connexion-indisponible");
  assert.equal(new URL(page.url()).pathname, "/");
  await page.click("#essayer-demo");
  await page.locator("#bandeau-demo").waitFor({ state: "visible" });
  assert.match(page.url(), /demo=famille/);
  await contexte.close();
});
