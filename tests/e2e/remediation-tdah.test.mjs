import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { servir, navigateur, ouvrir, racine } from "./outils.mjs";

let serveur, nav;
before(async () => { serveur = await servir(`${racine}dist`); nav = await navigateur(); });
after(async () => { await nav?.close(); await serveur?.fermer(); });

test("Labo adultes : parcours autonome, points uniques, récompenses, effacement et hors ligne", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url);
  page.on("dialog", d => d.accept());
  const requetes = [];
  page.on("request", r => requetes.push(r.url()));
  await page.goto(`${serveur.url}/labs/remediation-tdah/`);
  const meta = JSON.parse(await page.locator("#kermiclab-meta").textContent());
  assert.equal(meta.id, "remediation-tdah");
  assert.deepEqual(meta.onglets.slice(0, 3), ["explication", "application", "mise-en-situation"]);
  assert.equal(await page.locator("#connexion").isVisible(), false);
  await contexte.setOffline(true);
  await page.locator("#dailyEnergy").selectOption("1");
  await page.locator("[data-tab=brain]").click();
  await page.locator("#title").fill("Une démarche fictive");
  await page.locator("#addForm button").click();
  await page.locator("#inbox [data-open]").click();
  await page.locator("#stepText").fill("Ouvrir le dossier");
  await page.locator("#stepForm button").click();
  await page.locator("[data-step]").check();
  const points = await page.evaluate(() => totalXP());
  assert.equal(points, 25);
  await page.locator("[data-step]").uncheck();
  await page.locator("[data-step]").check();
  assert.equal(await page.evaluate(() => totalXP()), points);
  await page.locator("#actionDetails [data-done]").click();
  await page.locator("[data-tab=journey]").click();
  await page.locator("#rewardTitle").fill("Un moment lecture");
  await page.locator("#rewardCost").fill("20");
  await page.locator("#rewardForm button").click();
  await page.locator("[data-claim]").click();
  assert.equal(await page.evaluate(() => balance()), 25);
  await page.locator("[data-tab=mise-en-situation]").click();
  await page.locator("[data-practice=flou]").click();
  assert.match(await page.locator("#practiceFeedback").textContent(), /correspond au repère/);
  await contexte.setOffline(false);
  await page.reload();
  assert.equal(await page.evaluate(() => totalXP()), 45);
  assert.equal(await page.evaluate(() => state.rewards[0].claimed.length), 1);
  assert.equal(requetes.every(url => url === `${serveur.url}/labs/remediation-tdah/`), true);
  await page.locator("#clearLocal").click();
  await page.waitForLoadState("load");
  await page.waitForFunction(() => state.tasks.length === 0);
  assert.equal(await page.evaluate(() => totalXP()), 0);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("Labo adultes : clavier, mobile et absence de débordement", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { viewport: { width: 390, height: 844 } });
  await page.goto(`${serveur.url}/labs/remediation-tdah/`);
  await page.locator("[data-tab=explication]").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#explication").isVisible(), true);
  for (const tab of ["home", "brain", "sort", "action", "review", "journey", "mise-en-situation"]) {
    await page.locator(`[data-tab="${tab}"]`).click();
    assert.equal(await page.locator(`#${tab}`).isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
