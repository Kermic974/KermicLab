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
  const ancienneSauvegarde = {
    version: 1,
    tasks: [{ id: "ancienne-tache", title: "Exemple fictif", domain: "Pro", energy: 2, priorities: [],
      steps: [{ id: "ancienne-etape", text: "Ouvrir le dossier", done: "2026-11-24" }], done: "2026-11-24" }],
    days: {}, tomorrows: {}
  };
  await page.locator("#importFile").setInputFiles({ name: "sauvegarde.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(ancienneSauvegarde)) });
  await page.waitForFunction(() => state.tasks.length === 1);
  assert.equal(await page.evaluate(() => totalXP()), 30);
  const invalide = { ...ancienneSauvegarde, days: { '<img src=x onerror="alert(1)">': { win: "", note: "" } } };
  await page.locator("#importFile").setInputFiles({ name: "invalide.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(invalide)) });
  await page.waitForFunction(() => document.getElementById("toast").textContent.includes("non reconnu"));
  assert.equal(await page.evaluate(() => totalXP()), 30);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("Labo adultes : clavier, mobile et absence de débordement", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { viewport: { width: 390, height: 844 } });
  await page.goto(`${serveur.url}/labs/remediation-tdah/`);
  await page.locator("[data-tab=explication]").focus();
  for (const bouton of await page.locator("header nav button").all()) {
    const taille = await bouton.boundingBox();
    assert.ok(taille.width >= 90 && taille.height <= 100, "Navigation mobile lisible, sans mots découpés en colonnes");
  }
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#explication").isVisible(), true);
  for (const tab of ["home", "brain", "sort", "action", "review", "journey", "mise-en-situation", "memo"]) {
    await page.locator(`[data-tab="${tab}"]`).click();
    assert.equal(await page.locator(`#${tab}`).isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Pas de débordement dans ${tab}`);
  }
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("Micro-skills : rebond contextualisé vers les mémos et les notions sans gain de maîtrise fictif", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url);
  await page.goto(`${serveur.url}/labs/remediation-tdah/`);
  await page.locator("[data-tab=brain]").click();
  await page.locator("#title").fill("Un exemple fictif à découper");
  await page.locator("#addForm button").click();
  await page.locator("#inbox [data-open]").click();
  await page.locator("#stepText").fill("Ouvrir le document");
  await page.locator("#stepForm button").click();
  const id = "microskill.transversal.decomposer-une-tache-en-actions-simples";
  const points = await page.evaluate(() => totalXP());
  await page.locator(`[data-retenir="${id}"]`).click();
  assert.equal(await page.locator("#memo").isVisible(), true);
  const carte = page.locator(`[data-competence="${id}"]`);
  assert.match(await carte.textContent(), /Pratiqué aujourd’hui/);
  assert.match(await carte.textContent(), /Une case correspond à une action simple/);
  assert.match(await carte.textContent(), /Trouver l'inconnue intermédiaire/);
  await carte.locator("summary").first().click();
  assert.equal(await carte.locator("code").textContent(), id);
  assert.equal(await page.evaluate(() => totalXP()), points, "Lire un mémo ne valide pas une maîtrise et ne donne pas de points");
  await carte.locator("[data-pratiquer]").click();
  assert.equal(await page.locator("#stepText").isVisible(), true);
  assert.equal(await page.locator("#actionDetails .steps").textContent(), "Ouvrir le document");
  await page.reload();
  assert.equal(await page.locator("#memo").isVisible(), true, "Le lien profond retrouve le repère");
  assert.equal(await page.locator("#filtreMicroSkill").inputValue(), id);
  assert.match(await page.locator(`[data-competence="${id}"]`).textContent(), /Pratiqué aujourd’hui/);
  await contexte.route("**/maquettes/problemes-a-etapes-cm?lang=fr", route => route.fulfill({ contentType: "text/html", body: "<title>Notion liée</title><p>Lecture complète</p>" }));
  const ouverture = page.waitForEvent("popup");
  await page.locator('[data-notion-connexe="problemes-a-etapes-cm"]').click();
  const notion = await ouverture;
  await notion.waitForLoadState();
  assert.equal(new URL(notion.url()).pathname, "/maquettes/problemes-a-etapes-cm");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
