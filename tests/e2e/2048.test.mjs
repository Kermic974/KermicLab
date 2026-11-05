import { test } from "node:test";
import assert from "node:assert/strict";
import { ouvrir, navigateur, racine, servir } from "./outils.mjs";

test("2048 : commandes, Académie de Noob à Pro et affichage mobile", async () => {
  let serveur, nav;
  try {
    serveur = await servir(`${racine}catalogue/2048`);
    nav = await navigateur();
    const { page, erreurs } = await ouvrir(nav, serveur.url, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.goto(`${serveur.url}/page.html`);
    await page.getByRole("grid", { name: "Plateau de 2048" }).waitFor();
    assert.equal(await page.locator(".tuile").count(), 16);
    assert.equal(await page.locator(".tuile:not([data-valeur=''])").count(), 2);
    assert.equal(await page.getByRole("tab", { name: "Jouer" }).getAttribute("aria-selected"), "true");
    await page.getByRole("tab", { name: "Académie" }).click();
    assert.match(await page.locator('[data-sortie="progression"]').textContent(), /1 \/ 5/);
    assert.equal(await page.locator(".grade button:disabled").count(), 4);
    await page.getByRole("tab", { name: "Jouer" }).click();
    for (let tour = 0; tour < 5 && Number(await page.locator('[data-sortie="score"]').textContent()) === 0; tour++) {
      for (const direction of ["left", "up", "right", "down"]) {
        await page.getByRole("button", { name: `Déplacer vers ${direction === "up" ? "le haut" : direction === "down" ? "le bas" : direction === "left" ? "la gauche" : "la droite"}` }).click();
        if (Number(await page.locator('[data-sortie="score"]').textContent()) > 0) break;
      }
    }
    assert.ok(Number(await page.locator('[data-sortie="score"]').textContent()) > 0, "une fusion rapporte des points");
    await page.getByRole("button", { name: "Nouvelle partie" }).click();
    assert.equal(await page.locator('[data-sortie="score"]').textContent(), "0");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "pas de débordement horizontal");
    assert.deepEqual(erreurs, []);
  } finally {
    await nav?.close();
    await serveur?.fermer();
  }
});
