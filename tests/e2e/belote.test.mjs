import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { servir, navigateur, ouvrir, racine } from "./outils.mjs";

// Moteur lu dans la page : le test vérifie, coup par coup, que l'interface n'active que les cartes autorisées.
const HTML = await readFile(`${racine}catalogue/belote/page.html`, "utf8");
const B = vm.runInNewContext(`${HTML.match(/<script id="moteur-belote">([\s\S]*?)<\/script>/)[1]}\nMoteurBelote`, {});

let serveur, nav;
before(async () => { serveur = await servir(racine); nav = await navigateur(); });
after(async () => { await nav?.close(); await serveur?.fermer(); });

const URL_PAGE = () => `${serveur.url}/catalogue/belote/page.html`;
const MOBILE = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true };
const jeu = (page) => page.locator("#panneau-application");
const etat = (page) => page.evaluate(() => { const { donne, partie, pliAffiche } = window.kermiclab.belote.etat(); return { donne, partie, pliAffiche }; });
const academie = (page) => page.locator("#panneau-academie");
const etatA = (page) => page.evaluate(() => window.kermiclab.academie.etat());

/** Attend que ce soit à Sud d'agir (enchère ou carte), ou la fin de la donne. */
async function attendreSud(page) {
  await page.waitForFunction(() => {
    const { donne, pliAffiche } = window.kermiclab.belote.etat();
    return donne.phase === "fin" || (!pliAffiche && (donne.phase === "encheres" || donne.phase === "jeu") && donne.parole === "sud");
  }, null, { timeout: 15000 });
}
async function rapide(page) { await jeu(page).locator('input[name="vitesse"][value="rapide"]').check({ force: true }); }

test("belote : s'ouvre sur « Jouer », table et enchères, sans erreur ni violation CSP", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  const onglets = await page.locator("[role=tab]").evaluateAll((n) => n.map((b) => b.dataset.onglet));
  assert.deepEqual(onglets, ["explication", "application", "academie", "mise-en-situation"]);
  assert.equal(await page.locator("#onglet-application").getAttribute("aria-selected"), "true");
  const { donne } = await etat(page);
  assert.equal(donne.phase, "encheres");
  assert.equal(donne.parole, "sud", "Ouest distribue, Sud parle en premier");
  assert.equal(await jeu(page).locator('[data-zone="main"] .carte-jeu').count(), 5);
  assert.equal(await jeu(page).locator('[data-enchere="prendre"]').isVisible(), true);
  assert.match(await jeu(page).locator('[data-zone="tapis"]').textContent(), /Carte retournée/);
  assert.match(await jeu(page).locator('[data-zone="main"] .carte-jeu').first().getAttribute("aria-label"), /^(7|8|9|10|valet|dame|roi|as) de (pique|cœur|carreau|trèfle)/);
  const registre = await page.evaluate(() => window.kermiclab.registre.map((o) => [o.id, o.actif]));
  assert.deepEqual(registre.at(-1), ["self-test", false]);
  await page.click("#onglet-explication");
  assert.match(await page.locator("#panneau-explication").textContent(), /dix de der/);
  assert.deepEqual(erreurs, [], "aucune erreur console ni violation CSP");
  await contexte.close();
});

test("belote : une donne complète jouée au clic, seules les cartes autorisées sont actives, 162 points au bilan", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, URL_PAGE());
  const requetes = [];
  page.on("request", (r) => requetes.push(r.url()));
  await page.goto(URL_PAGE());
  await rapide(page);
  await jeu(page).locator('[data-enchere="prendre"]').click();
  assert.equal((await etat(page)).donne.preneur, "sud");
  let coups = 0;
  for (;;) {
    await attendreSud(page);
    const { donne } = await etat(page);
    if (donne.phase === "fin") break;
    const attendues = [...B.cartesJouables(donne.mains.sud, donne.pli, donne.atout, "sud").cartes].sort();
    const actives = (await jeu(page).locator('[data-zone="main"] button.carte-jeu:not([disabled])').evaluateAll((n) => n.map((b) => b.dataset.carte))).sort();
    assert.deepEqual(actives, attendues, `pli ${donne.plis.length + 1}`);
    assert.notEqual((await jeu(page).locator('[data-sortie="regle"]').textContent()).trim(), "", "la règle est expliquée");
    await jeu(page).locator(`[data-zone="main"] [data-carte="${attendues[0]}"]`).click();
    coups += 1;
  }
  assert.equal(coups, 8);
  // Le dernier pli reste affiché un instant, puis le bilan apparaît (et le score de la partie est mis à jour).
  await jeu(page).locator('[data-zone="bilan"]').waitFor({ state: "visible", timeout: 5000 });
  const { donne, partie } = await etat(page);
  const r = donne.resultat;
  assert.equal(r.total.NS + r.total.EO, 162 + (r.belote ? 20 : 0));
  assert.match(await jeu(page).locator('[data-sortie="bilan-titre"]').textContent(), /contrat|dedans|Capot/);
  assert.deepEqual(partie.scores, r.marque);
  // Les événements de la donne sont comptés pour l'Académie.
  const compteurs = (await etatA(page)).compteurs;
  assert.equal(compteurs.contrats, r.preneur === "NS" && r.faite ? 1 : 0);
  assert.equal(compteurs.belotes, r.belote === "NS" ? 1 : 0);
  await jeu(page).locator('[data-action="donne-suivante"]').click();
  assert.equal((await etat(page)).donne.donneur, "sud", "le donneur tourne");
  assert.deepEqual(requetes, [URL_PAGE()], "aucun appel réseau");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("belote : le conseil désigne une carte autorisée, le texte parle à « tu »", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await rapide(page);
  await jeu(page).locator('[data-action="conseil"]').click();
  assert.match(await jeu(page).locator('[data-sortie="message"]').textContent(), /l'ordinateur (prendrait|passerait)/);
  await jeu(page).locator('[data-enchere="prendre"]').click();
  assert.match(await jeu(page).locator('[data-sortie="message"]').textContent(), /^Tu prends : l'atout est/);
  await attendreSud(page);
  await jeu(page).locator('[data-action="conseil"]').click();
  const conseil = await jeu(page).locator("[data-conseil]").getAttribute("data-carte");
  const { donne } = await etat(page);
  assert.ok(B.cartesJouables(donne.mains.sud, donne.pli, donne.atout, "sud").cartes.includes(conseil));
  assert.equal(await page.evaluate(() => document.activeElement.dataset.carte), conseil, "le focus va sur la carte conseillée");
  await contexte.close();
});

test("académie de la belote : carte interdite expliquée, piège expliqué, bonne carte, puis enchère", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await page.click("#onglet-academie");
  await academie(page).locator('[data-action="detail"]').click();
  await academie(page).locator('input[name="libre"]').check();
  await academie(page).locator('[data-vue="detail"] [data-action="retour"]').click();
  await academie(page).locator('[data-lecon="couper"]').click();
  const retour = academie(page).locator('[data-sortie="retour"]');
  await academie(page).locator('.zone-exercice [data-carte="RK"]').click();
  assert.match(await retour.textContent(), /^Interdit : Tu n'as pas la couleur demandée/);
  await academie(page).locator('.zone-exercice [data-carte="9C"]').click();
  assert.match(await retour.textContent(), /gaspilles ton 9 d'atout/);
  await academie(page).locator('.zone-exercice [data-carte="7C"]').click();
  assert.match(await retour.textContent(), /^Réussi !/);
  await academie(page).locator('[data-action="suivant"]').click();
  assert.match(await academie(page).locator('[data-sortie="bilan-titre"]').textContent(), /Leçon terminée/);
  await academie(page).locator('[data-vue="session"] [data-action="retour"]').click();
  await academie(page).locator('[data-lecon="prendre"]').click();
  await academie(page).locator('.zone-exercice [data-enchere="passer"]').click();
  assert.match(await retour.textContent(), /Pas tout à fait/);
  await academie(page).locator('.zone-exercice [data-enchere="prendre"]').click();
  assert.match(await retour.textContent(), /^Réussi !/);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("le compteur : bonne réponse puis série, mauvaise réponse corrigée avec le détail des points", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await page.click("#onglet-mise-en-situation");
  const panneau = page.locator("#panneau-mise-en-situation");
  const { gagnant, points } = await page.evaluate(() => window.kermiclab.belote.compteur());
  assert.equal(await panneau.locator(".pli-exercice .carte-jeu").count(), 4);
  await panneau.locator(`[data-joueur="${gagnant}"]`).click();
  await panneau.locator('[data-zone="points"]').fill(String(points));
  await panneau.locator('[data-action="valider"]').click();
  assert.match(await panneau.locator('[data-sortie="retour"]').textContent(), /^Bravo/);
  assert.match(await panneau.locator('[data-sortie="serie"]').textContent(), /Série : 1/);
  await panneau.locator('[data-action="autre"]').click();
  const suivant = await page.evaluate(() => window.kermiclab.belote.compteur());
  await panneau.locator(`[data-joueur="${suivant.gagnant}"]`).click();
  await panneau.locator('[data-zone="points"]').fill(String(suivant.points + 1));
  await panneau.locator('[data-zone="points"]').press("Enter");
  assert.match(await panneau.locator('[data-sortie="retour"]').textContent(), new RegExp(`il vaut ${suivant.points} points`));
  assert.match(await panneau.locator('[data-sortie="serie"]').textContent(), /Série : 0 · record : 1/);
  await contexte.close();
});

test("belote mobile : jouer au toucher, aucun défilement horizontal sur aucun onglet", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE(), MOBILE);
  await page.goto(URL_PAGE());
  await rapide(page);
  const debord = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await jeu(page).locator('[data-enchere="prendre"]').tap();
  await attendreSud(page);
  assert.ok(await debord() <= 0, `jeu : ${await debord()}px`);
  const carte = await jeu(page).locator('[data-zone="main"] button.carte-jeu:not([disabled])').first();
  const boite = await carte.boundingBox();
  assert.ok(boite.width >= 38 && boite.height >= 54, "cartes assez grandes pour le doigt");
  await carte.tap();
  assert.equal((await etat(page)).donne.mains.sud.length, 7);
  for (const id of ["explication", "academie", "mise-en-situation"]) {
    await page.click(`#onglet-${id}`);
    assert.ok(await debord() <= 0, `${id} : ${await debord()}px`);
  }
  await contexte.close();
});
