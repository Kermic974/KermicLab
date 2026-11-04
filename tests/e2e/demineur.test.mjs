import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { servir, navigateur, ouvrir, racine } from "./outils.mjs";

// Moteur et parcours lus dans la page : le test rejoue les exercices de l'Académie côté Node.
const HTML = await readFile(`${racine}catalogue/demineur/page.html`, "utf8");
const MOTEUR = vm.runInNewContext(`${HTML.match(/<script id="moteur-demineur">([\s\S]*?)<\/script>/)[1]}\nMoteurDemineur`, {});
const PARCOURS = JSON.parse(HTML.match(/<script type="application\/json" id="parcours-demineur">([\s\S]*?)<\/script>/)[1]);

let serveur, nav;
before(async () => { serveur = await servir(racine); nav = await navigateur(); });
after(async () => { await nav?.close(); await serveur?.fermer(); });

const URL_PAGE = () => `${serveur.url}/catalogue/demineur/page.html`;
const MOBILE = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true };
const jeu = (page) => page.locator("#panneau-application");
const sortie = (page, nom) => jeu(page).locator(`[data-sortie="${nom}"]`);
const caseJeu = (page, index) => jeu(page).locator(`.case[data-index="${index}"]`);
/** Positions des mines de la partie en cours (lues dans l'état exposé par la page). */
const mines = (page) => page.evaluate(() => window.kermiclab.demineur.partie().cases.flatMap((c, i) => (c.mine ? [i] : [])));
const nombreCases = (page) => jeu(page).locator(".case").count();

test("démineur : s'ouvre sur « Jouer », état Prêt, onglets et aucune erreur ni violation CSP", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  const onglets = await page.locator("[role=tab]").evaluateAll((n) => n.map((b) => b.dataset.onglet));
  assert.deepEqual(onglets, ["explication", "application", "academie", "mise-en-situation"]);
  assert.equal(await page.locator("#onglet-application").getAttribute("aria-selected"), "true");
  assert.equal(await nombreCases(page), 81);
  assert.equal(await sortie(page, "niveau").textContent(), "Débutant");
  assert.equal(await sortie(page, "mines").textContent(), "10");
  assert.equal(await sortie(page, "restantes").textContent(), "10");
  assert.equal(await sortie(page, "statut").textContent(), "Prêt");
  assert.equal(await sortie(page, "temps").textContent(), "0:00");
  assert.equal(await page.locator("#connexion").isVisible(), false);
  const registre = await page.evaluate(() => window.kermiclab.registre.map((o) => [o.id, o.actif]));
  assert.deepEqual(registre.at(-1), ["self-test", false]);
  await page.click("#onglet-explication");
  assert.match(await page.locator("#panneau-explication").textContent(), /premier coup n'est jamais une mine/);
  assert.deepEqual(erreurs, [], "aucune erreur console ni violation CSP");
  await contexte.close();
});

test("démineur : aucun appel réseau pendant une partie", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  const requetes = [];
  page.on("request", (r) => requetes.push(r.url()));
  await page.goto(URL_PAGE());
  await caseJeu(page, 40).click();
  await caseJeu(page, 0).click({ button: "right" });
  await page.click("#onglet-mise-en-situation");
  assert.deepEqual(requetes, [URL_PAGE()]);
  await contexte.close();
});

test("démineur : premier clic toujours sûr, chronomètre lancé, partie en cours", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  for (let essai = 0; essai < 8; essai++) {
    await jeu(page).locator('[data-action="nouvelle-partie"]').click();
    assert.deepEqual(await mines(page), [], "aucune mine avant le premier coup");
    await caseJeu(page, (essai * 23) % 81).click();
    assert.equal(await sortie(page, "statut").textContent(), "En cours", `essai ${essai}`);
    assert.equal((await mines(page)).length, 10);
    assert.equal(await caseJeu(page, (essai * 23) % 81).getAttribute("data-etat"), "vide");
  }
  await page.waitForFunction(() => document.querySelector('#panneau-application [data-sortie="temps"]').textContent !== "0:00", null, { timeout: 3000 });
  await contexte.close();
});

test("démineur : drapeau au clic droit, compteur, puis victoire en ouvrant toutes les cases sûres", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await caseJeu(page, 40).click();
  const positions = await mines(page);
  await caseJeu(page, positions[0]).click({ button: "right" });
  assert.equal(await caseJeu(page, positions[0]).getAttribute("data-etat"), "drapeau");
  assert.match(await caseJeu(page, positions[0]).getAttribute("aria-label"), /drapeau/);
  assert.equal(await sortie(page, "restantes").textContent(), "9");
  await caseJeu(page, positions[0]).click();
  assert.equal(await sortie(page, "statut").textContent(), "En cours", "une case avec drapeau ne s'ouvre pas");
  for (let i = 0; i < 81; i++) {
    if (positions.includes(i) || (await caseJeu(page, i).getAttribute("data-etat")) !== "cachee") continue;
    await caseJeu(page, i).click();
  }
  assert.equal(await sortie(page, "statut").textContent(), "Victoire 🎉");
  assert.equal(await sortie(page, "restantes").textContent(), "0");
  assert.match(await sortie(page, "message").textContent(), /Bravo/);
  assert.notEqual(await sortie(page, "record").textContent(), "—", "record enregistré localement");
  await contexte.close();
});

test("démineur : le temps final est figé, même en recliquant sur la grille terminée", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await caseJeu(page, 40).click();
  await page.waitForTimeout(1100);
  const positions = await mines(page);
  for (let i = 0; i < 81; i++) {
    if (positions.includes(i) || (await caseJeu(page, i).getAttribute("data-etat")) !== "cachee") continue;
    await caseJeu(page, i).click();
  }
  assert.equal(await sortie(page, "statut").textContent(), "Victoire 🎉");
  const temps = await sortie(page, "temps").textContent();
  const message = await sortie(page, "message").textContent();
  assert.notEqual(temps, "0:00");
  await page.waitForTimeout(2100);
  await caseJeu(page, 40).click();
  await caseJeu(page, positions[0]).click();
  await jeu(page).locator('[data-action="mode-drapeau"]').click();
  assert.equal(await sortie(page, "temps").textContent(), temps, "temps affiché inchangé");
  assert.equal(await sortie(page, "message").textContent(), message, "message de victoire inchangé");
  assert.equal(await sortie(page, "record").textContent(), temps, "record égal au temps final");
  await contexte.close();
});

test("démineur : défaite en ouvrant une mine, mines dévoilées, nouvelle partie remise à zéro", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await caseJeu(page, 0).click();
  const [mine] = await mines(page);
  await caseJeu(page, mine).click();
  assert.equal(await sortie(page, "statut").textContent(), "Perdu 💥");
  assert.equal(await caseJeu(page, mine).getAttribute("data-etat"), "explosion");
  assert.equal(await jeu(page).locator('.case[data-etat="mine"]').count(), 9);
  await jeu(page).locator('[data-action="nouvelle-partie"]').click();
  assert.equal(await sortie(page, "statut").textContent(), "Prêt");
  assert.equal(await sortie(page, "temps").textContent(), "0:00");
  assert.equal(await jeu(page).locator('.case[data-etat="cachee"]').count(), 81);
  await contexte.close();
});

test("démineur : changement de niveau (Intermédiaire, Expert) avec le nombre exact de mines", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  for (const [niveau, nom, cases, total] of [["intermediaire", "Intermédiaire", 256, 40], ["expert", "Expert", 480, 99]]) {
    await jeu(page).locator(`input[value="${niveau}"]`).check();
    assert.equal(await nombreCases(page), cases, niveau);
    assert.equal(await sortie(page, "niveau").textContent(), nom);
    assert.equal(await sortie(page, "mines").textContent(), String(total));
    await caseJeu(page, 100).click();
    assert.equal((await mines(page)).length, total);
  }
  await page.reload();
  assert.equal(await nombreCases(page), 480, "niveau mémorisé");
  await contexte.close();
});

test("démineur : jouable au clavier (déplacement, drapeau, ouverture) avec un focus visible", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await caseJeu(page, 0).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.index), "10");
  const contour = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.equal(contour, "solid", "focus visible");
  await page.keyboard.press("d");
  assert.equal(await caseJeu(page, 10).getAttribute("data-etat"), "drapeau");
  await page.keyboard.press("f");
  assert.equal(await caseJeu(page, 10).getAttribute("data-etat"), "cachee");
  await page.keyboard.press("End");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.index), "17");
  await page.keyboard.press("Enter");
  assert.equal(await sortie(page, "statut").textContent(), "En cours");
  assert.equal(await caseJeu(page, 17).getAttribute("tabindex"), "0", "tabulation itinérante");
  assert.equal(await jeu(page).locator('.case[tabindex="0"]').count(), 1);
  await contexte.close();
});

test("démineur mobile : toucher ouvre, appui long et mode drapeau posent un drapeau", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE(), MOBILE);
  await page.goto(URL_PAGE());
  await caseJeu(page, 40).tap();
  assert.equal(await sortie(page, "statut").textContent(), "En cours");
  const cible = await page.evaluate(() => window.kermiclab.demineur.partie().cases.findIndex((c) => !c.revelee));
  const boite = await caseJeu(page, cible).boundingBox();
  const point = { pointerType: "touch", isPrimary: true, bubbles: true, clientX: boite.x + 5, clientY: boite.y + 5 };
  await caseJeu(page, cible).dispatchEvent("pointerdown", point);
  await page.waitForTimeout(650);
  await caseJeu(page, cible).dispatchEvent("pointerup", point);
  assert.equal(await caseJeu(page, cible).getAttribute("data-etat"), "drapeau", "appui long");
  await caseJeu(page, cible).dispatchEvent("click");
  assert.equal(await caseJeu(page, cible).getAttribute("data-etat"), "drapeau", "le clic qui suit l'appui long est ignoré");
  const mode = jeu(page).locator('[data-action="mode-drapeau"]');
  await mode.tap();
  assert.equal(await mode.getAttribute("aria-pressed"), "true");
  await caseJeu(page, cible).tap();
  assert.equal(await caseJeu(page, cible).getAttribute("data-etat"), "cachee", "mode drapeau : retrait");
  await mode.tap();
  assert.equal(await mode.getAttribute("aria-pressed"), "false");
  await contexte.close();
});

test("démineur mobile : aucun défilement horizontal de la page, y compris en Expert", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE(), MOBILE);
  await page.goto(URL_PAGE());
  const debord = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  for (const id of ["explication", "application", "mise-en-situation"]) {
    await page.click(`#onglet-${id}`);
    assert.ok(await debord() <= 0, `${id} déborde de ${await debord()}px`);
  }
  await page.click("#onglet-application");
  for (const niveau of ["intermediaire", "expert"]) {
    await jeu(page).locator(`input[value="${niveau}"]`).check();
    assert.ok(await debord() <= 0, `${niveau} déborde de ${await debord()}px`);
  }
  // Expert tourné d'un quart de tour sur téléphone : 16 colonnes affichées au lieu de 30, cases d'au moins 24 px.
  const premiereRangee = await jeu(page).locator(".rangee").first().locator(".case").count();
  assert.equal(premiereRangee, 16);
  const taille = (await caseJeu(page, 0).boundingBox()).width;
  assert.ok(taille >= 24, `cases de ${taille}px`);
  await caseJeu(page, 200).tap();
  assert.equal(await sortie(page, "statut").textContent(), "En cours");
  assert.equal((await mines(page)).length, 99);
  await contexte.close();
});

test("énigmes : une mauvaise case donne un indice, la bonne explique la déduction", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await page.click("#onglet-mise-en-situation");
  const panneau = page.locator("#panneau-mise-en-situation");
  const retour = panneau.locator('[data-sortie="retour"]');
  // Les solutions des énigmes, dans l'ordre : mine, mine, mine, case sûre.
  for (const [mauvaise, bonne] of [[null, 1], [1, 0], [0, 1], [0, 1]]) {
    if (mauvaise !== null) {
      await panneau.locator(`.case[data-index="${mauvaise}"]`).click();
      assert.match(await retour.textContent(), /Pas tout à fait/);
    }
    await panneau.locator(`.case[data-index="${bonne}"]`).click();
    assert.equal(await retour.getAttribute("class"), "message ok");
    await panneau.locator('[data-action="suivante"]').click();
  }
  assert.match(await panneau.locator('[data-sortie="progression"]').textContent(), /Énigme 1 \/ 4/);
  await contexte.close();
});

/* ---------- Académie ---------- */
const academie = (page) => page.locator("#panneau-academie");
const sortieA = (page, nom) => academie(page).locator(`[data-sortie="${nom}"]`).first();
const caseA = (page, i) => academie(page).locator(`.case[data-index="${i}"]`);
const etatA = (page) => page.evaluate(() => window.kermiclab.academie.etat());
const exercice = (id, k = 0) => PARCOURS.grades.flatMap((g) => g.lecons).find((l) => l.id === id).exercices[k];

test("académie du démineur : chaque geste est jugé par le solveur, seules les certitudes comptent", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await page.click("#onglet-academie");
  assert.match(await sortieA(page, "conseil").textContent(), /Commence par « Lire un chiffre »/);
  await academie(page).locator('[data-action="conseil"]').click();
  await academie(page).locator('[data-choix="1"]').click();
  await academie(page).locator('[data-action="suivant"]').click();
  // Grille 4 × 4 : la mine certaine est en ligne 3, colonne 4 (case 11).
  await caseA(page, 11).click();
  assert.match(await sortieA(page, "retour").textContent(), /on cherche les mines/);
  await caseA(page, 15).click({ button: "right" });
  assert.match(await sortieA(page, "retour").textContent(), /pas de mine ici/);
  await caseA(page, 11).click({ button: "right" });
  assert.match(await sortieA(page, "retour").textContent(), /^Réussi !/);
  assert.equal(await caseA(page, 11).getAttribute("data-etat"), "drapeau");
  await academie(page).locator('[data-action="suivant"]').click();
  assert.match(await sortieA(page, "bilan-titre").textContent(), /Leçon terminée/);
  assert.equal((await etatA(page)).lecons["lire-chiffre"].etoiles, 2);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("académie du démineur : déduction en chaîne jusqu'au bout, un pari est refusé (mode libre)", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await page.click("#onglet-academie");
  await academie(page).locator('[data-action="detail"]').click();
  await academie(page).locator('input[name="libre"]').check();
  await academie(page).locator('[data-vue="detail"] [data-action="retour"]').click();
  await academie(page).locator('[data-lecon="chaine"]').click();
  // Même grille côté Node : on ouvre, une par une, les cases que le solveur prouve sûres.
  const e = exercice("chaine"), p = MOTEUR.depuisModele(e.grille.mines);
  for (const [l, c] of e.grille.ouvrir) MOTEUR.reveler(p, l * p.colonnes + c);
  const pari = p.cases.findIndex((c, i) => !c.revelee && !c.mine && !MOTEUR.deduire(p).sures.includes(i));
  await caseA(page, pari).click();
  assert.match(await sortieA(page, "retour").textContent(), /c'était un pari/);
  for (let n = 0; n < 50 && p.statut === "en-cours"; n++) {
    const s = MOTEUR.deduire(p).sures.find((i) => !p.cases[i].revelee);
    MOTEUR.reveler(p, s);
    await caseA(page, s).click();
  }
  assert.match(await sortieA(page, "retour").textContent(), /^Réussi !/);
  assert.equal((await etatA(page)).themes.methode.premiers, 0, "le pari compte comme une erreur");
  await contexte.close();
});

test("démineur : une victoire nourrit l'Académie (XP, record, badges) et l'indice montre une certitude", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  // Hasard reproductible : le plateau est le même à chaque exécution du test.
  await page.addInitScript(() => { let a = 2026; Math.random = () => { a = (a * 1103515245 + 12345) >>> 0; return a / 4294967296; }; });
  await page.goto(URL_PAGE());
  await jeu(page).locator('[data-action="indice-jeu"]').click();
  assert.match(await sortie(page, "message").textContent(), /Commence par ouvrir une case/);
  await caseJeu(page, 40).click();
  await jeu(page).locator('[data-action="indice-jeu"]').click();
  const message = await sortie(page, "message").textContent();
  const partie = await page.evaluate(() => window.kermiclab.demineur.partie());
  const deductions = MOTEUR.deduire(MOTEUR.depuisModele(Array.from({ length: 9 }, (_, l) => partie.cases.slice(l * 9, l * 9 + 9).map((c) => (c.revelee ? "o" : c.mine ? "*" : ".")).join(""))), { compterMines: true });
  if (/Aucune case n'est certaine/.test(message)) {
    // Parfois rien n'est certain : l'indice doit le dire, sans entourer de case.
    assert.equal(await jeu(page).locator(".case[data-indice]").count(), 0);
    assert.equal(deductions.sures.length + deductions.mines.length, 0, "l'indice ne cache aucune certitude");
  } else {
    const indice = Number(await jeu(page).locator(".case[data-indice]").getAttribute("data-index"));
    assert.match(message, /sûre|mine/);
    assert.equal(partie.cases[indice].mine, /mine/.test(message) && !/sûre/.test(message), "l'indice ne ment jamais");
    assert.ok([...deductions.sures, ...deductions.mines].includes(indice), "l'indice désigne une certitude");
  }
  const positions = await mines(page);
  for (let i = 0; i < 81; i++) {
    if (positions.includes(i) || (await caseJeu(page, i).getAttribute("data-etat")) !== "cachee") continue;
    await caseJeu(page, i).click();
  }
  assert.match(await sortie(page, "message").textContent(), /\(\+30 XP à l'Académie\)/);
  const etat = await etatA(page);
  assert.equal(etat.parties.debutant.victoires, 1);
  assert.ok(Number.isInteger(etat.parties.debutant.meilleur));
  assert.ok(etat.badges.includes("premier-deminage"));
  await page.click("#onglet-academie");
  await academie(page).locator('[data-action="detail"]').click();
  assert.match(await sortieA(page, "parties").textContent(), /Débutant : 1 victoire · 0 défaite · record \d+:\d\d/);
  await contexte.close();
});

test("académie : page « Ma progression » complète, et effacement en deux temps", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE());
  await page.goto(URL_PAGE());
  await page.click("#onglet-academie");
  assert.match(await sortieA(page, "prochain-badge").textContent(), /Prochain badge/);
  await academie(page).locator('[data-action="conseil"]').click();
  await academie(page).locator('[data-choix="1"]').click();
  await academie(page).locator('[data-vue="session"] [data-action="retour"]').click();
  await academie(page).locator('[data-action="detail"]').click();
  assert.equal(await page.evaluate(() => document.activeElement.dataset.sortie), "detail-titre", "le focus suit la page");
  assert.match(await sortieA(page, "detail-niveau").textContent(), /Niveau 1 · 20 XP au total/);
  assert.ok(await academie(page).locator(".regles-xp tr").count() >= 10, "règles d'XP expliquées");
  assert.equal(await academie(page).locator('[data-sortie="badges"] li').count(), 16);
  assert.equal(await academie(page).locator('[data-sortie="activite"] li').count(), 7);
  assert.match(await academie(page).locator('[data-sortie="activite"] li').last().getAttribute("aria-label"), /1 activité/);
  const effacer = academie(page).locator('[data-action="effacer"]');
  await effacer.click();
  assert.equal((await etatA(page)).xp, 20, "premier clic : simple demande de confirmation");
  assert.match(await effacer.textContent(), /Confirmer/);
  await effacer.click();
  assert.equal((await etatA(page)).xp, 0);
  assert.match(await sortieA(page, "toast").textContent(), /nouveau départ/);
  await contexte.close();
});

test("académie du démineur mobile : synthèse, page détaillée et exercice sans défilement horizontal", async () => {
  const { page, contexte } = await ouvrir(nav, URL_PAGE(), MOBILE);
  await page.goto(URL_PAGE());
  await page.click("#onglet-academie");
  const debord = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(await debord() <= 0, `synthèse : ${await debord()}px`);
  await academie(page).locator('[data-action="detail"]').tap();
  assert.ok(await debord() <= 0, `détail : ${await debord()}px`);
  await academie(page).locator('[data-vue="detail"] [data-action="retour"]').tap();
  await academie(page).locator('[data-action="conseil"]').tap();
  await academie(page).locator('[data-choix="1"]').tap();
  await academie(page).locator('[data-action="suivant"]').tap();
  // Appui long = drapeau, comme dans le jeu.
  const cible = caseA(page, 11), boite = await cible.boundingBox();
  const point = { pointerType: "touch", isPrimary: true, bubbles: true, clientX: boite.x + 5, clientY: boite.y + 5 };
  await cible.dispatchEvent("pointerdown", point);
  await page.waitForTimeout(650);
  await cible.dispatchEvent("pointerup", point);
  assert.match(await sortieA(page, "retour").textContent(), /^Parfait !/);
  assert.ok(await debord() <= 0, `exercice : ${await debord()}px`);
  await contexte.close();
});
