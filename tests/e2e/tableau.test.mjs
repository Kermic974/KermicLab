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
/** Attend la fin du chargement du catalogue (entrée Éducation de l'accueil renseignée). */
const catalogueCharge = (page) => page.locator("#entree-education", { hasText: "notions" }).waitFor();
/** Le défi express est un outil d'Éducation. */
async function lancerDefi(page) {
  await page.click(".barre-laterale .nav-bouton[data-nav=education]");
  await page.click("#lancer-defi");
}

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
  await catalogueCharge(page);
  assert.equal(await page.locator("#dialogue-pseudo").evaluate((d) => d.open), false);
  assert.equal(await texte(page, "#salut"), "Bonjour Max 👋");
  assert.equal(await texte(page, "#pastille-serie"), "1");
  assert.match(await texte(page, "#reprendre"), /Le cercle trigonométrique/);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("accueil : une seule prochaine action, deux entrées, aperçu après usage ; progression calculée", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await choisirPseudo(page, "Nina");
  await catalogueCharge(page);
  // Premier lancement : pas de « Reprendre » inventé, une suggestion, les deux entrées, aucun aperçu vide.
  assert.equal(await page.locator("#reprendre").isVisible(), false);
  assert.match(await texte(page, "#suggestion"), /Le cercle trigonométrique/, "première suggestion : le cercle");
  assert.equal(await texte(page, "#entree-education"), "6 notions dans 3 matières");
  assert.equal(await texte(page, "#entree-jeux"), "", "aucun jeu au catalogue : aucun chiffre inventé");
  assert.equal(await page.locator("#apercu-progression").isVisible(), false);
  for (const absent of ["#grille-matieres", "#activites", "#jeux-accueil", ".parcours-v3"]) assert.equal(await page.locator(absent).count(), 0, absent);

  await page.locator("#suggestion button").click();
  await page.locator("#bulle-lab[open][data-notion=trigo-cercle]").waitFor();
  await page.click("#fermer-bulle");
  assert.match(await texte(page, "#reprendre"), /Maths.*Seconde.*Le cercle trigonométrique/s);
  assert.equal(await page.locator("#suggestion").isVisible(), false, "une seule prochaine action à la fois");
  assert.equal(await texte(page, "#apercu-progression-texte"), "1 notion(s) explorée(s)");

  await page.click("#apercu-progression [data-nav=progression]");
  assert.equal(await texte(page, '[data-compteur="statNotions"] dd'), "1");
  assert.equal(await texte(page, '[data-compteur="compteurMatieres"] dd'), "1");
  assert.equal(await page.locator('[data-compteur="compteurJeux"]').count(), 0, "un compteur nul n'est pas affiché");
  assert.equal(await texte(page, "#progression-matieres"), "Maths1 / 4 explorées");
  assert.match(await texte(page, "#chiffres-semaine"), /Questions posées0Notions découvertes1XP gagnés\+25 XP/);
  assert.equal(await page.locator("#graphique-semaine .baton.aujourdhui").count(), 1);
  assert.equal(await page.locator("#semaine-vide").isVisible(), false);
  assert.equal(await page.evaluate(() => /NaN|undefined|null/.test(document.querySelector("#ecran-progression").textContent)), false);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
test("Jeux : seulement les jeux du catalogue, résumé réel, « Jouer » puis « Déjà lancé », depuis l'accueil", async () => {
  const { page, contexte, erreurs } = await demarrer({}, null, { jeux: [
    { id: "echecs", titre: "Les échecs", version: "1.0.0", niveau: "autres", matiere: "jeux", resume: "Joue contre l'ordinateur." },
    { id: "sudoku", titre: "Le Sudoku", version: "1.0.0", niveau: "autres", matiere: "jeux" }
  ] });
  await choisirPseudo(page, "Lina");
  await catalogueCharge(page);
  assert.equal(await texte(page, "#entree-jeux"), "2 jeux");
  await page.locator(".entree[data-nav=jeux]").click();
  await page.locator("#ecran-jeux").waitFor({ state: "visible" });
  assert.equal(new URL(page.url()).hash, "#jeux");
  assert.deepEqual(await page.locator("#grille-jeux h3").allTextContents(), ["Les échecs", "Le Sudoku"]);
  assert.deepEqual(await page.locator("#grille-jeux .jeu-carte p").allTextContents(), ["Joue contre l'ordinateur."], "aucun résumé inventé");
  assert.deepEqual(await page.locator("#grille-jeux [data-jeu]").allTextContents(), ["Jouer", "Jouer"]);
  assert.equal(await page.getAttribute("[data-jeu=sudoku]", "aria-label"), "Jouer : Le Sudoku");
  assert.equal(await page.locator("#grille-jeux .pastille").count(), 0);
  await page.click("[data-jeu=sudoku]");
  await page.locator("#bulle-lab[open][data-notion=sudoku]").waitFor();
  await page.click("#fermer-bulle");
  assert.equal(await page.locator("[data-jeu=sudoku]").evaluate((n) => n.closest("article").textContent), "Le SudokuDéjà lancéJouer");
  // Un jeu n'est pas une notion : ni dans Éducation, ni dans les notions explorées.
  const stocke = await page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:progression")));
  assert.deepEqual(stocke.notions, []);
  assert.equal(stocke.decouvertes.jeu.sudoku.ouvertures, 1);
  await page.setViewportSize({ width: 360, height: 740 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
test("Mes cahiers : créer, retrouver et supprimer des modèles gardés dans la session", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await choisirPseudo(page, "Nina");
  // Mes cahiers : un outil d'Éducation, replié par défaut ; l'ancienne adresse #cahiers l'ouvre directement.
  await page.locator(".barre-laterale [data-nav=education]").click();
  assert.equal(await page.locator("#ecran-cahiers").isVisible(), false);
  await page.locator("[aria-controls=ecran-cahiers]").click();
  assert.equal(await page.getAttribute("[aria-controls=ecran-cahiers]", "aria-expanded"), "true");
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

  await page.goto(`${serveur.url}/#cahiers`);
  await page.reload();
  await page.locator("#liste-cahiers .cahier-enregistre").first().waitFor();
  assert.equal(await page.locator("#liste-cahiers .cahier-enregistre").count(), 3);
  await page.getByRole("button", { name: "Supprimer Cahier de vacances" }).click();
  assert.equal(await page.locator("#liste-cahiers .cahier-enregistre").count(), 2);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".nav-mobile [data-nav=accueil]").click();
  await page.locator(".nav-mobile [data-nav=education]").click();
  assert.equal(await page.locator("#ecran-cahiers").isVisible(), true, "l'accordéon garde son état pendant la session");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("Éducation : le Lab du cercle, ses trois modes et le mini-lab replié", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await choisirPseudo(page, "Lina");
  await page.click(".barre-laterale [data-nav=education]");
  assert.deepEqual(await page.locator(".outil a").evaluateAll((liens) => liens.map((l) => l.getAttribute("href"))), [
    "cercle/?mode=explore", "cercle/?mode=learn", "cercle/?mode=play"
  ]);
  const bascule = page.locator("[aria-controls=minilab]");
  assert.equal(await bascule.getAttribute("aria-expanded"), "false");
  assert.equal(await page.locator("#minilab").isVisible(), false, "rien n'est ouvert par défaut");
  await bascule.focus();
  await page.keyboard.press("Enter");
  assert.equal(await bascule.getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator("#minilab").isVisible(), true);
  assert.equal(await page.locator("#chat-titre").textContent(), "Pose ta question");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
test("défi express : correction immédiate, 5 XP par bonne réponse une fois par jour", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await choisirPseudo(page, "Sam");
  await lancerDefi(page);
  const bonnes = [1, 0, 1, 0, 0];
  for (const [i, bonne] of bonnes.entries()) {
    await page.locator("#defi .reponse").nth(bonne).click();
    assert.match(await texte(page, "#defi-retour"), /Correct !/, `question ${i + 1}`);
    await page.locator("#defi .defi-suite .bouton").click();
  }
  assert.equal(await texte(page, "#defi .score"), "5/5");
  assert.match(await texte(page, "#defi .resultat-defi"), /\+25 XP/);
  // « Terminer » ramène à Éducation, où se trouve le défi.
  await page.click("#defi .defi-suite button:not(.secondaire-bouton)");
  assert.equal(new URL(page.url()).hash, "#education");
  await page.click("#lancer-defi");
  await page.locator("#defi .reponse").nth(0).click();
  assert.match(await texte(page, "#defi-retour"), /Pas tout à fait\./);
  assert.match(await texte(page, "#defi-sur-titre"), /Déjà fait aujourd'hui/);
  await page.click(".barre-laterale [data-nav=progression]");
  assert.match(await texte(page, "#chiffres-semaine"), /\+25 XP/);
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
  assert.match(await texte(page, '#config-modules [data-skill="defi-express"] dd'), /Actif\s+defi-express-v2 · v1\.1\.0/);

  await lancerDefi(page);
  // Configurateur : périmètre choisi avant la génération (niveau, matière, notion en cascade, types de défis).
  await page.locator("#defi-config").waitFor();
  assert.match(await texte(page, "#defi-source"), /Choisis ton périmètre/);
  assert.equal(await page.inputValue("#defi-matiere"), "mathematiques", "dernière matière ouverte par défaut");
  assert.deepEqual(await page.locator("#defi-niveau option").allTextContents(),
    ["Tous les niveaux", "Collège", "Seconde", "Première", "Terminale"]);
  await page.selectOption("#defi-niveau", "college");
  assert.deepEqual(await page.locator("#defi-matiere option").allTextContents(),
    ["Toutes les matières", "Maths", "Physique-chimie"], "matières du niveau choisi seulement (jeux exclus)");
  assert.deepEqual(await page.locator("#defi-notion option").allTextContents(),
    ["Toutes les notions", "Les fractions", "Le théorème de Pythagore"]);
  assert.match(await texte(page, "#defi-config-resume"), /2 notion\(s\) dans ce périmètre · 2 défi/);
  for (const c of await page.locator("#defi-config input[name=defi-format]").all()) await c.uncheck();
  await page.click("#defi-lancer");
  assert.match(await texte(page, "#defi-config-erreur"), /au moins un type/);
  assert.equal(requetes.filter((r) => r.defi).length, 0, "rien n'est envoyé sans type de défi");
  await page.check("#defi-config input[value=qcm]");
  await page.check("#defi-config input[value=vrai-faux]");
  await page.click("#defi-lancer");
  await page.locator("#defi-question").waitFor();
  assert.equal(await texte(page, "#defi-question"), "Défi inédit 1 ?");
  assert.match(await texte(page, "#defi-source"), /préparés par l’IA/);
  assert.match(await texte(page, "#defi .defi-etiquette"), /Question · Le théorème de Pythagore/);
  const envoi = requetes.find((r) => r.defi)?.defi;
  assert.deepEqual(envoi, { langue: "fr", niveau: "college", matiere: "mathematiques", notion: null, formats: ["qcm", "vrai-faux"], utiliserLlm: true });
  assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem("kermiclab:defi:perimetre"))),
    { niveau: "college", matiere: "mathematiques", notion: "", formats: ["qcm", "vrai-faux"] });
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
  // Recommencer revient au configurateur, avec le périmètre mémorisé ; ici une seule notion.
  await page.locator("#defi-config").waitFor();
  assert.equal(await page.inputValue("#defi-niveau"), "college");
  await page.selectOption("#defi-notion", "fractions");
  await page.click("#defi-lancer");
  await page.locator("#defi-question").waitFor();
  assert.equal(requetes.filter((r) => r.defi).at(-1).defi.notion, "fractions");
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
  await lancerDefi(page);
  await page.locator("#defi-question").waitFor();
  assert.equal(await texte(page, "#defi-question"), "Combien vaut cos(0°) ?");
  assert.match(await texte(page, "#defi-source"), /tous tes défis inédits pour aujourd’hui/);
  assert.equal(requetes.filter((r) => r.defi).length, avant);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("configuration : sans IA activée, le réglage du défi invite à l'activer et le défi reste sur la banque", async () => {
  const { page, contexte, erreurs, requetes } = await demarrer();
  await choisirPseudo(page, "Noé");
  await page.click(".barre-laterale .nav-bouton[data-nav=profil]");
  assert.match(await texte(page, "#defi-ia-etat"), /Active « Utiliser l’IA »/);
  await lancerDefi(page);
  assert.equal(await texte(page, "#defi-question"), "Combien vaut cos(0°) ?");
  assert.match(await texte(page, "#defi-source"), /Active « Utiliser l’IA »/);
  assert.equal(requetes.filter((r) => r.defi).length, 0, "aucun appel sans consentement IA");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("défi express : IA indisponible côté serveur, les questions fixes s'affichent avec la raison", async () => {
  const { page, contexte, erreurs } = await demarrer({}, async (p) => {
    await p.addInitScript(() => { try { sessionStorage.setItem("kermiclab:llm:actif", "true"); } catch { /* iframe sandboxée */ } });
  }, {
    defi: () => ({ source: "banque", raison: "ia-indisponible", defis: [], quota: { limite: 3, utilisees: 1, restantes: 2 } })
  });
  await choisirPseudo(page, "Lou");
  await lancerDefi(page);
  await page.click("#defi-lancer");
  await page.locator("#defi-question").waitFor();
  assert.equal(await texte(page, "#defi-question"), "Combien vaut cos(0°) ?");
  assert.match(await texte(page, "#defi-source"), /l’IA ne peut pas préparer de défis pour le moment/);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("configuration : seul le switch IA est affiché, le profil reste dans une fenêtre séparée", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await choisirPseudo(page, "Léo");
  await page.click(".barre-laterale .nav-bouton[data-nav=profil]");
  assert.equal(await texte(page, "#salut"), "Profil");
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
  await page.click(".barre-laterale [data-nav=progression]");
  assert.equal(await texte(page, '[data-compteur="statQuestions"] dd'), "3", "progression d'une version précédente conservée");
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
  await catalogueCharge(page);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
  await contexte.close();
});

test("mobile : navigation inférieure, mini-lab utilisable dans Éducation, aucun défilement horizontal", async () => {
  const { page, contexte, erreurs } = await demarrer({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await choisirPseudo(page, "Inès");
  assert.equal(await page.locator(".barre-laterale").isVisible(), false);
  assert.equal(await page.locator(".nav-mobile").isVisible(), true);
  assert.equal(await page.locator("#suggestion").isVisible(), true);
  await page.click(".nav-mobile [data-nav=education]");
  await page.click("[aria-controls=minilab]");
  await page.locator("#angle-minilab").fill("90");
  assert.equal(await texte(page, '#minilab [data-sortie="sin"]'), "1,000");
  assert.equal(await texte(page, '#minilab [data-sortie="cos"]'), "0,000");
  assert.equal(await texte(page, '#minilab [data-sortie="rad"]'), "π/2 rad");
  await page.click(".nav-mobile [data-nav=profil]");
  await page.locator("#profil").waitFor();
  assert.equal(await texte(page, "#configuration-titre"), "Configuration");
  assert.match(await texte(page, "#profil .identite-textes"), /Inès/, "l'identité reste lisible sur mobile");
  assert.equal(await page.locator("#profil .lien-profil", { hasText: "Feuille de route" }).isVisible(), true);
  await page.click(".profil-mobile[data-ouvrir-profil]");
  await page.locator("#dialogue-profil[open]").waitFor();
  await page.click("#fermer-profil");
  assert.equal(await page.locator("#profil").isVisible(), true, "fermer le profil conserve l'écran courant");
  await page.click(".nav-mobile [data-nav=accueil]");
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
