import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab, defisIa } from "./outils.mjs";

// Tableau de bord élève (accueil) : pseudo au premier lancement, mémorisation par cookie local, données de la session.
let serveur, nav, htmlMaquette, api;
before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
  htmlMaquette = await readFile(`${racine}catalogue/trigo-cercle/page.html`, "utf8");
  const { apiUrl } = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8"));
  api = apiUrl || serveur.url;
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

async function demarrer(options = {}, avant, simulation = {}) {
  const session = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 900 }, ...options });
  session.requetes = await simulerApiKermiclab(session.page, { origine: serveur.url, api, htmlMaquette, ...simulation });
  if (avant) await avant(session.page);
  await session.page.goto(serveur.url);
  return session;
}

async function choisirPseudo(page, pseudo, { memoriser = false } = {}) {
  await page.locator("#dialogue-pseudo[open]").waitFor();
  await page.fill("#pseudo", pseudo);
  if (memoriser) await page.check("#pseudo-memoriser");
  await page.click("#formulaire-pseudo button[type=submit]");
  await page.locator("#dialogue-pseudo").waitFor({ state: "hidden" });
}

const texte = (page, s) => page.locator(s).textContent();

test("premier lancement : pseudo obligatoire et validé, données gardées pour la session seulement", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await page.locator("#dialogue-pseudo[open]").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#dialogue-pseudo").evaluate((d) => d.open), true, "Échap ne contourne pas le pseudo");
  await page.fill("#pseudo", "Léa 0612345678");
  await page.click("#formulaire-pseudo button[type=submit]");
  assert.match(await texte(page, "#pseudo-erreur"), /numéro de téléphone/);
  assert.equal(await page.getAttribute("#pseudo", "aria-invalid"), "true");
  await choisirPseudo(page, "  Léa  ");
  assert.equal(await texte(page, "#salut"), "Bonjour Léa 👋");
  assert.equal(await texte(page, ".barre-laterale [data-profil=pseudo]"), "Léa");
  assert.deepEqual(await contexte.cookies(), [], "aucun cookie sans accord");
  assert.equal(await page.evaluate(() => sessionStorage.getItem("kermiclab:pseudo")), "Léa");
  assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:pseudo")), null);
  // Un nouvel onglet (nouvelle session) ne connaît pas le pseudo : la fenêtre revient.
  const autre = await contexte.newPage();
  await simulerApiKermiclab(autre, { origine: serveur.url, api, htmlMaquette });
  await autre.goto(serveur.url);
  await autre.locator("#dialogue-pseudo[open]").waitFor();
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("se souvenir de moi : cookie local sans donnée personnelle, pseudo et progression retrouvés", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await choisirPseudo(page, "Max", { memoriser: true });
  const cookies = await contexte.cookies();
  assert.deepEqual(cookies.map((c) => [c.name, c.value, c.sameSite]), [["kermiclab_memoire", "1", "Strict"]]);
  assert.ok(cookies[0].expires * 1000 > Date.now() + 300 * 24 * 3600 * 1000, "valable environ un an");
  await page.click("#ouvrir-chat");
  await page.fill("#question", "c'est quoi le sinus ?");
  await page.keyboard.press("Enter");
  await page.locator("li[data-maquette=trigo-cercle] iframe").waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem("kermiclab:progression")), null);
  await page.reload();
  await page.locator("#grille-matieres .matiere-carte").first().waitFor();
  assert.equal(await page.locator("#dialogue-pseudo").evaluate((d) => d.open), false);
  assert.equal(await texte(page, "#salut"), "Bonjour Max 👋");
  assert.equal(await texte(page, "#pastille-serie"), "1");
  assert.match(await texte(page, "#reprendre"), /Le cercle trigonométrique/);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("tableau de bord : reprise, suggestion, matières et semaine calculées à partir de la session", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await choisirPseudo(page, "Nina");
  await page.locator("#grille-matieres .matiere-carte").first().waitFor();
  assert.match(await texte(page, "#reprendre"), /Ton premier Lab t'attend/);
  assert.match(await texte(page, "#suggestion"), /Le cercle trigonométrique/, "première suggestion : le cercle");
  assert.equal(await texte(page, "#chiffres-semaine"), "Questions posées0Notions découvertes0XP gagnés+0 XPJours actifs0 / 7");
  assert.equal(await page.locator("#semaine-vide").isVisible(), true);

  await page.locator("#suggestion button").click();
  await page.locator("#bulle-lab[open][data-notion=trigo-cercle]").waitFor();
  await page.click("#fermer-bulle");
  assert.match(await texte(page, "#reprendre"), /Le cercle trigonométrique.*Maths : 1 \/ 4 notions explorées.*25 %/s);
  assert.match(await texte(page, "#suggestion"), /Les fractions|Le théorème de Pythagore|La dérivation/);
  assert.doesNotMatch(await texte(page, "#suggestion .encart"), /Le cercle trigonométrique/, "une notion déjà vue n'est plus suggérée");
  const maths = page.locator("[data-matiere-carte=mathematiques]");
  assert.match(await maths.textContent(), /1 \/ 4 notions explorées.*25.*En cours/s);
  assert.equal(await maths.locator(".matiere-monogramme").textContent(), "M");
  assert.deepEqual(await maths.locator(":scope > *").evaluateAll((elements) => elements.map((e) => e.classList[0])),
    ["matiere-entete", "matiere-progression", "barre", "matiere-bas"]);
  assert.match(await texte(page, "#chiffres-semaine"), /Questions posées0Notions découvertes1XP gagnés\+25 XP/);
  assert.equal(await page.locator("#graphique-semaine .baton.aujourdhui").count(), 1);
  assert.equal(await page.locator("#semaine-vide").isVisible(), false);
  // Une carte de matière ouvre le catalogue sur cette matière.
  await page.locator("[data-matiere-carte=physique-chimie]").click();
  await page.locator("#catalogue .notion", { hasText: "Circuits électriques" }).waitFor({ state: "visible" });
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("Mes cahiers : créer, retrouver et supprimer des modèles gardés dans la session", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await choisirPseudo(page, "Nina");
  await page.locator(".barre-laterale [data-nav=cahiers]").click();
  await page.locator("#ecran-cahiers").waitFor({ state: "visible" });
  assert.equal(await page.locator("#cahiers-vide").isVisible(), true);

  for (const type of ["brouillon", "fiches", "vacances"]) {
    await page.locator(`[data-cahier-type="${type}"]`).click();
  }
  assert.equal(await page.locator("#liste-cahiers .cahier-enregistre").count(), 3);
  assert.deepEqual(await page.locator("#liste-cahiers h4").allTextContents(), ["Cahier de vacances", "Fiches de notes", "Brouillon"]);
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:cahiers")).length), 3);
  assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:cahiers")), null, "pas de persistance locale sans consentement");
  await page.click(".barre-laterale .profil-carte");
  await page.check("#profil-memoriser");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("kermiclab:cahiers")).length), 3);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("kermiclab:cahiers")), null);
  await page.uncheck("#profil-memoriser");
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:cahiers")).length), 3);
  assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:cahiers")), null);
  await page.click("#fermer-profil");

  await page.reload();
  await page.locator("#liste-cahiers .cahier-enregistre").first().waitFor();
  assert.equal(await page.locator("#liste-cahiers .cahier-enregistre").count(), 3);
  await page.getByRole("button", { name: "Supprimer Cahier de vacances" }).click();
  assert.equal(await page.locator("#liste-cahiers .cahier-enregistre").count(), 2);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".nav-mobile [data-nav=cahiers]").click();
  assert.equal(await page.locator("#ecran-cahiers").isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("parcours v3 : mini-lab en premier et liens vers les trois modes du cercle", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await choisirPseudo(page, "Lina");

  assert.match(await texte(page, "#parcours-v3-titre"), /Comprends le cercle en le manipulant/);
  assert.match(await texte(page, ".parcours-defi"), /sin\(θ\) = 1/);
  assert.equal(await page.locator(".parcours-action").getAttribute("href"), "cercle/?mode=explore");
  assert.deepEqual(await page.locator(".parcours-etapes a").evaluateAll((liens) => liens.map((l) => l.getAttribute("href"))), [
    "cercle/?mode=explore", "cercle/?mode=learn", "cercle/?mode=play"
  ]);
  assert.equal(await page.locator("#minilab").isVisible(), true);
  assert.equal(await page.locator("#minilab").evaluate((el) => Boolean(el.compareDocumentPosition(document.querySelector("#accueil")) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
  assert.match(await texte(page, "#reprendre"), /Ton premier Lab t'attend/);
  assert.equal(await page.locator("#chat-titre").textContent(), "Pose ta question");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("défi express : correction immédiate, 5 XP par bonne réponse une fois par jour", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await choisirPseudo(page, "Sam");
  await page.click("#lancer-defi");
  const bonnes = [1, 0, 1, 0, 0];
  for (const [i, bonne] of bonnes.entries()) {
    await page.locator("#defi .reponse").nth(bonne).click();
    assert.match(await texte(page, "#defi-retour"), /Correct !/, `question ${i + 1}`);
    await page.locator("#defi .defi-suite .bouton").click();
  }
  assert.equal(await texte(page, "#defi .score"), "5/5");
  assert.match(await texte(page, "#defi .resultat-defi"), /\+25 XP/);
  assert.match(await texte(page, "#chiffres-semaine"), /\+25 XP/);
  await page.click("#defi .defi-suite button:not(.secondaire-bouton)");
  await page.click("#lancer-defi");
  await page.locator("#defi .reponse").nth(0).click();
  assert.match(await texte(page, "#defi-retour"), /Pas tout à fait\./);
  assert.match(await texte(page, "#defi-sur-titre"), /Déjà fait aujourd'hui/);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("défi express IA : 5 défis inédits via /api/defi, lot incomplet complété par la banque, quota réglé dans Configuration", async () => {
  let restantes = 3;
  const { page, contexte, erreurs, requetes } = await demarrer({}, async (p) => {
    await p.addInitScript(() => { try { sessionStorage.setItem("kermiclab:llm:actif", "true"); } catch { /* iframe sandboxée */ } });
  }, {
    defi: () => {
      restantes -= 1;
      return { source: "ia", defis: defisIa(api, restantes === 2 ? 5 : 3), quota: { limite: 3, utilisees: 3 - restantes, restantes } };
    }
  });
  await choisirPseudo(page, "Ana");
  // Configuration : réglage du défi, plafonné par le serveur (3 par jour), mémorisé sur l'appareil.
  await page.click(".barre-laterale .nav-bouton[data-nav=profil]");
  assert.deepEqual(await page.locator("#defi-ia-par-jour option").allTextContents(),
    ["Désactivé (questions fixes)", "1 par jour", "2 par jour", "3 par jour"]);
  assert.equal(await page.inputValue("#defi-ia-par-jour"), "3");
  assert.match(await texte(page, "#defi-ia-etat"), /Il te reste 3 défi/);
  await page.selectOption("#defi-ia-par-jour", "2");
  assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:defi:ia-par-jour")), "2");
  // Paramètres du site centralisés par module (ADR 0019) : alias, budgets min–max et skills.
  assert.deepEqual(await page.locator("#config-modules .config-module h4").allTextContents(),
    ["Général", "Tuteur IA et boîte à idées", "Défi express"]);
  assert.equal(await texte(page, '#config-modules [data-cle="MODELE_DEFI"] dd'), "custom/haiku");
  assert.equal(await texte(page, '#config-modules [data-cle="LIMITE_TOKENS_SESSION"] dd'), "1000 (200–4000)");
  assert.match(await texte(page, '#config-modules [data-skill="defi-express"] dd'), /Actif\s+defi-express-v1 · v1\.0\.0/);

  await page.click(".barre-laterale .nav-bouton[data-nav=defi]");
  await page.locator("#defi-question").waitFor();
  assert.equal(await texte(page, "#defi-question"), "Défi inédit 1 ?");
  assert.match(await texte(page, "#defi-source"), /préparés par l’IA/);
  assert.match(await texte(page, "#defi .defi-etiquette"), /Question · Le théorème de Pythagore/);
  const envoi = requetes.find((r) => r.defi)?.defi;
  assert.deepEqual(envoi, { langue: "fr", matiere: "mathematiques", utiliserLlm: true });
  for (const bonne of [2, 0, 2, 2, 2]) {
    await page.locator("#defi .reponse").nth(bonne).click();
    assert.match(await texte(page, "#defi-retour"), /Correct !/);
    assert.equal(await page.locator("#defi-retour button", { hasText: "Revoir la notion" }).count(), 1);
    await page.locator("#defi .defi-suite .bouton:not(.secondaire-bouton)").click();
  }
  assert.equal(await texte(page, "#defi .score"), "5/5");
  assert.match(await texte(page, "#defi .resultat-defi"), /Cinq sur cinq/);

  // Recommencer : 3 défis inédits seulement, complétés par 2 questions fixes de la banque.
  await page.click("#defi .defi-suite .secondaire-bouton");
  await page.locator("#defi-question").waitFor();
  for (let i = 0; i < 3; i++) {
    await page.locator("#defi .reponse").nth(0).click();
    await page.locator("#defi .defi-suite .bouton:not(.secondaire-bouton)").click();
  }
  assert.equal(await texte(page, "#defi-question"), "Combien vaut cos(0°) ?");
  assert.equal(await page.locator("#defi-retour button", { hasText: "Revoir la notion" }).count(), 0);

  // Réglage à 2 par jour : la troisième ouverture n'appelle plus l'IA.
  await page.click(".barre-laterale .nav-bouton[data-nav=profil]");
  assert.match(await texte(page, "#defi-ia-etat"), /Il te reste 0 défi/);
  const avant = requetes.filter((r) => r.defi).length;
  await page.click(".barre-laterale .nav-bouton[data-nav=defi]");
  await page.locator("#defi-question").waitFor();
  assert.equal(await texte(page, "#defi-question"), "Combien vaut cos(0°) ?");
  assert.equal(requetes.filter((r) => r.defi).length, avant);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("configuration : sans IA activée, le réglage du défi invite à l'activer et le défi reste sur la banque", async () => {
  const { page, contexte, erreurs, requetes } = await demarrer();
  await choisirPseudo(page, "Noé");
  await page.click(".barre-laterale .nav-bouton[data-nav=profil]");
  assert.match(await texte(page, "#defi-ia-etat"), /Active « Utiliser l’IA »/);
  await page.click(".barre-laterale .nav-bouton[data-nav=defi]");
  assert.equal(await texte(page, "#defi-question"), "Combien vaut cos(0°) ?");
  assert.equal(requetes.filter((r) => r.defi).length, 0, "aucun appel sans consentement IA");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("configuration : seul le switch IA est affiché, le profil reste dans une fenêtre séparée", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await choisirPseudo(page, "Léo");
  await page.click(".barre-laterale .nav-bouton[data-nav=profil]");
  assert.equal(await texte(page, "#salut"), "Configuration");
  assert.equal(await texte(page, "#configuration-titre"), "Configuration");
  assert.equal(await page.locator("#profil input").count(), 1);
  assert.equal(await page.locator("#profil form").count(), 0);
  assert.equal(await page.locator("#panneau-chat [role=switch]").count(), 0);
  const interrupteur = page.locator("#profil [role=switch]");
  assert.equal(await interrupteur.isChecked(), false);
  await interrupteur.focus();
  await page.keyboard.press("Space");
  assert.equal(await interrupteur.isChecked(), true);
  assert.match(await texte(page, "#llm-etat"), /activée pour cette session/);
  await page.reload();
  await page.locator("#profil").waitFor();
  assert.equal(await interrupteur.isChecked(), true);
  await interrupteur.uncheck();
  assert.equal(await page.evaluate(() => sessionStorage.getItem("kermiclab:llm:actif")), "false");
  await page.click(".barre-laterale .profil-carte");
  await page.locator("#dialogue-profil[open]").waitFor();
  assert.equal(new URL(page.url()).hash, "#profil");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#dialogue-profil").isVisible(), false);
  assert.equal(await page.locator("#profil").isVisible(), true);
  assert.equal(await page.locator(".barre-laterale .profil-carte").evaluate((n) => n === document.activeElement), true);
  await page.selectOption("#langue", "en");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  assert.equal(await texte(page, "#configuration-titre"), "Configuration");
  assert.match(await texte(page, "#profil"), /Use AI/);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("fenêtre de profil : changer de pseudo, retirer le cookie, puis tout effacer avec confirmation", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await choisirPseudo(page, "Ana", { memoriser: true });
  await page.click(".barre-laterale .profil-carte");
  assert.equal(await page.locator("#dialogue-profil").isVisible(), true);
  assert.equal(await page.inputValue("#profil-pseudo"), "Ana");
  assert.equal(await page.isChecked("#profil-memoriser"), true);
  await page.fill("#profil-pseudo", "Ana B");
  await page.click("#formulaire-profil button[type=submit]");
  assert.equal(await texte(page, ".barre-laterale [data-profil=pseudo]"), "Ana B");
  assert.equal(await texte(page, "#salut"), "Bonjour Ana B 👋");
  assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:pseudo")), "Ana B");
  await page.uncheck("#profil-memoriser");
  assert.deepEqual(await contexte.cookies(), []);
  assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:pseudo")), null);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("kermiclab:pseudo")), "Ana B");
  await page.click("#effacer-donnees");
  assert.equal(await texte(page, "#effacer-donnees"), "Confirmer : tout effacer");
  await Promise.all([page.waitForEvent("load"), page.click("#effacer-donnees")]);
  await page.locator("#dialogue-pseudo[open]").waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem("kermiclab:pseudo")), null);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("reprise : une progression d'une version précédente est proposée à la mémorisation", async () => {
  const ancienne = { questions: 3, xp: 30, notions: [], serie: 1, serieMax: 2, dernierJour: "2026-01-01", badges: ["premier-pas"] };
  const { page, contexte, erreurs } = await demarrer({}, (p) => p.addInitScript((a) => {
    try { if (!sessionStorage.getItem("init")) { localStorage.setItem("kermiclab:progression", JSON.stringify(a)); sessionStorage.setItem("init", "1"); } } catch { /* iframe sandboxée */ }
  }, ancienne));
  await page.locator("#dialogue-pseudo[open]").waitFor();
  assert.equal(await page.locator("#pseudo-reprise").isVisible(), true);
  assert.equal(await page.isChecked("#pseudo-memoriser"), true);
  await page.fill("#pseudo", "Yanis");
  await page.click("#formulaire-pseudo button[type=submit]");
  await page.locator("#dialogue-pseudo").waitFor({ state: "hidden" });
  assert.equal((await contexte.cookies())[0]?.name, "kermiclab_memoire");
  assert.match(await texte(page, "#meta-question"), /^3 /);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("kermiclab:progression"))).questions, 3);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("thème : bascule clair/sombre mémorisée comme préférence d'affichage", async () => {
  const { page, contexte } = await demarrer({ colorScheme: "light" });
  await choisirPseudo(page, "Zoé");
  assert.equal(await page.getAttribute("#bascule-theme", "aria-pressed"), "false");
  await page.click("#bascule-theme");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
  assert.equal(await page.getAttribute("#bascule-theme", "aria-label"), "Activer le mode clair");
  await page.reload();
  await page.locator("#grille-matieres .matiere-carte").first().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
  await contexte.close();
});

test("mobile : navigation inférieure, mini-lab utilisable, aucun défilement horizontal", async () => {
  const { page, contexte, erreurs } = await demarrer({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await choisirPseudo(page, "Inès");
  assert.equal(await page.locator(".parcours-action").isVisible(), true);
  assert.equal(await page.locator("#minilab").isVisible(), true);
  assert.equal(await page.locator(".parcours-etapes a").count(), 3);
  assert.equal(await page.locator(".barre-laterale").isVisible(), false);
  assert.equal(await page.locator(".nav-mobile").isVisible(), true);
  await page.locator("#angle-minilab").fill("90");
  assert.equal(await texte(page, '#minilab [data-sortie="sin"]'), "1,000");
  assert.equal(await texte(page, '#minilab [data-sortie="cos"]'), "0,000");
  assert.equal(await texte(page, '#minilab [data-sortie="rad"]'), "π/2 rad");
  await page.click(".nav-mobile [data-nav=profil]");
  await page.locator("#profil").waitFor();
  assert.equal(await texte(page, "#configuration-titre"), "Configuration");
  await page.click(".profil-mobile[data-ouvrir-profil]");
  await page.locator("#dialogue-profil[open]").waitFor();
  await page.click("#fermer-profil");
  assert.equal(await page.locator("#profil").isVisible(), true, "fermer le profil conserve l'écran courant");
  await page.click("#profil [data-nav=accueil]");
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(debord <= 0, `déborde de ${debord}px`);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("bulle : les pages ouvertes depuis le tableau de bord s'affichent par-dessus, hors du fil du chat", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await choisirPseudo(page, "Bao");
  await page.locator("#suggestion button").click();
  const bulle = page.locator("#bulle-lab");
  await page.frameLocator("#bulle-cadre").locator("[role=tab]").first().waitFor();
  assert.equal(await texte(page, "#bulle-titre"), "Le cercle trigonométrique");
  assert.equal(await texte(page, "#bulle-contexte"), "Maths · Seconde");
  assert.match(await page.getAttribute("#bulle-plein-ecran", "href"), /\/maquettes\/trigo-cercle\?lang=fr$/);
  assert.equal(await page.getAttribute("#bulle-cadre", "sandbox"), "allow-scripts allow-popups allow-popups-to-escape-sandbox");
  assert.equal(await page.locator("#fil li[data-maquette]").count(), 0, "rien n'est ajouté au fil du chat");
  // Fermer décharge la page ; « Rouvrir la page » la rouvre dans la bulle.
  await page.keyboard.press("Escape");
  await bulle.waitFor({ state: "hidden" });
  await page.waitForFunction(() => !document.querySelector("#bulle-cadre").hasAttribute("src"));
  await page.locator("#reprendre button").click();
  await page.locator("#bulle-lab[open][data-notion=trigo-cercle]").waitFor();
  // « Poser une question » ferme la bulle et place le curseur dans le chat.
  await page.click("#bulle-question");
  await bulle.waitFor({ state: "hidden" });
  await page.waitForFunction(() => document.activeElement.id === "question");
  assert.equal(await page.evaluate(() => document.activeElement.id), "question");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("bulle mobile : plein écran, sans débordement", async () => {
  const { page, contexte, erreurs } = await demarrer({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await choisirPseudo(page, "Lou");
  await page.locator("#suggestion button").click();
  await page.frameLocator("#bulle-cadre").locator("[role=tab]").first().waitFor();
  // Taille de mise en page (sans l'échelle de l'animation d'ouverture).
  assert.deepEqual(await page.locator("#bulle-lab").evaluate((d) => [d.offsetWidth, d.offsetHeight]), [360, 740]);
  const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(debord <= 0, `déborde de ${debord}px`);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
