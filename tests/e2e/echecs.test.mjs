import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { servir, navigateur, ouvrir, racine } from "./outils.mjs";

let serveur, nav;
before(async () => { serveur = await servir(racine); nav = await navigateur(); });
after(async () => { await nav?.close(); await serveur?.fermer(); });

const URL_PAGE = () => `${serveur.url}/catalogue/echecs/page.html`;
const MOBILE = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true };
const jeu = (page) => page.locator("#panneau-application");
const caseJeu = (page, nom) => jeu(page).locator(`[data-case="${nom}"]`);
const statut = (page) => jeu(page).locator('[data-sortie="statut"]').textContent();
const etat = (page) => page.evaluate(() => window.kermiclab.echecs.etat());
/** Joue des coups « e2e4 » par deux clics (pièce puis case). */
async function jouer(page, coups, action = "click") {
  for (const c of coups.split(" ")) { await caseJeu(page, c.slice(0, 2))[action](); await caseJeu(page, c.slice(2, 4))[action](); }
}
async function aDeux(page) { await jeu(page).locator('input[name="mode"][value="deux"]').check(); }
const FEN_INITIALE = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

test("échecs : s'ouvre sur « Jouer » avec la position initiale, sans erreur ni violation CSP", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  const onglets = await page.locator("[role=tab]").evaluateAll((n) => n.map((b) => b.dataset.onglet));
  assert.deepEqual(onglets, ["explication", "application", "mise-en-situation"]);
  assert.equal(await page.locator("#onglet-application").getAttribute("aria-selected"), "true");
  assert.equal(await jeu(page).locator(".case").count(), 64);
  assert.equal(await jeu(page).locator(".case .piece").count(), 32);
  assert.equal((await etat(page)).fen, FEN_INITIALE);
  assert.equal(await statut(page), "À toi de jouer (Blancs)");
  assert.equal(await caseJeu(page, "e1").getAttribute("aria-label"), "e1 : roi blanc");
  assert.equal(await jeu(page).locator('[data-action="annuler"]').isDisabled(), true);
  const registre = await page.evaluate(() => window.kermiclab.registre.map((o) => [o.id, o.actif]));
  assert.deepEqual(registre.at(-1), ["self-test", false]);
  assert.equal(await page.locator("#connexion").isVisible(), false);
  await page.click("#onglet-explication");
  assert.match(await page.locator("#panneau-explication").textContent(), /roque/);
  assert.deepEqual(erreurs, [], "aucune erreur console ni violation CSP");
  await contexte.close();
});

test("échecs : aucun appel réseau pendant une partie contre l'ordinateur", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  const requetes = [];
  page.on("request", (r) => requetes.push(r.url()));
  await page.goto(URL_PAGE());
  await jouer(page, "e2e4");
  await page.waitForFunction(() => window.kermiclab.echecs.etat().coups.length === 2);
  await page.click("#onglet-mise-en-situation");
  assert.deepEqual(requetes, [URL_PAGE()]);
  await contexte.close();
});

test("échecs : sélection, destinations marquées, puis réponse de l'ordinateur", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await caseJeu(page, "e2").click();
  assert.equal(await caseJeu(page, "e2").getAttribute("data-selection"), "");
  const destinations = await jeu(page).locator("[data-destination]").evaluateAll((n) => n.map((b) => b.dataset.case).sort());
  assert.deepEqual(destinations, ["e3", "e4"]);
  assert.match(await caseJeu(page, "e4").getAttribute("aria-label"), /destination possible/);
  await caseJeu(page, "a5").click();
  assert.equal(await jeu(page).locator("[data-destination]").count(), 0, "un clic ailleurs annule la sélection");
  await jouer(page, "e2e4");
  await page.waitForFunction(() => window.kermiclab.echecs.etat().coups.length === 2, null, { timeout: 5000 });
  const { coups } = await etat(page);
  assert.equal(coups[0], "e4");
  assert.equal(await jeu(page).locator(".coups li").first().textContent(), `e4   ${coups[1]}`);
  assert.equal(await statut(page), "À toi de jouer (Blancs)");
  assert.equal(await jeu(page).locator("[data-dernier]").count(), 2, "dernier coup marqué");
  await contexte.close();
});

test("échecs : à deux, le mat du fou (le plus court possible) finit en échec et mat", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await aDeux(page);
  assert.equal(await jeu(page).locator('[data-zone="niveau"]').isVisible(), false);
  await jouer(page, "f2f3 e7e5 g2g4");
  assert.equal(await statut(page), "Au tour des Noirs");
  await jouer(page, "d8h4");
  assert.equal(await statut(page), "Échec et mat ! Les Noirs gagnent.");
  assert.deepEqual((await etat(page)).coups, ["f3", "e5", "g4", "Dh4#"]);
  assert.equal(await caseJeu(page, "e1").getAttribute("data-echec"), "");
  assert.match(await caseJeu(page, "e1").getAttribute("aria-label"), /roi en échec/);
  await caseJeu(page, "a2").click();
  assert.equal(await jeu(page).locator("[data-destination]").count(), 0, "plus aucun coup après le mat");
  await contexte.close();
});

test("échecs : annuler un coup, à deux puis contre l'ordinateur", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await jouer(page, "d2d4");
  await page.waitForFunction(() => window.kermiclab.echecs.etat().coups.length === 2, null, { timeout: 5000 });
  await jeu(page).locator('[data-action="annuler"]').click();
  assert.equal((await etat(page)).fen, FEN_INITIALE, "contre l'ordinateur, on revient avant le coup du joueur");
  await aDeux(page);
  await jouer(page, "e2e4 e7e5");
  await jeu(page).locator('[data-action="annuler"]').click();
  assert.deepEqual((await etat(page)).coups, ["e4"]);
  assert.equal(await statut(page), "Au tour des Noirs");
  await contexte.close();
});

test("échecs : promotion au choix (sous-promotion en cavalier)", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await aDeux(page);
  await jouer(page, "h2h4 g7g5 h4g5 h7h6 g5h6 f8g7 h6g7 g8f6");
  await caseJeu(page, "g7").click();
  await caseJeu(page, "h8").click();
  const dialogue = page.locator("#promotion");
  assert.equal(await dialogue.isVisible(), true);
  await dialogue.locator('[data-promotion="n"]').click();
  assert.equal(await dialogue.isVisible(), false);
  assert.equal((await etat(page)).coups.at(-1), "gxh8=C");
  assert.equal(await caseJeu(page, "h8").getAttribute("aria-label"), "h8 : cavalier blanc, dernier coup");
  await contexte.close();
});

test("échecs : jouable au clavier (flèches, Entrée, Échap) avec un focus visible", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await aDeux(page);
  await caseJeu(page, "e2").focus();
  await page.keyboard.press("Enter");
  assert.equal(await caseJeu(page, "e2").getAttribute("data-selection"), "");
  await page.keyboard.press("Escape");
  assert.equal(await caseJeu(page, "e2").getAttribute("data-selection"), null);
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.case), "e4");
  assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "solid");
  await page.keyboard.press("Enter");
  assert.deepEqual((await etat(page)).coups, ["e4"]);
  assert.equal(await jeu(page).locator('.case[tabindex="0"]').count(), 1, "tabulation itinérante");
  await contexte.close();
});

test("échecs : jouer les Noirs, l'ordinateur commence et l'échiquier est retourné ; réglages mémorisés", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await jeu(page).locator('input[name="couleur"][value="b"]').check();
  await page.waitForFunction(() => window.kermiclab.echecs.etat().coups.length === 1, null, { timeout: 5000 });
  assert.equal(await jeu(page).locator(".case").first().getAttribute("data-case"), "h1", "Noirs en bas");
  assert.equal(await statut(page), "À toi de jouer (Noirs)");
  await jeu(page).locator('input[name="niveau"][value="moyen"]').check();
  await page.reload();
  assert.equal(await jeu(page).locator('input[name="couleur"][value="b"]').isChecked(), true);
  assert.equal(await jeu(page).locator('input[name="niveau"][value="moyen"]').isChecked(), true);
  await aDeux(page);
  await jeu(page).locator('[data-action="tourner"]').click();
  assert.equal(await jeu(page).locator(".case").first().getAttribute("data-case"), "h1");
  await contexte.close();
});

test("échecs mobile : jouer au toucher, échiquier dans la largeur, aucun défilement horizontal", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE(), MOBILE);
  await page.goto(URL_PAGE());
  await jouer(page, "g1f3", "tap");
  await page.waitForFunction(() => window.kermiclab.echecs.etat().coups.length === 2, null, { timeout: 5000 });
  assert.equal((await etat(page)).coups[0], "Cf3");
  const boite = await jeu(page).locator(".echiquier").boundingBox();
  assert.ok(boite.x >= 0 && boite.x + boite.width <= 360, `échiquier de ${boite.width}px`);
  assert.ok(boite.width / 8 >= 36, "cases assez grandes pour le doigt");
  for (const id of ["explication", "application", "mise-en-situation"]) {
    await page.click(`#onglet-${id}`);
    const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(debord <= 0, `${id} déborde de ${debord}px`);
  }
  await contexte.close();
});

test("énigmes : un coup qui ne fait pas mat donne un indice, le mat explique la solution", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await page.click("#onglet-mise-en-situation");
  const panneau = page.locator("#panneau-mise-en-situation");
  const retour = panneau.locator('[data-sortie="retour"]');
  const cliquer = async (c) => { await panneau.locator(`[data-case="${c.slice(0, 2)}"]`).click(); await panneau.locator(`[data-case="${c.slice(2, 4)}"]`).click(); };
  await cliquer("a1a7");
  assert.match(await retour.textContent(), /Ta7 ne fait pas mat/);
  for (const solution of ["a1a8", "h5f7", "b1b8", "h6f7"]) {
    await cliquer(solution);
    assert.equal(await retour.getAttribute("class"), "message ok", solution);
    assert.match(await retour.textContent(), /Échec et mat/);
    await panneau.locator('[data-action="suivante"]').click();
  }
  assert.match(await panneau.locator('[data-sortie="progression"]').textContent(), /Énigme 1 \/ 4/);
  await contexte.close();
});
