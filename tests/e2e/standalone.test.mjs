import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { servir, navigateur, ouvrir, racine } from "./outils.mjs";

let serveur, nav;
before(async () => { serveur = await servir(racine); nav = await navigateur(); });
after(async () => { await nav?.close(); await serveur?.fermer(); });

test("application autonome : contrôles, défi et rendu mobile", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, `${serveur.url}/index.html`, {
    viewport: { width: 360, height: 740 },
    isMobile: true
  });
  await page.goto(`${serveur.url}/index.html`);

  const cosInitial = Number((await page.locator("#cos").textContent()).replace(",", "."));
  assert.ok(Math.abs(cosInitial - Math.SQRT1_2) < 0.00001);
  await page.locator("#input").fill("90");
  await page.locator("#apply").click();
  assert.equal(await page.locator("#cos").textContent(), "0");
  assert.equal(await page.locator("#sin").textContent(), "1");
  assert.equal(await page.locator("#tan").textContent(), "non définie");

  await page.locator('[data-tab="play"]').click();
  await page.locator('[data-game="quiz"]').click();
  assert.notEqual(await page.locator("#gPrompt").textContent(), "");
  await page.locator("#gOptions button").first().click();
  assert.notEqual(await page.locator("#gFeedback").textContent(), "");

  const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(debord <= 0, `débordement horizontal de ${debord}px`);
  assert.deepEqual(erreurs, [], "aucune erreur console ou JavaScript");
  await contexte.close();
});

test("application autonome : les liens du parcours ouvrent le mode demandé", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, `${serveur.url}/index.html?mode=explore`);
  for (const mode of ["explore", "learn", "play"]) {
    await page.goto(`${serveur.url}/index.html?mode=${mode}`);
    await page.waitForFunction(() => document.querySelector("#status")?.textContent.startsWith("Prêt"));
    assert.equal(await page.locator(`[data-tab="${mode}"]`).getAttribute("aria-selected"), "true");
    assert.ok(await page.locator(`[data-mode~="${mode}"]:not(.hidden)`).count() > 0, `le mode ${mode} est visible`);
  }
  assert.deepEqual(erreurs, [], "aucune erreur console ou JavaScript");
  await contexte.close();
});
