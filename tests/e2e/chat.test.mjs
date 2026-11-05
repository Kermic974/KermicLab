import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab } from "./outils.mjs";

let serveur, nav, htmlMaquette, api;
before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
  htmlMaquette = await readFile(`${racine}catalogue/trigo-cercle/page.html`, "utf8");
  // L'URL d'API est celle que le build a réellement écrite (Worker kermiclab-api, localhost en CI, ou même origine).
  const { apiUrl } = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8"));
  api = apiUrl || serveur.url;
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

/** Simule l'API et entre un pseudo de session (fenêtre de premier lancement déjà passée). */
async function simulerApi(page, { pseudo = "Testeur", jeux = false } = {}) {
  // Le script s'exécute aussi dans les iframes sandboxées des maquettes, sans accès au stockage : on l'ignore alors.
  if (pseudo) await page.addInitScript((p) => { try { if (!sessionStorage.getItem("kermiclab:pseudo")) sessionStorage.setItem("kermiclab:pseudo", p); } catch { /* iframe sandboxée */ } }, pseudo);
  return simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette, jeux });
}

test("chat : une question sur le sinus affiche la maquette dans le fil", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR" });
  const requetes = await simulerApi(page);
  await page.goto(serveur.url);
  await page.locator("#fil li").first().waitFor();
  assert.match(await page.locator("#fil li").first().textContent(), /Kermiclab/);
  assert.equal(await page.locator("#se-connecter").isVisible(), false);
  assert.equal(await page.locator("#mon-compte").isVisible(), false);
  await page.fill("#question", "c'est quoi le sinus ?");
  await page.keyboard.press("Enter");
  const cadre = page.locator("li[data-maquette=trigo-cercle] iframe");
  await cadre.waitFor();
  assert.equal(requetes[0].langue, "fr");
  const onglets = page.frameLocator("li[data-maquette=trigo-cercle] iframe").locator("[role=tab]");
  await onglets.first().waitFor();
  assert.equal(await onglets.count(), 3);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("i18n : détection automatique de l'anglais et sélecteur manuel", async () => {
  const { page, contexte } = await ouvrir(nav, serveur.url, { locale: "en-US" });
  const requetes = await simulerApi(page);
  await page.goto(serveur.url);
  await page.locator("#fil li").first().waitFor();
  assert.equal(await page.locator("#formulaire button").textContent(), "Send");
  await page.selectOption("#langue", "fr");
  await page.waitForFunction(() => document.documentElement.lang === "fr");
  assert.equal(await page.locator("#formulaire button").textContent(), "Envoyer");
  await page.fill("#question", "bonjour");
  await page.click("#formulaire button");
  await page.locator("#fil li", { hasText: "Réponse simple." }).waitFor();
  assert.equal(requetes[0].langue, "fr");
  await contexte.close();
});

test("chat mobile : aucun défilement horizontal", async () => {
  const { page, contexte } = await ouvrir(nav, serveur.url, { viewport: { width: 360, height: 740 }, isMobile: true });
  await simulerApi(page);
  await page.goto(serveur.url);
  await page.locator("#fil li").first().waitFor();
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(debord <= 0, `déborde de ${debord}px`);
  await contexte.close();
});

test("progression : suggestions cliquables, XP et badges gardés pour la session (sans cookie)", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR" });
  await simulerApi(page);
  await page.goto(serveur.url);
  await page.locator(".bienvenue .puce").first().click();
  await page.locator("li[data-maquette=trigo-cercle] iframe").waitFor();
  await page.locator(".relances .puce").first().waitFor();
  assert.equal(await page.locator("#pastille-serie").textContent(), "1");
  const stocke = await page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:progression")));
  assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:progression")), null, "rien dans le stockage local sans cookie");
  assert.equal(stocke.questions, 1);
  assert.deepEqual(stocke.notions, ["trigo-cercle"]);
  await page.click("#ouvrir-progres");
  assert.equal(await page.locator("#liste-badges .badge.obtenu").count(), 2);
  await page.click("#fermer-progres");
  assert.equal(await page.locator("#progres").isVisible(), false);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("hors catalogue : propose des questions qui marchent et ne rapporte pas d'XP", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR" });
  await simulerApi(page);
  await page.goto(serveur.url);
  await page.locator("#puces-bienvenue .puce", { hasText: "Je ne comprends pas les radians" }).waitFor();
  await page.fill("#question", "parle-moi des volcans");
  await page.keyboard.press("Enter");
  const relance = page.locator("li.hors-catalogue .relances .puce");
  await relance.waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem("kermiclab:progression")), null);
  await relance.click();
  await page.locator("li[data-maquette=trigo-cercle] iframe").waitFor();
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("catalogue : tiroir « Explorer », recherche sans accents, ouverture directe d'une notion", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 800 } });
  const requetes = await simulerApi(page);
  await page.goto(serveur.url);
  const barre = page.locator("#catalogue");
  await page.locator("#grille-matieres .matiere-carte").first().waitFor();
  assert.equal(await barre.isVisible(), false, "fermé tant qu'on n'explore pas");
  await page.click("#ouvrir-catalogue");
  await barre.locator(".notion").first().waitFor();
  assert.equal(await page.locator("#ouvrir-catalogue").getAttribute("aria-expanded"), "true");
  assert.deepEqual(await barre.locator(".groupe-niveau summary > span:first-child").allTextContents(), ["Collège", "Seconde", "Première"]);
  assert.match(await page.locator("#catalogue-compteur").textContent(), /0 \/ 6 notions explorées/);
  await page.fill("#recherche-notion", "theoreme");
  assert.deepEqual(await barre.locator(".notion").allTextContents(), ["Le théorème de Pythagore"]);
  await page.fill("#recherche-notion", "volcan");
  assert.equal(await page.locator("#catalogue-vide").isVisible(), true);
  await page.fill("#recherche-notion", "");
  await barre.locator(".notion", { hasText: "Le cercle trigonométrique" }).click();
  await page.locator("#bulle-lab[open][data-notion=trigo-cercle] #bulle-cadre").waitFor();
  assert.equal(requetes.length, 0, "aucun appel au chat : la page est ouverte directement");
  assert.equal(await page.locator("#fil li[data-maquette]").count(), 0, "ouverte dans une bulle, pas dans le fil");
  await page.keyboard.press("Escape");
  await page.locator("#bulle-lab").waitFor({ state: "hidden" });
  await barre.waitFor({ state: "hidden" }); // le tiroir se referme après le choix
  await page.click("#ouvrir-catalogue");
  const bouton = barre.locator("[data-notion=trigo-cercle]");
  assert.equal(await bouton.getAttribute("aria-current"), "page");
  assert.match(await bouton.textContent(), /✓/);
  assert.match(await page.locator("#catalogue-compteur").textContent(), /1 \/ 6/);
  // Onglets de matière : la physique-chimie a sa propre liste ; une recherche porte sur toutes les matières.
  assert.deepEqual(await page.locator("#catalogue-matieres [role=tab]").allTextContents(), ["Maths", "Physique-chimie", "Philosophie"]);
  await page.click("[data-matiere=physique-chimie][role=tab]");
  assert.deepEqual(await barre.locator(".notion").allTextContents(), ["Circuits électriques et loi d'Ohm"]);
  await page.click("[data-matiere=philosophie][role=tab]");
  assert.deepEqual(await barre.locator(".notion").allTextContents(), ["L'art"]);
  await page.selectOption("#langue", "en");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  assert.equal(await page.locator("[data-matiere=philosophie][role=tab]").textContent(), "Philosophy");
  await page.selectOption("#langue", "fr");
  await page.waitForFunction(() => document.documentElement.lang === "fr");
  await page.fill("#recherche-notion", "la");
  assert.ok((await barre.locator(".groupe-niveau summary > span:first-child").allTextContents()).some((t) => t.startsWith("Maths · ")));
  await page.fill("#recherche-notion", "art");
  assert.ok((await barre.locator(".groupe-niveau summary > span:first-child").allTextContents()).some((t) => t.startsWith("Philosophie · ")));
  await page.fill("#recherche-notion", "");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("navigation : les Labs et les jeux ouvrent directement leur catégorie", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 800 } });
  await simulerApi(page, { jeux: true });
  await page.goto(serveur.url);
  const catalogue = page.locator("#catalogue");
  const labs = page.locator(".barre-laterale [data-nav=labs]");
  const jeux = page.locator(".barre-laterale [data-nav=jeux]");
  await labs.click();
  await catalogue.locator(".notion").first().waitFor();
  assert.equal(await page.locator("[data-matiere=mathematiques][role=tab]").getAttribute("aria-selected"), "true");
  assert.equal(await labs.getAttribute("aria-expanded"), "true");
  assert.equal(await jeux.getAttribute("aria-expanded"), "false");
  await page.click("#fermer-catalogue");
  await jeux.click();
  assert.equal(await page.locator("[data-matiere=jeux][role=tab]").getAttribute("aria-selected"), "true");
  assert.deepEqual(await catalogue.locator(".notion").allTextContents(), ["Les échecs"]);
  assert.equal(await labs.getAttribute("aria-expanded"), "false");
  assert.equal(await jeux.getAttribute("aria-expanded"), "true");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("catalogue mobile : tiroir ouvert par le bouton, fermé par Échap, sans débordement", async () => {
  const { page, contexte } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 360, height: 740 }, isMobile: true });
  await simulerApi(page);
  await page.goto(serveur.url);
  const explorer = page.locator(".nav-mobile [data-nav=labs]");
  await explorer.waitFor({ state: "visible" });
  assert.equal(await page.locator("#catalogue").isVisible(), false, "fermé par défaut sur mobile");
  await explorer.click();
  await page.locator("#catalogue .notion").first().waitFor({ state: "visible" });
  assert.equal(await explorer.getAttribute("aria-expanded"), "true");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("#catalogue").classList.contains("ouvert"));
  await explorer.click();
  await page.locator("#catalogue .notion", { hasText: "Les fractions" }).click();
  await page.locator("#bulle-lab[open][data-notion=fractions] #bulle-cadre").waitFor();
  assert.equal(await page.locator("#voile-catalogue").isVisible(), false, "le tiroir se referme après le choix");
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(debord <= 0, `déborde de ${debord}px`);
  await contexte.close();
});

test("navigation mobile : Labs et jeux restent accessibles sans débordement", async () => {
  const { page, contexte } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 320, height: 740 }, isMobile: true });
  await simulerApi(page, { jeux: true });
  await page.goto(serveur.url);
  const groupe = page.locator(".nav-mobile-groupe");
  const jeux = groupe.locator("[data-nav=jeux]");
  await page.locator(".nav-mobile [data-nav=labs]").waitFor({ state: "visible" });
  await jeux.click();
  await page.locator("#catalogue [data-matiere=jeux][role=tab][aria-selected=true]").waitFor();
  assert.deepEqual(await page.locator("#catalogue .notion").allTextContents(), ["Les échecs"]);
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(debord <= 0, `déborde de ${debord}px`);
  await contexte.close();
});
