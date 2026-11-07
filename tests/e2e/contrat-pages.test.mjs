import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { chargerCatalogue, lireMetaHtml } from "../../scripts/lib/catalogue.mjs";
import { navigateur, ouvrir, racine } from "./outils.mjs";

// Contrat navigateur de TOUTES les pages servies (AGENTS.md §5) : catalogue public et privé (catalogue-prive/,
// récupéré par la CI), pages du gabarit et pages écrites à la main (cercle, jeux), toutes les langues.
// Chaque page est testée telle que le Worker la sert (pages[id][langue]), avec sa CSP en <meta>.
const { pages } = await chargerCatalogue([`${racine}catalogue`, `${racine}catalogue-prive`]);
const CAS = Object.entries(pages).flatMap(([id, langues]) => Object.entries(langues).map(([langue, html]) => ({ id, langue, html })));
const ORIGINE = "http://kermiclab.test";

let nav;
before(async () => { nav = await navigateur(); });
after(async () => { await nav?.close(); });

test("contrat : le catalogue chargé couvre public, pages écrites à la main et, si présent, le catalogue privé", () => {
  assert.ok(CAS.length >= 150, `${CAS.length} pages seulement`);
  for (const id of ["trigo-cercle", "pythagore", "echecs", "pendu"]) assert.ok(pages[id]?.fr, `${id} absent`);
});

// En CI, le jeton CATALOGUE_TOKEN fait récupérer le dépôt privé : ses pages doivent alors être testées, jamais ignorées.
test("contrat : avec CATALOGUE_TOKEN, le catalogue privé est présent et testé", { skip: !process.env.CATALOGUE_TOKEN }, async () => {
  const dossiers = await readdir(`${racine}catalogue-prive`, { withFileTypes: true });
  const ids = dossiers.filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name);
  assert.ok(ids.some((id) => pages[id]), "aucune page du catalogue privé chargée");
});

for (const { id, langue, html } of CAS) {
  test(`contrat ${id} (${langue}) : onglets au clavier, CSP sans violation, aucune erreur, mobile sans débordement`, async () => {
    const meta = lireMetaHtml(html);
    const url = `${ORIGINE}/maquettes/${id}?lang=${langue}`;
    const { page, contexte, erreurs } = await ouvrir(nav, url, { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
    await page.route(`${ORIGINE}/**`, (route) => route.request().url() === url
      ? route.fulfill({ contentType: "text/html; charset=utf-8", body: html })
      : route.fulfill({ status: 404, body: "" }));
    await page.goto(url);

    // Onglets (registre rendu dans le DOM) : onglets de base présents et déclarés dans les métadonnées, self-test déclaré
    // mais jamais affiché (inactif). Les jeux s'ouvrent sur « Jouer » (application) : on part de l'onglet sélectionné.
    for (const o of ["explication", "application", "mise-en-situation", "self-test"]) {
      assert.ok(meta.onglets.includes(o), `onglet « ${o} » absent des métadonnées`);
    }
    const onglets = page.locator("[role=tab]");
    const affiches = await onglets.evaluateAll((n) => n.map((b) => b.id.replace(/^onglet-/, "")));
    for (const o of ["explication", "application", "mise-en-situation"]) assert.ok(affiches.includes(o), `onglet de base « ${o} » non affiché`);
    assert.ok(!affiches.includes("self-test"), "self-test affiché alors qu'il est inactif");
    assert.ok(affiches.every((o) => meta.onglets.includes(o)), "onglet affiché absent des métadonnées");

    // Clavier : un seul onglet sélectionné ; la flèche droite sélectionne le suivant et affiche son panneau.
    const selection = await onglets.evaluateAll((n) => n.map((b) => b.getAttribute("aria-selected") === "true"));
    assert.equal(selection.filter(Boolean).length, 1, "un et un seul onglet sélectionné");
    const i = selection.indexOf(true), suivant = (i + 1) % affiches.length;
    await onglets.nth(i).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await onglets.nth(suivant).getAttribute("aria-selected"), "true", "flèche droite sans effet");
    assert.equal(await page.locator(`#panneau-${affiches[suivant]}`).isVisible(), true);

    // Mobile : aucun onglet ne fait défiler la page horizontalement.
    for (const o of affiches) {
      await page.locator(`#onglet-${o}`).click();
      const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(debord <= 0, `onglet ${o} : débordement de ${debord}px`);
    }

    assert.equal(await page.locator("#connexion").isVisible(), false, "bouton de connexion visible");
    assert.deepEqual(erreurs, [], "aucune erreur console ni violation CSP");
    await contexte.close();
  });
}
