import { test } from "node:test";
import assert from "node:assert/strict";
import { ouvrir, navigateur, racine, servir } from "./outils.mjs";

test("Le pendu : clavier, victoire, progression de l'Académie et rendu mobile", async () => {
  const serveur = await servir(`${racine}catalogue/pendu`);
  const nav = await navigateur();
  try {
    const { page, erreurs } = await ouvrir(nav, serveur.url, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.addInitScript(() => { Math.random = () => 0; });
    await page.goto(`${serveur.url}/page.html`);
    await page.getByRole("tab", { name: "Jouer" }).waitFor();
    assert.equal(await page.getByRole("tab", { name: "Jouer" }).getAttribute("aria-selected"), "true");
    assert.equal(await page.locator(".niveau:disabled").count(), 4);
    await page.keyboard.press("C");
    await page.keyboard.press("H");
    await page.keyboard.press("A");
    await page.keyboard.press("T");
    assert.match(await page.locator('[data-sortie="message"]').textContent(), /Mot trouvé/);
    assert.equal(await page.locator(".niveau:disabled").count(), 3);
    await page.getByRole("tab", { name: "Académie" }).click();
    assert.match(await page.locator('[data-sortie="stats"]').textContent(), /Grades : 0 \/ 5/);
    assert.equal(await page.locator(".parcours [data-grade]").count(), 5);
    await page.getByRole("button", { name: /Le mot caché/ }).click();
    await page.getByRole("button", { name: /4$/ }).click();
    assert.match(await page.locator('[data-sortie="retour"]').textContent(), /Parfait/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "pas de débordement horizontal");
    assert.deepEqual(erreurs, []);
  } finally {
    await nav.close();
    await serveur.fermer();
  }
});
