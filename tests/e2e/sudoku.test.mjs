import { test } from "node:test";
import assert from "node:assert/strict";
import { ouvrir, navigateur, racine, servir } from "./outils.mjs";

test("Sudoku : grille accessible, progression, indice et affichage mobile", async () => {
  const serveur = await servir(`${racine}catalogue/sudoku`);
  const nav = await navigateur();
  try {
    const { page, erreurs } = await ouvrir(nav, serveur.url, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.goto(`${serveur.url}/page.html`);
    await page.getByRole("grid", { name: "Grille de Sudoku" }).waitFor();
    assert.equal(await page.locator(".case").count(), 81);
    assert.equal(await page.getByRole("tab", { name: "Jouer" }).getAttribute("aria-selected"), "true");
    await page.getByRole("tab", { name: "Académie" }).click();
    assert.match(await page.locator('[data-sortie="progression"]').textContent(), /1 \/ 5/);
    assert.equal(await page.locator(".grade button:disabled").count(), 4);
    await page.getByRole("tab", { name: "Jouer" }).click();
    await page.getByRole("button", { name: "💡 Indice" }).click();
    assert.match(await page.locator('[data-sortie="message"]').textContent(), /Indice/);
    for (let i = 0; i < 81 && !(await page.locator('[data-sortie="message"]').textContent()).includes("Grille résolue"); i++) {
      await page.getByRole("button", { name: "💡 Indice" }).click();
    }
    assert.match(await page.locator('[data-sortie="message"]').textContent(), /Grille résolue/);
    await page.getByRole("tab", { name: "Académie" }).click();
    assert.match(await page.locator('[data-sortie="progression"]').textContent(), /2 \/ 5/);
    assert.equal(await page.locator(".grade button:disabled").count(), 3);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "pas de débordement horizontal");
    assert.deepEqual(erreurs, []);
  } finally {
    await nav.close();
    await serveur.fermer();
  }
});
