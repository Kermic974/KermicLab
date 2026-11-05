import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab } from "./outils.mjs";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";

let serveur, nav, api;
before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
  api = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8")).apiUrl || serveur.url;
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

async function brouillon(lien) {
  await lien.focus();
  const url = new URL(await lien.getAttribute("href"));
  assert.equal(url.origin, "https://github.com");
  assert.equal(url.pathname, "/Kermic974/trigoLab/issues/new");
  assert.equal(url.searchParams.get("template"), "feature.yml");
  assert.match(url.searchParams.get("title"), /^\[Feature\]/);
  return url.searchParams.get("need");
}

test("boîte à idées : pages publiques, mobile et application hors ligne", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { viewport: { width: 360, height: 740 } });
  for (const fichier of ["feuille-de-route.html", "confidentialite.html", "mentions-legales.html"]) {
    await page.goto(`${serveur.url}/${fichier}?secret=NE_PAS_TRANSMETTRE#prive`);
    const lien = page.locator("body > .boite-idees");
    const corps = await brouillon(lien);
    assert.match(corps, new RegExp(`page: ${fichier}`));
    assert.doesNotMatch(corps, /NE_PAS_TRANSMETTRE|prive/);
    assert.ok(await lien.isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.goto(new URL(`file://${racine}index.html`).href);
  for (const mode of ["explore", "learn", "play"]) {
    await page.locator(`[data-tab="${mode}"]`).click();
    assert.match(await brouillon(page.locator("body > .boite-idees")), new RegExp(`onglet: ${mode}`));
  }
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("boîte à idées : dialogues, navigation, langues et aucune donnée de l'élève", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR" });
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette: CATALOGUE.pages["trigo-cercle"].fr, jeux: true });
  await page.goto(serveur.url);
  const pseudo = page.locator("#dialogue-pseudo");
  await pseudo.waitFor({ state: "visible" });
  assert.match(await brouillon(pseudo.locator(":scope > .boite-idees")), /dialogue: dialogue-pseudo/);
  await page.fill("#pseudo", "PseudoSecret");
  await page.click("#formulaire-pseudo button[type=submit]");
  await page.fill("#question", "Conversation privée à ne pas transmettre");
  for (const vue of ["labs", "jeux", "defi", "progression", "badges", "profil", "aide"]) {
    await page.locator(`.barre-laterale [data-nav="${vue}"]`).first().click();
    const ouvert = page.locator("dialog[open]").last();
    const lien = await ouvert.count() ? ouvert.locator(":scope > .boite-idees") : page.locator("body > .boite-idees");
    const corps = await brouillon(lien);
    assert.doesNotMatch(corps, /PseudoSecret|Conversation privée/);
    assert.match(corps, /AGENTS\.md/);
    if (vue === "labs" || vue === "jeux") {
      assert.match(corps, new RegExp(`navigation: ${vue}`));
      assert.match(corps, /panneau: catalogue/);
      await page.locator("#fermer-catalogue").click();
    }
    if (await ouvert.count()) await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  }
  await page.selectOption("#langue", "en");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  assert.equal(await page.locator("body > .boite-idees").textContent(), "Idea box");
  assert.match(await brouillon(page.locator("body > .boite-idees")), /Agent preparation/);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("boîte à idées : onglets des notions, sous-vues des jeux et popup depuis une iframe isolée", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url);
  await contexte.route("https://github.com/Kermic974/trigoLab/issues/new**", (route) => route.fulfill({ contentType: "text/html", body: "<title>Brouillon</title>" }));
  for (const id of ["fractions", "echecs"]) {
    await page.route(`${serveur.url}/maquettes/${id}`, (route) => route.fulfill({ contentType: "text/html", body: CATALOGUE.pages[id].fr }));
    await page.goto(`${serveur.url}/maquettes/${id}`);
    for (const onglet of ["explication", "application", "mise-en-situation"]) {
      await page.locator(`[data-onglet="${onglet}"]`).click();
      const corps = await brouillon(page.locator("body > .boite-idees"));
      assert.match(corps, new RegExp(`page: ${id}`));
      assert.match(corps, new RegExp(`onglet: ${onglet}`));
      assert.match(corps, /version: /);
    }
    if (id === "echecs") {
      await page.locator('[data-onglet="academie"]').click();
      assert.match(await brouillon(page.locator("body > .boite-idees")), /vues: accueil/);
      await page.locator('#panneau-academie [data-action="detail"]').click();
      const corps = await brouillon(page.locator("body > .boite-idees"));
      assert.match(corps, /onglet: academie/);
      assert.match(corps, /vues: detail/);
      assert.doesNotMatch(corps, /vues: accueil/);
    }
  }
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette: CATALOGUE.pages["trigo-cercle"].fr });
  await page.goto(serveur.url);
  await page.fill("#pseudo", "Test");
  await page.click("#formulaire-pseudo button[type=submit]");
  await page.locator("#suggestion button").click();
  const cadre = page.frameLocator("#bulle-cadre");
  const lien = cadre.locator("body > .boite-idees");
  const popupPromise = contexte.waitForEvent("page");
  await lien.click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  assert.match(new URL(popup.url()).searchParams.get("need"), /page: trigo-cercle/);
  await popup.close();
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
