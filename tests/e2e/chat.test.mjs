import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine } from "./outils.mjs";

let serveur, nav, htmlMaquette;
before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
  htmlMaquette = await readFile(`${racine}catalogue/trigo-cercle/page.html`, "utf8");
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

/** Simule le Worker (http://localhost:8787 dans dist/config.json). */
async function simulerApi(page) {
  const requetes = [];
  await page.route("http://localhost:8787/**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith("/maquettes/")) return route.fulfill({ contentType: "text/html", body: htmlMaquette });
    const corps = route.request().postDataJSON();
    requetes.push(corps);
    const sinus = /sinus|sine/i.test(corps.message);
    return route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(sinus
        ? { type: "maquette", texte: "Voici la page.", maquette: { id: "trigo-cercle", titre: "Le cercle trigonométrique", version: "1.0.0", langue: "fr", url: "http://localhost:8787/maquettes/trigo-cercle?lang=fr" } }
        : { type: "reponse", texte: "Réponse simple." })
    });
  });
  return requetes;
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
