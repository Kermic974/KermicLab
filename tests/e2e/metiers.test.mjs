// Espace Métiers (ADR 0041) : l'écran dans un navigateur, sous la CSP du site, avec les vraies données du build
// (dist/metiers.json, dist/referentiel-graphe.json). Seule l'API du Worker est simulée (catalogue, maquettes).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab, capturer } from "./outils.mjs";

let serveur, nav, api, htmlMaquette;
before(async () => {
  const csp = (await readFile(`${racine}dist/_headers`, "utf8")).match(/Content-Security-Policy: (.*)/)[1];
  serveur = await servir(`${racine}dist`, { headers: { "content-security-policy": csp, "referrer-policy": "no-referrer" } });
  nav = await navigateur();
  htmlMaquette = await readFile(`${racine}catalogue/trigo-cercle/page.html`, "utf8");
  const { apiUrl } = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8"));
  api = apiUrl || serveur.url;
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

async function preparer(page) {
  await page.addInitScript(() => { try { sessionStorage.setItem("kermiclab:pseudo", "Testeur"); } catch { /* iframe sandboxée */ } });
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette });
}
const pixelsDessines = (page, selecteur) => page.locator(selecteur).evaluate((c) => {
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
});

test("métiers : anneaux, filtres, chaîne d'un métier, notions KermicLab et graphe 3D dans le détail", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  await preparer(page);
  await page.goto(serveur.url);
  await page.locator(".barre-laterale [data-nav=metiers]").click();
  await page.locator("#ecran-metiers").waitFor({ state: "visible" });
  assert.equal(new URL(page.url()).hash, "#metiers");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.espace), "metiers", "bandeau à la couleur de l'espace");
  await page.locator("#metiers-liste .metiers-item").first().waitFor();
  assert.match(await page.locator("#metiers-etat").textContent(), /38 métier\(s\) affiché\(s\) · 26 disciplines · 60 notions KermicLab reliées/);
  assert.equal(await page.locator("#metiers-anneaux .metiers-noeud.metier").count(), 38);
  assert.equal(await page.locator("#metiers-anneaux .metiers-noeud.notion").count(), 60);

  // Filtres : famille de métiers puis recherche sans accents.
  await page.locator("#metiers-categories [data-categorie=health]").click();
  assert.equal(await page.locator("#metiers-liste .metiers-item").count(), 10);
  await page.locator("#metiers-categories [data-categorie=\"\"]").click();
  await page.fill("#metiers-recherche", "ebeniste");
  assert.deepEqual(await page.locator("#metiers-liste .metiers-item strong").allTextContents(), ["Ébéniste"]);
  await page.fill("#metiers-recherche", "");

  // Un métier : sa chaîne s'allume et le détail relie disciplines, gestes et notions KermicLab.
  await page.locator("#metiers-liste [data-metier=data-analyst]").click();
  const detail = page.locator("#metiers-detail");
  await detail.waitFor({ state: "visible" });
  assert.equal(await detail.locator("h3").textContent(), "Data Analyst");
  const texte = await detail.textContent();
  for (const attendu of ["Statistiques", "Informatique", "Requêtage SQL", "Tests d’hypothèses", "Notions KermicLab à travailler", "Correspondance proposée"]) assert.ok(texte.includes(attendu), attendu);
  assert.ok(await detail.locator(".metiers-notion").count() >= 4, "notions des statistiques et de l'informatique");
  assert.equal(await page.locator("#metiers-anneaux .metiers-noeud.metier:not(.estompe)").count(), 1, "seul ce métier reste allumé");
  assert.equal(await pixelsDessines(page, "#metiers-detail .metiers-canvas") > 500, true, "le graphe 3D des notions est dessiné");
  await capturer(page, "metiers-data-analyst", { pleinePage: true });

  // Sens inverse : une notion mène à tous les métiers de ses disciplines.
  await detail.locator(".metiers-notion .metiers-pastille.notion", { hasText: "Statistiques" }).first().click();
  assert.equal(await detail.locator(".sur-titre").textContent(), "Notion KermicLab");
  assert.ok(await detail.locator(".metiers-bloc .metiers-pastille.metier").count() > 5, "les métiers qui mobilisent les statistiques");

  // Ouvrir la notion : la bulle du catalogue s'ouvre (même mécanisme que l'espace Éducation). L'API simulée ne connaît
  // que quelques notions, dont « electricite » (physique) : seules les notions du catalogue chargé ont ce bouton.
  await page.locator("#metiers-liste [data-metier=ing-biomedical]").click();
  assert.equal(await detail.locator("[data-ouvrir-notion]").count(), 1);
  await detail.locator("[data-ouvrir-notion=electricite]").click();
  await page.locator("#bulle-lab[open]").waitFor();
  await page.click("#fermer-bulle");
  assert.equal(await page.locator("#ecran-metiers").isVisible(), true);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("métiers : mobile (390 px), sans débordement horizontal, détail lisible", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await preparer(page);
  await page.goto(`${serveur.url}/#metiers`);
  await page.locator("#metiers-liste .metiers-item").first().waitFor();
  await page.locator("#metiers-liste [data-metier=infirmier]").click();
  await page.locator("#metiers-detail .metiers-canvas").waitFor();
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(debord <= 0, `déborde de ${debord}px`);
  assert.equal(await page.locator(".nav-mobile [data-nav=metiers][aria-current=page]").count(), 1);
  await capturer(page, "metiers-mobile", { pleinePage: true });
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
