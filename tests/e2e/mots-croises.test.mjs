import { test } from "node:test";
import assert from "node:assert/strict";
import { ouvrir, navigateur, racine, servir } from "./outils.mjs";

test("Mots croisés : remplir une grille, débloquer un grade et jouer sur mobile", async () => {
  const serveur = await servir(`${racine}catalogue/mots-croises`);
  const nav = await navigateur();
  try {
    const { page, erreurs } = await ouvrir(nav, serveur.url, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.goto(`${serveur.url}/page.html`);
    await page.getByRole("grid", { name: "Grille de mots croisés" }).waitFor();
    assert.equal(await page.getByRole("tab", { name: "Jouer" }).getAttribute("aria-selected"), "true");
    assert.ok(await page.locator('[data-zone="definitions"] .clue').count() >= 5);

    await page.getByRole("button", { name: "Contour ou aspect géométrique d'un objet." }).click();
    await page.keyboard.type("FORME");
    for (const [definition, mot] of [
      ["Un des côtés plats d'un solide.", "FACE"],
      ["Figure fermée formée de plusieurs segments.", "POLYGONE"],
      ["Segment qui relie le centre d'un cercle à son bord.", "RAYON"],
      ["Point où se rejoignent deux côtés d'un polygone.", "SOMMET"],
      ["Longueur totale du contour d'une figure.", "PERIMETRE"]
    ]) {
      await page.getByRole("button", { name: definition }).click();
      await page.keyboard.type(mot);
    }
    assert.match(await page.locator('[data-sortie="message"]').textContent(), /Grille résolue/);
    await page.getByRole("tab", { name: "Académie" }).click();
    assert.match(await page.locator('[data-sortie="progression"]').textContent(), /1 \/ 5 grilles résolues/);
    assert.equal(await page.locator(".grade button:disabled").count(), 3);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "pas de débordement horizontal");
    assert.deepEqual(erreurs, []);
  } finally {
    await nav.close();
    await serveur.fermer();
  }
});
