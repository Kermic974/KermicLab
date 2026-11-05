import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab } from "./outils.mjs";

let serveur, nav, htmlMaquette, api;
before(async () => {
  serveur = await servir(`${racine}dist`, { headers: { "referrer-policy": "no-referrer" } });
  nav = await navigateur();
  htmlMaquette = await readFile(`${racine}catalogue/trigo-cercle/page.html`, "utf8");
  // L'URL d'API est celle que le build a réellement écrite (Worker kermiclab-api, localhost en CI, ou même origine).
  const { apiUrl } = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8"));
  api = apiUrl || serveur.url;
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

/** Simule l'API et entre un pseudo de session (fenêtre de premier lancement déjà passée). */
async function simulerApi(page, { pseudo = "Testeur", jeux = false, llmActif = true } = {}) {
  // Le script s'exécute aussi dans les iframes sandboxées des maquettes, sans accès au stockage : on l'ignore alors.
  if (pseudo) await page.addInitScript((p) => { try { if (!sessionStorage.getItem("kermiclab:pseudo")) sessionStorage.setItem("kermiclab:pseudo", p); } catch { /* iframe sandboxée */ } }, pseudo);
  return simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette, jeux, llmActif });
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
  assert.equal(await page.locator("#llm-actif").isChecked(), false);
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

test("IA : sources et métadonnées en fin de réponse, requête avec cookie sans historique", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 360, height: 800 } });
  await simulerApi(page);
  await page.addInitScript(() => {
    const fetchOrigine = window.fetch;
    window.fetch = (url, options) => {
      if (String(url).endsWith("/api/chat")) window.credentialsChat = options.credentials;
      return fetchOrigine(url, options);
    };
  });
  let demande;
  await page.route(`${api}/api/chat`, (route) => {
    demande = route.request().postDataJSON();
    return route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": serveur.url, "access-control-allow-credentials": "true" },
      body: JSON.stringify({
        type: "reponse", texte: "Le sinus donne la hauteur du point.",
        suggestions: ["Donne-moi un exemple"],
        sources: [{
          id: "trigo-cercle", titre: "Le cercle trigonométrique",
          url: `${api}/maquettes/trigo-cercle?lang=fr`,
          description: "Le cercle trigonométrique — mathematiques/trigonometrie · v1.0.0"
        }],
        llm: {
          fournisseur: "cloudflare-workers-ai", modele: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          harness: { nom: "KermicLab", version: "1.0.0", prompt: "tuteur-catalogue-v1", perimetre: "catalogue-kermiclab", acces: "gratuit-provisoire" },
          quota: { limite: 1000, consommes: 180, restants: 820 }, repli: false,
          appels: [{ fournisseur: "cloudflare-workers-ai", modele: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", tokensSortie: 180, comptage: "fournisseur" }]
        }
      })
    });
  });
  await page.goto(serveur.url);
  await page.locator("#fil li").first().waitFor();
  await page.locator("#llm-actif").check();
  await page.fill("#question", "Explique plus simplement");
  await page.keyboard.press("Enter");
  const fin = page.locator(".references-llm");
  await fin.waitFor();
  const credentials = await page.evaluate(() => window.credentialsChat);
  assert.equal(credentials, "include");
  assert.deepEqual(demande, { message: "Explique plus simplement", langue: "fr", utiliserLlm: true });
  assert.equal(await fin.locator("a").getAttribute("href"), `${api}/maquettes/trigo-cercle?lang=fr`);
  assert.match(await fin.locator(".source-description").textContent(), /trigonometrie · v1.0.0/);
  assert.match(await fin.textContent(), /tuteur-catalogue-v1/);
  assert.match(await fin.textContent(), /180 \/ 1000/);
  assert.match(await fin.textContent(), /@cf\/meta\/llama-3.3/);
  assert.equal(await fin.evaluate((n) => n === n.parentElement.lastElementChild), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.selectOption("#langue", "en");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  assert.match(await fin.textContent(), /KermicLab sources consulted/);
  assert.match(await fin.textContent(), /Temporarily free/);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("IA : opt-in de session, désactivée si le site la coupe globalement", async () => {
  const { page, contexte } = await ouvrir(nav, serveur.url, { locale: "fr-FR" });
  await simulerApi(page, { llmActif: false });
  await page.goto(serveur.url);
  const toggle = page.locator("#llm-actif");
  await toggle.waitFor();
  assert.equal(await toggle.isDisabled(), true);
  assert.match(await page.locator("#llm-etat").textContent(), /désactivée ou indisponible/);
  await contexte.close();
});

test("IA : l’opt-in individuel reste désactivé par défaut et peut être mémorisé par session", async () => {
  const { page, contexte } = await ouvrir(nav, serveur.url);
  const requetes = await simulerApi(page);
  await page.goto(serveur.url);
  await page.locator("#fil li").first().waitFor();
  const toggle = page.locator("#llm-actif");
  assert.equal(await toggle.isChecked(), false);
  await page.fill("#question", "c'est quoi le sinus ?");
  await page.keyboard.press("Enter");
  await page.locator("li[data-maquette=trigo-cercle] iframe").waitFor();
  assert.equal(requetes[0].utiliserLlm, false);
  await toggle.check();
  assert.equal(await page.evaluate(() => sessionStorage.getItem("kermiclab:llm:actif")), "true");
  await page.reload();
  await page.locator("#llm-actif").waitFor();
  await page.waitForFunction(() => !document.querySelector("#llm-actif").disabled);
  assert.equal(await page.locator("#llm-actif").isChecked(), true);
  await contexte.close();
});

test("IA : un lien non issu du catalogue n'est pas rendu comme source cliquable", async () => {
  const { page, contexte } = await ouvrir(nav, serveur.url, { locale: "fr-FR" });
  await simulerApi(page);
  await page.route(`${api}/api/chat`, (route) => route.fulfill({
    contentType: "application/json",
    headers: { "access-control-allow-origin": serveur.url, "access-control-allow-credentials": "true" },
    body: JSON.stringify({
      type: "reponse", texte: "Une explication.",
      sources: [{ titre: "Source non autorisée", url: "javascript:alert(1)", description: "Lien à refuser." }],
      llm: { fournisseur: "test", modele: "test", harness: { nom: "KermicLab", version: "1.0.0", prompt: "tuteur-catalogue-v1", perimetre: "catalogue-kermiclab" }, quota: { consommes: 100, limite: 1000 }, appels: [] }
    })
  }));
  await page.goto(serveur.url);
  await page.locator("#fil li").first().waitFor();
  await page.fill("#question", "un exemple");
  await page.keyboard.press("Enter");
  await page.locator(".references-llm").waitFor();
  assert.equal(await page.locator(".references-llm a").count(), 0);
  await contexte.close();
});

test("catalogue : tiroir « Notions », recherche sans accents, ouverture directe d'une notion", async () => {
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

test("navigation : Labs, Jeux et Progression ont des écrans séparés des Notions", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 800 } });
  const requetes = await simulerApi(page, { jeux: true });
  await page.goto(serveur.url);
  const catalogue = page.locator("#catalogue");
  const labs = page.locator(".barre-laterale [data-nav=labs]");
  const jeux = page.locator(".barre-laterale [data-nav=jeux]");
  await labs.click();
  assert.equal(await page.locator("#ecran-labs").isVisible(), true);
  assert.equal(await catalogue.isVisible(), false);
  assert.equal(await page.locator("#accueil").isVisible(), false);
  assert.equal(await page.locator("#matieres").isVisible(), false);
  assert.equal(await page.locator("#ecran-jeux").isVisible(), false);
  assert.equal(await labs.getAttribute("aria-current"), "page");
  assert.equal(await page.locator("#salut").textContent(), "Labs");
  assert.equal(await page.locator("#salut").evaluate((n) => n === document.activeElement), true);
  assert.deepEqual(await page.locator("#ecran-labs a").evaluateAll((liens) => liens.map((l) => l.getAttribute("href"))), [
    "cercle/?mode=explore", "cercle/?mode=learn", "cercle/?mode=play"
  ]);
  assert.equal(await page.locator("#ecran-labs [data-notion]").count(), 0, "les fiches de Notions ne deviennent pas des Labs");
  await jeux.click();
  assert.equal(await page.locator("#ecran-jeux").isVisible(), true);
  assert.equal(await page.locator("#ecran-labs").isVisible(), false);
  assert.equal(await catalogue.isVisible(), false);
  assert.deepEqual(await page.locator("#grille-jeux h3").allTextContents(), ["Les échecs"]);
  assert.equal(await labs.getAttribute("aria-current"), null);
  assert.equal(await jeux.getAttribute("aria-current"), "page");
  await page.fill("#recherche-jeu", "echecs");
  assert.equal(await page.locator("#grille-jeux article").count(), 1, "recherche sans accents");
  await page.fill("#recherche-jeu", "fractions");
  assert.equal(await page.locator("#grille-jeux article").count(), 0);
  assert.equal(await page.locator("#jeux-vide").isVisible(), true);
  await page.fill("#recherche-jeu", "");
  await page.click("[data-jeu=echecs]");
  await page.locator("#bulle-lab[open][data-notion=echecs]").waitFor();
  assert.equal(requetes.length, 0, "l'ouverture ne passe pas par le chat");
  await page.click("#fermer-bulle");
  await page.waitForFunction(() => document.activeElement?.dataset.jeu === "echecs");
  assert.match(await page.locator("#grille-jeux").textContent(), /déjà explorée/);
  await page.click("#ouvrir-catalogue");
  await page.locator("#catalogue .notion").first().waitFor();
  assert.deepEqual(await page.locator("#catalogue-matieres [role=tab]").allTextContents(), ["Maths", "Physique-chimie", "Philosophie", "Jeux"]);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#ecran-jeux").isVisible(), true, "fermer les Notions conserve l'écran courant");
  await page.locator(".barre-laterale [data-nav=progression]").click();
  assert.equal(await page.locator("#semaine").isVisible(), true);
  assert.equal(await page.locator("#ecran-jeux").isVisible(), false);
  assert.equal(await page.locator("#accueil").isVisible(), false);
  await page.locator(".barre-laterale [data-nav=accueil]").click();
  assert.equal(await page.locator("#accueil").isVisible(), true);
  assert.equal(await page.locator("#salut").textContent(), "Bonjour Testeur 👋");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("navigation : liens directs, rechargement, historique et traduction des écrans", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 800 } });
  await simulerApi(page, { jeux: true });
  await page.goto(`${serveur.url}/#labs`);
  await page.locator("#ecran-labs").waitFor();
  assert.equal(await page.locator("#accueil").isVisible(), false);
  await page.locator(".evitement").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.hash === "#contenu");
  assert.equal(await page.locator("#ecran-labs").isVisible(), true, "le lien d'évitement ne change pas d'écran");
  await page.goBack();
  await page.locator(".barre-laterale [data-nav=jeux]").click();
  assert.equal(new URL(page.url()).hash, "#jeux");
  await page.goBack();
  await page.locator("#ecran-labs").waitFor();
  await page.goForward();
  await page.locator("#ecran-jeux").waitFor();
  await page.reload();
  await page.locator("#ecran-jeux").waitFor();
  assert.equal(await page.locator(".barre-laterale [data-nav=jeux]").getAttribute("aria-current"), "page");
  await page.selectOption("#langue", "en");
  await page.waitForFunction(() => document.querySelector("#salut").textContent === "Games");
  assert.match(await page.locator("#accroche").textContent(), /Choose a game/);
  assert.equal(await page.locator("#recherche-jeu").getAttribute("placeholder"), "Search a game…");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("jeux : états vides explicites sans bloquer les Labs", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 800 } });
  await simulerApi(page);
  await page.goto(`${serveur.url}/#jeux`);
  await page.locator("#ecran-jeux").waitFor();
  assert.equal(await page.locator("#jeux-vide").textContent(), "Aucun jeu disponible pour le moment.");
  await page.route(`${api}/api/catalogue`, (route) => route.fulfill({
    contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ notions: [] })
  }));
  await page.reload();
  await page.locator("#ecran-jeux").waitFor();
  assert.match(await page.locator("#jeux-vide").textContent(), /catalogue/i);
  await page.locator(".barre-laterale [data-nav=labs]").click();
  assert.equal(await page.locator("#ecran-labs a").count(), 3);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("navigation : défi, trophées et profil remplacent l'accueil sans panneau modal", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 800 } });
  await simulerApi(page);
  await page.goto(`${serveur.url}/#defi`);
  await page.locator("#defi .reponse").first().waitFor();
  assert.equal(await page.locator("#accueil").isVisible(), false);
  assert.equal(await page.locator("#defi").evaluate((n) => n.closest("main") !== null && n.tagName === "SECTION"), true);
  await page.locator("#defi .reponse").nth(1).click();
  await page.selectOption("#langue", "en");
  await page.waitForFunction(() => document.querySelector("#salut").textContent === "Quick challenge");
  assert.match(await page.locator("#defi-retour").textContent(), /Correct/);
  assert.ok((await page.locator("#defi .reponse").first().isDisabled()), "changer de langue ne permet pas de répondre deux fois");
  await page.locator(".barre-laterale .nav-bouton[data-nav=profil]").click();
  assert.equal(await page.locator("#profil").isVisible(), true);
  assert.equal(await page.locator("#defi").isVisible(), false);
  assert.equal(await page.inputValue("#profil-pseudo"), "Testeur");
  await page.locator(".barre-laterale [data-nav=badges]").click();
  assert.equal(await page.locator("#progres").isVisible(), true);
  assert.equal(await page.locator("#profil").isVisible(), false);
  assert.equal(await page.locator("dialog[open]").count(), 0);
  await page.reload();
  await page.locator("#progres").waitFor();
  assert.equal(await page.locator(".barre-laterale [data-nav=badges]").getAttribute("aria-current"), "page");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("catalogue mobile : tiroir ouvert par le bouton, fermé par Échap, sans débordement", async () => {
  const { page, contexte } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 360, height: 740 }, isMobile: true });
  await simulerApi(page);
  await page.goto(serveur.url);
  const explorer = page.locator(".nav-mobile [data-nav=catalogue]");
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
  await page.locator("#ecran-jeux").waitFor();
  assert.deepEqual(await page.locator("#grille-jeux h3").allTextContents(), ["Les échecs"]);
  assert.equal(await page.locator("#catalogue").isVisible(), false);
  await page.locator(".nav-mobile [data-nav=labs]").click();
  assert.equal(await page.locator("#ecran-labs").isVisible(), true);
  assert.equal(await page.locator("#ecran-jeux").isVisible(), false);
  await page.locator(".nav-mobile [data-nav=progression]").click();
  assert.equal(await page.locator("#semaine").isVisible(), true);
  await page.locator(".nav-mobile [data-nav=accueil]").click();
  assert.equal(await page.locator("#accueil").isVisible(), true);
  const boutons = await page.locator(".nav-mobile-bouton").evaluateAll((elements) => elements.map((n) => {
    const r = n.getBoundingClientRect();
    return { largeur: r.width, hauteur: r.height, droite: r.right, bas: r.bottom };
  }));
  assert.ok(boutons.every((b) => b.largeur >= 44 && b.hauteur >= 44 && b.droite <= 320 && b.bas <= 740), "les huit entrées restent visibles et tactiles");
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(debord <= 0, `déborde de ${debord}px`);
  await contexte.close();
});
