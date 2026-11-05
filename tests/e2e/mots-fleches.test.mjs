import { test } from "node:test";
import assert from "node:assert/strict";
import { ouvrir, navigateur, racine, servir } from "./outils.mjs";

test("Mots fléchés : clavier, indices, déblocage de l'Académie et rendu mobile", async () => {
  let serveur, nav;
  try {
    serveur = await servir(`${racine}catalogue/mots-fleches`);
    nav = await navigateur();
    const { page, erreurs } = await ouvrir(nav, serveur.url, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.goto(`${serveur.url}/page.html`);
    await page.getByRole("grid", { name: "Grille de mots fléchés" }).waitFor();
    assert.equal(await page.locator(".case").count(), 5);
    assert.equal(await page.getByRole("tab", { name: "Jouer" }).getAttribute("aria-selected"), "true");
    await page.getByRole("button", { name: /Paroles prononcées ou écrites/ }).click();
    const premiere = page.locator(".case.selection");
    const index = await premiere.getAttribute("data-index");
    await page.keyboard.press("M");
    assert.equal(await page.locator(`.case[data-index="${index}"]`).textContent(), "M");
    const suivante = await page.locator(".case.selection").getAttribute("data-index");
    await page.getByRole("button", { name: "Choisir O" }).click();
    assert.equal(await page.locator(`.case[data-index="${suivante}"]`).textContent(), "O");
    for (let i = 0; i < 10 && !(await page.locator('[data-sortie="message"]').textContent()).includes("Grille résolue"); i++) {
      await page.getByRole("button", { name: "💡 Indice" }).click();
    }
    assert.match(await page.locator('[data-sortie="message"]').textContent(), /Grille résolue/);
    assert.equal(await page.locator(".niveau:disabled").count(), 3);
    await page.getByRole("tab", { name: "Académie" }).click();
    assert.match(await page.locator('[data-sortie="stats"]').textContent(), /Grades : 0 \/ 5/);
    assert.equal(await page.locator(".parcours [data-grade]").count(), 5);
    await page.getByRole("button", { name: /Observer l’indice/ }).click();
    await page.getByRole("button", { name: "MOT", exact: true }).click();
    assert.match(await page.locator('[data-sortie="retour"]').textContent(), /Parfait/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "pas de débordement horizontal");
    assert.deepEqual(erreurs, []);
  } finally {
    await nav?.close();
    await serveur?.fermer();
  }
});
