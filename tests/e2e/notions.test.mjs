import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { servir, navigateur, ouvrir, racine } from "./outils.mjs";

// Pages générées depuis gabarit/ : même contrat que trigo-cercle, plus exercices, étoiles et défi progressif.
let serveur, nav;
before(async () => { serveur = await servir(racine); nav = await navigateur(); });
after(async () => { await nav?.close(); await serveur?.fermer(); });
const url = (id) => `${serveur.url}/catalogue/${id}/page.html`;

for (const id of ["pythagore", "fractions", "proportionnalite"]) {
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
    assert.ok(await page.locator("#panneau-application .figure svg *").count() > 3, "la figure est dessinée");
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
