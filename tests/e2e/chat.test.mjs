import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab, capturer } from "./outils.mjs";

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

async function ouvrirConfiguration(page) {
  if (await page.locator("#panneau-chat").isVisible()) await page.click("#fermer-chat");
  await page.locator("[data-nav=profil]:visible").first().click();
}

test("avatar : chat replié, accessible au clavier sur chaque écran, conversation et brouillon conservés", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  const requetes = await simulerApi(page);
  await page.goto(serveur.url);
  await page.locator("#grille-matieres .matiere-carte").first().waitFor();
  const avatar = page.locator("#ouvrir-chat");
  const panneau = page.locator("#panneau-chat");
  assert.equal(await panneau.isVisible(), false);
  assert.equal(await avatar.getAttribute("aria-expanded"), "false");
  assert.equal(await avatar.locator(".avatar-robot").count(), 1);
  await avatar.focus();
  await page.keyboard.press("Enter");
  assert.equal(await panneau.isVisible(), true);
  assert.equal(await avatar.getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator("#question").evaluate((n) => n === document.activeElement), true);
  const boite = await panneau.boundingBox();
  assert.ok(boite.x > 1280 / 2 && boite.x + boite.width <= 1280 && boite.y >= 0);
  await page.fill("#question", "bonjour");
  await page.keyboard.press("Enter");
  await page.locator("#fil li", { hasText: "Réponse simple." }).waitFor();
  await page.fill("#question", "Mon brouillon");
  await page.keyboard.press("Escape");
  assert.equal(await panneau.isVisible(), false);
  assert.equal(await avatar.evaluate((n) => n === document.activeElement), true);
  assert.equal(await avatar.getAttribute("aria-expanded"), "false");
  for (const ecran of ["labs", "jeux", "defi", "progression", "badges", "profil"]) {
    await page.click(`.barre-laterale [data-nav="${ecran}"]`);
    await avatar.click();
    assert.equal(new URL(page.url()).hash, `#${ecran}`, "ouvrir le chat ne change pas d’écran");
    assert.equal(await panneau.isVisible(), true);
    assert.equal(await page.inputValue("#question"), "Mon brouillon");
    assert.equal(await page.locator("#fil .moi").count(), 1);
    await avatar.click();
    assert.equal(await panneau.isVisible(), false);
  }
  await page.click(".barre-laterale [data-nav=accueil]");
  await page.click('[data-action="question"]');
  assert.equal(await panneau.isVisible(), true);
  await page.click("#fermer-chat");
  assert.equal(await avatar.evaluate((n) => n === document.activeElement), true);
  await page.click("#suggestion button");
  await page.locator("#bulle-lab[open]").waitFor();
  await page.click("#bulle-question");
  await panneau.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.activeElement.id === "question");
  assert.equal(await panneau.isVisible(), true);
  assert.equal(await page.locator("#bulle-lab").isVisible(), false);
  assert.equal(await page.locator("#question").evaluate((n) => n === document.activeElement), true);
  await page.click(".barre-laterale [data-nav=notions]");
  assert.equal(new URL(page.url()).hash, "#notions", "Notions est un écran, comme les autres menus");
  assert.equal(await page.locator("#catalogue").isVisible(), true);
  assert.equal(requetes.length, 1, "ouvrir ou fermer ne déclenche aucun échange");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("avatar mobile : panneau borné à l’écran, saisie visible et fil défilant au-dessus de la navigation", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, {
    locale: "fr-FR", viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true
  });
  await simulerApi(page);
  await page.goto(serveur.url);
  await page.click("#ouvrir-chat");
  await page.locator("#fil li").first().waitFor();
  const avatar = await page.locator("#ouvrir-chat").boundingBox();
  const navigation = await page.locator(".nav-mobile").boundingBox();
  const panneau = await page.locator("#panneau-chat").boundingBox();
  const formulaire = await page.locator("#formulaire").boundingBox();
  assert.ok(avatar.y + avatar.height <= navigation.y);
  assert.ok(panneau.x >= 0 && panneau.x + panneau.width <= 360 && panneau.y >= 0);
  assert.ok(panneau.y + panneau.height <= avatar.y);
  assert.ok(formulaire.y >= panneau.y && formulaire.y + formulaire.height <= panneau.y + panneau.height);
  assert.equal(await page.locator("#fil").evaluate((n) => getComputedStyle(n).overflowY), "auto");
  await page.fill("#question", "c'est quoi le sinus ?");
  await page.keyboard.press("Enter");
  await page.locator("li[data-maquette=trigo-cercle] iframe").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.click("#fermer-chat");
  await page.click(".nav-mobile [data-nav=labs]");
  await page.click("#ouvrir-chat");
  assert.equal(new URL(page.url()).hash, "#labs");
  assert.equal(await page.locator("li[data-maquette=trigo-cercle]").count(), 1);
  await page.setViewportSize({ width: 667, height: 375 });
  const paysage = await page.locator("#panneau-chat").boundingBox();
  const saisie = await page.locator("#formulaire").boundingBox();
  assert.ok(paysage.y >= 0 && paysage.y + paysage.height <= 375);
  assert.ok(saisie.y >= paysage.y && saisie.y + saisie.height <= paysage.y + paysage.height);
  assert.ok((await page.locator("#fil").boundingBox()).height >= 100, "le fil reste lisible en paysage");
  await page.click("#fermer-chat");
  assert.equal(await page.locator("#panneau-chat").isVisible(), false);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("chat replié : une réponse en cours arrive sans rouvrir le panneau ni déplacer la page", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR" });
  await simulerApi(page);
  let repondre;
  const suite = new Promise((resolve) => { repondre = resolve; });
  await page.route(`${api}/api/chat`, async (route) => {
    await suite;
    await route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": serveur.url, "access-control-allow-credentials": "true" },
      body: JSON.stringify({ type: "reponse", texte: "Réponse différée." })
    });
  });
  await page.goto(serveur.url);
  await page.click("#ouvrir-chat");
  await page.fill("#question", "bonjour");
  const demande = page.waitForRequest(`${api}/api/chat`);
  await page.keyboard.press("Enter");
  await demande;
  await page.click("#fermer-chat");
  await page.evaluate(() => window.scrollTo(0, 300));
  const position = await page.evaluate(() => scrollY);
  repondre();
  await page.locator("#fil li", { hasText: "Réponse différée." }).waitFor({ state: "attached" });
  assert.equal(await page.locator("#panneau-chat").isVisible(), false);
  assert.equal(await page.evaluate(() => scrollY), position);
  await page.click("#ouvrir-chat");
  assert.equal(await page.locator("#fil li", { hasText: "Réponse différée." }).isVisible(), true);
  await page.click(".barre-laterale [data-nav=aide]");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#signalement").isVisible(), false);
  assert.equal(await page.locator("#panneau-chat").isVisible(), true, "Échap respecte la priorité du dialogue modal");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("chat : une question sur le sinus affiche la maquette dans le fil", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR" });
  const requetes = await simulerApi(page);
  await page.goto(serveur.url);
  await page.click("#ouvrir-chat");
  await page.locator("#fil li").first().waitFor();
  assert.match(await page.locator("#fil li").first().textContent(), /Kermiclab/);
  assert.equal(await page.locator("#entree-famille").isVisible(), false);
  await page.fill("#question", "c'est quoi le sinus ?");
  await page.keyboard.press("Enter");
  const cadre = page.locator("li[data-maquette=trigo-cercle] iframe");
  await cadre.waitFor();
  assert.equal(requetes[0].langue, "fr");
  const onglets = page.frameLocator("li[data-maquette=trigo-cercle] iframe").locator("[role=tab]");
  await onglets.first().waitFor();
  assert.equal(await onglets.count(), 3);
  await onglets.first().focus();
  await page.keyboard.press("Escape");
  await page.locator("#panneau-chat").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#panneau-chat").isVisible(), false);
  assert.equal(await page.locator("#ouvrir-chat").evaluate((n) => n === document.activeElement), true);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("i18n : détection automatique de l'anglais et sélecteur manuel", async () => {
  const { page, contexte } = await ouvrir(nav, serveur.url, { locale: "en-US" });
  const requetes = await simulerApi(page);
  await page.goto(serveur.url);
  await page.click("#ouvrir-chat");
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
  await page.click("#ouvrir-chat");
  await page.locator("#fil li").first().waitFor();
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(debord <= 0, `déborde de ${debord}px`);
  await contexte.close();
});

test("progression : suggestions cliquables, XP et badges gardés pour la session (sans cookie)", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR" });
  await simulerApi(page);
  await page.goto(serveur.url);
  await page.click("#ouvrir-chat");
  await page.locator(".bienvenue .puce").first().click();
  await page.locator("li[data-maquette=trigo-cercle] iframe").waitFor();
  await page.locator(".relances .puce").first().waitFor();
  assert.equal(await page.locator("#pastille-serie").textContent(), "1");
  const stocke = await page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:progression")));
  assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:progression")), null, "rien dans le stockage local sans cookie");
  assert.equal(stocke.questions, 1);
  assert.deepEqual(stocke.notions, ["trigo-cercle"]);
  await page.click("#fermer-chat");
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
  await page.click("#ouvrir-chat");
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
  await ouvrirConfiguration(page);
  await page.locator("#llm-actif").check();
  await page.click("#ouvrir-chat");
  await page.fill("#question", "Explique plus simplement");
  await page.keyboard.press("Enter");
  const fin = page.locator(".references-llm");
  await fin.waitFor();
  const credentials = await page.evaluate(() => window.credentialsChat);
  assert.equal(credentials, "include");
  assert.deepEqual(demande, { message: "Explique plus simplement", langue: "fr", utiliserLlm: true });
  assert.equal(await fin.locator("a").getAttribute("href"), `${api}/maquettes/trigo-cercle?lang=fr`);
  assert.match(await fin.locator(".source-description").textContent(), /trigonometrie · v1.0.0/);
  const details = fin.locator("details.details-llm");
  assert.equal(await details.evaluate((n) => n.open), false, "métadonnées repliées par défaut");
  assert.equal(await fin.locator(".metadonnees-llm").isVisible(), false);
  assert.equal(await fin.locator("a").isVisible(), true, "les sources restent visibles");
  await capturer(page, "chat-ia-details-replies");
  await details.locator("summary").click();
  assert.equal(await fin.locator(".metadonnees-llm").isVisible(), true);
  await capturer(page, "chat-ia-details-ouverts");
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

test("conversation : bonjour suivi de relances cliquables, puis nouvelle conversation", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR" });
  const requetes = await simulerApi(page);
  await page.route(`${api}/api/chat`, (route) => {
    const { message } = route.request().postDataJSON();
    requetes.push(message);
    const aide = /sais-tu faire/.test(message);
    return route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": serveur.url, "access-control-allow-credentials": "true" },
      body: JSON.stringify({
        type: "conversation", intention: aide ? "aide" : "salutation",
        texte: aide ? "Je connais 6 notions." : "Bonjour ! Je suis Kermiclab.",
        suggestions: aide ? ["C'est quoi le sinus ?"] : ["Que sais-tu faire ?", "C'est quoi le sinus ?"]
      })
    });
  });
  await page.goto(serveur.url);
  await page.click("#ouvrir-chat");
  await page.locator("#fil li.bienvenue").waitFor();
  await page.fill("#question", "bonjour");
  await page.keyboard.press("Enter");
  const reponse = page.locator("#fil li.conversation");
  await reponse.waitFor();
  assert.match(await reponse.textContent(), /Bonjour ! Je suis Kermiclab/);
  assert.match(await reponse.locator(".relances .puces-titre").textContent(), /Je te propose/);
  await capturer(page, "chat-politesse-relances");
  await reponse.locator(".puce", { hasText: "Que sais-tu faire ?" }).click();
  await page.locator("#fil li.conversation", { hasText: "Je connais 6 notions." }).waitFor();
  assert.deepEqual(requetes, ["bonjour", "Que sais-tu faire ?"]);
  assert.equal(await page.locator("#fil .relances").count(), 1, "seules les dernières relances restent proposées");

  const bouton = page.locator("#nouvelle-conversation");
  assert.equal(await bouton.getAttribute("aria-label"), "Nouvelle conversation");
  await page.fill("#question", "brouillon");
  await bouton.click();
  assert.equal(await page.locator("#fil li").count(), 1);
  assert.equal(await page.locator("#fil li.bienvenue").count(), 1);
  assert.equal(await page.locator("#puces-bienvenue .puce").count() > 0, true);
  assert.equal(await page.inputValue("#question"), "");
  assert.equal(await page.locator("#question").evaluate((n) => n === document.activeElement), true);
  assert.equal(requetes.length, 2, "repartir de zéro n'appelle pas l'API");
  await capturer(page, "chat-nouvelle-conversation");
  await page.selectOption("#langue", "en");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  assert.equal(await bouton.getAttribute("aria-label"), "New conversation");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("conversation : bouton « Nouvelle conversation » visible et sans débordement sur mobile", async () => {
  const { page, contexte } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await simulerApi(page);
  await page.goto(serveur.url);
  await page.click("#ouvrir-chat");
  const bouton = await page.locator("#nouvelle-conversation").boundingBox();
  const panneau = await page.locator("#panneau-chat").boundingBox();
  await page.waitForTimeout(300);
  assert.ok(bouton.width >= 36 && bouton.x >= panneau.x && bouton.x + bouton.width <= panneau.x + panneau.width);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await contexte.close();
});

test("IA : opt-in de session, désactivée si le site la coupe globalement", async () => {
  const { page, contexte } = await ouvrir(nav, serveur.url, { locale: "fr-FR" });
  await simulerApi(page, { llmActif: false });
  await page.goto(serveur.url);
  await ouvrirConfiguration(page);
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
  await page.click("#ouvrir-chat");
  await page.locator("#fil li").first().waitFor();
  const toggle = page.locator("#llm-actif");
  assert.equal(await toggle.isChecked(), false);
  await page.fill("#question", "c'est quoi le sinus ?");
  await page.keyboard.press("Enter");
  await page.locator("li[data-maquette=trigo-cercle] iframe").waitFor();
  assert.equal(requetes[0].utiliserLlm, false);
  await ouvrirConfiguration(page);
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
  await page.click("#ouvrir-chat");
  await page.locator("#fil li").first().waitFor();
  await page.fill("#question", "un exemple");
  await page.keyboard.press("Enter");
  await page.locator(".references-llm").waitFor();
  assert.equal(await page.locator(".references-llm a").count(), 0);
  await contexte.close();
});

test("catalogue : écran « Notions », recherche sans accents, ouverture directe d'une notion", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 800 } });
  const requetes = await simulerApi(page);
  await page.goto(serveur.url);
  const barre = page.locator("#catalogue");
  await page.locator("#grille-matieres .matiere-carte").first().waitFor();
  assert.equal(await barre.isVisible(), false, "masqué tant qu'on n'ouvre pas le menu");
  await page.click("#ouvrir-catalogue");
  await barre.locator(".notion").first().waitFor();
  assert.equal(await page.locator("#ouvrir-catalogue").getAttribute("aria-current"), "page");
  assert.equal(new URL(page.url()).hash, "#notions");
  assert.equal(await page.locator("#salut").textContent(), "Notions");
  assert.equal(await page.locator("#accueil").isVisible(), false);
  await capturer(page, "notions-ecran");
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
  assert.equal(await barre.isVisible(), true, "l'écran Notions reste affiché sous la bulle, comme Jeux");
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
  assert.equal(await page.locator("#ecran-jeux").isVisible(), false, "Notions remplace l'écran courant, comme les autres menus");
  await page.goBack();
  await page.locator("#ecran-jeux").waitFor({ state: "visible" });
  assert.equal(await page.locator("#catalogue").isVisible(), false, "le retour arrière ramène à l'écran précédent");
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

test("navigation : défi, trophées et configuration remplacent l'accueil sans panneau modal", async () => {
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
  assert.equal(await page.locator("#configuration-titre").textContent(), "Configuration");
  assert.equal(await page.locator("#llm-actif").isVisible(), true);
  assert.equal(await page.locator("#dialogue-profil").isVisible(), false);
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

test("catalogue mobile : écran « Notions » depuis la navigation du bas, sans débordement", async () => {
  const { page, contexte } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 360, height: 740 }, isMobile: true });
  await simulerApi(page);
  await page.goto(serveur.url);
  const explorer = page.locator(".nav-mobile [data-nav=notions]");
  await explorer.waitFor({ state: "visible" });
  assert.equal(await page.locator("#catalogue").isVisible(), false, "masqué sur l'accueil");
  await explorer.click();
  await page.locator("#catalogue .notion").first().waitFor({ state: "visible" });
  assert.equal(await explorer.getAttribute("aria-current"), "page");
  await capturer(page, "notions-mobile");
  await page.locator("#catalogue .notion", { hasText: "Les fractions" }).click();
  await page.locator("#bulle-lab[open][data-notion=fractions] #bulle-cadre").waitFor();
  await page.click("#fermer-bulle");
  assert.equal(await page.locator("#catalogue").isVisible(), true, "retour à la liste après la bulle");
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

test("chat : bascule plein écran et retour, sur ordinateur et mobile", async () => {
  for (const options of [{ viewport: { width: 1280, height: 800 } }, { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }]) {
    const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", ...options });
    await simulerApi(page);
    await page.goto(serveur.url);
    await page.click("#ouvrir-chat");
    const panneau = page.locator("#panneau-chat");
    const bouton = page.locator("#plein-ecran-chat");
    assert.equal(await bouton.getAttribute("aria-pressed"), "false");
    assert.equal(await bouton.getAttribute("aria-label"), "Afficher le chat en plein écran");
    await page.waitForTimeout(300); // fin de l'animation d'ouverture
    const avant = await panneau.boundingBox();
    await bouton.click();
    await page.waitForTimeout(300);
    const { width, height } = options.viewport;
    const apres = await panneau.boundingBox();
    assert.equal(await bouton.getAttribute("aria-pressed"), "true");
    assert.equal(await bouton.getAttribute("aria-label"), "Quitter le plein écran");
    assert.ok(apres.width >= width - 32 && apres.height >= height - 32, `panneau ${apres.width}×${apres.height}`);
    assert.ok(apres.x >= 0 && apres.y >= 0 && apres.x + apres.width <= width && apres.y + apres.height <= height);
    const saisie = await page.locator("#formulaire").boundingBox();
    assert.ok(saisie.y + saisie.height <= height, "la saisie reste visible");
    assert.equal(await page.locator("body > .boite-idees-flottante").isVisible(), false, "aucun bouton flottant par-dessus");
    await capturer(page, `chat-plein-ecran-${width}`);
    await page.fill("#question", "c'est quoi le sinus ?");
    await page.keyboard.press("Enter");
    await page.locator("li[data-maquette=trigo-cercle] iframe").waitFor();
    await bouton.click();
    await page.waitForTimeout(300);
    const retour = await panneau.boundingBox();
    assert.ok(Math.abs(retour.width - avant.width) < 2, "retour à la taille d'origine");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(erreurs, []);
    await contexte.close();
  }
});

test("assistant : progression résumée sur l'appareil et boutons vers les écrans", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 800 } });
  await simulerApi(page);
  await page.route(`${api}/api/chat`, (route) => route.fulfill({
    contentType: "application/json",
    headers: { "access-control-allow-origin": serveur.url, "access-control-allow-credentials": "true" },
    body: JSON.stringify({
      type: "conversation", intention: "progression", resume: "progression",
      texte: "Voici où tu en es.", suggestions: ["Quels jeux as-tu ?"],
      actions: ["progression", "badges", "inconnu", "defi"]
    })
  }));
  await page.goto(serveur.url);
  await page.click("#ouvrir-chat");
  await page.fill("#question", "Où j'en suis ?");
  await page.keyboard.press("Enter");
  const resume = page.locator("#fil .resume-progression");
  await resume.waitFor();
  assert.match(await resume.textContent(), /NiveauNiveau 1/);
  assert.match(await resume.textContent(), /Série0 jour\(s\)/);
  assert.match(await resume.textContent(), /Badges0 \/ \d+/);
  const boutons = page.locator("#fil .actions-chat button");
  assert.deepEqual(await boutons.allTextContents(), ["Progression", "Mes trophées", "Défi express"], "écran inconnu ignoré");
  await capturer(page, "chat-assistant-progression");
  await boutons.filter({ hasText: "Mes trophées" }).click();
  assert.equal(new URL(page.url()).hash, "#badges");
  assert.equal(await page.locator("#progres").isVisible(), true);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
