import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab, capturer } from "./outils.mjs";
import { gererApiCompteLocal } from "../../worker/src/compte-local.js";
import { gererApiFamille } from "../../worker/src/famille.js";
import { gererApiProfesseur } from "../../worker/src/professeur.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { creerD1Complet } from "../helpers/d1-complet.mjs";

// Espace famille des comptes locaux (ADR 0029), de bout en bout : un compte solo invite son parent, le parent le
// rattache, lui assigne un cahier ; l'enfant passe le calibrage, son bilan arrive dans le tableau de bord du parent.
// Le vrai code du Worker répond (D1 en mémoire).
let serveur, nav, htmlMaquette, api, env;
before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
  htmlMaquette = await readFile(`${racine}catalogue/trigo-cercle/page.html`, "utf8");
  api = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8")).apiUrl || serveur.url;
  env = { DB: creerD1Complet(), COMPTES_LOCAUX_SECRET: "f".repeat(40) };
});
after(async () => { await nav?.close(); await serveur?.fermer(); env?.DB.sqlite.close(); });

const cors = () => ({ "access-control-allow-origin": serveur.url, "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "GET, POST, PUT" });

async function appareil(pseudo) {
  const session = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  const { page } = session;
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette, llmActif: false });
  const relayer = (traiter) => async (route) => {
    const r = route.request();
    if (r.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors() });
    const reponse = await traiter(new Request(r.url(), { method: r.method(), headers: r.headers(), body: r.postData() ?? undefined }));
    return route.fulfill({ status: reponse.status, headers: { ...Object.fromEntries(reponse.headers), ...cors() }, body: await reponse.text() });
  };
  await page.route(`${api}/api/compte-local/**`, relayer((req) => gererApiCompteLocal(req, env)));
  await page.route(`${api}/api/famille/**`, relayer((req) => gererApiFamille(req, env, { catalogue: CATALOGUE })));
  await page.route(`${api}/api/professeur/**`, relayer((req) => gererApiProfesseur(req, env, { catalogue: CATALOGUE })));
  await page.goto(serveur.url);
  await page.locator("#dialogue-pseudo[open]").waitFor();
  await page.fill("#pseudo", pseudo);
  await page.click("#formulaire-pseudo button[type=submit]");
  await page.locator("#dialogue-pseudo").waitFor({ state: "hidden" });
  return session;
}

async function creerCompteLie(page, identifiant, mdp) {
  await page.click(".barre-laterale .profil-carte[data-action=profil]");
  await page.click("#entree-compte");
  await page.locator("#compte-creation").waitFor();
  await page.fill("#compte-identifiant", identifiant);
  await page.fill("#compte-mdp", mdp);
  await page.fill("#compte-mdp2", mdp);
  await page.check("#liaison-creer-d1");
  await page.click("#formulaire-compte-creer button[type=submit]");
  await page.locator("#compte-ouvert").waitFor();
}

test("famille : invitation d'un compte solo, cahier assigné avec calibrage, bilan chez le parent", async () => {
  // L'enfant a déjà un compte solo, lié en ligne, et un peu de progression.
  const enfant = await appareil("Noé");
  await creerCompteLie(enfant.page, "noe.k", "Petit-Renard-42");
  await enfant.page.locator("#famille-compte-solo").waitFor();
  assert.match(await enfant.page.locator("#famille-compte-statut").textContent(), /solo/);
  await enfant.page.click("#famille-inviter");
  await enfant.page.locator("#famille-code-zone").waitFor();
  const code = (await enfant.page.locator("#famille-code").textContent()).trim();
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // Le parent : compte lié, rôle parent attribué dans le back-office.
  const parent = await appareil("Papa");
  await creerCompteLie(parent.page, "papa.k", "Grand-Hibou-77");
  assert.equal(await parent.page.locator("#entree-espace-famille").isHidden(), true, "pas de rôle parent : pas d'Espace famille");
  const ids = env.DB.sqlite.prepare("SELECT id FROM comptes_locaux ORDER BY rowid").all().map((l) => l.id);
  env.DB.sqlite.prepare("INSERT INTO attributions_roles (type_compte, compte_id, role_id) VALUES ('compte-local', ?, 'parent')").run(ids[1]);
  await parent.page.reload();
  await parent.page.locator("#dialogue-pseudo").waitFor({ state: "hidden" }).catch(() => {});
  await parent.page.evaluate(() => { location.hash = "compte"; });
  await parent.page.locator("#famille-ouvrir-espace").waitFor();
  await parent.page.click("#famille-ouvrir-espace");
  await parent.page.locator("#ef-contenu").waitFor();
  assert.equal(await parent.page.locator("#ef-vide").isVisible(), true);

  // Rattachement par le code, avec prénom, tranche d'âge et consentement.
  await parent.page.click("#ef-ajout summary");
  await parent.page.fill("#ef-code", code.toLowerCase());
  await parent.page.fill("#ef-prenom", "Noé");
  await parent.page.check('input[name="ef-tranche"][value="11-14"]');
  await parent.page.click("#ef-ajouter-bouton");
  assert.match(await parent.page.locator("#ef-ajout-erreur").textContent(), /accord/i);
  await parent.page.check("#ef-consentement");
  await parent.page.click("#ef-ajouter-bouton");
  const carte = parent.page.locator(".ef-enfant").first();
  await carte.waitFor();
  assert.match(await carte.textContent(), /Noé/);
  assert.match(await carte.textContent(), /aucun bilan reçu/);

  // Cahier assigné (catalogue seul) : même constructeur, sans titre libre.
  await carte.locator("[data-ef-assigner]").click();
  await parent.page.locator("#constructeur-cahier[open]").waitFor();
  assert.equal(await parent.page.locator("#cahier-titre-zone").isHidden(), true);
  assert.match(await parent.page.locator("#cahier-famille-pour").textContent(), /Noé/);
  await parent.page.locator('#cahier-notions input[value="fractions"]').check();
  await parent.page.locator('#cahier-notions input[value="pythagore"]').check();
  await parent.page.click("#construire-cahier");
  await parent.page.locator("#constructeur-cahier").waitFor({ state: "hidden" });
  await parent.page.locator(".ef-cahier").first().waitFor();
  assert.match(await parent.page.locator(".ef-cahier").first().textContent(), /à commencer/);

  // L'enfant : rechargement, le compte est rattaché, le cahier attend le calibrage.
  await enfant.page.reload();
  await enfant.page.evaluate(() => { location.hash = "compte"; });
  await enfant.page.waitForFunction(() => /famille/.test(document.querySelector("#famille-compte-statut")?.textContent ?? ""));
  assert.match(await enfant.page.locator("#famille-compte-statut").textContent(), /« Noé »/);
  await enfant.page.evaluate(() => { location.hash = "cahiers"; });
  await enfant.page.locator("#cahiers-famille").waitFor();
  await enfant.page.click("[data-cahier-famille]");
  await enfant.page.locator("#calibrage-cahier[open]").waitFor();
  await enfant.page.click("#calibrage-valider");
  await enfant.page.locator("#lecture-cahier[open]").waitFor();
  await enfant.page.click("#fermer-lecture");

  // Le bilan de l'enfant arrive dans le tableau de bord du parent, avec le cahier en cours.
  await enfant.page.waitForFunction(() => true);
  await parent.page.waitForTimeout(300);
  await parent.page.click("#ef-actualiser");
  await parent.page.waitForFunction(() => /en cours/.test(document.querySelector(".ef-cahier")?.textContent ?? ""));
  assert.doesNotMatch(await carte.textContent(), /aucun bilan reçu/);
  assert.match(await parent.page.locator("#ef-chiffres").textContent(), /enfants/);
  await capturer(parent.page, "espace-famille", { pleinePage: true });

  // Rien de ce qui est stocké ne contient le pseudo de l'enfant ni son identifiant.
  const bilan = env.DB.sqlite.prepare("SELECT bilan FROM familles_bilans").get().bilan;
  assert.equal(/Noé|noe\.k/.test(bilan), false);
  assert.deepEqual([...enfant.erreurs, ...parent.erreurs], []);
  await enfant.contexte.close();
  await parent.contexte.close();
});
