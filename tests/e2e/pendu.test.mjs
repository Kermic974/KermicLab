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
    assert.match(await page.locator('[data-sortie="mot-decouvert"]').textContent(), /chat/);
    assert.match(await page.locator('[data-sortie="definition"]').textContent(), /miaule/);
    assert.equal(await page.locator('[data-zone="fiche-mot"]').isVisible(), true);
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

for (const options of [
  { viewport: { width: 1280, height: 900 } },
  { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
]) {
  test(`Mes mots : édition, sauvegarde, correction exacte, bilan et révision (${options.viewport.width}px)`, async () => {
    const serveur = await servir(`${racine}catalogue/pendu`);
    let nav;
    try {
      nav = await navigateur();
      const { page, erreurs } = await ouvrir(nav, serveur.url, options);
      await page.goto(`${serveur.url}/page.html`);
      await page.getByRole("tab", { name: "Mes mots", exact: true }).click();
      const liste = page.getByLabel("Liste de mots à apprendre");
      await liste.fill("école\nchat\ncœur");
      await page.getByRole("button", { name: "Enregistrer la liste", exact: true }).click();
      assert.match(await page.locator('[data-sortie="liste-message"]').textContent(), /3 mot.*enregistré/);
      await page.reload();
      await page.getByRole("tab", { name: "Mes mots", exact: true }).click();
      assert.equal(await liste.inputValue(), "école\nchat\ncœur");
      await page.getByRole("button", { name: "Commencer le test", exact: true }).click();
      assert.equal(await page.locator('[data-sortie="mot-a-retenir"]').textContent(), "école");
      await page.getByRole("button", { name: "Cacher et répondre", exact: true }).click();
      assert.equal(await page.locator('[data-sortie="mot-a-retenir"]').textContent(), "");
      assert.equal(await liste.isVisible(), false, "la liste n’est pas montrée pendant la réponse");
      const reponse = page.getByLabel("Écris le mot de mémoire");
      assert.equal(await reponse.getAttribute("autocorrect"), "off");
      assert.equal(await reponse.getAttribute("spellcheck"), "false");
      await reponse.fill("ecole");
      await reponse.press("Enter");
      assert.match(await page.locator('[data-sortie="correction-mot"]').textContent(), /À retravailler : école/);
      await page.getByRole("button", { name: "Mot suivant", exact: true }).click();
      await page.getByRole("button", { name: "Cacher et répondre", exact: true }).click();
      await reponse.fill("CHAT");
      await page.getByRole("button", { name: "Vérifier le mot", exact: true }).click();
      assert.match(await page.locator('[data-sortie="correction-mot"]').textContent(), /Bien écrit/);
      await page.getByRole("button", { name: "Mot suivant", exact: true }).click();
      await page.getByRole("button", { name: "Cacher et répondre", exact: true }).click();
      await page.getByRole("button", { name: "Je ne sais pas", exact: true }).click();
      await page.getByRole("button", { name: "Voir mon bilan", exact: true }).click();
      assert.match(await page.locator('[data-sortie="bilan-mots"]').textContent(), /1 \/ 3/);
      assert.equal(await page.locator(".bilan-mots li").count(), 3);
      await page.getByRole("button", { name: "Revoir les mots à retravailler", exact: true }).click();
      assert.match(await page.locator('[data-sortie="avancement-mots"]').textContent(), /1 sur 2/);
      for (const [i, mot] of ["école", "cœur"].entries()) {
        await page.getByRole("button", { name: "Cacher et répondre", exact: true }).click();
        await reponse.fill(mot);
        await reponse.press("Enter");
        await page.getByRole("button", { name: i === 0 ? "Mot suivant" : "Voir mon bilan", exact: true }).click();
      }
      assert.match(await page.locator('[data-sortie="bilan-mots"]').textContent(), /2 \/ 2/);
      assert.equal(await page.getByRole("button", { name: "Revoir les mots à retravailler", exact: true }).isVisible(), false);
      const sauvegardes = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("kermiclab:pendu")).map((k) => [k, localStorage.getItem(k)]));
      assert.deepEqual(sauvegardes, [["kermiclab:pendu:mots", JSON.stringify("école\nchat\ncœur")]], "seule la liste est persistée, pas les réponses");
      assert.equal(await page.locator('#panneau-application [data-sortie="erreurs"]').textContent(), "Erreurs : 0 / 6", "la saisie n’agit pas sur le pendu");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
      await page.getByRole("button", { name: "Modifier la liste", exact: true }).click();
      await page.getByRole("button", { name: "Effacer la liste enregistrée", exact: true }).click();
      await page.reload();
      await page.getByRole("tab", { name: "Mes mots", exact: true }).click();
      assert.equal(await liste.inputValue(), "");
      assert.deepEqual(erreurs, []);
    } finally {
      await nav?.close();
      await serveur.fermer();
    }
  });
}

test("Mes mots : charger chacun des cinq niveaux et refuser les listes invalides", async () => {
  const serveur = await servir(`${racine}catalogue/pendu`);
  let nav;
  try {
    nav = await navigateur();
    const { page, erreurs } = await ouvrir(nav, serveur.url);
    await page.goto(`${serveur.url}/page.html`);
    await page.getByRole("tab", { name: "Mes mots", exact: true }).click();
    const liste = page.getByLabel("Liste de mots à apprendre");
    for (const niveau of ["noob", "debutant", "intermediaire", "expert", "pro"]) {
      await page.getByLabel("Liste du dictionnaire").selectOption(niveau);
      await page.getByRole("button", { name: "Remplacer la liste par les 100 mots de ce niveau", exact: true }).click();
      const mots = (await liste.inputValue()).split("\n");
      assert.equal(mots.length, 100, niveau);
      assert.equal(new Set(mots).size, 100, niveau);
    }
    for (const [valeur, erreur] of [["", /1 à 100/], ["chat\nCHAT", /déjà/], ["<img src=x>", /Ligne 1/], ["a".repeat(41), /40 caractères/]]) {
      await liste.fill(valeur);
      await page.getByRole("button", { name: "Commencer le test", exact: true }).click();
      assert.match(await page.locator('[data-sortie="liste-message"]').textContent(), erreur);
      assert.equal(await page.locator('[data-zone="test-mots"]').isVisible(), false);
    }
    assert.equal(await page.locator("img").count(), 0, "une saisie HTML n’est jamais interprétée");
    assert.deepEqual(erreurs, []);
  } finally {
    await nav?.close();
    await serveur.fermer();
  }
});

test("Mes mots : stockage indisponible ou corrompu signalé, test toujours utilisable en mémoire", async () => {
  const serveur = await servir(`${racine}catalogue/pendu`);
  let nav;
  try {
    nav = await navigateur();
    const { page, erreurs } = await ouvrir(nav, serveur.url);
    await page.goto(`${serveur.url}/page.html`);
    await page.evaluate(() => localStorage.setItem("kermiclab:pendu:mots", '"123"'));
    await page.reload();
    await page.getByRole("tab", { name: "Mes mots", exact: true }).click();
    assert.match(await page.locator('[data-sortie="liste-message"]').textContent(), /invalide/);
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Accès refusé", "SecurityError"); } });
    });
    await page.reload();
    assert.match(await page.locator("#stockage-avertissement").textContent(), /indisponible/);
    await page.getByRole("tab", { name: "Mes mots", exact: true }).click();
    await page.getByLabel("Liste de mots à apprendre").fill("chat");
    await page.getByRole("button", { name: "Enregistrer la liste", exact: true }).click();
    assert.match(await page.locator('[data-sortie="liste-message"]').textContent(), /impossible/);
    await page.getByRole("button", { name: "Commencer le test", exact: true }).click();
    await page.getByRole("button", { name: "Cacher et répondre", exact: true }).click();
    await page.getByLabel("Écris le mot de mémoire").fill("chat");
    await page.getByRole("button", { name: "Vérifier le mot", exact: true }).click();
    await page.getByRole("button", { name: "Voir mon bilan", exact: true }).click();
    assert.match(await page.locator('[data-sortie="bilan-mots"]').textContent(), /1 \/ 1/);
    assert.deepEqual(erreurs, []);
  } finally {
    await nav?.close();
    await serveur.fermer();
  }
});

test("Mes mots : une liste enregistrée reste lisible et effaçable si le quota est déjà atteint", async () => {
  const serveur = await servir(`${racine}catalogue/pendu`);
  let nav;
  try {
    nav = await navigateur();
    const { page, erreurs } = await ouvrir(nav, serveur.url);
    await page.addInitScript(() => {
      if (!location.hostname) return;
      const setItem = Storage.prototype.setItem;
      setItem.call(localStorage, "kermiclab:pendu:mots", JSON.stringify("chat\nécole"));
      Storage.prototype.setItem = function (cle, valeur) {
        if (cle === "kermiclab:test") throw new DOMException("Quota dépassé", "QuotaExceededError");
        return setItem.call(this, cle, valeur);
      };
    });
    await page.goto(`${serveur.url}/page.html`);
    assert.match(await page.locator("#stockage-avertissement").textContent(), /stockage local est saturé/);
    await page.getByRole("tab", { name: "Mes mots", exact: true }).click();
    const liste = page.getByLabel("Liste de mots à apprendre");
    assert.equal(await liste.inputValue(), "chat\nécole");
    await page.getByRole("button", { name: "Effacer la liste enregistrée", exact: true }).click();
    assert.equal(await page.locator('[data-sortie="liste-message"]').textContent(), "Liste enregistrée effacée.");
    assert.equal(await liste.inputValue(), "");
    assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:pendu:mots")), null);
    assert.deepEqual(erreurs, []);
  } finally {
    await nav?.close();
    await serveur.fermer();
  }
});

test("Pendu : accents visibles, nouveau mot différent et correction après une défaite", async () => {
  const serveur = await servir(`${racine}catalogue/pendu`);
  let nav;
  try {
    nav = await navigateur();
    const { page, erreurs } = await ouvrir(nav, serveur.url);
    await page.addInitScript(() => { Math.random = () => 0.39; });
    await page.goto(`${serveur.url}/page.html`);
    await page.getByRole("button", { name: "Choisir E", exact: true }).click();
    assert.equal(await page.locator(".lettre-mot").nth(1).textContent(), "É");
    for (const lettre of "VLO") await page.getByRole("button", { name: `Choisir ${lettre}`, exact: true }).click();
    assert.match(await page.locator('[data-sortie="mot-decouvert"]').textContent(), /vélo/);
    await page.getByRole("button", { name: "Nouveau mot", exact: true }).click();
    await page.getByRole("button", { name: "💡 Indice", exact: true }).click();
    assert.match(await page.locator('[data-sortie="message"]').textContent(), /véhicule à moteur/);
    for (const lettre of "XWQYZF") await page.getByRole("button", { name: `Choisir ${lettre}`, exact: true }).click();
    assert.match(await page.locator('[data-sortie="message"]').textContent(), /Perdu/);
    assert.match(await page.locator('[data-sortie="mot-decouvert"]').textContent(), /moto/);
    assert.equal(await page.locator('[data-zone="fiche-mot"]').isVisible(), true);
    assert.deepEqual(erreurs, []);
  } finally {
    await nav?.close();
    await serveur.fermer();
  }
});

test("Mes mots : une erreur d’écriture locale ne ressemble jamais à un enregistrement réussi", async () => {
  const serveur = await servir(`${racine}catalogue/pendu`);
  let nav;
  try {
    nav = await navigateur();
    const { page, erreurs } = await ouvrir(nav, serveur.url);
    await page.goto(`${serveur.url}/page.html`);
    await page.getByRole("tab", { name: "Mes mots", exact: true }).click();
    await page.getByLabel("Liste de mots à apprendre").fill("chat");
    await page.evaluate(() => {
      Storage.prototype.setItem = () => { throw new DOMException("Quota dépassé", "QuotaExceededError"); };
    });
    await page.getByRole("button", { name: "Enregistrer la liste", exact: true }).click();
    assert.match(await page.locator('[data-sortie="liste-message"]').textContent(), /impossible/);
    assert.match(await page.locator("#stockage-avertissement").textContent(), /impossible/);
    assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:pendu:mots")), null);
    assert.deepEqual(erreurs, []);
  } finally {
    await nav?.close();
    await serveur.fermer();
  }
});
