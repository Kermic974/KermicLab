import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab } from "./outils.mjs";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { classificationJeu } from "../../web/contrat-jeux.js";

let serveur, nav, api;
before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
  api = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8")).apiUrl;
});
after(async () => { await nav?.close(); await serveur?.fermer(); });
const suivi = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:evenements"))?.jeux ?? {});

async function demarrer() {
  const session = await ouvrir(nav, serveur.url, { locale: "fr-FR" });
  const { page } = session;
  await page.addInitScript(() => { try { sessionStorage.setItem("kermiclab:pseudo", "Testeur"); } catch { /* sandbox */ } });
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette: "", jeux: ["sudoku", "2048", "echecs", "pendu"].map((id) => ({
    id, titre: id === "sudoku" ? "Sudoku" : "2048", version: "1.0.1", matiere: "jeux", classification: classificationJeu(id)
  })) });
  await page.route(`${api}/maquettes/**`, (r) => {
    const id = new URL(r.request().url()).pathname.split("/").at(-1);
    const html = CATALOGUE.pages[id].fr.replace(/(<script type="application\/json" id="kermiclab-meta">)([\s\S]*?)(<\/script>)/,
      (_, debut, texte, fin) => debut + JSON.stringify({ ...JSON.parse(texte), allowedParentOrigins: [serveur.url] }) + fin);
    return r.fulfill({ contentType: "text/html", body: html });
  });
  await page.goto(serveur.url);
  await page.click(".barre-laterale [data-nav=jeux]");
  await page.locator("[data-jeu=sudoku]").waitFor();
  return session;
}

test("Jeux : filtre, suivi réel Sudoku avec aides, KPI affichés et aucun acquis scolaire", async () => {
  const { page, contexte, erreurs } = await demarrer();
  try {
    await page.selectOption("#famille-jeu", "nombres");
    assert.equal(await page.locator(".jeu-carte").count(), 1);
    await page.selectOption("#famille-jeu", "logique");
    await page.click("[data-jeu=sudoku]");
    const cadre = page.frameLocator("#bulle-cadre");
    await cadre.getByRole("grid", { name: "Grille de Sudoku" }).waitFor();
    assert.deepEqual(await suivi(page), {}, "ouvrir et restaurer ne fabriquent pas de tentative");
    const indice = cadre.getByRole("button", { name: "💡 Indice", exact: true });
    for (let i = 0; i < 81; i++) {
      if ((await cadre.locator('#panneau-application [data-sortie="message"]').textContent()).includes("Grille résolue")) break;
      await indice.click();
    }
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:evenements"))?.jeux?.sudoku?.tentatives?.[0]?.resultat === "reussite");
    const journal = await suivi(page);
    assert.equal(journal.sudoku.tentatives.length, 1);
    assert.ok(journal.sudoku.tentatives[0].indices > 0);
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:evenements")).notions.sudoku), undefined);
    await page.click("#fermer-bulle");
    await page.click(".barre-laterale [data-nav=progression]");
    await page.click("[aria-controls=decouvertes-jeux]");
    const details = page.locator('#decouvertes [data-suivi-jeu="sudoku"]');
    await details.locator(":scope > summary").click();
    assert.match(await details.textContent(), /1 \/ 1 \(100 %\)/);
    assert.match(await details.textContent(), /64 dernières tentatives/);
    assert.match(await details.textContent(), /ne mesurent pas la maîtrise scolaire/);
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});

test("Jeux : retrait du cadre et rechargement ne comptent ni victoire ni double tentative", async () => {
  const { page, contexte, erreurs } = await demarrer();
  try {
    await page.click("[data-jeu='2048']");
    const cadre = page.frameLocator("#bulle-cadre");
    await cadre.getByRole("grid", { name: "Plateau de 2048" }).waitFor();
    await cadre.locator('[data-direction="left"]').click();
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:evenements"))?.jeux?.["2048"]?.tentatives?.length === 1);
    await page.evaluate(() => document.getElementById("bulle-cadre").remove());
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:evenements"))?.jeux?.["2048"]?.tentatives?.[0]?.resultat === "abandon");
    await page.reload();
    await page.locator("#entree-jeux").waitFor({ state: "attached" });
    const journal = await suivi(page);
    assert.equal(journal["2048"].tentatives.length, 1);
    assert.equal(journal["2048"].tentatives[0].resultat, "abandon");
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});

test("Académie : erreurs et réussite observées dans le cadre, sans XP ni maîtrise scolaires", async () => {
  const { page, contexte, erreurs } = await demarrer();
  try {
    await page.click("[data-jeu=echecs]");
    const cadre = page.frameLocator("#bulle-cadre");
    await cadre.locator("#onglet-academie").click();
    const academie = cadre.locator("#panneau-academie");
    await academie.locator('[data-action="conseil"]').click();
    const xp = await page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:progression")).xp);
    await academie.locator('[data-choix="1"]').click();
    await academie.locator('[data-choix="2"]').click();
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:evenements"))?.jeux?.echecs?.tentatives?.[0]?.resultat === "reussite");
    const t = (await suivi(page)).echecs.tentatives[0];
    assert.equal(t.mode, "lecon"); assert.equal(t.erreurs, 1); assert.equal(t.reponses, 2);
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:progression")).xp), xp);
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("kermiclab:evenements")).notions.echecs), undefined);
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});

test("Pendu : les mots et réponses personnels ne quittent pas le cadre", async () => {
  const { page, contexte, erreurs } = await demarrer();
  try {
    await page.click("[data-jeu=pendu]");
    const cadre = page.frameLocator("#bulle-cadre");
    await cadre.getByRole("tab", { name: "Mes mots", exact: true }).click();
    await cadre.getByLabel("Liste de mots à apprendre").fill("cabri");
    await cadre.getByRole("button", { name: "Commencer le test", exact: true }).click();
    await cadre.getByRole("button", { name: "Cacher et répondre", exact: true }).click();
    await cadre.locator('#reponse-mot').fill("chèvre");
    await cadre.locator('[data-action="verifier-mot"]').click();
    await cadre.locator('[data-action="mot-suivant"]').click();
    await page.waitForFunction(() => JSON.parse(sessionStorage.getItem("kermiclab:evenements"))?.jeux?.pendu?.tentatives?.[0]?.resultat === "echec");
    const journal = await suivi(page);
    assert.equal(journal.pendu.tentatives[0].activite, "mes-mots");
    assert.equal(journal.pendu.tentatives[0].mode, "orthographe");
    assert.doesNotMatch(JSON.stringify(journal), /cabri|chèvre/);
    assert.deepEqual(erreurs, []);
  } finally { await contexte.close(); }
});
