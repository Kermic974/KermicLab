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

test("Labo adultes : les suggestions ouvrent et modifient les tâches hors ligne", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { viewport: { width: 390, height: 844 } });
  await page.goto(`${serveur.url}/labs/remediation-tdah/`);
  await contexte.setOffline(true);
  await page.locator("#dailyEnergy").selectOption("2");
  await page.locator("[data-tab=brain]").click();
  await page.locator("#title").fill("Préparer le dossier");
  await page.locator("#addForm button").click();
  const sauvegarde = () => page.evaluate(() => localStorage.getItem("petits-pas-v1"));
  const avant = await sauvegarde();

  await page.locator("#brain [data-plan]").click();
  const proposition = page.locator("#localPlanResults .task");
  assert.match(await proposition.innerText(), /Préparer le dossier/);
  assert.equal(await sauvegarde(), avant);
  await proposition.getByRole("button", { name: "Modifier la tâche" }).click();
  await page.locator("#taskEditTitle").fill("Tâche non enregistrée");
  await page.keyboard.press("Escape");
  assert.equal(await sauvegarde(), avant);
  await proposition.getByRole("button", { name: "Modifier la tâche" }).click();
  await page.locator("#taskEditTitle").fill("Préparer le dossier demain");
  await page.locator("#taskEditEnergy").selectOption("1");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  assert.match(await proposition.innerText(), /Préparer le dossier demain/);

  await proposition.getByRole("button", { name: "Choisir cette priorité" }).click();
  assert.equal(await page.locator("#priorityCount").innerText(), "1 / 3");
  await proposition.getByRole("button", { name: "Travailler sur la tâche" }).click();
  assert.equal(await page.locator("#stepText").evaluate(element => element === document.activeElement), true);
  await page.locator("#stepText").fill("Ouvrir le dossier");
  await page.locator("#stepForm button").click();
  await page.locator("[data-tab=home]").click();
  await page.locator("#localPlan").click();
  assert.match(await proposition.innerText(), /Prochaine mini-étape : Ouvrir le dossier/);
  await proposition.getByRole("button", { name: "Essayer cinq minutes" }).click();
  assert.equal(await page.locator("#startTimer").innerText(), "Mettre en pause");
  await contexte.setOffline(false);
  await page.reload();
  assert.match(await page.locator("#priorities").innerText(), /Préparer le dossier demain/);
  await page.locator("#priorities [data-priority]").click();
  assert.equal(await page.locator("#priorityCount").innerText(), "0 / 3");
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
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Pas de débordement dans ${tab}`);
  }
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("Labo adultes : cibles tactiles et navigation responsive", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url);
  await page.goto(`${serveur.url}/labs/remediation-tdah/`);
  for (const width of [320, 375, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const tab of ["home", "brain", "sort", "action", "review", "journey", "explication", "mise-en-situation"]) {
      const bouton = page.locator(`[data-tab="${tab}"]`);
      await bouton.click();
      assert.equal(await bouton.getAttribute("aria-current"), "page");
      assert.equal(await page.locator(`#${tab}`).isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px : ${tab}`);
      const taille = await bouton.boundingBox();
      assert.ok(taille.height >= 48 && taille.width >= 44, `Cible tactile ${tab} à ${width}px`);
      assert.ok(taille.height <= 80, `Libellé compact ${tab} à ${width}px`);
    }
  }
  await page.locator("[data-tab=brain]").click();
  assert.ok((await page.locator("#title").boundingBox()).height >= 48);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.matches(":focus-visible")), true);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("Labo adultes : décharge validée, petit pas et reprise issus des données locales", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { viewport: { width: 375, height: 820 } });
  try {
    await page.goto(`${serveur.url}/labs/remediation-tdah/`);
    await contexte.setOffline(true);
    await page.locator("[data-tab=brain]").click();
    await page.locator("#dechargeTexte").fill("Préparer le dossier\nIdée : faire un classeur\nPréparer le dossier");
    await page.getByRole("button", { name: "Préparer le tri" }).click();
    assert.equal(await page.evaluate(() => state.tasks.length), 0);
    assert.equal(await page.locator("#dechargeLignes [data-garder]").last().isChecked(), false);
    await page.locator("#dechargeLignes [data-texte]").first().fill("Préparer le dossier KermicLab");
    await page.getByRole("button", { name: "Enregistrer la sélection" }).click();
    assert.equal(await page.evaluate(() => state.tasks.length), 1);
    assert.match(await page.locator("#pochetteNotes").innerText(), /faire un classeur/);
    await page.locator("[data-tab=home]").click();
    await page.locator("#dailyEnergy").selectOption("1");
    await page.locator("#tempsDisponible").selectOption("2");
    await page.locator("#suggestTask").click();
    assert.match(await page.locator("#pasSuggestion").innerText(), /Aucune tâche/);
    await page.locator("#dailyEnergy").selectOption("2");
    assert.match(await page.locator("#pasSuggestion").innerText(), /dossier KermicLab.*2 min/);
    await page.locator("#ouvrirPetitPas").click();
    assert.equal(await page.locator("#clock").innerText(), "02:00");
    await page.locator("#stepText").fill("Ouvrir la pochette");
    await page.locator("#stepForm button").click();
    await page.locator("#blocageRapide").click();
    await page.locator("#feeling").selectOption("flou");
    assert.match(await page.locator("#advice").innerText(), /première ligne/);
    await page.locator("#pauseReprise").click();
    assert.match(await page.locator("#repriseTexte").innerText(), /Ouvrir la pochette/);
    await contexte.setOffline(false);
    await page.reload();
    assert.match(await page.locator("#repriseTexte").innerText(), /Ouvrir la pochette/);
    await page.locator("#repriseOuvrir").click();
    assert.match(await page.locator("#focusName").innerText(), /dossier KermicLab/);
    await page.locator("[data-tab=home]").click();
    await page.locator("#repriseOublier").click();
    await page.reload();
    assert.equal(await page.locator("#repriseLocale").isVisible(), false);
    assert.deepEqual(erreurs, []);
  } finally {
    await contexte.close();
  }
});

test("Labo adultes : les neuf espaces sont accessibles sans JavaScript", async () => {
  const contexte = await nav.newContext({ javaScriptEnabled: false });
  try {
    const page = await contexte.newPage();
    await page.goto(`${serveur.url}/labs/remediation-tdah/`);
    const liens = page.getByRole("navigation", { name: "Navigation sans JavaScript" }).getByRole("link");
    assert.equal(await liens.count(), 9);
    for (const lien of await liens.all()) {
      const ancre = await lien.getAttribute("href");
      assert.equal(await page.locator(ancre).isVisible(), true, ancre);
    }
  } finally {
    await contexte.close();
  }
});

test("Labo adultes : les repères embarqués proviennent des notions publiques", async () => {
  const contexte = await nav.newContext();
  try {
    const page = await contexte.newPage();
    await page.goto(`${serveur.url}/labs/remediation-tdah/`);
    await contexte.setOffline(true);
    await page.locator("[data-tab=explication]").click();
    assert.match(await page.locator('[data-notion="problemes-a-etapes-cm"]').innerText(), /inconnue intermédiaire/);
    assert.match(await page.locator('[data-notion="algorithmes-programmation-cm"]').innerText(), /ordre des instructions/);
  } finally {
    await contexte.close();
  }
});
