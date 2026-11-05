import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { servir, navigateur, racine, ouvrir } from "./outils.mjs";

let serveur, nav;
before(async () => { serveur = await servir(racine); nav = await navigateur(); });
after(async () => { await nav?.close(); await serveur?.fermer(); });

test("Texas Hold'em : jouer une manche et afficher les deux mains à l'abattage", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, `${serveur.url}/catalogue/poker-texas-holdem/page.html`);
  const requetes = [];
  page.on("request", (requete) => requetes.push(requete.url()));
  await page.goto(`${serveur.url}/catalogue/poker-texas-holdem/page.html`);
  assert.deepEqual(erreurs, [], "aucune erreur au chargement");
  assert.equal(await page.locator('[data-sortie="main-joueur"] .carte-jeu').count(), 2);
  assert.equal(await page.locator('[data-sortie="main-ordi"] .cachee').count(), 2);
  for (const action of ["suivre", "parole", "parole", "parole"]) {
    const bouton = page.locator('[data-zone="actions"] [data-action="suivre"], [data-zone="actions"] [data-action="parole"]');
    await bouton.click();
  }
  const etat = await page.evaluate(() => {
    const { phase, statut, message, pot } = window.kermiclab.poker.etat();
    return { phase, statut, message, pot };
  });
  assert.equal(etat.statut, "terminee", JSON.stringify(etat));
  assert.equal(await page.locator('[data-action="nouvelle"]').isVisible(), true, "la manche suivante apparaît");
  assert.equal(await page.locator('[data-sortie="communes"] .carte-jeu').count(), 5);
  assert.equal(await page.locator('[data-sortie="main-ordi"] .cachee').count(), 0);
  assert.deepEqual(requetes, [`${serveur.url}/catalogue/poker-texas-holdem/page.html`]);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("Texas Hold'em : règles, défi et affichage mobile sans débordement horizontal", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, `${serveur.url}/catalogue/poker-texas-holdem/page.html`, {
    viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true
  });
  await page.goto(`${serveur.url}/catalogue/poker-texas-holdem/page.html`);
  assert.deepEqual(erreurs, [], "aucune erreur au chargement mobile");
  const debord = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  for (const id of ["explication", "mise-en-situation"]) {
    await page.click(`#onglet-${id}`);
    assert.ok(await debord() <= 0, `${id} déborde de ${await debord()}px`);
  }
  await page.locator('[data-reponse="a"]').tap();
  assert.match(await page.locator('[data-sortie="reponse-defi"]').textContent(), /brelan de rois/);
  await page.locator('[data-reponse="b"]').tap();
  assert.match(await page.locator('[data-sortie="reponse-defi"]').textContent(), /^Bravo/);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
