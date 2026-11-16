// Front piloté par le back-office (ADR 0026) : « À la une », parcours, « Ma classe » et profil allégé.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab, capturer } from "./outils.mjs";

let serveur, nav, htmlMaquette, api;
before(async () => {
  serveur = await servir(`${racine}dist`, { headers: { "referrer-policy": "no-referrer" } });
  nav = await navigateur();
  htmlMaquette = await readFile(`${racine}catalogue/trigo-cercle/page.html`, "utf8");
  api = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8")).apiUrl || serveur.url;
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

const CATALOGUE = [
  { id: "fractions", titre: "Les fractions", niveau: "college", enAvant: true },
  { id: "pythagore", titre: "Le théorème de Pythagore", niveau: "college" },
  { id: "trigo-cercle", titre: "Le cercle trigonométrique", niveau: "seconde", enAvant: true },
  { id: "derivation", titre: "La dérivation", niveau: "premiere" }
].map((n) => ({ matiere: "mathematiques", version: "1.0.0", ...n }));
const PARCOURS = [{ id: "p1", titre: "Vers le cercle", description: "Deux étapes pour arriver au sinus.", etapes: [{ id: "pythagore" }, { id: "trigo-cercle" }, { id: "retire-du-catalogue" }] }];

async function preparer(page, { parcours = PARCOURS, catalogue = CATALOGUE } = {}) {
  await page.addInitScript(() => { try { if (!sessionStorage.getItem("kermiclab:pseudo")) sessionStorage.setItem("kermiclab:pseudo", "Testeur"); } catch { /* iframe sandboxée */ } });
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette, jeux: false, llmActif: true });
  const json = (corps) => (route) => route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(corps) });
  await page.route(`${api}/api/catalogue`, json({ notions: catalogue }));
  await page.route(`${api}/api/parcours`, json({ parcours }));
}

test("accueil : « À la une » et parcours décidés dans le back-office, progression du parcours sur l'appareil", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  await preparer(page);
  await page.goto(serveur.url);
  await page.locator("#parcours [data-parcours=p1]").waitFor();
  assert.deepEqual(await page.locator("#une-liste .une-titre").allTextContents(), ["Les fractions", "Le cercle trigonométrique"]);
  const carte = page.locator("[data-parcours=p1]");
  assert.match(await carte.textContent(), /Vers le cercle.*0 étape\(s\) sur 2.*Deux étapes pour arriver au sinus\./s);
  assert.deepEqual(await carte.locator("[data-etape]").allTextContents(), ["Le théorème de Pythagore", "Le cercle trigonométrique"], "étape absente du catalogue écartée");
  assert.equal(await carte.locator("[data-parcours-suite]").textContent(), "Commencer : Le théorème de Pythagore");
  await capturer(page, "accueil-une-et-parcours");

  await carte.locator("[data-parcours-suite]").click();
  await page.locator("#bulle-lab[open]").waitFor();
  assert.equal(await page.locator("#bulle-titre").textContent(), "Le théorème de Pythagore");
  await page.click("#fermer-bulle");
  assert.match(await carte.textContent(), /1 étape\(s\) sur 2/);
  assert.equal(await carte.locator("[data-parcours-suite]").textContent(), "Continuer : Le cercle trigonométrique");
  assert.equal(await carte.locator('[data-etape="trigo-cercle"]').getAttribute("aria-current"), "step");

  await page.locator('#une-liste [data-une="trigo-cercle"]').click();
  await page.locator("#bulle-lab[open]").waitFor();
  await page.click("#fermer-bulle");
  assert.match(await carte.textContent(), /2 étape\(s\) sur 2.*Parcours terminé/s);
  assert.equal(await carte.locator("[data-parcours-suite]").count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("accueil : sans contenu mis en avant ni parcours, les deux sections restent masquées", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 390, height: 844 } });
  await preparer(page, { parcours: [], catalogue: CATALOGUE.map(({ enAvant, ...n }) => n) });
  await page.goto(serveur.url);
  await page.locator("#entree-education", { hasText: "notions" }).waitFor();
  assert.equal(await page.locator("#a-la-une").isVisible(), false);
  assert.equal(await page.locator("#parcours").isVisible(), false);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("Éducation : « Ma classe » ouvre le niveau choisi, le retient, et se retire d'un second appui", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  await preparer(page);
  await page.goto(serveur.url);
  await page.click('.barre-laterale [data-nav="education"]');
  const ouvert = (niveau) => page.locator(`[aria-controls="edu-${niveau}"]`).getAttribute("aria-expanded");
  assert.deepEqual(await page.locator("#ma-classe [data-classe]").allTextContents(), ["Collège", "Seconde", "Première"]);
  assert.deepEqual([await ouvert("college"), await ouvert("seconde")], ["false", "false"], "rien d'ouvert sans choix");

  await page.click('#ma-classe [data-classe="seconde"]');
  assert.equal(await page.locator('#ma-classe [data-classe="seconde"]').getAttribute("aria-pressed"), "true");
  assert.deepEqual([await ouvert("college"), await ouvert("seconde")], ["false", "true"]);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.classe), "seconde", "le focus reste sur le choix");
  await capturer(page, "education-ma-classe");

  // Le choix survit au changement d'écran et au rechargement de l'onglet.
  await page.click('.barre-laterale [data-nav="accueil"]');
  await page.reload();
  await page.locator("#entree-education", { hasText: "notions" }).waitFor();
  await page.click('.barre-laterale [data-nav="education"]');
  assert.equal(await ouvert("seconde"), "true");
  assert.equal(await page.locator('#ma-classe [data-classe="seconde"]').getAttribute("aria-pressed"), "true");

  await page.click('#ma-classe [data-classe="college"]');
  assert.deepEqual([await ouvert("college"), await ouvert("seconde")], ["true", "false"], "un seul niveau ouvert par le choix");
  await page.click('#ma-classe [data-classe="college"]');
  assert.equal(await page.locator('#ma-classe [aria-pressed="true"]').count(), 0);
  assert.equal(await ouvert("college"), "false");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("Profil : les réglages techniques sont repliés ; les choix de l'élève restent visibles", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  await preparer(page);
  await page.goto(serveur.url);
  await page.click('.barre-laterale .nav-bouton[data-nav="profil"]');
  await page.locator("#config-modules .config-module").first().waitFor({ state: "attached" });
  assert.equal(await page.locator("#llm-actif").isVisible(), true);
  assert.equal(await page.locator("#config-serveur").isVisible(), false, "les détails techniques ne sont plus dans le profil");
  // Ils sont rangés dans « À propos », toujours repliés.
  await page.click('.barre-laterale [data-nav="apropos"]');
  await page.locator("#apropos").waitFor();
  assert.equal(await page.locator("#config-serveur").evaluate((d) => d.open), false);
  assert.equal(await page.locator("#config-modules").isVisible(), false, "ni modèle ni budget de tokens affiché d'emblée");
  await page.click("#config-serveur > summary");
  assert.equal(await page.locator('#config-modules [data-cle="MODELE_CHAT"]').isVisible(), true);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
