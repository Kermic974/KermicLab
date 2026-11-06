import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab, capturer } from "./outils.mjs";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";

let serveur, nav, api;
before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
  api = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8")).apiUrl || serveur.url;
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

/** Contexte porté par le lien (repli vers le formulaire du tableau de bord, dans le fragment d'URL). */
async function brouillon(lien) {
  await lien.focus();
  const url = new URL(await lien.getAttribute("href"));
  assert.notEqual(url.hostname, "github.com", "aucun compte GitHub n'est demandé");
  assert.equal(url.pathname, "/");
  assert.match(url.hash, /^#idee=/);
  const contexte = JSON.parse(decodeURIComponent(url.hash.slice(6)));
  return Object.entries(contexte).map(([cle, valeur]) => `${cle}: ${valeur}`).join("\n");
}

test("boîte à idées : pages publiques, mobile et application hors ligne", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { viewport: { width: 360, height: 740 } });
  for (const fichier of ["feuille-de-route.html", "confidentialite.html", "mentions-legales.html"]) {
    await page.goto(`${serveur.url}/${fichier}?secret=NE_PAS_TRANSMETTRE#prive`);
    const lien = page.locator("body > .boite-idees");
    const corps = await brouillon(lien);
    assert.match(corps, new RegExp(`page: ${fichier}`));
    assert.doesNotMatch(corps, /NE_PAS_TRANSMETTRE|prive/);
    assert.ok(await lien.isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.goto(new URL(`file://${racine}index.html`).href);
  assert.match(await page.locator("body > .boite-idees").getAttribute("href"), /^https:\/\/www\.kermiclab\.online\/#idee=/);
  for (const mode of ["explore", "learn", "play"]) {
    await page.locator(`[data-tab="${mode}"]`).click();
    assert.match(await brouillon(page.locator("body > .boite-idees")), new RegExp(`onglet: ${mode}`));
  }
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("boîte à idées : dialogues, navigation, langues et aucune donnée de l'élève", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR" });
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette: CATALOGUE.pages["trigo-cercle"].fr, jeux: true });
  await page.goto(serveur.url);
  const pseudo = page.locator("#dialogue-pseudo");
  await pseudo.waitFor({ state: "visible" });
  assert.match(await brouillon(pseudo.locator(":scope > .boite-idees")), /dialogue: dialogue-pseudo/);
  await page.fill("#pseudo", "PseudoSecret");
  await page.click("#formulaire-pseudo button[type=submit]");
  await page.click("#ouvrir-chat");
  await page.fill("#question", "Conversation privée à ne pas transmettre");
  await page.click("#fermer-chat");
  for (const vue of ["labs", "jeux", "defi", "progression", "badges", "profil", "aide"]) {
    await page.locator(`.barre-laterale [data-nav="${vue}"]`).first().click();
    const ouvert = page.locator("dialog[open]").last();
    // Le formulaire de signalement (comme celui des idées) n'embarque pas de boîte à idées.
    const lien = await ouvert.locator(":scope > .boite-idees").count() ? ouvert.locator(":scope > .boite-idees") : page.locator(".nav-idees > .boite-idees");
    if (vue === "aide") assert.equal(await ouvert.locator(".boite-idees").count(), 0);
    const corps = await brouillon(lien);
    assert.doesNotMatch(corps, /PseudoSecret|Conversation privée/);
    if (vue === "labs" || vue === "jeux") {
      assert.match(corps, new RegExp(`navigation: ${vue}`));
      await page.locator('.barre-laterale [data-nav="notions"]').click();
      assert.match(await brouillon(page.locator(".nav-idees > .boite-idees")), /navigation: notions/);
      await page.goBack();
      assert.doesNotMatch(await brouillon(page.locator(".nav-idees > .boite-idees")), /navigation: notions|onglet:/);
    }
    if (await ouvert.count()) await page.evaluate(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
  }
  await page.selectOption("#langue", "en");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  assert.equal(await page.locator(".nav-idees > .boite-idees").textContent(), "Idea box");
  assert.match(await page.locator(".nav-idees > .boite-idees").getAttribute("aria-label"), /no account/);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("boîte à idées : onglets des notions, sous-vues des jeux et formulaire du tableau de bord depuis une iframe isolée", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url);
  for (const id of ["fractions", "echecs"]) {
    await page.route(`${serveur.url}/maquettes/${id}`, (route) => route.fulfill({ contentType: "text/html", body: CATALOGUE.pages[id].fr }));
    await page.goto(`${serveur.url}/maquettes/${id}`);
    for (const onglet of ["explication", "application", "mise-en-situation"]) {
      await page.locator(`[data-onglet="${onglet}"]`).click();
      const corps = await brouillon(page.locator("body > .boite-idees"));
      assert.match(corps, new RegExp(`page: ${id}`));
      assert.match(corps, new RegExp(`onglet: ${onglet}`));
      // Page servie par le Worker (/maquettes/…), sans tableau de bord à la racine : repli vers le site.
      assert.match(await page.locator("body > .boite-idees").getAttribute("href"), /^https:\/\/www\.kermiclab\.online\/#idee=/);
      assert.match(corps, /version: /);
    }
    if (id === "echecs") {
      await page.locator('[data-onglet="academie"]').click();
      assert.match(await brouillon(page.locator("body > .boite-idees")), /vues: accueil/);
      await page.locator('#panneau-academie [data-action="detail"]').click();
      const corps = await brouillon(page.locator("body > .boite-idees"));
      assert.match(corps, /onglet: academie/);
      assert.match(corps, /vues: detail/);
      assert.doesNotMatch(corps, /vues: accueil/);
    }
  }
  await page.evaluate(() => {
    const dialogue = document.createElement("dialog");
    dialogue.id = "dialogue-sans-onglet";
    document.body.append(dialogue);
    dialogue.showModal();
  });
  const dialogue = page.locator("#dialogue-sans-onglet");
  await dialogue.locator(":scope > .boite-idees").waitFor();
  assert.match(await brouillon(dialogue.locator(":scope > .boite-idees")), /onglet: academie/);
  await dialogue.evaluate((element) => element.close());
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette: CATALOGUE.pages["trigo-cercle"].fr });
  await page.goto(serveur.url);
  await page.fill("#pseudo", "Test");
  await page.click("#formulaire-pseudo button[type=submit]");
  const iframe = page.waitForEvent("framenavigated", (frame) =>
    frame.parentFrame() === page.mainFrame() && new URL(frame.url()).pathname === "/maquettes/trigo-cercle");
  await page.locator("#suggestion button").click();
  const maquette = await iframe;
  await maquette.waitForLoadState("load");
  const cadre = page.frameLocator("#bulle-cadre");
  const lien = cadre.locator("body > .boite-idees");
  await lien.click();
  const formulaire = page.locator("#dialogue-idee");
  await formulaire.waitFor({ state: "visible" });
  assert.equal(page.frames().length >= 2, true);
  assert.match(await page.locator("#idee-contexte").textContent(), /trigo-cercle/);
  assert.equal(contexte.pages().length, 1, "aucun onglet GitHub ouvert");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("boîte à idées : formulaire natif envoyé au Worker, depuis le site et depuis une page ouverte seule", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => { try { sessionStorage.setItem("kermiclab:pseudo", "Testeur"); } catch { /* iframe */ } });
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette: CATALOGUE.pages["trigo-cercle"].fr });
  const envois = [];
  await page.route(`${api}/api/idee`, (route) => {
    envois.push(route.request().postDataJSON());
    return route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ ok: true, texte: "Merci pour ton idée !" }) });
  });
  await page.goto(`${serveur.url}/#labs`);
  const cta = page.locator(".nav-idees > .boite-idees");
  await cta.waitFor();
  assert.equal(await cta.locator("svg").count(), 1, "icône pensive à l'ampoule");
  assert.equal(await page.locator("body > .boite-idees-flottante").isVisible(), false, "pas de doublon flottant sur ordinateur");
  await cta.click();
  const dialogue = page.locator("#dialogue-idee");
  await dialogue.waitFor({ state: "visible" });
  assert.equal(await dialogue.locator(".boite-idees").count(), 0, "pas de bouton dans son propre formulaire");
  assert.match(await page.locator("#idee-contexte").textContent(), /index\.html · labs/);
  await capturer(page, "idees-formulaire");
  await page.fill("#texte-idee", "Un mode chronomètre");
  await page.click("#formulaire-idee button[type=submit]");
  await page.locator("#retour-idee", { hasText: "Merci" }).waitFor();
  assert.equal(envois[0].message, "Un mode chronomètre");
  assert.equal(envois[0].contexte.navigation, "labs");
  assert.equal(await page.inputValue("#texte-idee"), "");
  await page.click("#fermer-idee");

  await page.goto(`${serveur.url}/feuille-de-route.html`);
  await page.locator("body > .boite-idees").click();
  await dialogue.waitFor({ state: "visible" });
  assert.match(await page.locator("#idee-contexte").textContent(), /feuille-de-route\.html/);
  assert.equal(new URL(page.url()).hash, "", "le contexte quitte l'adresse");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("boîte à idées : pastille compacte sur mobile, sans débordement", async () => {
  const { page, contexte } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await page.addInitScript(() => { try { sessionStorage.setItem("kermiclab:pseudo", "Testeur"); } catch { /* iframe */ } });
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette: CATALOGUE.pages["trigo-cercle"].fr });
  await page.goto(serveur.url);
  const pastille = page.locator("body > .boite-idees-flottante");
  await pastille.waitFor();
  const boite = await pastille.boundingBox();
  assert.ok(boite.width <= 48 && boite.height <= 48, `pastille ${boite.width}×${boite.height}`);
  await capturer(page, "idees-pastille-mobile");
  const barre = await page.locator(".nav-mobile").boundingBox();
  assert.ok(boite.y + boite.height <= barre.y, "au-dessus de la navigation");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  // En bas de page, le pied de page reste lisible au-dessus des boutons flottants (chat, boîte à idées).
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  const chevauchement = await page.evaluate(() => {
    const pied = document.querySelector(".pied").getBoundingClientRect();
    const hauts = [...document.querySelectorAll("#ouvrir-chat, body > .boite-idees-flottante")].map((n) => n.getBoundingClientRect().top);
    return pied.bottom - Math.min(...hauts);
  });
  assert.ok(chevauchement <= 0, `pied de page masqué de ${chevauchement}px`);
  await pastille.tap();
  await page.locator("#dialogue-idee").waitFor({ state: "visible" });
  await contexte.close();
});

test("boîte à idées : l'IA prépare le cadrage de l'issue, relu puis joint à l'envoi", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => { try { sessionStorage.setItem("kermiclab:pseudo", "Testeur"); } catch { /* iframe */ } });
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette: CATALOGUE.pages["trigo-cercle"].fr });
  const cadrages = [];
  const envois = [];
  const cors = { "access-control-allow-origin": serveur.url, "access-control-allow-credentials": "true" };
  await page.route(`${api}/api/idee/cadrage`, (route) => {
    cadrages.push(route.request().postDataJSON());
    return route.fulfill({ contentType: "application/json", headers: cors, body: JSON.stringify({
      ok: true,
      cadrage: { titre: "Ajouter un chronomètre au défi express", besoin: "Se mesurer au temps.", criteres: ["Chronomètre optionnel"], zones: ["tableau-de-bord"], questions: [], pistes: ["web/app.js"] },
      llm: { fournisseur: "cloudflare-workers-ai", modele: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", harness: { prompt: "cadrage-idee-v1" }, quota: { consommes: 90, limite: 1000 } }
    }) });
  });
  await page.route(`${api}/api/idee`, (route) => {
    envois.push(route.request().postDataJSON());
    return route.fulfill({ contentType: "application/json", headers: cors, body: JSON.stringify({ ok: true, texte: "Merci pour ton idée !" }) });
  });
  await page.goto(serveur.url);
  await page.locator(".nav-idees > .boite-idees").click();
  const preparer = page.locator("#preparer-idee");
  assert.equal(await preparer.isDisabled(), true, "l'IA reste un opt-in");
  assert.match(await page.locator("#idee-ia-aide").textContent(), /Active l’IA/);
  await page.click("#fermer-idee");
  await page.locator('.barre-laterale [data-nav="profil"]').click();
  await page.locator("#llm-actif").check();
  await page.locator(".nav-idees > .boite-idees").click();
  assert.equal(await preparer.isDisabled(), false);
  await preparer.click();
  assert.match(await page.locator("#retour-idee").textContent(), /Écris d’abord/);
  await page.fill("#texte-idee", "un chrono pour le défi");
  await preparer.click();
  const bloc = page.locator("#idee-cadrage");
  await bloc.waitFor({ state: "visible" });
  assert.equal(cadrages[0].utiliserLlm, true);
  assert.equal(cadrages[0].contexte.navigation, "profil");
  assert.match(await page.locator("#idee-cadrage-nom").textContent(), /chronomètre/);
  assert.equal(await page.locator("#idee-cadrage-criteres li").count(), 1);
  assert.equal(await page.locator("#idee-cadrage-questions-bloc").isVisible(), false);
  assert.equal(await page.locator("#idee-cadrage-llm").isVisible(), false, "métadonnées repliées");
  await capturer(page, "idees-cadrage-ia");
  await page.click("#formulaire-idee button[type=submit]");
  await page.locator("#retour-idee", { hasText: "Merci" }).waitFor();
  assert.equal(envois[0].cadrage.titre, "Ajouter un chronomètre au défi express");
  // Modifier le texte après la préparation invalide le cadrage : il ne part jamais avec une autre idée.
  await page.fill("#texte-idee", "idée A");
  await preparer.click();
  await bloc.waitFor({ state: "visible" });
  await page.fill("#texte-idee", "idée B, toute différente");
  assert.equal(await bloc.isVisible(), false);
  await page.click("#formulaire-idee button[type=submit]");
  await page.waitForFunction(() => document.querySelector("#texte-idee").value === "");
  assert.equal(envois[1].cadrage, undefined);
  assert.equal(envois[1].message, "idée B, toute différente");
  assert.equal(await bloc.isVisible(), false);
  // Sans la case cochée, l'idée part seule.
  await page.fill("#texte-idee", "autre idée");
  await preparer.click();
  await bloc.waitFor({ state: "visible" });
  await page.locator("#idee-joindre").uncheck();
  await page.click("#formulaire-idee button[type=submit]");
  await page.waitForFunction(() => document.querySelector("#texte-idee").value === "");
  assert.equal(envois[2].cadrage, undefined);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
