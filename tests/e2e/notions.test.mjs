import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine } from "./outils.mjs";

// Pages générées depuis gabarit/ : même contrat que trigo-cercle, plus exercices, étoiles et défi progressif.
let serveur, nav;
before(async () => { serveur = await servir(racine); nav = await navigateur(); });
after(async () => { await nav?.close(); await serveur?.fermer(); });
const url = (id) => `${serveur.url}/catalogue/${id}/page.html`;

// Toutes les notions décrites par un contenu.json (gabarit commun).
const NOTIONS = [];
for (const nom of (await readdir(`${racine}catalogue`)).sort()) {
  try { await stat(`${racine}catalogue/${nom}/contenu.json`); NOTIONS.push(nom); } catch { /* page écrite à la main */ }
}

for (const id of NOTIONS) {
  test(`${id} : onglets, figure, aucune erreur ni violation CSP, pas de débordement mobile`, async () => {
    const { page, contexte, erreurs } = await ouvrir(nav, url(id), { viewport: { width: 360, height: 740 }, isMobile: true });
    await page.goto(url(id));
    assert.deepEqual(await page.locator("[role=tab]").evaluateAll((n) => n.map((b) => b.dataset.onglet)), ["explication", "application", "mise-en-situation"]);
    assert.deepEqual((await page.evaluate(() => window.kermiclab.registre.map((o) => [o.id, o.actif]))).at(-1), ["self-test", false]);
    for (const o of ["explication", "application", "mise-en-situation"]) {
      await page.click(`#onglet-${o}`);
      const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(debord <= 0, `${o} déborde de ${debord}px`);
    }
    await page.click("#onglet-application");
    if (await page.locator("#panneau-application .figure").count()) {
      assert.ok(await page.locator("#panneau-application .figure svg *").count() > 3, "la figure est dessinée");
    }
    assert.equal(await page.locator("#connexion").isVisible(), false);
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });
}

test("exercices : QCM, indices progressifs, étoiles mémorisées", async () => {
  const { page, contexte } = await ouvrir(nav, url("pythagore"));
  await page.goto(url("pythagore"));
  await page.click("#onglet-application");
  assert.match(await page.locator("#etoiles").textContent(), /★ 0 \/ 10/);
  const qcm = page.locator("[data-exercice=app-1]");
  await qcm.getByRole("button", { name: "le plus petit côté" }).click();
  assert.match(await qcm.locator(".retour").textContent(), /Pas tout à fait/);
  await qcm.getByRole("button", { name: "le côté opposé à l'angle droit" }).click();
  assert.match(await qcm.locator(".retour").textContent(), /\+1 étoile/);
  const calcul = page.locator("[data-exercice=app-2]");
  await calcul.locator("input").fill("21");
  await calcul.getByRole("button", { name: "Valider" }).click();
  assert.match(await calcul.locator(".retour").textContent(), /Indice : Calcule 9² \+ 12²/);
  await calcul.locator("input").fill("15");
  await calcul.getByRole("button", { name: "Valider" }).click();
  assert.match(await calcul.locator(".retour").textContent(), /Exact/);
  assert.match(await page.locator("#etoiles").textContent(), /★ 2 \/ 10/);
  await page.reload();
  assert.match(await page.locator("#etoiles").textContent(), /★ 2 \/ 10/);
  await contexte.close();
});

test("fractions : une fraction non simplifiée est refusée, « 3/4 » et les virgules sont comprises", async () => {
  const { page, contexte } = await ouvrir(nav, url("fractions"));
  await page.goto(url("fractions"));
  await page.click("#onglet-application");
  const simplifier = page.locator("[data-exercice=app-1]");
  await simplifier.locator("input").fill("6/8");
  await simplifier.getByRole("button", { name: "Valider" }).click();
  assert.match(await simplifier.locator(".retour").textContent(), /pas encore simplifiée/);
  await simplifier.locator("input").fill("3/4");
  await simplifier.getByRole("button", { name: "Valider" }).click();
  assert.match(await simplifier.locator(".retour").textContent(), /Exact/);
  const addition = page.locator("[data-exercice=app-2]");
  await addition.locator("input").fill("0,75");
  await addition.getByRole("button", { name: "Valider" }).click();
  assert.match(await addition.locator(".retour").textContent(), /Exact/);
  await contexte.close();
});

test("défi : les étapes se débloquent une à une jusqu'à « Mission accomplie »", async () => {
  const { page, contexte } = await ouvrir(nav, url("proportionnalite"));
  await page.goto(url("proportionnalite"));
  await page.click("#onglet-mise-en-situation");
  const etapes = page.locator("#panneau-mise-en-situation .exercice");
  assert.equal(await etapes.nth(1).isVisible(), false);
  for (const [i, reponse] of ["300", "250", "9", "2,40"].entries()) {
    await etapes.nth(i).locator("input").fill(reponse);
    await etapes.nth(i).getByRole("button", { name: "Valider" }).click();
    assert.match(await etapes.nth(i).locator(".retour").textContent(), /Exact/);
  }
  assert.equal(await page.locator("#panneau-mise-en-situation .bravo").isVisible(), true);
  await contexte.close();
});

test("figures : la droite affine et le simulateur de dé réagissent", async () => {
  const affine = await ouvrir(nav, url("fonctions-affines"));
  await affine.page.goto(url("fonctions-affines"));
  await affine.page.click("#onglet-application");
  await affine.page.locator(".curseur input").first().fill("-1");
  await affine.page.locator(".curseur input").nth(1).fill("0");
  const tuiles = await affine.page.locator(".tuile b").allTextContents();
  assert.equal(tuiles[0], "f(x) = −x");
  assert.match(tuiles[1], /décroissante/);
  assert.equal(tuiles[3], "linéaire (proportionnalité)");
  await affine.contexte.close();

  const des = await ouvrir(nav, url("probabilites"));
  await des.page.goto(url("probabilites"));
  await des.page.click("#onglet-application");
  await des.page.getByRole("button", { name: "Lancer 1000 fois" }).click();
  const [lancers, , frequence] = await des.page.locator(".tuile b").allTextContents();
  assert.equal(lancers.replace(/\s/g, ""), "1000");
  const f = Number(frequence.replace(",", "."));
  assert.ok(f > 0.08 && f < 0.26, `fréquence du 6 plausible : ${f}`);
  assert.deepEqual(des.erreurs, []);
  await des.contexte.close();
});

/** Écriture qu'un élève taperait pour la réponse attendue : fraction (si exigée) ou nombre décimal à virgule. */
function saisie(ex) {
  if (!ex.fractionIrreductible) return String(ex.reponse).replace(".", ",");
  for (let d = 1; d <= 1000; d++) {
    const n = Math.round(ex.reponse * d);
    if (Math.abs(n / d - ex.reponse) < 1e-9) return `${n}/${d}`;
  }
  throw new Error(`réponse non rationnelle : ${ex.reponse}`);
}

test("toutes les notions : chaque exercice accepte sa réponse attendue (application et défi complets)", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const id of NOTIONS) {
    const contenu = JSON.parse(await readFile(`${racine}catalogue/${id}/contenu.json`, "utf8"));
    const { page, contexte, erreurs } = await ouvrir(nav, url(id));
    await page.goto(url(id));
    for (const [onglet, prefixe, liste] of [["application", "app", contenu.application.exercices], ["mise-en-situation", "defi", contenu.situation.etapes]]) {
      await page.click(`#onglet-${onglet}`);
      for (const [i, ex] of liste.entries()) {
        const carte = page.locator(`[data-exercice=${prefixe}-${i + 1}]`);
        if (ex.type === "qcm") await carte.locator(".choix-bouton").nth(ex.bonne).click();
        else {
          await carte.locator("input").fill(saisie(ex));
          await carte.getByRole("button", { name: "Valider" }).click();
        }
        assert.match(await carte.locator(".retour").textContent(), /Bravo|Exact/, `${id} ${prefixe}-${i + 1} : « ${ex.question} »`);
      }
    }
    assert.equal(await page.locator("#panneau-mise-en-situation .bravo").isVisible(), true, `${id} : défi terminé`);
    const total = contenu.application.exercices.length + contenu.situation.etapes.length;
    assert.equal((await page.locator("#etoiles").textContent()).trim(), `★ ${total} / ${total}`);
    assert.deepEqual(erreurs, [], id);
    await contexte.close();
  }
});

test("géographie : une erreur donne un indice, le corrigé donne une étoile et le défi reste progressif", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const id of ["mondialisation", "mers-oceans", "union-europeenne", "dynamiques-territoriales", "france-regions", "espaces-productifs", "tourisme", "afrique-australe"]) {
    const contenu = JSON.parse(await readFile(`${racine}catalogue/${id}/contenu.json`, "utf8"));
    const { page, contexte, erreurs } = await ouvrir(nav, url(id));
    await page.goto(url(id));
    await page.click("#onglet-application");
    const i = contenu.application.exercices.findIndex((ex) => ex.type === "qcm");
    const ex = contenu.application.exercices[i];
    const carte = page.locator(`[data-exercice=app-${i + 1}]`);
    await carte.locator(".choix-bouton").nth((ex.bonne + 1) % ex.choix.length).click();
    assert.ok((await carte.locator(".retour").textContent()).includes(ex.indice), id);
    const total = contenu.application.exercices.length + contenu.situation.etapes.length;
    assert.equal((await page.locator("#etoiles").textContent()).trim(), `★ 0 / ${total}`, id);
    await carte.locator(".choix-bouton").nth(ex.bonne).click();
    assert.ok((await carte.locator(".retour").textContent()).includes(ex.explication), id);
    await page.reload();
    assert.equal((await page.locator("#etoiles").textContent()).trim(), `★ 1 / ${total}`, id);
    await page.click("#onglet-mise-en-situation");
    const etapes = page.locator("#panneau-mise-en-situation .exercice");
    assert.equal(await etapes.nth(0).isVisible(), true, id);
    assert.equal(await etapes.nth(1).isVisible(), false, id);
    assert.deepEqual(erreurs, [], id);
    await contexte.close();
  }
});
