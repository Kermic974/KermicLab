import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab, capturer } from "./outils.mjs";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";

// Progression, temps actif et découvertes génériques, dans le vrai tableau de bord et avec de vraies pages servies
// (pages du catalogue compilé : boîte à idées et signal d'activité injectés comme en production).
let serveur, nav, api;
const CATALOGUE_TEST = [
  { id: "pythagore", titre: "Le théorème de Pythagore", version: "1.0.0", niveau: "college", matiere: "mathematiques" },
  { id: "trigo-cercle", titre: "Le cercle trigonométrique", version: "1.0.0", niveau: "seconde", matiere: "mathematiques" },
  { id: "la-cellule", titre: "La cellule", version: "1.1.0", niveau: "seconde", matiere: "svt" },
  { id: "demineur", titre: "Démineur", version: "1.1.0", niveau: "autres", matiere: "jeux", resume: "Révèle les cases sans mine." },
  { id: "echecs", titre: "Les échecs", version: "1.1.0", niveau: "autres", matiere: "jeux" }
];
const MINUTE = 60_000;

before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
  ({ apiUrl: api } = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8")));
  api ||= serveur.url;
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

/** Tableau de bord avec un pseudo, le catalogue de test, et, si demandé, une progression déjà enregistrée. */
async function demarrer({ viewport = { width: 1280, height: 900 }, progression, horloge = false } = {}) {
  const session = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport });
  const { page } = session;
  if (horloge) await page.clock.install({ time: new Date("2026-11-06T10:00:00") });
  await page.addInitScript((p) => {
    try {
      if (sessionStorage.getItem("init")) return;
      sessionStorage.setItem("init", "1");
      sessionStorage.setItem("kermiclab:pseudo", "Testeur");
      if (p) sessionStorage.setItem("kermiclab:progression", JSON.stringify(p));
    } catch { /* iframe sandboxée */ }
  }, progression ?? null);
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette: "" });
  await page.route(`${api}/api/catalogue`, (r) => r.fulfill({
    contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ notions: CATALOGUE_TEST })
  }));
  await page.route(`${api}/maquettes/**`, (r) => {
    const id = new URL(r.request().url()).pathname.split("/").at(-1);
    return r.fulfill({ contentType: "text/html", body: CATALOGUE.pages[id].fr });
  });
  await page.goto(serveur.url);
  await page.locator("#entree-education", { hasText: "notions" }).waitFor();
  return session;
}

const progressionStockee = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:progression")));

test("temps actif : compté seulement pendant l'activité, en pause après une minute, affiché sans secondes", async () => {
  const { page, contexte, erreurs } = await demarrer({ horloge: true });
  // 5 interactions espacées de 30 s : 2 min entre la première et la dernière, puis 1 min de fenêtre d'activité.
  for (let i = 0; i < 5; i++) {
    await page.mouse.click(640, 860);
    await page.clock.runFor(30_000);
  }
  // Dix minutes sans aucune interaction : le compteur ne bouge plus.
  await page.clock.runFor(10 * MINUTE);
  const p = await progressionStockee(page);
  // 2 min d'interactions + 1 min de fenêtre, rien pendant l'inactivité (à quelques ms près : durée des clics simulés).
  const proche = (valeur, attendu) => valeur >= attendu && valeur - attendu < 1000;
  assert.ok(proche(p.tempsActif.total, 3 * MINUTE), `total ${p.tempsActif.total}`);
  assert.equal(p.tempsActif.sections.accueil, p.tempsActif.total, "attribué à la section courante");
  assert.equal(p.jours["2026-11-06"].s, p.tempsActif.total);
  assert.equal(await page.locator("#apercu-progression-texte").textContent(), "3 min d'activité");
  await page.click(".barre-laterale [data-nav=progression]");
  assert.equal(await page.locator('[data-compteur="compteurTemps"] dd').textContent(), "3 min");
  assert.doesNotMatch(await page.locator("#ecran-progression").textContent(), /\d+ s\b|NaN|undefined/);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("intégration jeu réel : le Démineur servi signale l'activité, le temps lui est attribué, aucune statistique avant", async () => {
  const { page, contexte, erreurs } = await demarrer({ horloge: true });
  await page.click(".barre-laterale [data-nav=progression]");
  assert.equal(await page.locator("#progression-vide").isVisible(), true, "Démineur jamais lancé : aucune statistique");
  assert.equal(await page.locator("#decouvertes").isVisible(), false);

  await page.click(".barre-laterale [data-nav=jeux]");
  assert.equal(await page.locator(".jeu-carte", { hasText: "Démineur" }).locator("p").textContent(), "Révèle les cases sans mine.");
  await page.click("[data-jeu=demineur]");
  const jeu = page.frameLocator("#bulle-cadre");
  const premiere = jeu.locator('#panneau-application .case[data-index="0"]');
  await premiere.waitFor();
  // Les clics ont lieu DANS la page du jeu (iframe sandboxée) : seul son signal prolonge le temps actif.
  for (let i = 0; i < 4; i++) {
    await jeu.locator(`#panneau-application .case[data-index="${i * 9}"]`).click();
    await page.clock.runFor(30_000);
  }
  await page.clock.runFor(5 * MINUTE);
  await page.click("#fermer-bulle");
  const p = await progressionStockee(page);
  assert.ok(p.tempsActif.experiences["jeu:demineur"] >= 2 * MINUTE, `temps attribué au Démineur : ${p.tempsActif.experiences["jeu:demineur"]}`);
  assert.ok(p.tempsActif.experiences["jeu:demineur"] <= p.tempsActif.total, "ventilation sans double comptage");
  assert.deepEqual(p.notions, [], "un jeu n'est pas une notion");
  assert.equal(p.decouvertes.jeu.demineur.ouvertures, 1);
  assert.equal(p.decouvertes.jeu.echecs, undefined, "un jeu jamais lancé n'est pas découvert");

  await page.click(".barre-laterale [data-nav=progression]");
  assert.equal(await page.locator("#bloc-matieres").isVisible(), false, "Jeux seulement : pas de progression par matière");
  assert.equal(await page.locator('[data-compteur="compteurJeux"] dd').textContent(), "1");
  assert.equal(await page.locator('[data-compteur="statNotions"]').count(), 0);
  await page.click("[aria-controls=decouvertes-jeux]");
  const ligne = page.locator('#decouvertes .experience[data-type="jeu"]');
  assert.deepEqual(await ligne.locator("strong").allTextContents(), ["Démineur"]);
  assert.match(await ligne.textContent(), /Ouvert 1 fois · \d+ min/);
  await capturer(page, "progression-jeu");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("découverte générique : sections, matières, notions et jeux, avec plusieurs identifiants", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await page.click(".barre-laterale [data-nav=education]");
  await page.click("[aria-controls=edu-seconde]");
  await page.click("[aria-controls=edu-seconde-svt]");
  await page.click("[data-notion=la-cellule]");
  await page.click("#fermer-bulle");
  await page.click("[aria-controls=edu-seconde-mathematiques]");
  await page.click("[data-notion=trigo-cercle]");
  await page.click("#fermer-bulle");
  await page.click(".barre-laterale [data-nav=jeux]");
  for (const id of ["echecs", "demineur", "echecs"]) {
    await page.click(`[data-jeu=${id}]`);
    await page.click("#fermer-bulle");
  }
  const { decouvertes, derniere } = await progressionStockee(page);
  assert.deepEqual(Object.keys(decouvertes.section).sort(), ["accueil", "education", "jeux"]);
  assert.deepEqual(Object.keys(decouvertes.matiere).sort(), ["mathematiques", "svt"]);
  assert.deepEqual(Object.keys(decouvertes.notion).sort(), ["la-cellule", "trigo-cercle"]);
  assert.deepEqual(Object.fromEntries(Object.entries(decouvertes.jeu).map(([id, d]) => [id, d.ouvertures])), { echecs: 2, demineur: 1 });
  assert.ok(Object.values(decouvertes).every((liste) => Object.values(liste).every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.premiere))));
  assert.deepEqual(derniere, { type: "jeu", id: "echecs" });
  // Progression : Éducation et Jeux ensemble, sans pourcentage, avec un dénominateur issu du catalogue.
  await page.click(".barre-laterale [data-nav=progression]");
  assert.deepEqual(await page.locator("#progression-matieres li").allTextContents(), ["Maths1 / 2 explorées", "SVT1 / 1 explorées"]);
  assert.doesNotMatch(await page.locator("#ecran-progression").textContent(), /%/);
  await page.click("[aria-controls=decouvertes-education]");
  await page.click("[aria-controls=decouvertes-svt]");
  assert.deepEqual(await page.locator("#decouvertes-svt .experience strong").allTextContents(), ["La cellule"]);
  await page.click(".barre-laterale [data-nav=accueil]");
  assert.match(await page.locator("#reprendre").textContent(), /Jeux.*Les échecs/s);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("migration : une progression v1 contenant un jeu est reclassée sans perte d'XP, de badge ni de reprise", async () => {
  const v1 = {
    version: 1, questions: 2, xp: 75, notions: ["pythagore", "echecs"], serie: 1, serieMax: 4, dernierJour: "2026-11-05",
    badges: ["premier-pas", "explorateur"], jours: { "2026-11-05": { q: 2, n: 2, xp: 75 } }, derniereNotion: "echecs", defiJour: null
  };
  const { page, contexte, erreurs } = await demarrer({ progression: v1 });
  await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:progression")).version === 2);
  const p = await progressionStockee(page);
  assert.deepEqual(p.notions, ["pythagore"]);
  assert.deepEqual(p.decouvertes.jeu, { echecs: { premiere: null, ouvertures: 0 } }, "aucune date ni ouverture inventée");
  assert.deepEqual(p.derniere, { type: "jeu", id: "echecs" });
  for (const cle of ["xp", "questions", "serieMax", "badges", "jours", "derniereNotion"]) assert.deepEqual(p[cle], v1[cle], cle);
  assert.match(await page.locator("#reprendre").textContent(), /Les échecs/);
  await page.click(".barre-laterale [data-nav=progression]");
  assert.equal(await page.locator('[data-compteur="statNotions"] dd').textContent(), "1");
  assert.equal(await page.locator('[data-compteur="compteurJeux"] dd').textContent(), "1");
  await page.click("[aria-controls=decouvertes-jeux]");
  assert.doesNotMatch(await page.locator('#decouvertes .experience[data-type="jeu"]').textContent(), /Ouvert|min/, "aucune statistique inconnue affichée");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("migration : données absentes, corrompues ou partielles ne cassent rien et n'affichent jamais NaN", async () => {
  for (const brut of [null, { version: 9, tempsActif: "x", decouvertes: [], jours: 3 }, { xp: "12", notions: "pythagore", derniere: { type: "jeu" } }]) {
    const { page, contexte, erreurs } = await demarrer({ progression: brut });
    await page.click(".barre-laterale [data-nav=progression]");
    assert.equal(await page.locator("#progression-vide").isVisible(), true);
    assert.doesNotMatch(await page.locator("main").textContent(), /NaN|undefined|null/);
    assert.equal(await page.locator("#reprendre").isVisible(), false, "aucune reprise inventée");
    assert.deepEqual(erreurs, []);
    await contexte.close();
  }
});

test("accessibilité : navigation au clavier, une seule page courante, accordéons reliés, sans mouvement imposé", async () => {
  const { page: p, contexte, erreurs } = await demarrer();
  await p.emulateMedia({ reducedMotion: "reduce" });
  // Clavier : une destination s'active avec Entrée, comme un bouton.
  await p.locator(".barre-laterale [data-nav=education]").focus();
  await p.keyboard.press("Enter");
  assert.equal(new URL(p.url()).hash, "#education");
  assert.deepEqual(await p.locator("[aria-current=page]").evaluateAll((n) => n.map((b) => b.dataset.nav)), ["education", "education"], "desktop et mobile, une seule destination");
  const bouton = p.locator("[aria-controls=edu-college]");
  assert.equal(await bouton.evaluate((b) => b.tagName), "BUTTON");
  assert.equal(await bouton.evaluate((b) => b.parentElement.tagName), "H3");
  await bouton.focus();
  await p.keyboard.press("Space");
  assert.equal(await bouton.getAttribute("aria-expanded"), "true");
  assert.equal(await p.locator("#edu-college").isVisible(), true);
  assert.ok(parseFloat(await p.locator("[aria-controls=edu-college] .chevron").evaluate((n) => getComputedStyle(n).transitionDuration)) <= 0.001, "aucune animation perceptible");
  await p.keyboard.press("Enter");
  assert.equal(await bouton.getAttribute("aria-expanded"), "false");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
