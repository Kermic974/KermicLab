import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab, capturer } from "./outils.mjs";
import { compteDeSession, gererApiCompteLocal } from "../../worker/src/compte-local.js";
import { gererApiFamille } from "../../worker/src/famille.js";
import { gererApiProfesseur } from "../../worker/src/professeur.js";
import { gererApiContributions, roleContributionCompteLocal } from "../../worker/src/contributions.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { creerD1Complet } from "../helpers/d1-complet.mjs";

// Contributions d'un compte local (ADR 0023 §6 ter) : le rôle attribué dans le back-office affiche le menu
// Contributions ; les propositions partent au Worker (vrai code, D1 en mémoire) avec le jeton du compte.
// Lien rapide « Ma famille » dans la navigation.
let serveur, nav, htmlMaquette, api, env;
before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
  htmlMaquette = await readFile(`${racine}catalogue/trigo-cercle/page.html`, "utf8");
  api = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8")).apiUrl || serveur.url;
  env = { DB: creerD1Complet(), COMPTES_LOCAUX_SECRET: "c".repeat(40) };
});
after(async () => { await nav?.close(); await serveur?.fermer(); env?.DB.sqlite.close(); });

const cors = () => ({ "access-control-allow-origin": serveur.url, "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "GET, POST, PUT, PATCH" });

async function appareil(pseudo) {
  const session = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  const { page } = session;
  const cookies = [];
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
  // Même aiguillage que worker/src/index.js pour un compte local (en-tête Authorization).
  await page.route(`${api}/api/contributions**`, (route) => {
    if (route.request().headers().cookie) cookies.push(route.request().url());
    return relayer(async (req) => {
      const s = await compteDeSession(req, env);
      if (!s) return Response.json({ erreur: "non-connecte" }, { status: 401 });
      return gererApiContributions(req, env, s.compteId, {
        catalogue: CATALOGUE.index, table: "contributions_locales", role: await roleContributionCompteLocal(env, s.compteId)
      });
    })(route);
  });
  await page.goto(serveur.url);
  await page.locator("#dialogue-pseudo[open]").waitFor();
  await page.fill("#pseudo", pseudo);
  await page.click("#formulaire-pseudo button[type=submit]");
  await page.locator("#dialogue-pseudo").waitFor({ state: "hidden" });
  return { ...session, cookies };
}

test("compte local au rôle Professeur : menu Contributions, proposition envoyée au Worker, lien « Ma famille »", async () => {
  const { page, contexte, erreurs } = await appareil("Prof");
  assert.equal(await page.locator("#nav-famille").isHidden(), true, "sans compte lié : pas de lien Ma famille");
  await page.click(".barre-laterale .profil-carte[data-action=profil]");
  await page.click("#entree-compte");
  await page.locator("#compte-creation").waitFor();
  await page.fill("#compte-identifiant", "m.martin");
  await page.fill("#compte-mdp", "Grand-Hibou-77");
  await page.fill("#compte-mdp2", "Grand-Hibou-77");
  await page.check("#liaison-creer-d1");
  await page.click("#formulaire-compte-creer button[type=submit]");
  await page.locator("#compte-ouvert").waitFor();
  await page.locator("#nav-famille").waitFor();
  assert.equal(await page.locator("#nav-contributions").isHidden(), true, "sans rôle : pas de menu Contributions");
  // Compte solo : « Ma famille » mène au bloc Famille de « Mon compte » (inviter un parent).
  await page.click(".barre-laterale [data-nav=accueil]");
  await page.click("#nav-famille");
  await page.locator("#famille-compte").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => location.hash), "#compte");

  // Rôle attribué dans le back-office.
  const id = env.DB.sqlite.prepare("SELECT id FROM comptes_locaux ORDER BY rowid DESC").get().id;
  env.DB.sqlite.prepare("INSERT INTO attributions_roles (type_compte, compte_id, role_id) VALUES ('compte-local', ?, 'prof')").run(id);
  await page.goto(`${serveur.url}/#contributions`);
  await page.reload();
  await page.locator("#nav-contributions").waitFor();
  await page.locator("#contrib-espace").waitFor({ state: "visible" });
  assert.equal(await page.locator("#nav-contributions").getAttribute("aria-current"), "page", "l'adresse #contributions ouvre l'écran une fois le rôle lu");
  assert.match(await page.locator("#contrib-role-nom").textContent(), /Prof/);
  assert.equal(await page.locator("#contrib-deconnexion").isHidden(), true, "la connexion se gère dans Mon compte");
  assert.equal(await page.locator("#contrib-tableau").isVisible(), true, "tableau de relecture du Professeur");
  await capturer(page, "contributions-compte-local-nav");

  // Proposition envoyée avec le jeton du compte local.
  await page.click("#contrib-proposer-titre");
  await page.selectOption("#contrib-notion", "pythagore");
  await page.locator("#contrib-champ:not([disabled])").waitFor();
  await page.selectOption("#contrib-champ", "intro");
  await page.fill("#contrib-texte", "Une seule page pour toute la notion. Commence par l'intuition !");
  await page.fill("#contrib-motif", "Guider les débutants.");
  await page.check("#contrib-charte");
  await page.click("#contrib-envoyer");
  await page.locator("#contrib-miennes li").first().waitFor();
  const ligne = env.DB.sqlite.prepare("SELECT auteur_id, statut FROM contributions_locales").get();
  assert.equal(ligne.auteur_id, id);
  assert.equal(ligne.statut, "proposee");
  assert.match(await page.locator("#contrib-miennes li").first().textContent(), /Pythagore/);

  // « Ma famille » : le rôle Professeur porte la permission famille → Espace famille, marqué page courante.
  await page.click("#nav-famille");
  await page.locator("#espace-famille").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => location.hash), "#espace-famille");
  assert.equal(await page.locator("#nav-famille").getAttribute("aria-current"), "page");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
