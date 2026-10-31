import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { servir, navigateur, ouvrir, racine } from "./outils.mjs";

let serveur, nav;
before(async () => { serveur = await servir(racine); nav = await navigateur(); });
after(async () => { await nav?.close(); await serveur?.fermer(); });

const URL_PAGE = () => `${serveur.url}/catalogue/trigo-cercle/page.html`;

test("onglets : registre modulaire, self-test désactivé, navigation clavier", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  const onglets = await page.locator("[role=tab]").evaluateAll((n) => n.map((b) => b.dataset.onglet));
  assert.deepEqual(onglets, ["explication", "application", "mise-en-situation"]);
  assert.equal(await page.locator("#onglet-explication").getAttribute("aria-selected"), "true");
  await page.locator("#onglet-explication").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("#onglet-application").getAttribute("aria-selected"), "true");
  assert.equal(await page.locator("#panneau-application").isVisible(), true);
  assert.equal(await page.locator("#panneau-explication").isVisible(), false);
  const registre = await page.evaluate(() => window.kermiclab.registre.map((o) => [o.id, o.actif]));
  assert.deepEqual(registre.at(-1), ["self-test", false]);
  assert.equal(await page.locator("#connexion").isVisible(), false);
  assert.deepEqual(erreurs, [], "aucune erreur console ni violation CSP");
  await contexte.close();
});

test("application : le curseur met à jour cos et sin", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await page.click("#onglet-application");
  await page.locator("[data-entree=angle]").fill("90");
  assert.equal(await page.locator("#panneau-application [data-sortie=cos]").textContent(), "0,000");
  assert.equal(await page.locator("#panneau-application [data-sortie=sin]").textContent(), "1,000");
  assert.equal(await page.locator("#panneau-application [data-sortie=tan]").textContent(), "non définie");
  await contexte.close();
});

test("défi : toucher le cercle donne un retour immédiat et l'onglet est mémorisé", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await page.click("#onglet-mise-en-situation");
  const svg = page.locator("#panneau-mise-en-situation svg");
  const boite = await svg.boundingBox();
  await page.mouse.click(boite.x + boite.width * 0.87, boite.y + boite.height / 2);
  assert.notEqual((await page.locator("#panneau-mise-en-situation [data-sortie=retour]").textContent()).trim(), "");
  await page.reload();
  assert.equal(await page.locator("#onglet-mise-en-situation").getAttribute("aria-selected"), "true");
  await contexte.close();
});

test("rendu mobile : aucun défilement horizontal, sur chaque onglet", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE(), { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await page.goto(URL_PAGE());
  for (const id of ["explication", "application", "mise-en-situation"]) {
    await page.click(`#onglet-${id}`);
    const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(debord <= 0, `${id} déborde de ${debord}px`);
  }
  await contexte.close();
});
