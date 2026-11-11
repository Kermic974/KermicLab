import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab } from "./outils.mjs";

let serveur, nav;
before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

const NOMS = ["Émile Grok", "Inès Grok", "Chloé Grok", "Paul Grok", "Hugo Grok", "Manon Grok"];

test("équipe : six agents, texte fidèle, ancres et aucun débordement, sans JavaScript", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, {
    javaScriptEnabled: false, viewport: { width: 1280, height: 900 }
  });
  await page.goto(`${serveur.url}/equipe.html`);
  assert.equal(await page.locator("h1").textContent(), "L'équipe");
  assert.match(await page.locator(".fr-chapeau").textContent(), /Les agents Grok au service de la solution KermicLab/);
  assert.match(await page.locator(".fr-encadre").textContent(), /agents d'intelligence artificielle/);
  assert.equal(await page.locator(".carte-agent").count(), 6);
  for (const nom of NOMS) assert.equal(await page.getByRole("heading", { name: nom, level: 2 }).count(), 1);
  const ancres = await page.locator('a[href^="#"]').evaluateAll((liens) => liens.map((lien) => lien.getAttribute("href").slice(1)));
  for (const id of ancres) assert.equal(await page.locator(`[id="${id}"]`).count(), 1, `ancre valide : ${id}`);
  assert.equal(await page.locator("img, iframe").count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "pas de débordement");
  await page.setViewportSize({ width: 360, height: 800 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "pas de débordement mobile");
  assert.equal(await page.locator(".eq-grille").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length), 1);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

async function entrer(page) {
  const api = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8")).apiUrl || serveur.url;
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette: "<!doctype html><title>maquette</title>" });
  await page.goto(serveur.url);
  const pseudo = page.locator("#dialogue-pseudo");
  await pseudo.waitFor({ state: "visible" });
  await page.fill("#pseudo", "Visiteur");
  await page.click("#formulaire-pseudo button[type=submit]");
  await pseudo.waitFor({ state: "hidden" });
}

test("équipe : le lien de la barre latérale ouvre la page", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { viewport: { width: 1280, height: 900 }, locale: "fr-FR" });
  await entrer(page);
  await page.locator('.barre-laterale a[href="equipe.html"]').click();
  await page.waitForURL(/equipe\.html$/);
  assert.equal(await page.locator("h1").textContent(), "L'équipe");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("équipe : le pied de page ouvre la page sur mobile", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, {
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "fr-FR"
  });
  await entrer(page);
  const lien = page.locator('footer.pied a[href="equipe.html"]');
  await lien.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await lien.click();
  await page.waitForURL(/equipe\.html$/);
  assert.equal(await page.locator(".carte-agent").count(), 6);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
