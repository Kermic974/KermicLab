import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab } from "./outils.mjs";

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
    await r.fulfill({ contentType: "text/html", body: await readFile(`${racine}catalogue/${id}/page.html`, "utf8") });
  });
  await page.goto(serveur.url);
  await page.locator("#grille-matieres button").first().waitFor();
  return session;
}

async function ouvrirModule(page, id) {
  await page.locator("#minilab [data-angles] button").first().waitFor({ state: "attached" });
  await page.click("#ouvrir-catalogue");
  await page.fill("#recherche-notion", modules.find((m) => m.id === id).titre);
  const navigation = page.waitForEvent("framenavigated", (frame) =>
    frame.parentFrame() === page.mainFrame() && new URL(frame.url()).pathname === `/maquettes/${id}`);
  await page.locator(`#catalogue-liste [data-notion="${id}"]`).click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#catalogue")).visibility === "hidden");
  const iframe = await navigation;
  await iframe.waitForLoadState("load");
  const cadre = page.frameLocator("#bulle-cadre");
  const titrePage = { echecs: "Échecs", sudoku: "Sudoku" }[id] ?? modules.find((m) => m.id === id).titre;
  await cadre.locator("header h1").filter({ hasText: titrePage }).waitFor();
  await cadre.locator("#onglets [role=tab]").first().waitFor();
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
    await page.click("[data-nav=badges]");
    assert.equal(await page.locator("#progres-titre").textContent(), "Mes trophées");
    assert.match(await page.locator("#trophees-notions").textContent(), /Pythagore.*1 \/ 10/s);
    assert.equal(await page.locator("#progres").evaluate((d) => d.scrollWidth <= d.clientWidth), true);
    await page.click("#fermer-progres");
    await page.reload();
    const reprise = await ouvrirModule(page, "pythagore");
    await reprise.locator("#etoiles").filter({ hasText: "★ 1 / 10" }).waitFor();
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:progression")).xp), 25);
    assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:trophees")), null);
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
    await page.click("[data-nav=badges]");
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
    await page.click("[data-nav=badges]");
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
    for (const angle of [30, 45, 90]) await page.locator(`#minilab [data-angles] button`).filter({ hasText: new RegExp(`^${angle}°$`) }).click();
    await page.click("#ouvrir-progres");
    assert.match(await page.locator("#trophees-labs").textContent(), /2 \/ 2/);
    assert.equal(await page.locator("#progres").evaluate((d) => d.scrollWidth <= d.clientWidth), true);
    await page.click("#fermer-progres");
    await page.locator(".profil-mobile[data-ouvrir-profil]").click();
    await page.check("#profil-memoriser");
    assert.equal(await page.evaluate(() => sessionStorage.getItem("kermiclab:trophees")), null);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("kermiclab:trophees"))["mini-cercle"].etoiles), 2);
    await page.click("#fermer-profil");
    await page.reload();
    await page.click("#ouvrir-progres");
    assert.match(await page.locator("#trophees-labs").textContent(), /2 \/ 2/);
    await page.click("#fermer-progres");
    await page.selectOption("#langue", "en");
    await page.click("#ouvrir-progres");
    assert.equal(await page.locator("#progres-titre").textContent(), "My trophies");
    await page.click("#fermer-progres");
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

test("trophées depuis l'accueil : toute la collection est visible sans avoir ouvert un module", async () => {
  const { page, contexte, erreurs } = await demarrer();
  const pagesOuvertes = [];
  page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/maquettes/")) pagesOuvertes.push(r.url()); });
  try {
    await page.click("[data-nav=badges]");
    await page.locator("#trophees-jeux [data-trophee-module=echecs]").waitFor();
    assert.equal(await page.locator("#trophees-notions [data-trophee-module=pythagore]").count(), 1);
    assert.equal(await page.locator("#trophees-labs [data-trophee-module=mini-cercle]").count(), 1);
    assert.equal(await page.locator("#trophees-labs [data-trophee-module=trigo-cercle]").count(), 1);
    const echecs = page.locator("[data-trophee-module=echecs]");
    assert.match(await echecs.textContent(), /Les échecs.*0 \/ 17 trophées obtenus/s);
    await echecs.locator("summary").click();
    assert.equal(await echecs.locator(".badge.verrouille").count(), 17);
    assert.equal(await page.locator("#progres .badge.obtenu").count(), 0, "aucun succès inventé");
    assert.equal(await page.evaluate(() => sessionStorage.getItem("kermiclab:trophees")), null, "consulter ne crée pas de progression");
    assert.equal(await page.evaluate(() => localStorage.getItem("kermiclab:trophees")), null);
    assert.deepEqual(pagesOuvertes, [], "la collection ne lance aucune page de jeu en arrière-plan");
    await echecs.getByRole("button", { name: "Commencer", exact: true }).click();
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:trophees") ?? "{}").echecs);
    assert.equal(await page.locator("#bulle-lab").getAttribute("data-notion"), "echecs");
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
    await page.locator("#grille-matieres button").first().waitFor();
    await page.click("[data-nav=badges]");
    const carte = page.locator("#trophees-jeux [data-trophee-module=echecs]");
    await carte.waitFor();
    await carte.locator("summary").click();
    assert.match(await carte.textContent(), /70/);
    assert.equal(await carte.locator(".badge.obtenu").count(), 2);
    assert.equal(await page.locator("iframe[data-module]").count(), 0);
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});

test("trophées : un échec du chargement de la collection est visible et réessayable", async () => {
  const { page, contexte } = await demarrer();
  try {
    await page.route("**/trophees.json", (r) => r.fulfill({ status: 503, body: "indisponible" }));
    await page.click("[data-nav=badges]");
    await page.locator("#trophees-reessayer").waitFor();
    assert.match(await page.locator("#trophees-etat").textContent(), /Impossible de charger/);
    await page.unroute("**/trophees.json");
    await page.click("#trophees-reessayer");
    await page.locator("#trophees-jeux [data-trophee-module=echecs]").waitFor();
    assert.equal(await page.locator("#trophees-etat").textContent(), "");
    assert.equal(await page.locator("#trophees-reessayer").isVisible(), false);
  } finally { await contexte.close(); }
});
