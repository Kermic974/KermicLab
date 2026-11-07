import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab } from "./outils.mjs";
import { injecterOriginesParent } from "../../worker/src/origines-pages.js";

let serveur, nav, api;
const modules = [
  { id: "pythagore", titre: "Le théorème de Pythagore", matiere: "mathematiques", niveau: "college" },
  { id: "trigo-cercle", titre: "Le cercle trigonométrique", matiere: "mathematiques", niveau: "seconde" },
  { id: "echecs", titre: "Les échecs", matiere: "jeux", niveau: "autres" },
  { id: "poker-texas-holdem", titre: "Poker Texas Hold'em", matiere: "jeux", niveau: "autres" },
  { id: "sudoku", titre: "Le Sudoku", matiere: "jeux", niveau: "autres" },
  { id: "2048", titre: "2048", matiere: "jeux", niveau: "autres" }
];
before(async () => {
  serveur = await servir(`${racine}dist`, { headers: { "referrer-policy": "no-referrer" } });
  nav = await navigateur();
  ({ apiUrl: api } = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8")));
  api ||= serveur.url;
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

async function demarrer(options = {}) {
  const session = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 900 }, ...options });
  const { page } = session;
  await page.addInitScript(() => { try { sessionStorage.setItem("kermiclab:pseudo", "Testeur"); } catch { /* iframe isolée */ } });
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette: "" });
  await page.route(`${api}/api/catalogue`, (r) => r.fulfill({
    contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ notions: modules })
  }));
  await page.route(`${api}/maquettes/**`, async (r) => {
    const id = new URL(r.request().url()).pathname.split("/").at(-1);
    // Comme le Worker (servirPage) : origines autorisées du parent écrites dans les métadonnées servies (ADR 0025).
    const html = await readFile(`${racine}catalogue/${id}/page.html`, "utf8");
    await r.fulfill({ contentType: "text/html", body: injecterOriginesParent(html, [serveur.url]) });
  });
  await page.goto(serveur.url);
  await page.locator("#entree-education", { hasText: "notions" }).waitFor();
  return session;
}

async function ouvrirModule(page, id) {
  await page.locator("#minilab [data-angles] button").first().waitFor({ state: "attached" });
  const module = modules.find((m) => m.id === id);
  const navigation = page.waitForEvent("framenavigated", (frame) =>
    frame.parentFrame() === page.mainFrame() && new URL(frame.url()).pathname === `/maquettes/${id}`);
  // Un jeu s'ouvre depuis l'écran Jeux, une notion depuis Éducation (recherche).
  if (module.matiere === "jeux") {
    await page.click(".barre-laterale [data-nav=jeux]");
    await page.click(`#grille-jeux [data-jeu="${id}"]`);
  } else {
    await page.click("#ouvrir-catalogue");
    await page.fill("#recherche-notion", module.titre);
    await page.locator(`#catalogue-liste [data-notion="${id}"]`).click();
  }
  const iframe = await navigation;
  await iframe.waitForLoadState("load");
  const cadre = page.frameLocator("#bulle-cadre");
  const titrePage = { echecs: "Échecs", sudoku: "Sudoku" }[id] ?? modules.find((m) => m.id === id).titre;
  await cadre.locator("header h1").filter({ hasText: titrePage }).waitFor();
  await cadre.locator('[role="tab"]').first().waitFor();
  await page.waitForFunction((id) => JSON.parse(sessionStorage.getItem("kermiclab:trophees") ?? localStorage.getItem("kermiclab:trophees") ?? "{}")[id], id, { timeout: 5000 });
  return cadre;
}

test("trophées : étoiles d'une notion remontées, restaurées et isolées de l'XP d'exploration", async () => {
  const { page, contexte, erreurs } = await demarrer();
  try {
    const cadre = await ouvrirModule(page, "pythagore");
    assert.equal(await page.locator("#bulle-cadre").getAttribute("sandbox"), "allow-scripts allow-popups allow-popups-to-escape-sandbox");
    await cadre.locator("#onglet-application").click();
    const application = cadre.locator("#panneau-application");
    await application.waitFor({ state: "visible" });
    await application.locator("[data-exercice=app-1]").getByRole("button", { name: "le côté opposé à l'angle droit", exact: true }).click();
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:trophees")).pythagore.etoiles === 1);
    await page.click("#fermer-bulle");
    await page.click(".barre-laterale [data-nav=progression]");
    assert.equal(await page.locator("#progres-titre").textContent(), "Mes badges");
    assert.match(await page.locator("#trophees-notions").textContent(), /Pythagore.*1 \/ 10/s);
    assert.equal(await page.locator("#progres").evaluate((d) => d.scrollWidth <= d.clientWidth), true);
    await page.reload();
    const reprise = await ouvrirModule(page, "pythagore");
    await reprise.locator("#etoiles").filter({ hasText: "★ 1 / 10" }).waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:progression")).xp), 25);
    assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:trophees")), null);
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});

test("événements (ADR 0025) : démarré, réponses, indice et réussite après indice agrégés localement, sans texte saisi", async () => {
  const { page, contexte, erreurs } = await demarrer();
  try {
    const cadre = await ouvrirModule(page, "pythagore");
    const lire = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:evenements") ?? "null"));
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:evenements") ?? "null")?.notions?.pythagore?.ouvertures === 1);
    await cadre.locator("#onglet-application").click();
    const application = cadre.locator("#panneau-application");
    await application.waitFor({ state: "visible" });
    const qcm = application.locator("[data-exercice=app-1]");
    await qcm.getByRole("button", { name: "le plus petit côté", exact: true }).click();
    await qcm.getByRole("button", { name: "le côté opposé à l'angle droit", exact: true }).click();
    const nombre = application.locator("[data-exercice=app-2]");
    await nombre.locator("input").fill("12");
    await nombre.getByRole("button", { name: "Valider" }).click();
    // Dans la bulle (iframe isolée sans « allow-forms »), la réponse se valide sans soumission de formulaire.
    await nombre.locator(".retour", { hasText: "Indice" }).waitFor();
    await nombre.locator("input").fill("15");
    await nombre.locator("input").press("Enter");
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:evenements")).notions.pythagore.exercices["app-2"]?.reussi);
    const { notions } = await lire();
    assert.deepEqual(notions.pythagore.exercices, {
      "app-1": { reponses: 2, reussi: true, indice: 0, apresIndice: false },
      "app-2": { reponses: 2, reussi: true, indice: 1, apresIndice: true }
    });
    assert.equal(notions.pythagore.termine, false);
    assert.match(notions.pythagore.dernierJour, /^\d{4}-\d{2}-\d{2}$/);
    const brut = await page.evaluate(() => sessionStorage.getItem("kermiclab:evenements"));
    assert.doesNotMatch(brut, /"12"|"15"|côté/, "aucune réponse saisie ni texte de la page n'est conservé");
    assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:evenements")), null, "session seulement sans mémorisation");
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});

test("événements (ADR 0025) : le cercle, page écrite à la main, émet le contrat jusqu'à « termine » (issue #184)", async () => {
  const { page, contexte, erreurs } = await demarrer();
  try {
    const cadre = await ouvrirModule(page, "trigo-cercle");
    const lire = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:evenements") ?? "null")?.notions?.["trigo-cercle"]);
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:evenements") ?? "null")?.notions?.["trigo-cercle"]?.ouvertures === 1);
    await cadre.locator("#onglet-mise-en-situation").click();
    const defi = cadre.locator("#panneau-mise-en-situation");
    await defi.waitFor({ state: "visible" });
    // Même table que la page : libellé de la cible → angle en radians.
    const CIBLES = { "30°": Math.PI / 6, "45°": Math.PI / 4, "60°": Math.PI / 3, "90°": Math.PI / 2, "120°": 2 * Math.PI / 3,
      "π rad": Math.PI, "3π/2 rad": 3 * Math.PI / 2, "5π/6 rad": 5 * Math.PI / 6, "cos θ = 0,5 et sin θ > 0": Math.PI / 3, "sin θ = −1": 3 * Math.PI / 2 };
    const ID = Object.fromEntries(Object.keys(CIBLES).map((libelle, i) => [libelle, `defi-${i + 1}`]));
    const svg = defi.locator("svg[data-cercle=defi]");
    const toucher = async (angle) => {
      const b = await svg.boundingBox(); // viewBox -1,35 → 1,35, carré
      await page.mouse.click(b.x + (0.9 * Math.cos(angle) + 1.35) / 2.7 * b.width, b.y + (-0.9 * Math.sin(angle) + 1.35) / 2.7 * b.height);
    };
    // Une cible manquée : réponse fausse et indice ; elle reste à réussir.
    const premiere = (await defi.locator("[data-sortie=cible]").textContent()).trim();
    await toucher(CIBLES[premiere] + Math.PI);
    await defi.locator(".retour.ko").waitFor();
    await page.waitForFunction((id) => JSON.parse(sessionStorage.getItem("kermiclab:evenements")).notions["trigo-cercle"].exercices[id]?.indice === 1, ID[premiere]);
    // Puis toutes les cibles réussies, jusqu'à « termine ».
    for (let tour = 0; tour < 300 && !(await lire())?.termine; tour++) {
      await defi.locator("[data-action=nouveau-defi]").click();
      await toucher(CIBLES[(await defi.locator("[data-sortie=cible]").textContent()).trim()]);
      await defi.locator(".retour.ok").waitFor();
    }
    const notion = await lire();
    assert.equal(notion.termine, true);
    assert.equal(notion.version, "1.1.0");
    assert.deepEqual(Object.keys(notion.exercices).sort(), Object.values(ID).sort());
    assert.ok(Object.values(notion.exercices).every((e) => e.reussi));
    assert.equal(notion.exercices[ID[premiere]].apresIndice, true, "la cible manquée est réussie après l'indice");
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});

test("trophées : Académie, XP, leçon, succès et reprise dans une iframe opaque", async () => {
  const { page, contexte, erreurs } = await demarrer();
  try {
    const cadre = await ouvrirModule(page, "echecs");
    assert.equal(await cadre.locator("body").evaluate(() => document.referrer), "", "la remontée fonctionne sans Referer");
    const academie = cadre.locator("#panneau-academie");
    await cadre.locator("#onglet-academie").click();
    await cadre.locator("#onglet-academie[aria-selected=true]").waitFor();
    await academie.waitFor({ state: "visible" });
    await academie.locator('[data-action="conseil"]').click();
    await academie.locator('[data-choix="2"]').click();
    await academie.locator('[data-action="suivant"]').click();
    await academie.locator('[data-case="d4"]').click();
    await academie.locator('[data-case="d8"]').click();
    await academie.locator('[data-action="suivant"]').click();
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:trophees")).echecs.lecons === 1);
    await page.click("#fermer-bulle");
    await page.click(".barre-laterale [data-nav=progression]");
    const carte = page.locator("#trophees-jeux [data-trophee-module=echecs]");
    assert.match(await carte.textContent(), /70/);
    await carte.locator("summary").click();
    assert.equal(await carte.locator(".badge.obtenu").count(), 2);
    assert.match(await carte.textContent(), /Premiers pas.*Obtenu/s);
    const navigation = page.waitForEvent("framenavigated", (frame) =>
      frame.parentFrame() === page.mainFrame() && new URL(frame.url()).pathname === "/maquettes/echecs");
    await carte.getByRole("button", { name: "Rouvrir la page" }).click();
    const iframe = await navigation;
    await iframe.waitForLoadState("load");
    await cadre.locator("header h1").filter({ hasText: "Échecs" }).waitFor();
    await cadre.locator("#onglet-academie").click();
    await cadre.locator("#onglet-academie[aria-selected=true]").waitFor();
    await academie.waitFor({ state: "visible" });
    await academie.locator('[data-sortie="niveau"]').filter({ hasText: "70 XP" }).waitFor();
    await academie.locator('[data-action="detail"]').click();
    await academie.locator('[data-action="effacer"]').click();
    await academie.locator('[data-action="effacer"]').click();
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:trophees")).echecs.xp === 0);
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});

test("trophées poker : pratique et leçons remontées, restaurées puis effacées dans le tableau de bord", async () => {
  const { page, contexte, erreurs } = await demarrer();
  try {
    let cadre = await ouvrirModule(page, "poker-texas-holdem");
    await cadre.locator('[data-action="coucher"]').click();
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:trophees"))["poker-texas-holdem"].etat.compteurs.manches === 1);
    await cadre.locator("#onglet-academie").click();
    let academie = cadre.locator("#panneau-academie");
    await academie.locator('[data-lecon="cinq-cartes"]').click();
    await academie.locator('[data-choix="1"]').click();
    await academie.locator('[data-action="suivant"]').click();
    await academie.locator('[data-choix="2"]').click();
    await academie.locator('[data-action="suivant"]').click();
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:trophees"))["poker-texas-holdem"].lecons === 1);
    await page.click("#fermer-bulle");
    await page.click(".barre-laterale [data-nav=progression]");
    const carte = page.locator('#trophees-jeux [data-trophee-module="poker-texas-holdem"]');
    await carte.waitFor();
    await carte.locator("summary").click();
    assert.match(await carte.textContent(), /Premiers pas.*Obtenu/s);
    await carte.getByRole("button", { name: "Rouvrir la page" }).click();
    cadre = page.frameLocator("#bulle-cadre");
    const stats = cadre.locator('[data-sortie="stats-jeu"]');
    await stats.waitFor({ state: "visible" });
    const etat = await cadre.locator("body").evaluate(() => window.kermiclab.academie.etat());
    const texteStats = await stats.textContent();
    assert.ok(etat.xp > 0);
    assert.match(texteStats, new RegExp(`${etat.xp} XP`), "le bandeau Jouer reflète les XP restaurés avant interaction");
    assert.match(texteStats, new RegExp(`${etat.compteurs.manches} manches terminées`), "le bandeau reflète les manches restaurées");
    assert.match(texteStats, new RegExp(`${etat.parties.entrainement.victoires} victoires`), "le bandeau reflète les victoires restaurées");
    academie = cadre.locator("#panneau-academie");
    await cadre.locator("#onglet-academie").click();
    await academie.locator('[data-lecon="cinq-cartes"].faite').waitFor();
    assert.equal(await cadre.locator("body").evaluate(() => window.kermiclab.academie.etat().compteurs.manches), 1);
    await academie.locator('[data-action="detail"]').click();
    await academie.locator('[data-action="effacer"]').click();
    await academie.locator('[data-action="effacer"]').click();
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:trophees"))["poker-texas-holdem"].xp === 0);
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});

test("trophées : mini-lab, mémorisation choisie, langue et effacement global sur mobile", async () => {
  const { page, contexte, erreurs } = await demarrer({ viewport: { width: 360, height: 740 }, isMobile: true });
  try {
    await page.click(".nav-mobile [data-nav=education]");
    await page.click("[aria-controls=minilab]");
    for (const angle of [30, 45, 90]) await page.locator(`#minilab [data-angles] button`).filter({ hasText: new RegExp(`^${angle}°$`) }).click();
    await page.click("#ouvrir-progres");
    assert.equal(await page.locator("#progression-vide").isVisible(), false, "un module manipulé n'est pas une progression vide");
    assert.match(await page.locator("#trophees-labs").textContent(), /2 \/ 2/);
    assert.equal(await page.locator("#progres").evaluate((d) => d.scrollWidth <= d.clientWidth), true);
    await page.locator(".profil-mobile[data-ouvrir-profil]").click();
    await page.check("#profil-memoriser");
    assert.equal(await page.evaluate(() => sessionStorage.getItem("kermiclab:trophees")), null);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("kermiclab:trophees"))["mini-cercle"].etoiles), 2);
    await page.click("#fermer-profil");
    await page.reload();
    await page.locator("#trophees-labs").waitFor();
    assert.match(await page.locator("#trophees-labs").textContent(), /2 \/ 2/);
    await page.selectOption("#langue", "en");
    await page.waitForFunction(() => document.querySelector("#progres-titre").textContent === "My badges");
    await page.locator(".profil-mobile[data-ouvrir-profil]").click();
    await page.uncheck("#profil-memoriser");
    assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:trophees")), null);
    await page.click("#effacer-donnees");
    await page.click("#effacer-donnees");
    await page.waitForFunction(() => sessionStorage.getItem("kermiclab:trophees") === null && localStorage.getItem("kermiclab:trophees") === null);
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});

test("trophées : les fenêtres étrangères et les identifiants incohérents sont ignorés", async () => {
  const { page, contexte, erreurs } = await demarrer();
  try {
    await ouvrirModule(page, "pythagore");
    await page.evaluate(() => {
      const faux = { type: "kermiclab:trophees:progres", module: "pythagore", genre: "notions", etat: [], etoiles: 999, badges: [] };
      window.dispatchEvent(new MessageEvent("message", { source: window, origin: "null", data: faux }));
      const cadre = document.querySelector("#bulle-cadre");
      window.dispatchEvent(new MessageEvent("message", { source: cadre.contentWindow, origin: "null", data: { ...faux, module: "echecs" } }));
      window.dispatchEvent(new MessageEvent("message", { source: cadre.contentWindow, origin: location.origin, data: faux }));
    });
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:trophees")).pythagore.etoiles), 0);
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});

for (const id of ["sudoku", "2048"]) {
  test(`trophées : ${id} publie ses objectifs et restaure les grades`, async () => {
    const { page, contexte, erreurs } = await demarrer();
    try {
      const cadre = await ouvrirModule(page, id);
      const n = await page.evaluate((id) => JSON.parse(sessionStorage.getItem("kermiclab:trophees"))[id].badges.length, id);
      assert.equal(n, 5);
      if (id === "sudoku") {
        const message = cadre.locator('[data-sortie="message"]');
        for (let i = 0; i < 81 && !(await message.textContent()).includes("Grille résolue"); i++) {
          await cadre.getByRole("button", { name: "💡 Indice" }).click();
        }
        assert.match(await message.textContent(), /Grille résolue/, "les indices terminent la grille et débloquent le grade suivant");
        await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:trophees")).sudoku.grades === 1);
        assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:trophees")).sudoku.badges.filter((b) => b.obtenu).length), 1);
      } else {
        for (let tour = 0; tour < 5; tour++) {
          for (const direction of ["left", "up", "right", "down"]) await cadre.locator(`[data-direction="${direction}"]`).click();
        }

        await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:trophees"))["2048"].record > 0);
        const record = Number(await cadre.locator('[data-sortie="record"]').textContent());
        await page.waitForFunction((record) => JSON.parse(sessionStorage.getItem("kermiclab:trophees"))["2048"].record === record, record);
      }
      const avant = await page.evaluate((id) => JSON.parse(sessionStorage.getItem("kermiclab:trophees"))[id], id);
      await page.click("#fermer-bulle");
      await ouvrirModule(page, id);
      if (id === "sudoku") {
        const academie = cadre.getByRole("tab", { name: "Académie" });
        await academie.click();
        await cadre.locator("#onglet-academie[aria-selected=true]").waitFor();
        await cadre.locator("#panneau-academie").waitFor({ state: "visible" });
        assert.match(await cadre.locator('[data-sortie="progression"]').textContent(), /2 \/ 5 grades débloqués/);
        assert.equal(await cadre.locator("#panneau-academie .grade button:not(:disabled)").count(), 2);
        assert.equal(await cadre.locator(".grade button:disabled").count(), 3);
      } else {
        await cadre.locator('[data-sortie="record"]').filter({ hasText: new RegExp(`^${avant.record}$`) }).waitFor();
        assert.equal(Number(await cadre.locator('[data-sortie="record"]').textContent()), avant.record);
      }
      assert.deepEqual(erreurs, []);
    } finally { await contexte.close(); }
  });
}

test("Mes badges : aucun module jamais lancé, aucune grille grisée, rien chargé en arrière-plan", async () => {
  const { page, contexte, erreurs } = await demarrer();
  const pagesOuvertes = [];
  const chargements = [];
  page.on("request", (r) => {
    const chemin = new URL(r.url()).pathname;
    if (chemin.startsWith("/maquettes/")) pagesOuvertes.push(r.url());
    if (chemin.endsWith("/trophees.json")) chargements.push(r.url());
  });
  try {
    await page.click(".barre-laterale [data-nav=progression]");
    // Divulgation progressive : avant toute activité, un état vide et deux portes d'entrée, rien d'autre.
    assert.equal(await page.locator("#progression-vide").isVisible(), true);
    assert.equal(await page.locator("#progres").isVisible(), false);
    assert.equal(await page.locator("[data-trophee-module]").count(), 0, "aucun module jamais lancé");
    assert.equal(await page.locator(".badge.verrouille").count(), 0, "aucune grille de badges grisés");
    assert.deepEqual(pagesOuvertes, [], "aucune page de jeu lancée en arrière-plan");
    assert.deepEqual(chargements, [], "la collection complète n'est plus téléchargée");
    assert.equal(await page.evaluate(() => sessionStorage.getItem("kermiclab:trophees")), null, "consulter ne crée pas de progression");
    // Après un premier lancement réel, le module apparaît avec ses propres objectifs.
    await ouvrirModule(page, "echecs");
    await page.click("#fermer-bulle");
    await page.click(".barre-laterale [data-nav=progression]");
    const echecs = page.locator("#trophees-jeux [data-trophee-module=echecs]");
    assert.match(await echecs.textContent(), /Les échecs.*0 \/ 17 trophées obtenus/s);
    assert.equal(await page.locator("[data-trophee-module]").count(), 1);
    assert.equal(await page.locator("#progres .badge.obtenu").count(), 1, "seul « Explorateur » (première page ouverte) est obtenu : aucun succès inventé");
    await page.click("[aria-controls=decouvertes-jeux]");
    assert.match(await page.locator("#decouvertes").textContent(), /Les échecs.*Ouvert 1 fois/s);
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});

test("trophées depuis l'accueil : les résultats conservés apparaissent sans rouvrir le jeu", async () => {
  const { page, contexte, erreurs } = await demarrer();
  try {
    const c = JSON.parse(await readFile(`${racine}dist/trophees.json`, "utf8"));
    const p = c.modules.find((m) => m.id === "echecs").progression;
    p.xp = 70; p.etoiles = 3; p.lecons = 1;
    p.etat.xp = 70; p.etat.lecons.valeurs = { etoiles: 3, jour: "2026-11-05" };
    for (const badge of p.badges.filter((b) => ["premiers-pas", "sans-faute"].includes(b.id))) {
      badge.actuel = 1; badge.obtenu = true;
    }
    await page.evaluate((p) => sessionStorage.setItem("kermiclab:trophees", JSON.stringify({ echecs: p })), p);
    await page.reload();
    await page.locator("#entree-education", { hasText: "notions" }).waitFor();
    await page.click(".barre-laterale [data-nav=progression]");
    const carte = page.locator("#trophees-jeux [data-trophee-module=echecs]");
    await carte.waitFor();
    await carte.locator("summary").click();
    assert.match(await carte.textContent(), /70/);
    assert.equal(await carte.locator(".badge.obtenu").count(), 2);
    assert.equal(await page.locator("iframe[data-module]").count(), 0);
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});
