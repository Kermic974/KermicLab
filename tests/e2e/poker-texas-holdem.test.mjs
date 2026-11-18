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
  assert.equal(await page.locator('[data-sortie="communes"] .emplacement').count(), 5);
  assert.match(await page.locator('[data-sortie="cout-action"]').textContent(), /ajouter 10 jetons/);
  await page.locator('#panneau-application [data-action="conseil"]').click();
  assert.match(await page.locator('[data-sortie="conseil-jeu"]').textContent(), /cartes adverses sont inconnues/);
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
  assert.equal(await page.locator('[data-sortie="communes"] .carte-jeu:not(.emplacement)').count(), 5);
  assert.equal(await page.locator('[data-sortie="main-ordi"] .cachee').count(), 0);
  assert.equal(await page.locator('[data-sortie="meilleures-mains"] .carte-jeu').count(), 10);
  assert.ok(await page.locator('[data-sortie="historique"] li').count() >= 5);
  const pratique = await page.evaluate(() => window.kermiclab.academie.etat());
  assert.equal(pratique.compteurs.manches, 1);
  assert.equal(pratique.compteurs.abattages, 1);
  assert.match(await page.locator('[data-sortie="recompense"]').textContent(), /\+\d+ XP/);
  for (const id of ["academie", "application", "academie", "application"]) await page.click(`#onglet-${id}`);
  assert.equal(await page.evaluate(() => window.kermiclab.academie.etat().xp), pratique.xp, "revoir la table ne redonne pas d'XP");
  await page.locator('[data-action="nouvelle"]').click();
  assert.equal(await page.locator('[data-sortie="communes"] .emplacement').count(), 5);
  assert.equal(await page.locator('[data-sortie="numero"]').textContent(), "2");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.bouton), "suivre");
  assert.deepEqual(requetes, [`${serveur.url}/catalogue/poker-texas-holdem/page.html`]);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("Texas Hold'em : leçons, erreurs, indices, étoiles, mémorisation et effacement", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, `${serveur.url}/catalogue/poker-texas-holdem/page.html`);
  try {
    await page.goto(`${serveur.url}/catalogue/poker-texas-holdem/page.html`);
    await page.click("#onglet-academie");
    const panneau = page.locator("#panneau-academie");
    await panneau.locator('[data-lecon="cinq-cartes"]').click();
    await panneau.locator('[data-choix="1"]').click();
    await panneau.locator('[data-action="suivant"]').click();
    await panneau.locator('[data-choix="2"]').click();
    await panneau.locator('[data-action="suivant"]').click();
    assert.equal(await page.evaluate(() => window.kermiclab.academie.etat().lecons["cinq-cartes"].etoiles), 3);
    await page.reload();
    assert.equal(await page.evaluate(() => window.kermiclab.academie.etat().lecons["cinq-cartes"].etoiles), 3, "la leçon est conservée");
    await panneau.locator('[data-action="detail"]').click();
    await panneau.locator('input[name="libre"]').check();
    await panneau.locator('[data-vue="detail"] [data-action="retour"]').click();
    await panneau.locator('[data-lecon="full"]').click();
    assert.match(await panneau.locator(".consigne").textContent(), /Qui gagne/);
    await panneau.locator('[data-comparaison="a"]').click();
    assert.match(await panneau.locator('[data-sortie="retour"]').textContent(), /cinq meilleures/);
    await panneau.locator('[data-action="indice"]').click();
    const indice = await panneau.locator('[data-sortie="retour"]').textContent();
    assert.match(indice, /B a full/);
    assert.doesNotMatch(indice, /undefined/);
    await panneau.locator('[data-comparaison="b"]').click();
    await panneau.locator('[data-action="suivant"]').click();
    const etat = await page.evaluate(() => window.kermiclab.academie.etat());
    assert.equal(etat.lecons.full.etoiles, 1, "une erreur et un indice réduisent les étoiles");
    await panneau.locator('[data-vue="session"] [data-action="retour"]').first().click();
    await panneau.locator('[data-action="detail"]').click();
    await panneau.locator('[data-action="effacer"]').click();
    await panneau.locator('[data-action="effacer"]').click();
    await page.reload();
    assert.equal(await page.evaluate(() => window.kermiclab.academie.etat().xp), 0);
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});

test("Texas Hold'em : défis variés sans XP répétable et commandes au clavier", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, `${serveur.url}/catalogue/poker-texas-holdem/page.html`);
  try {
    await page.goto(`${serveur.url}/catalogue/poker-texas-holdem/page.html`);
    await page.focus("#onglet-application");
    await page.keyboard.press("End");
    assert.equal(await page.locator("#onglet-mise-en-situation").getAttribute("aria-selected"), "true");
    for (const gagnant of ["b", "egalite", "a"]) {
      await page.locator(`[data-reponse="${gagnant}"]`).click();
      assert.match(await page.locator('[data-sortie="reponse-defi"]').textContent(), /^Bravo/);
      await page.locator('[data-action="autre-defi"]').click();
    }
    assert.equal(await page.evaluate(() => window.kermiclab.academie.etat().xp), 0);
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});

test("Texas Hold'em : règles, défi et affichage mobile sans débordement horizontal", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, `${serveur.url}/catalogue/poker-texas-holdem/page.html`, {
    viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true
  });
  await page.goto(`${serveur.url}/catalogue/poker-texas-holdem/page.html`);
  assert.deepEqual(erreurs, [], "aucune erreur au chargement mobile");
  const debord = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  for (const id of ["application", "explication", "academie", "mise-en-situation"]) {
    await page.click(`#onglet-${id}`);
    assert.ok(await debord() <= 0, `${id} déborde de ${await debord()}px`);
  }
  await page.locator('[data-reponse="a"]').tap();
  assert.match(await page.locator('[data-sortie="reponse-defi"]').textContent(), /full aux rois/);
  await page.locator('[data-reponse="b"]').tap();
  assert.match(await page.locator('[data-sortie="reponse-defi"]').textContent(), /^Bravo/);
  for (const largeur of [320, 390, 768]) {
    await page.setViewportSize({ width: largeur, height: 740 });
    for (const id of ["application", "academie"]) {
      await page.click(`#onglet-${id}`);
      assert.ok(await debord() <= 0, `${id} à ${largeur}px : ${await debord()}px`);
    }
  }
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
