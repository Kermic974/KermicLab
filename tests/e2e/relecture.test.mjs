import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab, capturer } from "./outils.mjs";

// Relecture humaine (ADR 0039) : badge public, confirmation réservée à un compte prof ou admin.
let serveur, nav, htmlMaquette, api, config;
before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
  htmlMaquette = await readFile(`${racine}catalogue/trigo-cercle/page.html`, "utf8");
  config = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8"));
  api = config.apiUrl || serveur.url;
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

const cors = () => ({ "access-control-allow-origin": serveur.url, "access-control-allow-credentials": "true" });

async function demarrer({ role = null } = {}) {
  const session = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  const { page } = session;
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette });
  const envoyees = [];
  if (role) {
    await page.route(`${serveur.url}/config.json`, (r) => r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ...config, connexionActive: true })
    }));
    await page.route(`${api}/auth/me`, (r) => r.fulfill({
      status: 200, contentType: "application/json", headers: cors(),
      body: JSON.stringify({ connecte: true, compte: { id: "00000000-0000-4000-8000-0000000000ab", role } })
    }));
    await page.route(`${api}/api/eleves`, (r) => r.fulfill({ contentType: "application/json", headers: cors(), body: "[]" }));
    await page.route(`${api}/api/contributions**`, (r) => r.fulfill({ contentType: "application/json", headers: cors(), body: "[]" }));
  }
  await page.route(`${api}/api/relectures**`, async (r) => {
    const url = new URL(r.request().url());
    if (url.pathname.endsWith("/statut")) {
      return r.fulfill({
        contentType: "application/json", headers: cors(),
        body: JSON.stringify(role
          ? { notion_id: "pythagore", statut: "non-relue", grille: "v1", date: null, code: null, decision: null, version: "1.2.0" }
          : { notion_id: "pythagore", statut: "relue", grille: "v1", date: "2026-11-23 09:00:00", code: "0000AB", decision: "conforme", version: "1.2.0" })
      });
    }
    if (r.request().method() === "POST") {
      const corps = r.request().postDataJSON();
      envoyees.push({
        id: "revue-1", notion_id: corps.notion_id, grille: "v1",
        criteres: Object.keys(corps.criteres ?? {}).filter((k) => corps.criteres[k]),
        decision: corps.decision, commentaire: corps.commentaire || null, code: "0000AB", role,
        created_at: "2026-11-23 10:00:00", statut: "relue"
      });
      return r.fulfill({
        status: 201, contentType: "application/json", headers: cors(),
        body: JSON.stringify({
          id: "revue-1",
          statut: { statut: "relue", grille: "v1", date: "2026-11-23 10:00:00", code: "0000AB", decision: "conforme", version: "1.2.0" }
        })
      });
    }
    return r.fulfill({ contentType: "application/json", headers: cors(), body: JSON.stringify(envoyees) });
  });
  await page.goto(`${serveur.url}/`);
  await page.locator("#dialogue-pseudo[open]").waitFor();
  await page.fill("#pseudo", "Sam");
  await page.click("#formulaire-pseudo button[type=submit]");
  await page.locator("#dialogue-pseudo").waitFor({ state: "hidden" });
  return { ...session, envoyees };
}

async function ouvrirPythagore(page) {
  await page.click(".barre-laterale [data-nav=education]");
  await page.locator("#catalogue .accordeon-bouton", { hasText: "Collège" }).click();
  await page.locator("#edu-college .accordeon-bouton", { hasText: "Maths" }).click();
  await page.locator("#catalogue .notion", { hasText: "Pythagore" }).click();
  await page.locator("#bulle-lab[open][data-notion=pythagore]").waitFor();
}

test("visiteur : badge de relecture, bouton de confirmation absent", async () => {
  const { page, contexte, erreurs } = await demarrer();
  await ouvrirPythagore(page);
  const badge = page.locator("#bulle-relecture-badge");
  await badge.waitFor({ state: "visible" });
  assert.match(await badge.textContent(), /Relue par un humain le 23\/11 · 0000AB/);
  assert.equal(await page.locator("#bulle-relecture-ouvrir").isHidden(), true);
  await capturer(page, "relecture-visiteur");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("prof : confirme la grille, le badge et le suivi se mettent à jour", async () => {
  const { page, contexte, erreurs, envoyees } = await demarrer({ role: "prof" });
  await ouvrirPythagore(page);
  const bouton = page.locator("#bulle-relecture-ouvrir");
  await bouton.waitFor({ state: "visible" });
  assert.match(await page.locator("#bulle-relecture-badge").textContent(), /Non relue/);
  await bouton.click();
  await page.locator("#bulle-relecture").waitFor({ state: "visible" });
  assert.equal(await page.locator("#relecture-criteres label").count(), 6);
  await capturer(page, "relecture-relecteur");
  for (const case_ of await page.locator("#relecture-criteres input").all()) await case_.check();
  await page.fill("#relecture-commentaire", "Relu sur téléphone et ordinateur.");
  await page.locator("#relecture-formulaire button[type=submit]").click();
  await page.locator("#bulle-relecture-badge", { hasText: "23/11" }).waitFor();
  assert.match(await page.locator("#bulle-relecture-badge").textContent(), /Relue par un humain le 23\/11 · 0000AB/);
  assert.equal(envoyees[0].decision, "conforme");
  assert.equal(envoyees[0].commentaire, "Relu sur téléphone et ordinateur.");
  assert.equal(envoyees[0].criteres.length, 6);
  await page.click("#relecture-vers-suivi");
  const suivi = page.locator("#relecture-suivi");
  await suivi.waitFor({ state: "visible" });
  await suivi.scrollIntoViewIfNeeded();
  assert.match(await page.locator("#relecture-liste").textContent(), /Pythagore/);
  assert.match(await page.locator("#relecture-synthese").textContent(), /Encore valides/);
  await capturer(page, "relecture-suivi");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
