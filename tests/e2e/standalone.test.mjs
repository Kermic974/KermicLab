import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { servir, navigateur, ouvrir, racine } from "./outils.mjs";

let serveur, nav;
before(async () => { serveur = await servir(racine); nav = await navigateur(); });
after(async () => { await nav?.close(); await serveur?.fermer(); });

test("application autonome : explorer, défi, sécurité CSP et rendu mobile", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, `${serveur.url}/index.html`, {
    viewport: { width: 360, height: 740 },
    isMobile: true
  });
  await page.addInitScript(() => {
    const aleas = [0, 0.75];
    Math.random = () => aleas.shift() ?? 0;
  });
  await page.goto(`${serveur.url}/index.html`);

  assert.equal(await page.locator("#valeur-cos").textContent(), "0.707");
  await page.locator("#angle").evaluate((element) => {
    element.value = "90";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await page.locator("#valeur-cos").textContent(), "0.000");
  assert.equal(await page.locator("#valeur-sin").textContent(), "1.000");
  assert.equal(await page.locator("#valeur-tan").textContent(), "non définie");

  await page.locator("#onglet-explorer").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("#panneau-defi").isVisible(), true);
  assert.match(await page.locator("#question-defi").textContent(), /cos\(0°\)/);
  await page.locator("#reponse").fill("1");
  await page.locator("#formulaire-defi button[type=submit]").click();
  assert.match(await page.locator("#feedback").textContent(), /Bien joué/);

  const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(debord <= 0, `débordement horizontal de ${debord}px`);
  assert.deepEqual(erreurs, [], "aucune erreur console, JavaScript ou violation CSP");
  await contexte.close();
});
