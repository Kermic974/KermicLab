import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine } from "./outils.mjs";

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

/** Simule le Worker kermiclab-api (API et maquettes) à l'adresse configurée dans dist/config.json. */
async function simulerApi(page) {
  const requetes = [];
  await page.route(`${api}/auth/me`, (route) => route.fulfill({
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": serveur.url,
      "access-control-allow-credentials": "true"
    },
    body: JSON.stringify({ connecte: false })
  }));
  await page.route(`${api}/maquettes/**`, (route) => route.fulfill({ contentType: "text/html", body: htmlMaquette }));
  await page.route(`${api}/api/suggestions**`, (route) => route.fulfill({
    contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ suggestions: ["C'est quoi le sinus ?", "Je ne comprends pas les radians"] })
  }));
  await page.route(`${api}/api/catalogue`, (route) => route.fulfill({
    contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ notions: [
      { id: "fractions", titre: "Les fractions", version: "1.0.0", niveau: "college" },
      { id: "pythagore", titre: "Le théorème de Pythagore", version: "1.0.0", niveau: "college" },
      { id: "trigo-cercle", titre: "Le cercle trigonométrique", version: "1.0.0", niveau: "seconde" },
      { id: "derivation", titre: "La dérivation", version: "1.0.0", niveau: "premiere" },
      { id: "electricite", titre: "Circuits électriques et loi d'Ohm", version: "1.0.0", niveau: "college", matiere: "physique-chimie" }
    ].map((n) => ({ matiere: "mathematiques", ...n })) })
  }));
  await page.route(`${api}/api/chat`, async (route) => {
    const corps = route.request().postDataJSON();
    requetes.push(corps);
    const sinus = /sinus|sine/i.test(corps.message);
    return route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(sinus
        ? { type: "maquette", texte: "Voici la page.", suggestions: ["Que vaut sin(30°) ?"], maquette: { id: "trigo-cercle", titre: "Le cercle trigonométrique", version: "1.0.0", langue: "fr", url: `${api}/maquettes/trigo-cercle?lang=fr` } }
        : /volcan/i.test(corps.message)
          ? { type: "hors-catalogue", texte: "Pas encore de page.", suggestions: ["C'est quoi le sinus ?"] }
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

test("progression : suggestions cliquables, XP et badges gardés dans le navigateur", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR" });
  await simulerApi(page);
  await page.goto(serveur.url);
  await page.locator(".bienvenue .puce").first().click();
  await page.locator("li[data-maquette=trigo-cercle] iframe").waitFor();
  await page.locator(".relances .puce").first().waitFor();
  assert.equal(await page.locator("#pastille-serie").textContent(), "1");
  const stocke = await page.evaluate(() => JSON.parse(localStorage.getItem("kermiclab:progression")));
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
  assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:progression")), null);
  await relance.click();
  await page.locator("li[data-maquette=trigo-cercle] iframe").waitFor();
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("catalogue : barre de navigation, recherche sans accents, ouverture directe d'une notion", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 800 } });
  const requetes = await simulerApi(page);
  await page.goto(serveur.url);
  const barre = page.locator("#catalogue");
  await barre.locator(".notion").first().waitFor();
  assert.equal(await barre.isVisible(), true, "visible en permanence sur grand écran");
  assert.deepEqual(await barre.locator(".groupe-niveau summary > span:first-child").allTextContents(), ["Collège", "Seconde", "Première"]);
  assert.match(await page.locator("#catalogue-compteur").textContent(), /0 \/ 5 notions explorées/);
  await page.fill("#recherche-notion", "theoreme");
  assert.deepEqual(await barre.locator(".notion").allTextContents(), ["Le théorème de Pythagore"]);
  await page.fill("#recherche-notion", "volcan");
  assert.equal(await page.locator("#catalogue-vide").isVisible(), true);
  await page.fill("#recherche-notion", "");
  await barre.locator(".notion", { hasText: "Le cercle trigonométrique" }).click();
  await page.locator("li[data-maquette=trigo-cercle] iframe").waitFor();
  assert.equal(requetes.length, 0, "aucun appel au chat : la page est ouverte directement");
  const bouton = barre.locator("[data-notion=trigo-cercle]");
  assert.equal(await bouton.getAttribute("aria-current"), "page");
  assert.match(await bouton.textContent(), /✓/);
  assert.match(await page.locator("#catalogue-compteur").textContent(), /1 \/ 5/);
  // Onglets de matière : la physique-chimie a sa propre liste ; une recherche porte sur toutes les matières.
  assert.deepEqual(await page.locator("#catalogue-matieres [role=tab]").allTextContents(), ["Maths", "Physique-chimie"]);
  await page.click("[data-matiere=physique-chimie][role=tab]");
  assert.deepEqual(await barre.locator(".notion").allTextContents(), ["Circuits électriques et loi d'Ohm"]);
  await page.fill("#recherche-notion", "la");
  assert.ok((await barre.locator(".groupe-niveau summary > span:first-child").allTextContents()).some((t) => t.startsWith("Maths · ")));
  await page.fill("#recherche-notion", "");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("catalogue mobile : tiroir ouvert par le bouton, fermé par Échap, sans débordement", async () => {
  const { page, contexte } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 360, height: 740 }, isMobile: true });
  await simulerApi(page);
  await page.goto(serveur.url);
  await page.locator("#ouvrir-catalogue").waitFor({ state: "visible" });
  assert.equal(await page.locator("#catalogue").isVisible(), false, "fermé par défaut sur mobile");
  await page.click("#ouvrir-catalogue");
  await page.locator("#catalogue .notion").first().waitFor({ state: "visible" });
  assert.equal(await page.locator("#ouvrir-catalogue").getAttribute("aria-expanded"), "true");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("#catalogue").classList.contains("ouvert"));
  await page.click("#ouvrir-catalogue");
  await page.locator("#catalogue .notion", { hasText: "Les fractions" }).click();
  await page.locator("li[data-maquette=fractions] iframe").waitFor();
  assert.equal(await page.locator("#voile-catalogue").isVisible(), false, "le tiroir se referme après le choix");
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(debord <= 0, `déborde de ${debord}px`);
  await contexte.close();
});
