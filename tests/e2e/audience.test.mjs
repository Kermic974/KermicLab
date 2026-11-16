// Mesure d'audience Google Analytics (ADR 0027) : rien n'est chargé sans accord, le choix est gardé et modifiable.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, capturer, simulerApiKermiclab } from "./outils.mjs";

let serveur, nav, config;
before(async () => {
  const csp = (await readFile(`${racine}dist/_headers`, "utf8")).match(/Content-Security-Policy: (.*)/)[1];
  config = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8"));
  serveur = await servir(`${racine}dist`, { headers: { "content-security-policy": csp } });
  nav = await navigateur();
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

/** Ouvre la page Confidentialité sans choix enregistré et note les appels vers Google. */
async function ouvrirSansChoix(options = {}) {
  const session = await ouvrir(nav, serveur.url, { audience: null, ...options });
  const appels = [];
  session.page.on("request", (r) => { if (/google/.test(new URL(r.url()).hostname)) appels.push(r.url()); });
  await session.page.route(`${serveur.url}/config.json`, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ ...config, mesureGoogle: "G-TEST123456" }) }));
  return { ...session, appels };
}
const choix = (page) => page.evaluate(() => localStorage.getItem("kermiclab_audience"));

test("audience : sans réponse puis après un refus, aucun appel à Google ni cookie", async () => {
  const { page, contexte, erreurs, appels } = await ouvrirSansChoix({ viewport: { width: 360, height: 800 } });
  await page.goto(`${serveur.url}/confidentialite.html`);
  const bandeau = page.locator("#bandeau-audience");
  await bandeau.waitFor({ state: "visible" });
  assert.ok(await page.locator('[data-audience-etat="aucun"]').isVisible());
  assert.deepEqual(appels, []);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "pas de débordement mobile");
  await capturer(page, "audience-bandeau");
  await bandeau.locator('[data-audience-choix="refuse"]').click();
  await bandeau.waitFor({ state: "hidden" });
  assert.equal(await choix(page), "refuse");
  assert.ok(await page.locator('[data-audience-etat="refuse"]').isVisible());
  await page.reload();
  await page.locator('[data-audience-etat="refuse"]').waitFor({ state: "visible" });
  assert.ok(await bandeau.isHidden(), "le bandeau ne revient pas après un refus");
  assert.deepEqual(appels, []);
  assert.equal(await page.evaluate(() => document.cookie), "");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("audience : l'accord charge Google Analytics sous la CSP du site, puis « Changer mon choix » permet de refuser", async () => {
  const { page, contexte, erreurs, appels } = await ouvrirSansChoix();
  await page.goto(`${serveur.url}/confidentialite.html`);
  const bandeau = page.locator("#bandeau-audience");
  await bandeau.locator('[data-audience-choix="accepte"]').click();
  await page.waitForFunction(() => document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js?id=G-TEST123456"]'));
  assert.equal(await choix(page), "accepte");
  assert.ok(appels.some((u) => u === "https://www.googletagmanager.com/gtag/js?id=G-TEST123456"), "script de Google demandé après accord");
  const reglages = await page.evaluate(() => [...window.dataLayer].map((a) => Array.from(a)).find((a) => a[0] === "config"));
  assert.deepEqual(reglages, ["config", "G-TEST123456", { allow_google_signals: false, allow_ad_personalization_signals: false, page_location: `${serveur.url}/confidentialite.html` }]);
  // Le choix reste modifiable : refuser arrête la mesure et efface les cookies de Google Analytics.
  await page.evaluate(() => { document.cookie = "_ga=GA1.1.1.2; Path=/"; });
  await page.locator("[data-audience-gerer]").click();
  await bandeau.locator('[data-audience-choix="refuse"]').click();
  assert.equal(await choix(page), "refuse");
  assert.equal(await page.evaluate(() => window["ga-disable-G-TEST123456"]), true);
  assert.equal(await page.evaluate(() => document.cookie), "");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("audience : sur le tableau de bord, le bandeau est traduit et le pied de page permet de revenir sur son choix", async () => {
  const { page, contexte, appels } = await ouvrirSansChoix({ locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => { try { if (!sessionStorage.getItem("kermiclab:pseudo")) sessionStorage.setItem("kermiclab:pseudo", "Testeur"); } catch { /* iframe sandboxée */ } });
  await simulerApiKermiclab(page, { origine: serveur.url, api: config.apiUrl || serveur.url, htmlMaquette: "" });
  await page.goto(serveur.url);
  const bandeau = page.locator("#bandeau-audience");
  await bandeau.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector('#bandeau-audience [data-audience-choix="refuse"]').textContent === "Refuser");
  assert.equal(await bandeau.locator('[data-audience-choix="accepte"]').textContent(), "Accepter");
  await capturer(page, "audience-tableau-de-bord");
  await bandeau.locator('[data-audience-choix="refuse"]').click();
  await bandeau.waitFor({ state: "hidden" });
  assert.equal(await choix(page), "refuse");
  // Le lien du pied de page rouvre le bandeau.
  await page.evaluate(() => document.querySelector(".pied [data-audience-gerer]").click());
  await bandeau.waitFor({ state: "visible" });
  assert.deepEqual(appels, []);
  await contexte.close();
});

test("audience : sans identifiant de mesure, ni bandeau ni appel", async () => {
  const { page, contexte, appels, erreurs } = await ouvrirSansChoix();
  await page.route(`${serveur.url}/config.json`, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ ...config, mesureGoogle: "" }) }));
  await page.goto(`${serveur.url}/confidentialite.html`);
  await page.waitForLoadState("networkidle");
  assert.ok(await page.locator("#bandeau-audience").isHidden());
  assert.ok(await page.locator("[data-audience-gerer]").isHidden());
  assert.deepEqual(appels, []);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
