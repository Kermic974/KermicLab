import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab, capturer } from "./outils.mjs";
import { gererApiCompteLocal } from "../../worker/src/compte-local.js";
import { gererApiFamille } from "../../worker/src/famille.js";
import { gererApiProfesseur } from "../../worker/src/professeur.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { creerD1Complet } from "../helpers/d1-complet.mjs";

// Expérience Professeur (ADR 0030), de bout en bout : un compte au rôle Professeur configure son profil, crée une
// classe et un lien d'invitation ; un élève ouvre le lien, accepte le partage et apparaît dans « Mes élèves ».
// Le vrai code du Worker répond (D1 en mémoire). Puis la démonstration « Tester les rôles → Prof », sans Worker.
let serveur, nav, htmlMaquette, api, env;
before(async () => {
  serveur = await servir(`${racine}dist`);
  nav = await navigateur();
  htmlMaquette = await readFile(`${racine}catalogue/trigo-cercle/page.html`, "utf8");
  api = JSON.parse(await readFile(`${racine}dist/config.json`, "utf8")).apiUrl || serveur.url;
  env = { DB: creerD1Complet(), COMPTES_LOCAUX_SECRET: "p".repeat(40) };
});
after(async () => { await nav?.close(); await serveur?.fermer(); env?.DB.sqlite.close(); });

const cors = () => ({ "access-control-allow-origin": serveur.url, "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "GET, POST, PUT" });

async function appareil(pseudo, { viewport = { width: 1280, height: 900 } } = {}) {
  const session = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport });
  const { page } = session;
  const appelsProf = [];
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette, llmActif: false });
  const relayer = (traiter) => async (route) => {
    const r = route.request();
    if (r.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors() });
    const reponse = await traiter(new Request(r.url(), { method: r.method(), headers: r.headers(), body: r.postData() ?? undefined }));
    return route.fulfill({ status: reponse.status, headers: { ...Object.fromEntries(reponse.headers), ...cors() }, body: await reponse.text() });
  };
  await page.route(`${api}/api/compte-local/**`, relayer((req) => gererApiCompteLocal(req, env)));
  await page.route(`${api}/api/famille/**`, relayer((req) => gererApiFamille(req, env, { catalogue: CATALOGUE })));
  await page.route(`${api}/api/professeur/**`, (route) => {
    appelsProf.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    return relayer((req) => gererApiProfesseur(req, env, { catalogue: CATALOGUE }))(route);
  });
  await page.goto(serveur.url);
  if (pseudo) {
    await page.locator("#dialogue-pseudo[open]").waitFor();
    await page.fill("#pseudo", pseudo);
    await page.click("#formulaire-pseudo button[type=submit]");
    await page.locator("#dialogue-pseudo").waitFor({ state: "hidden" });
  }
  return { ...session, appelsProf };
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

test("professeur : profil, classe, lien d'invitation, adhésion de l'élève avec accord, suivi dans « Mes élèves »", async () => {
  const prof = await appareil("Prof");
  await creerCompteLie(prof.page, "m.martin", "Grand-Hibou-77");
  assert.equal(await prof.page.locator("#nav-classes").isHidden(), true, "sans rôle Professeur : pas de menu Mes classes");
  // Le rôle est attribué dans le back-office.
  const profId = env.DB.sqlite.prepare("SELECT id FROM comptes_locaux ORDER BY rowid DESC").get().id;
  env.DB.sqlite.prepare("INSERT INTO attributions_roles (type_compte, compte_id, role_id) VALUES ('compte-local', ?, 'prof')").run(profId);
  await prof.page.reload();
  await prof.page.locator("#nav-classes").waitFor();
  assert.equal(await prof.page.locator("#nav-eleves").isVisible(), true);

  // Mes classes sans profil : invitation à configurer le profil.
  await prof.page.click("#nav-classes");
  await prof.page.locator("#classes-contenu").waitFor();
  assert.match(await prof.page.locator("#classes-profil").textContent(), /Configure d'abord/);
  assert.equal(await prof.page.locator("#classes-ajout").isHidden(), true);

  // Profil professeur : nom affiché, matières, niveaux.
  await prof.page.click(".barre-laterale .profil-carte[data-action=profil]");
  await prof.page.locator("#profil-prof").waitFor();
  await prof.page.fill("#prof-nom", "M. Martin");
  await prof.page.click("#formulaire-profil-prof button[type=submit]");
  assert.match(await prof.page.locator("#prof-profil-erreur").textContent(), /1 à 5 matières/);
  await prof.page.check('#prof-matieres input[value="mathematiques"]');
  await prof.page.check('#prof-niveaux input[value="4e"]');
  await prof.page.check('#prof-niveaux input[value="3e"]');
  await prof.page.click("#formulaire-profil-prof button[type=submit]");
  await prof.page.waitForFunction(() => document.querySelector("#prof-profil-erreur").textContent === "");

  // Création d'une classe et d'un lien d'invitation.
  await prof.page.click("#nav-classes");
  await prof.page.locator("#classes-ajout").waitFor();
  assert.match(await prof.page.locator("#classes-profil").textContent(), /M\. Martin · Maths · 4e, 3e/);
  await prof.page.click("#classes-ajout summary");
  await prof.page.fill("#classe-nom", "4e B");
  await prof.page.selectOption("#classe-niveau", "4e");
  await prof.page.click("#formulaire-classe button[type=submit]");
  const carte = prof.page.locator(".prof-classe").first();
  await carte.waitFor();
  assert.match(await carte.textContent(), /4e B.*Maths · 4e.*0 \/ 40 élèves/s);
  await carte.locator("[data-classe-lien]").click();
  await prof.page.locator("#classes-lien").waitFor();
  const lien = await prof.page.locator("#classes-lien-url").inputValue();
  assert.match(lien, /\/\?rejoindre=[A-Z2-9]{10}$/);
  await carte.locator(".prof-invitations li").waitFor();
  assert.match(await carte.textContent(), /Lien actif/);
  await capturer(prof.page, "professeur-classes");

  // L'élève ouvre le lien sans compte : il est guidé vers « Mon compte », puis rejoint après la connexion.
  const eleve = await appareil("Léa");
  await eleve.page.goto(lien);
  await eleve.page.locator("#prof-compte-attente").waitFor();
  assert.ok(!eleve.page.url().includes("rejoindre"), "le code est retiré de l'adresse");
  await creerCompteLie(eleve.page, "lea.eleve", "Petit-Renard-42");
  await eleve.page.locator("#dialogue-rejoindre[open]").waitFor();
  assert.match(await eleve.page.locator("#rejoindre-resume").textContent(), /M\. Martin t'invite dans la classe 4e B \(Maths, 4e\)/);
  assert.equal(await eleve.page.locator("#rejoindre-pseudo").inputValue(), "Léa");
  await eleve.page.click("#rejoindre-valider");
  assert.match(await eleve.page.locator("#rejoindre-erreur").textContent(), /accord/);
  await eleve.page.check("#rejoindre-accord");
  await eleve.page.click("#rejoindre-valider");
  await eleve.page.locator("#dialogue-rejoindre").waitFor({ state: "hidden" });
  await eleve.page.locator("#mes-profs li").waitFor();
  assert.match(await eleve.page.locator("#mes-profs").textContent(), /M\. Martin — 4e B · Maths/);
  assert.equal(await eleve.page.locator("#nav-classes").isHidden(), true, "un élève n'a pas l'expérience Professeur");
  // Le bilan part vers le professeur.
  for (let i = 0; i < 50 && !env.DB.sqlite.prepare("SELECT count(*) AS n FROM professeurs_bilans").get().n; i++) await new Promise((r) => setTimeout(r, 100));
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM professeurs_bilans").get().n, 1);

  // Le professeur voit l'élève dans « Mes élèves ».
  await prof.page.click("#nav-eleves");
  const carteEleve = prof.page.locator("[data-eleve]").first();
  await carteEleve.waitFor();
  assert.match(await carteEleve.textContent(), /Léa/);
  assert.match(await carteEleve.textContent(), /4e B/);
  assert.equal(await prof.page.locator("#eleves-chiffres dd").first().textContent(), "1");
  await capturer(prof.page, "professeur-eleves");

  // L'élève quitte : il n'est plus suivi.
  await eleve.page.click("[data-quitter-prof]");
  await eleve.page.click("[data-quitter-prof]");
  await eleve.page.locator("#mes-profs-vide").waitFor();
  await prof.page.click("#eleves-actualiser");
  await prof.page.locator("#eleves-vide").waitFor();
  for (const p of [prof, eleve]) {
    assert.deepEqual(p.erreurs, []);
    await p.contexte.close();
  }
});

test("professeur (démo) : « Tester les rôles → Prof » ouvre Mes classes et Mes élèves sans appel au Worker", async () => {
  const session = await appareil(null, { viewport: { width: 390, height: 844 } });
  const { page, erreurs, appelsProf } = session;
  await page.goto(`${serveur.url}/?demo=contributions#contributions`);
  await page.locator("#dialogue-pseudo[open]").waitFor();
  await page.fill("#pseudo", "Démo");
  await page.click("#formulaire-pseudo button[type=submit]");
  await page.click("#contrib-demo-prof");
  await page.locator("#contrib-tableau").waitFor({ state: "visible" });
  await page.locator("#nav-mobile-classes").waitFor();
  await page.click("#nav-mobile-classes");
  const carte = page.locator(".prof-classe").first();
  await carte.waitFor();
  assert.match(await carte.textContent(), /4e B/);
  await carte.locator("[data-classe-lien]").click();
  await page.locator("#classes-lien-simuler").waitFor();
  await page.click("#classes-lien-simuler");
  await page.locator(".prof-classe", { hasText: "4 / 40" }).waitFor();
  await carte.locator("[data-classe-eleves]").click();
  await page.locator("#eleves-contenu").waitFor();
  assert.equal(await page.locator("#eleves-filtre").inputValue(), "demo-classe-4b");
  assert.equal(await page.locator("[data-eleve]").count(), 4);
  // Le profil professeur est dans l'écran Profil.
  await page.click('.nav-mobile [data-nav="profil"]');
  await page.locator("#profil-prof").waitFor();
  assert.equal(await page.locator("#prof-nom").inputValue(), "M. Martin");
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(largeur <= 390, `pas de défilement horizontal sur mobile (${largeur})`);
  assert.deepEqual(appelsProf, [], "la démonstration n'appelle pas le Worker");
  assert.deepEqual(erreurs, []);
  await session.contexte.close();
});
