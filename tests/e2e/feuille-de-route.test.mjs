import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { servir, navigateur, ouvrir, racine } from "./outils.mjs";

let serveur, nav;
before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

test("roadmap : acquis sourcés, pendu non livré et navigation complète sans JavaScript", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, {
    javaScriptEnabled: false, viewport: { width: 1280, height: 900 }
  });
  await page.goto(`${serveur.url}/feuille-de-route.html`);
  assert.match(await page.locator(".fr-surtitre").textContent(), /version 3/);
  assert.equal(await page.locator(".fr-chiffres dd").first().textContent(), "8");
  assert.ok(await page.locator("#synthese > p:not(.fr-encadre)").evaluate((element) =>
    element.clientWidth <= Number.parseFloat(getComputedStyle(element).maxWidth)), "paragraphes limités à une largeur confortable");
  assert.ok(await page.locator(".fr-gantt tbody td").first().evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize) >= 14), "texte du Gantt lisible sans zoom");
  assert.match(await page.locator("#livraisons").textContent(), /PR ouverte · non livrée/);
  for (const numero of [80, 81, 82, 83, 84, 86, 88, 90, 92, 94, 95, 96, 97, 98, 99, 100]) {
    assert.equal(await page.locator(`#livraisons a[href="https://github.com/Kermic974/trigoLab/pull/${numero}"]`).count(), 1);
  }
  const ancres = await page.locator('a[href^="#"]').evaluateAll((liens) =>
    liens.map((lien) => lien.getAttribute("href").slice(1)));
  for (const id of ancres) assert.equal(await page.locator(`[id="${id}"]`).count(), 1, `ancre valide : ${id}`);
  assert.equal(await page.locator(".fr-gantt tbody tr").count(), 8);
  assert.ok(await page.locator(".fr-gantt").evaluate((element) => element.scrollWidth <= element.clientWidth),
    "Gantt entièrement visible sur ordinateur");
  assert.equal(await page.locator(".fr-flux li").count(), 4);
  const phase = page.locator("#phase-2 details");
  await phase.locator("summary").click();
  assert.equal(await phase.getAttribute("open"), null);
  await phase.locator("summary").focus();
  await page.keyboard.press("Enter");
  assert.notEqual(await phase.getAttribute("open"), null);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

for (const colorScheme of ["light", "dark"]) {
  test(`roadmap mobile ${colorScheme} : Gantt défilant, aucun débordement de page`, async () => {
    const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, {
      viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, colorScheme
    });
    await page.goto(`${serveur.url}/feuille-de-route.html`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "pas de débordement global");
    const gantt = page.getByRole("region", { name: "Gantt des chantiers, défilement horizontal" });
    assert.ok(await gantt.evaluate((element) => element.scrollWidth > element.clientWidth), "tableau défilant dans son cadre");
    await gantt.focus();
    assert.equal(await gantt.evaluate((element) => element === document.activeElement), true);
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector(".fr-gantt").scrollLeft > 0);
    assert.equal(await page.locator(".fr-flux").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length), 1);
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });
}
