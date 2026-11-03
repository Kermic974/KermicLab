import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { servir, navigateur, ouvrir, racine } from "./outils.mjs";

// Maquette du tableau de bord élève, publiée sous /dashboard/ et accessible depuis l'en-tête du chat.
let serveur, nav;
before(async () => { serveur = await servir(`${racine}dist`); nav = await navigateur(); });
after(async () => { await nav?.close(); await serveur?.fermer(); });

test("chat : le bouton du tableau de bord est visible à côté de la pastille de progression", async () => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 360, height: 740 }]) {
    const { page, contexte } = await ouvrir(nav, serveur.url, { viewport, locale: "fr-FR" });
    await page.goto(`${serveur.url}/`);
    const bouton = page.locator("#ouvrir-dashboard");
    await bouton.waitFor({ state: "visible" });
    assert.equal(await bouton.getAttribute("href"), "dashboard/");
    assert.equal(await bouton.getAttribute("title"), "Mon tableau de bord");
    const voisin = await bouton.evaluate((n) => n.previousElementSibling?.id);
    assert.equal(voisin, "ouvrir-progres");
    await contexte.close();
  }
});

test("tableau de bord : chargé sans violation CSP, cercle et défi fonctionnels, sans débordement mobile", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, `${serveur.url}/dashboard/`, { viewport: { width: 390, height: 844 } });
  await page.goto(`${serveur.url}/dashboard/`);

  await page.locator("#heroAngle").fill("90");
  assert.equal(await page.locator('.lab-pane [data-out="sin"]').textContent(), "1,000");
  assert.equal(await page.locator('.lab-pane [data-out="cos"]').textContent(), "0,000");

  await page.locator("#defiBtn").click();
  await page.locator(".ans").first().click();
  assert.match(await page.locator("#fb").textContent(), /Correct|Pas tout à fait/);

  const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(debord <= 0, `débordement horizontal : ${debord}px`);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
