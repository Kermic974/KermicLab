import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { servir, navigateur, ouvrir, racine } from "./outils.mjs";

let serveur, nav;
before(async () => { serveur = await servir(racine); nav = await navigateur(); });
after(async () => { await nav?.close(); await serveur?.fermer(); });

const URL_PAGE = () => `${serveur.url}/catalogue/echecs/page.html`;
const MOBILE = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true };
const jeu = (page) => page.locator("#panneau-application");
const caseJeu = (page, nom) => jeu(page).locator(`[data-case="${nom}"]`);
const statut = (page) => jeu(page).locator('[data-sortie="statut"]').textContent();
const etat = (page) => page.evaluate(() => window.kermiclab.echecs.etat());
/** Joue des coups « e2e4 » par deux clics (pièce puis case). */
async function jouer(page, coups, action = "click") {
  for (const c of coups.split(" ")) { await caseJeu(page, c.slice(0, 2))[action](); await caseJeu(page, c.slice(2, 4))[action](); }
}
async function aDeux(page) { await jeu(page).locator('input[name="mode"][value="deux"]').check(); }
const FEN_INITIALE = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

test("échecs : s'ouvre sur « Jouer » avec la position initiale, sans erreur ni violation CSP", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  const onglets = await page.locator("[role=tab]").evaluateAll((n) => n.map((b) => b.dataset.onglet));
  assert.deepEqual(onglets, ["explication", "application", "academie", "mise-en-situation"]);
  assert.equal(await page.locator("#onglet-application").getAttribute("aria-selected"), "true");
  assert.equal(await jeu(page).locator(".case").count(), 64);
  assert.equal(await jeu(page).locator(".case .piece").count(), 32);
  assert.equal((await etat(page)).fen, FEN_INITIALE);
  assert.equal(await statut(page), "À toi de jouer (Blancs)");
  assert.equal(await caseJeu(page, "e1").getAttribute("aria-label"), "e1 : roi blanc");
  assert.equal(await jeu(page).locator('[data-action="annuler"]').isDisabled(), true);
  const registre = await page.evaluate(() => window.kermiclab.registre.map((o) => [o.id, o.actif]));
  assert.deepEqual(registre.at(-1), ["self-test", false]);
  assert.equal(await page.locator("#connexion").isVisible(), false);
  await page.click("#onglet-explication");
  assert.match(await page.locator("#panneau-explication").textContent(), /roque/);
  assert.deepEqual(erreurs, [], "aucune erreur console ni violation CSP");
  await contexte.close();
});

test("échecs : aucun appel réseau pendant une partie contre l'ordinateur", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  const requetes = [];
  page.on("request", (r) => requetes.push(r.url()));
  await page.goto(URL_PAGE());
  await jouer(page, "e2e4");
  await page.waitForFunction(() => window.kermiclab.echecs.etat().coups.length === 2);
  await page.click("#onglet-mise-en-situation");
  assert.deepEqual(requetes, [URL_PAGE()]);
  await contexte.close();
});

test("échecs : sélection, destinations marquées, puis réponse de l'ordinateur", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await caseJeu(page, "e2").click();
  assert.equal(await caseJeu(page, "e2").getAttribute("data-selection"), "");
  const destinations = await jeu(page).locator("[data-destination]").evaluateAll((n) => n.map((b) => b.dataset.case).sort());
  assert.deepEqual(destinations, ["e3", "e4"]);
  assert.match(await caseJeu(page, "e4").getAttribute("aria-label"), /destination possible/);
  await caseJeu(page, "a5").click();
  assert.equal(await jeu(page).locator("[data-destination]").count(), 0, "un clic ailleurs annule la sélection");
  await jouer(page, "e2e4");
  await page.waitForFunction(() => window.kermiclab.echecs.etat().coups.length === 2, null, { timeout: 5000 });
  const { coups } = await etat(page);
  assert.equal(coups[0], "e4");
  assert.equal(await jeu(page).locator(".coups li").first().textContent(), `e4   ${coups[1]}`);
  assert.equal(await statut(page), "À toi de jouer (Blancs)");
  assert.equal(await jeu(page).locator("[data-dernier]").count(), 2, "dernier coup marqué");
  await contexte.close();
});

test("échecs : à deux, le mat du fou (le plus court possible) finit en échec et mat", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await aDeux(page);
  assert.equal(await jeu(page).locator('[data-zone="niveau"]').isVisible(), false);
  await jouer(page, "f2f3 e7e5 g2g4");
  assert.equal(await statut(page), "Au tour des Noirs");
  await jouer(page, "d8h4");
  assert.equal(await statut(page), "Échec et mat ! Les Noirs gagnent.");
  assert.deepEqual((await etat(page)).coups, ["f3", "e5", "g4", "Dh4#"]);
  assert.equal(await caseJeu(page, "e1").getAttribute("data-echec"), "");
  assert.match(await caseJeu(page, "e1").getAttribute("aria-label"), /roi en échec/);
  await caseJeu(page, "a2").click();
  assert.equal(await jeu(page).locator("[data-destination]").count(), 0, "plus aucun coup après le mat");
  await contexte.close();
});

test("échecs : annuler un coup, à deux puis contre l'ordinateur", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await jouer(page, "d2d4");
  await page.waitForFunction(() => window.kermiclab.echecs.etat().coups.length === 2, null, { timeout: 5000 });
  await jeu(page).locator('[data-action="annuler"]').click();
  assert.equal((await etat(page)).fen, FEN_INITIALE, "contre l'ordinateur, on revient avant le coup du joueur");
  await aDeux(page);
  await jouer(page, "e2e4 e7e5");
  await jeu(page).locator('[data-action="annuler"]').click();
  assert.deepEqual((await etat(page)).coups, ["e4"]);
  assert.equal(await statut(page), "Au tour des Noirs");
  await contexte.close();
});

test("échecs : promotion au choix (sous-promotion en cavalier)", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await aDeux(page);
  await jouer(page, "h2h4 g7g5 h4g5 h7h6 g5h6 f8g7 h6g7 g8f6");
  await caseJeu(page, "g7").click();
  await caseJeu(page, "h8").click();
  const dialogue = page.locator("#promotion");
  assert.equal(await dialogue.isVisible(), true);
  await dialogue.locator('[data-promotion="n"]').click();
  assert.equal(await dialogue.isVisible(), false);
  assert.equal((await etat(page)).coups.at(-1), "gxh8=C");
  assert.equal(await caseJeu(page, "h8").getAttribute("aria-label"), "h8 : cavalier blanc, dernier coup");
  await contexte.close();
});

test("échecs : jouable au clavier (flèches, Entrée, Échap) avec un focus visible", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await aDeux(page);
  await caseJeu(page, "e2").focus();
  await page.keyboard.press("Enter");
  assert.equal(await caseJeu(page, "e2").getAttribute("data-selection"), "");
  await page.keyboard.press("Escape");
  assert.equal(await caseJeu(page, "e2").getAttribute("data-selection"), null);
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.case), "e4");
  assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "solid");
  await page.keyboard.press("Enter");
  assert.deepEqual((await etat(page)).coups, ["e4"]);
  assert.equal(await jeu(page).locator('.case[tabindex="0"]').count(), 1, "tabulation itinérante");
  await contexte.close();
});

test("échecs : jouer les Noirs, l'ordinateur commence et l'échiquier est retourné ; réglages mémorisés", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await jeu(page).locator('input[name="couleur"][value="b"]').check();
  await page.waitForFunction(() => window.kermiclab.echecs.etat().coups.length === 1, null, { timeout: 5000 });
  assert.equal(await jeu(page).locator(".case").first().getAttribute("data-case"), "h1", "Noirs en bas");
  assert.equal(await statut(page), "À toi de jouer (Noirs)");
  await jeu(page).locator('input[name="niveau"][value="moyen"]').check();
  await page.reload();
  assert.equal(await jeu(page).locator('input[name="couleur"][value="b"]').isChecked(), true);
  assert.equal(await jeu(page).locator('input[name="niveau"][value="moyen"]').isChecked(), true);
  await aDeux(page);
  await jeu(page).locator('[data-action="tourner"]').click();
  assert.equal(await jeu(page).locator(".case").first().getAttribute("data-case"), "h1");
  await contexte.close();
});

test("échecs mobile : jouer au toucher, échiquier dans la largeur, aucun défilement horizontal", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE(), MOBILE);
  await page.goto(URL_PAGE());
  await jouer(page, "g1f3", "tap");
  await page.waitForFunction(() => window.kermiclab.echecs.etat().coups.length === 2, null, { timeout: 5000 });
  assert.equal((await etat(page)).coups[0], "Cf3");
  const boite = await jeu(page).locator(".echiquier").boundingBox();
  assert.ok(boite.x >= 0 && boite.x + boite.width <= 360, `échiquier de ${boite.width}px`);
  assert.ok(boite.width / 8 >= 36, "cases assez grandes pour le doigt");
  for (const id of ["explication", "application", "mise-en-situation"]) {
    await page.click(`#onglet-${id}`);
    const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(debord <= 0, `${id} déborde de ${debord}px`);
  }
  await contexte.close();
});

test("énigmes : un coup qui ne fait pas mat donne un indice, le mat explique la solution", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await page.click("#onglet-mise-en-situation");
  const panneau = page.locator("#panneau-mise-en-situation");
  const retour = panneau.locator('[data-sortie="retour"]');
  const cliquer = async (c) => { await panneau.locator(`[data-case="${c.slice(0, 2)}"]`).click(); await panneau.locator(`[data-case="${c.slice(2, 4)}"]`).click(); };
  await cliquer("a1a7");
  assert.match(await retour.textContent(), /Ta7 ne fait pas mat/);
  for (const solution of ["a1a8", "h5f7", "b1b8", "h6f7"]) {
    await cliquer(solution);
    assert.equal(await retour.getAttribute("class"), "message ok", solution);
    assert.match(await retour.textContent(), /Échec et mat/);
    await panneau.locator('[data-action="suivante"]').click();
  }
  assert.match(await panneau.locator('[data-sortie="progression"]').textContent(), /Énigme 1 \/ 4/);
  await contexte.close();
});

/* ---------- Académie ---------- */
const academie = (page) => page.locator("#panneau-academie");
const etatAcademie = (page) => page.evaluate(() => window.kermiclab.academie.etat());
const coupAcademie = async (page, c) => {
  await academie(page).locator(`[data-case="${c.slice(0, 2)}"]`).click();
  await academie(page).locator(`[data-case="${c.slice(2, 4)}"]`).click();
};

test("académie : première leçon complète, XP, étoiles, badge, progression gardée au rechargement", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await page.click("#onglet-academie");
  assert.match(await academie(page).locator('[data-sortie="conseil"]').textContent(), /Commence par « La valeur des pièces »/);
  assert.equal(await academie(page).locator('[data-lecon="fourchette"]').isDisabled(), true, "grade Fou verrouillé");
  await academie(page).locator('[data-action="conseil"]').click();
  assert.match(await academie(page).locator('[data-sortie="retenir"]').textContent(), /Pion 1, cavalier 3/);
  await academie(page).locator('[data-choix="1"]').click();
  assert.match(await academie(page).locator('[data-sortie="retour"]').textContent(), /Pas tout à fait/);
  await academie(page).locator('[data-choix="2"]').click();
  assert.match(await academie(page).locator('[data-sortie="toast"]').textContent(), /\+10 XP/);
  await academie(page).locator('[data-action="suivant"]').click();
  await coupAcademie(page, "d4h4");
  assert.match(await academie(page).locator('[data-sortie="retour"]').textContent(), /la dame en vaut 9/, "piège expliqué");
  await coupAcademie(page, "d4d8");
  assert.match(await academie(page).locator('[data-sortie="retour"]').textContent(), /Txd8\+/);
  await academie(page).locator('[data-action="suivant"]').click();
  assert.match(await academie(page).locator('[data-sortie="bilan-titre"]').textContent(), /★★☆ Leçon terminée/);
  assert.match(await academie(page).locator('[data-sortie="toast"]').textContent(), /Badge « Premiers pas »/);
  assert.match(await academie(page).locator('[data-action="bilan-suite"]').textContent(), /Parer un échec/);
  const etat = await etatAcademie(page);
  assert.equal(etat.xp, 10 + 10 + 30);
  assert.equal(etat.lecons.valeurs.etoiles, 2, "deux erreurs : 2 étoiles");
  assert.deepEqual(Object.keys(etat.cartes).sort(), ["valeurs/0", "valeurs/1"]);
  await page.reload();
  await page.click("#onglet-academie");
  assert.equal((await etatAcademie(page)).xp, 50);
  assert.match(await academie(page).locator('[data-lecon="valeurs"]').getAttribute("aria-label"), /2 étoiles sur 3/);
  assert.match(await academie(page).locator('[data-sortie="stats"]').textContent(), /Aujourd'hui : 2 \/ 3/);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("académie : indice qui montre la pièce, exercice en deux coups avec réponse automatique (mode libre)", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await page.click("#onglet-academie");
  await academie(page).locator('[data-action="detail"]').click();
  await academie(page).locator('input[name="libre"]').check();
  await academie(page).locator('[data-vue="detail"] [data-action="retour"]').click();
  await academie(page).locator('[data-lecon="fourchette"]').click();
  await academie(page).locator('[data-action="indice"]').click();
  assert.equal(await academie(page).locator('[data-case="d5"]').getAttribute("data-selection"), "", "l'indice montre le cavalier");
  assert.match(await academie(page).locator('[data-sortie="retour"]').textContent(), /Indice/);
  await academie(page).locator('[data-case="c7"]').click();
  await page.waitForFunction(() => document.querySelector('#panneau-academie [data-sortie="retour"]').textContent.startsWith("L'adversaire a joué"));
  await coupAcademie(page, "c7a8");
  assert.match(await academie(page).locator('[data-sortie="retour"]').textContent(), /^Réussi !/);
  assert.equal((await etatAcademie(page)).themes.tactique.premiers, 0, "un indice ne compte pas comme réussi du premier coup");
  await contexte.close();
});

test("académie : révisions espacées dues, défi du jour et emblème personnalisé", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  // Progression déjà commencée : grade Pion obtenu, trois cartes à revoir aujourd'hui.
  await page.addInitScript(() => {
    const hier = new Date(Date.now() - 86400000), j = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    localStorage.setItem("kermiclab:echecs:academie", JSON.stringify({
      xp: 120, lecons: { valeurs: { etoiles: 3 }, "parer-echec": { etoiles: 2 }, roque: { etoiles: 3 } },
      cartes: { "valeurs/0": { boite: 1, prochaine: j(hier) }, "roque/1": { boite: 2, prochaine: j(hier) }, "parer-echec/0": { boite: 1, prochaine: j(hier) } },
      serie: 4, serieMax: 4, dernierJour: j(hier)
    }));
  });
  await page.goto(URL_PAGE());
  await page.click("#onglet-academie");
  assert.match(await academie(page).locator('[data-sortie="titre"]').textContent(), /^Pion$/);
  assert.match(await academie(page).locator('[data-sortie="stats"]').textContent(), /4 jours de suite/);
  assert.match(await academie(page).locator('[data-sortie="conseil"]').textContent(), /3 stratégies t'attendent/);
  assert.equal(await academie(page).locator('[data-lecon="mat-couloir"]').isDisabled(), false, "grade Cavalier ouvert");
  // Emblème du cavalier débloqué par le grade Pion, la dame pas encore.
  await academie(page).locator('[data-action="detail"]').click();
  assert.equal(await academie(page).locator('input[name="embleme"][value="q"]').isDisabled(), true);
  await academie(page).locator('input[name="embleme"][value="n"]').check({ force: true });
  assert.equal((await etatAcademie(page)).embleme, "n");
  await academie(page).locator('[data-vue="detail"] [data-action="retour"]').click();
  // Révisions : on répond juste à chaque carte.
  await academie(page).locator('[data-action="conseil"]').click();
  assert.match(await academie(page).locator('[data-sortie="session-titre"]').textContent(), /Tes révisions/);
  for (let k = 0; k < 3; k++) {
    const exo = await page.evaluate(() => document.querySelector('#panneau-academie [data-sortie="consigne"]').textContent);
    const bonne = { "Combien de points vaut une tour ?": 2, "Dans quel cas le roque est-il interdit ?": 0, "Laquelle de ces réponses NE pare PAS un échec ?": 2 }[exo];
    assert.notEqual(bonne, undefined, exo);
    await academie(page).locator(`[data-choix="${bonne}"]`).click();
    assert.match(await academie(page).locator('[data-sortie="retour"]').textContent(), /À retenir/, "la stratégie est rappelée");
    await academie(page).locator('[data-action="suivant"]').click();
  }
  assert.match(await academie(page).locator('[data-sortie="bilan-titre"]').textContent(), /Révisions terminées/);
  const etat = await etatAcademie(page);
  assert.equal(etat.revisions, 3);
  assert.equal(etat.serie, 5, "la série continue");
  assert.equal(etat.cartes["roque/1"].boite, 3);
  assert.ok(etat.badges.includes("serie-3") && etat.badges.includes("sans-faute"));
  assert.ok(!etat.badges.includes("perfectionniste"), "« Parer un échec » n'a que 2 étoiles");
  await academie(page).locator('[data-action="bilan-retour"]').click();
  assert.equal(await academie(page).locator('[data-action="reviser"]').isDisabled(), true);
  assert.match(await academie(page).locator('[data-action="defi"]').textContent(), /Défi du jour \(\+15 XP\)/);
  await contexte.close();
});

test("académie mobile : parcours et exercice sans défilement horizontal, échiquier dans l'écran", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE(), MOBILE);
  await page.goto(URL_PAGE());
  await page.click("#onglet-academie");
  const debord = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(await debord() <= 0, `accueil : ${await debord()}px`);
  await academie(page).locator('[data-action="conseil"]').tap();
  await academie(page).locator('[data-choix="2"]').tap();
  await academie(page).locator('[data-action="suivant"]').tap();
  const boite = await academie(page).locator(".echiquier").boundingBox();
  assert.ok(boite.x >= 0 && boite.x + boite.width <= 360, `échiquier de ${boite.width}px`);
  await academie(page).locator('[data-case="d4"]').tap();
  await academie(page).locator('[data-case="d8"]').tap();
  assert.match(await academie(page).locator('[data-sortie="retour"]').textContent(), /^Parfait !/);
  assert.ok(await debord() <= 0, `exercice : ${await debord()}px`);
  await contexte.close();
});

test("académie : une victoire contre l'ordinateur rapporte de l'XP et un badge, une seule fois", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  // Hasard figé : l'ordinateur Facile joue toujours les mêmes coups, et cette suite le mate.
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.goto(URL_PAGE());
  const blancs = "a2a4 c2c4 d1b3 b3f3 a4b5 b5c6 e2e4 f3e4 b1d2 b2b4 a1a8 a8c8".split(" ");
  for (const [k, coup] of blancs.entries()) {
    await jouer(page, coup);
    if (k < blancs.length - 1) await page.waitForFunction((n) => window.kermiclab.echecs.etat().coups.length === n, 2 * (k + 1), { timeout: 5000 });
  }
  assert.equal(await statut(page), "Échec et mat : bravo, tu as gagné ! 🏆 (+50 XP à l'Académie)");
  let etat = await etatAcademie(page);
  assert.equal(etat.parties.facile.victoires, 1);
  assert.ok(etat.badges.includes("robot-facile"));
  // Annuler puis rejouer le coup gagnant ne compte pas une deuxième victoire.
  await jeu(page).locator('[data-action="annuler"]').click();
  await jouer(page, "a8c8");
  etat = await etatAcademie(page);
  assert.equal(etat.parties.facile.victoires, 1);
  assert.equal(etat.xp, 50);
  await page.click("#onglet-academie");
  await academie(page).locator('[data-action="detail"]').click();
  assert.match(await academie(page).locator('[data-sortie="parties"]').textContent(), /Facile : 1 victoire · 0 nulle · 0 défaite/);
  await contexte.close();
});
