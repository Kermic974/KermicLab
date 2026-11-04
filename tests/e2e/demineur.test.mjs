import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { servir, navigateur, ouvrir, racine } from "./outils.mjs";

let serveur, nav;
before(async () => { serveur = await servir(racine); nav = await navigateur(); });
after(async () => { await nav?.close(); await serveur?.fermer(); });

const URL_PAGE = () => `${serveur.url}/catalogue/demineur/page.html`;
const MOBILE = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true };
const jeu = (page) => page.locator("#panneau-application");
const sortie = (page, nom) => jeu(page).locator(`[data-sortie="${nom}"]`);
const caseJeu = (page, index) => jeu(page).locator(`.case[data-index="${index}"]`);
/** Positions des mines de la partie en cours (lues dans l'état exposé par la page). */
const mines = (page) => page.evaluate(() => window.kermiclab.demineur.partie().cases.flatMap((c, i) => (c.mine ? [i] : [])));
const nombreCases = (page) => jeu(page).locator(".case").count();

test("démineur : s'ouvre sur « Jouer », état Prêt, onglets et aucune erreur ni violation CSP", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  const onglets = await page.locator("[role=tab]").evaluateAll((n) => n.map((b) => b.dataset.onglet));
  assert.deepEqual(onglets, ["explication", "application", "mise-en-situation"]);
  assert.equal(await page.locator("#onglet-application").getAttribute("aria-selected"), "true");
  assert.equal(await nombreCases(page), 81);
  assert.equal(await sortie(page, "niveau").textContent(), "Débutant");
  assert.equal(await sortie(page, "mines").textContent(), "10");
  assert.equal(await sortie(page, "restantes").textContent(), "10");
  assert.equal(await sortie(page, "statut").textContent(), "Prêt");
  assert.equal(await sortie(page, "temps").textContent(), "0:00");
  assert.equal(await page.locator("#connexion").isVisible(), false);
  const registre = await page.evaluate(() => window.kermiclab.registre.map((o) => [o.id, o.actif]));
  assert.deepEqual(registre.at(-1), ["self-test", false]);
  await page.click("#onglet-explication");
  assert.match(await page.locator("#panneau-explication").textContent(), /premier coup n'est jamais une mine/);
  assert.deepEqual(erreurs, [], "aucune erreur console ni violation CSP");
  await contexte.close();
});

test("démineur : aucun appel réseau pendant une partie", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  const requetes = [];
  page.on("request", (r) => requetes.push(r.url()));
  await page.goto(URL_PAGE());
  await caseJeu(page, 40).click();
  await caseJeu(page, 0).click({ button: "right" });
  await page.click("#onglet-mise-en-situation");
  assert.deepEqual(requetes, [URL_PAGE()]);
  await contexte.close();
});

test("démineur : premier clic toujours sûr, chronomètre lancé, partie en cours", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  for (let essai = 0; essai < 8; essai++) {
    await jeu(page).locator('[data-action="nouvelle-partie"]').click();
    assert.deepEqual(await mines(page), [], "aucune mine avant le premier coup");
    await caseJeu(page, (essai * 23) % 81).click();
    assert.equal(await sortie(page, "statut").textContent(), "En cours", `essai ${essai}`);
    assert.equal((await mines(page)).length, 10);
    assert.equal(await caseJeu(page, (essai * 23) % 81).getAttribute("data-etat"), "vide");
  }
  await page.waitForFunction(() => document.querySelector('#panneau-application [data-sortie="temps"]').textContent !== "0:00", null, { timeout: 3000 });
  await contexte.close();
});

test("démineur : drapeau au clic droit, compteur, puis victoire en ouvrant toutes les cases sûres", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await caseJeu(page, 40).click();
  const positions = await mines(page);
  await caseJeu(page, positions[0]).click({ button: "right" });
  assert.equal(await caseJeu(page, positions[0]).getAttribute("data-etat"), "drapeau");
  assert.match(await caseJeu(page, positions[0]).getAttribute("aria-label"), /drapeau/);
  assert.equal(await sortie(page, "restantes").textContent(), "9");
  await caseJeu(page, positions[0]).click();
  assert.equal(await sortie(page, "statut").textContent(), "En cours", "une case avec drapeau ne s'ouvre pas");
  for (let i = 0; i < 81; i++) {
    if (positions.includes(i) || (await caseJeu(page, i).getAttribute("data-etat")) !== "cachee") continue;
    await caseJeu(page, i).click();
  }
  assert.equal(await sortie(page, "statut").textContent(), "Victoire 🎉");
  assert.equal(await sortie(page, "restantes").textContent(), "0");
  assert.match(await sortie(page, "message").textContent(), /Bravo/);
  assert.notEqual(await sortie(page, "record").textContent(), "—", "record enregistré localement");
  await contexte.close();
});

test("démineur : défaite en ouvrant une mine, mines dévoilées, nouvelle partie remise à zéro", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await caseJeu(page, 0).click();
  const [mine] = await mines(page);
  await caseJeu(page, mine).click();
  assert.equal(await sortie(page, "statut").textContent(), "Perdu 💥");
  assert.equal(await caseJeu(page, mine).getAttribute("data-etat"), "explosion");
  assert.equal(await jeu(page).locator('.case[data-etat="mine"]').count(), 9);
  await jeu(page).locator('[data-action="nouvelle-partie"]').click();
  assert.equal(await sortie(page, "statut").textContent(), "Prêt");
  assert.equal(await sortie(page, "temps").textContent(), "0:00");
  assert.equal(await jeu(page).locator('.case[data-etat="cachee"]').count(), 81);
  await contexte.close();
});

test("démineur : changement de niveau (Intermédiaire, Expert) avec le nombre exact de mines", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  for (const [niveau, nom, cases, total] of [["intermediaire", "Intermédiaire", 256, 40], ["expert", "Expert", 480, 99]]) {
    await jeu(page).locator(`input[value="${niveau}"]`).check();
    assert.equal(await nombreCases(page), cases, niveau);
    assert.equal(await sortie(page, "niveau").textContent(), nom);
    assert.equal(await sortie(page, "mines").textContent(), String(total));
    await caseJeu(page, 100).click();
    assert.equal((await mines(page)).length, total);
  }
  await page.reload();
  assert.equal(await nombreCases(page), 480, "niveau mémorisé");
  await contexte.close();
});

test("démineur : jouable au clavier (déplacement, drapeau, ouverture) avec un focus visible", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await caseJeu(page, 0).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.index), "10");
  const contour = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.equal(contour, "solid", "focus visible");
  await page.keyboard.press("d");
  assert.equal(await caseJeu(page, 10).getAttribute("data-etat"), "drapeau");
  await page.keyboard.press("f");
  assert.equal(await caseJeu(page, 10).getAttribute("data-etat"), "cachee");
  await page.keyboard.press("End");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.index), "17");
  await page.keyboard.press("Enter");
  assert.equal(await sortie(page, "statut").textContent(), "En cours");
  assert.equal(await caseJeu(page, 17).getAttribute("tabindex"), "0", "tabulation itinérante");
  assert.equal(await jeu(page).locator('.case[tabindex="0"]').count(), 1);
  await contexte.close();
});

test("démineur mobile : toucher ouvre, appui long et mode drapeau posent un drapeau", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE(), MOBILE);
  await page.goto(URL_PAGE());
  await caseJeu(page, 40).tap();
  assert.equal(await sortie(page, "statut").textContent(), "En cours");
  const cible = await page.evaluate(() => window.kermiclab.demineur.partie().cases.findIndex((c) => !c.revelee));
  const boite = await caseJeu(page, cible).boundingBox();
  const point = { pointerType: "touch", isPrimary: true, bubbles: true, clientX: boite.x + 5, clientY: boite.y + 5 };
  await caseJeu(page, cible).dispatchEvent("pointerdown", point);
  await page.waitForTimeout(650);
  await caseJeu(page, cible).dispatchEvent("pointerup", point);
  assert.equal(await caseJeu(page, cible).getAttribute("data-etat"), "drapeau", "appui long");
  await caseJeu(page, cible).dispatchEvent("click");
  assert.equal(await caseJeu(page, cible).getAttribute("data-etat"), "drapeau", "le clic qui suit l'appui long est ignoré");
  const mode = jeu(page).locator('[data-action="mode-drapeau"]');
  await mode.tap();
  assert.equal(await mode.getAttribute("aria-pressed"), "true");
  await caseJeu(page, cible).tap();
  assert.equal(await caseJeu(page, cible).getAttribute("data-etat"), "cachee", "mode drapeau : retrait");
  await mode.tap();
  assert.equal(await mode.getAttribute("aria-pressed"), "false");
  await contexte.close();
});

test("démineur mobile : aucun défilement horizontal de la page, y compris en Expert", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE(), MOBILE);
  await page.goto(URL_PAGE());
  const debord = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  for (const id of ["explication", "application", "mise-en-situation"]) {
    await page.click(`#onglet-${id}`);
    assert.ok(await debord() <= 0, `${id} déborde de ${await debord()}px`);
  }
  await page.click("#onglet-application");
  for (const niveau of ["intermediaire", "expert"]) {
    await jeu(page).locator(`input[value="${niveau}"]`).check();
    assert.ok(await debord() <= 0, `${niveau} déborde de ${await debord()}px`);
  }
  // Expert tourné d'un quart de tour sur téléphone : 16 colonnes affichées au lieu de 30, cases d'au moins 24 px.
  const premiereRangee = await jeu(page).locator(".rangee").first().locator(".case").count();
  assert.equal(premiereRangee, 16);
  const taille = (await caseJeu(page, 0).boundingBox()).width;
  assert.ok(taille >= 24, `cases de ${taille}px`);
  await caseJeu(page, 200).tap();
  assert.equal(await sortie(page, "statut").textContent(), "En cours");
  assert.equal((await mines(page)).length, 99);
  await contexte.close();
});

test("énigmes : une mauvaise case donne un indice, la bonne explique la déduction", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await page.click("#onglet-mise-en-situation");
  const panneau = page.locator("#panneau-mise-en-situation");
  const retour = panneau.locator('[data-sortie="retour"]');
  // Les solutions des énigmes, dans l'ordre : mine, mine, mine, case sûre.
  for (const [mauvaise, bonne] of [[null, 1], [1, 0], [0, 1], [0, 1]]) {
    if (mauvaise !== null) {
      await panneau.locator(`.case[data-index="${mauvaise}"]`).click();
      assert.match(await retour.textContent(), /Pas tout à fait/);
    }
    await panneau.locator(`.case[data-index="${bonne}"]`).click();
    assert.equal(await retour.getAttribute("class"), "message ok");
    await panneau.locator('[data-action="suivante"]').click();
  }
  assert.match(await panneau.locator('[data-sortie="progression"]').textContent(), /Énigme 1 \/ 4/);
  await contexte.close();
});
