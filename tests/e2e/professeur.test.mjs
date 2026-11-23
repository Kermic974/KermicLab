import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab, capturer, NAVIGATION_RACCOURCIS, surchargerConfig } from "./outils.mjs";
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

async function appareil(pseudo, { viewport = { width: 1280, height: 900 }, raccourcis = true } = {}) {
  const session = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport });
  const { page } = session;
  const appelsProf = [];
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette, llmActif: false });
  if (raccourcis) await surchargerConfig(page, serveur.url, { navigation: NAVIGATION_RACCOURCIS });
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
  // Sur mobile, Contributions et Suivi sont regroupées sous « Plus » : 7 entrées tactiles à 320 px.
  const plus = page.locator("#nav-mobile-plus");
  await plus.waitFor();
  await page.setViewportSize({ width: 320, height: 740 });
  const barre = await page.locator(".nav-mobile .nav-mobile-bouton:not([hidden])").evaluateAll((l) => l.map((n) => n.getBoundingClientRect()).map((r) => ({ l: r.width, h: r.height, d: r.right })));
  assert.equal(barre.length, 7, "six destinations + Plus");
  assert.ok(barre.every((b) => b.l >= 44 && b.h >= 44 && b.d <= 320), "sept entrées tactiles à 320 px");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator("#nav-mobile-autres").isHidden(), true);
  await plus.click();
  assert.equal(await plus.getAttribute("aria-expanded"), "true");
  assert.deepEqual(await page.locator("#nav-mobile-autres .nav-mobile-bouton:visible").allTextContents(), ["Contrib.", "Prof"]);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#nav-mobile-autres").isHidden(), true, "Échap referme le panneau");
  // L'entrée Professeur ouvre le tableau de bord ; Mes classes est dans la sous-navigation.
  await plus.click();
  await page.click("#nav-mobile-suivi");
  assert.equal(await page.locator("#nav-mobile-autres").isHidden(), true, "un choix referme le panneau");
  assert.equal(await plus.getAttribute("aria-current"), "page", "Plus porte la page courante");
  await page.locator("#suivi-contenu").waitFor();
  await page.click('#navigation-personnelle [data-nav="classes"]');
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

test("Mon tableau de bord (ordre par défaut) : sous l'Accueil, vues du professeur filtrées, sans raccourcis de rôle", async () => {
  const session = await appareil(null, { raccourcis: false });
  const { page, erreurs, appelsProf } = session;
  await page.goto(`${serveur.url}/?demo=contributions#contributions`);
  await page.locator("#dialogue-pseudo[open]").waitFor();
  await page.fill("#pseudo", "Démo");
  await page.click("#formulaire-pseudo button[type=submit]");
  await page.click("#contrib-demo-prof");
  await page.locator("#contrib-tableau").waitFor({ state: "visible" });
  // Barre latérale : cinq destinations (ADR 0039) ; les vues personnelles s'ouvrent par l'avatar « Mon espace ».
  const entrees = page.locator(".barre-laterale nav [data-nav]:not([hidden])");
  assert.deepEqual(await entrees.evaluateAll((b) => b.map((n) => n.dataset.nav)), ["accueil", "education", "labs", "jeux", "progression"]);
  const tdb = page.locator(".barre-pied .profil-carte");
  assert.equal(await tdb.getAttribute("aria-current"), "page", "Contributions est une vue du tableau de bord");
  // Les filtres : les vues proposées suivent le rôle.
  const filtres = page.locator("#navigation-personnelle [data-nav]:visible");
  assert.deepEqual(await filtres.allTextContents(), ["Profil", "Mon compte", "Contributions", "Suivi de classe", "Mes classes", "Mes élèves"]);
  assert.equal(await page.locator('#navigation-personnelle [data-nav="contributions"]').getAttribute("aria-current"), "page");
  await page.click('#navigation-personnelle [data-nav="classes"]');
  await page.locator(".prof-classe").first().waitFor();
  assert.equal(new URL(page.url()).hash, "#classes");
  assert.equal(await tdb.getAttribute("aria-current"), "page");
  assert.equal(await page.locator('#navigation-personnelle [data-nav="classes"]').getAttribute("aria-current"), "page");
  // L'Accueil propose la carte « Tes classes », qui rouvre le suivi ; l'avatar mène au Profil et à ses filtres.
  await page.click('.barre-laterale [data-nav="accueil"]');
  assert.equal(await page.locator("#accueil-prof").isVisible(), true, "carte de rôle du professeur sur l'Accueil");
  assert.equal(await tdb.getAttribute("aria-current"), null, "l'Accueil est la page courante");
  await page.click("#accueil-prof [data-nav=suivi]");
  await page.locator("#suivi").waitFor({ state: "visible" });
  assert.equal(new URL(page.url()).hash, "#suivi");
  assert.equal(await tdb.getAttribute("aria-current"), "page");
  await tdb.click();
  await page.locator("#profil").waitFor({ state: "visible" });
  await capturer(page, "tableau-de-bord-filtres");
  assert.deepEqual(appelsProf, []);
  assert.deepEqual(erreurs, []);
  await session.contexte.close();
});

// ---------- Activités et tableau de bord (ADR 0030 §9) ----------

test("activités : le professeur donne une évaluation à la classe, l'élève la passe, le tableau de bord affiche le score", async () => {
  const prof = await appareil("Prof2");
  await creerCompteLie(prof.page, "mme.diallo", "Grand-Hibou-77");
  const profId = env.DB.sqlite.prepare("SELECT id FROM comptes_locaux ORDER BY rowid DESC").get().id;
  env.DB.sqlite.prepare("INSERT INTO attributions_roles (type_compte, compte_id, role_id) VALUES ('compte-local', ?, 'prof')").run(profId);
  await prof.page.reload();
  // Profil et classe, puis un lien.
  await prof.page.click(".barre-laterale .profil-carte[data-action=profil]");
  await prof.page.locator("#profil-prof").waitFor();
  await prof.page.fill("#prof-nom", "Mme Diallo");
  await prof.page.check('#prof-matieres input[value="mathematiques"]');
  await prof.page.check('#prof-niveaux input[value="4e"]');
  await prof.page.click("#formulaire-profil-prof button[type=submit]");
  await prof.page.waitForFunction(() => document.querySelector("#prof-profil-erreur").textContent === "");
  await prof.page.click("#nav-classes");
  await prof.page.click("#classes-ajout summary");
  await prof.page.fill("#classe-nom", "4e A");
  await prof.page.click("#formulaire-classe button[type=submit]");
  const carte = prof.page.locator(".prof-classe").first();
  await carte.waitFor();
  await carte.locator("[data-classe-lien]").click();
  await prof.page.locator("#classes-lien").waitFor();
  const lien = await prof.page.locator("#classes-lien-url").inputValue();

  const eleve = await appareil("Inès");
  await creerCompteLie(eleve.page, "ines.eleve", "Petit-Renard-42");
  await eleve.page.goto(lien);
  await eleve.page.locator("#dialogue-rejoindre[open]").waitFor();
  await eleve.page.check("#rejoindre-accord");
  await eleve.page.click("#rejoindre-valider");
  await eleve.page.locator("#mes-profs li").waitFor({ state: "attached" });

  // Évaluation de 5 questions pour toute la classe, depuis la carte de la classe.
  await prof.page.click("#nav-classes");
  await carte.locator("[data-activite-classe]").click();
  await prof.page.locator("#dialogue-activite[open]").waitFor();
  await prof.page.check('input[name="activite-type"][value="evaluation"]');
  await prof.page.fill("#activite-nb", "3");
  await prof.page.check('#activite-notions input[value="pythagore"]');
  await prof.page.click("#activite-valider");
  assert.match(await prof.page.locator("#activite-erreur").textContent(), /5 à 40/);
  await prof.page.fill("#activite-nb", "5");
  await prof.page.fill("#activite-libelle", "Contrôle Pythagore");
  await prof.page.click("#activite-valider");
  await prof.page.locator("#dialogue-activite").waitFor({ state: "hidden" });

  // L'élève la voit sur l'accueil et la passe.
  await eleve.page.reload();
  await eleve.page.locator("#activites-eleve").waitFor();
  assert.match(await eleve.page.locator("#activites-eleve").textContent(), /Contrôle Pythagore.*Évaluation.*5 questions.*Mme Diallo.*à faire/s);
  await eleve.page.click("[data-mon-activite]");
  await eleve.page.locator("#dialogue-quiz[open]").waitFor();
  assert.equal(await eleve.page.locator("#quiz-questions fieldset").count(), 5);
  for (let i = 0; i < 5; i++) await eleve.page.locator(`input[name="quiz-${i}"]`).first().check();
  await eleve.page.click("#quiz-valider");
  await eleve.page.waitForFunction(() => /bonne\(s\) réponse\(s\) sur 5/.test(document.querySelector("#quiz-retour").textContent));
  await eleve.page.click("#quiz-valider");
  await eleve.page.locator("#dialogue-quiz").waitFor({ state: "hidden" });
  await eleve.page.locator("#activites-eleve", { hasText: "terminé" }).waitFor();
  assert.equal(await eleve.page.locator("[data-mon-activite]").count(), 0, "une évaluation ne se repasse pas");

  // Le tableau de bord du professeur.
  await prof.page.click("#nav-suivi");
  const activite = prof.page.locator(".activite-carte").first();
  await activite.waitFor();
  assert.match(await activite.textContent(), /Contrôle Pythagore.*1 \/ 1 terminé/s);
  assert.match(await prof.page.locator("#suivi-engagement").textContent(), /0 \/ 1.*élèves actifs.*100 %.*activités terminées/s);
  assert.match(await prof.page.locator("#suivi-performance").textContent(), /\d+ %.*score moyen aux évaluations/s);
  await capturer(prof.page, "professeur-tableau-de-bord", { pleinePage: true });
  for (const p of [prof, eleve]) {
    assert.deepEqual(p.erreurs, []);
    await p.contexte.close();
  }
});

test("activités (démo) : tableau de bord rempli et défi donné à la classe, sans appel au Worker", async () => {
  const session = await appareil(null);
  const { page, erreurs, appelsProf } = session;
  await page.goto(`${serveur.url}/?demo=contributions#contributions`);
  await page.locator("#dialogue-pseudo[open]").waitFor();
  await page.fill("#pseudo", "Démo");
  await page.click("#formulaire-pseudo button[type=submit]");
  await page.click("#contrib-demo-prof");
  await page.locator("#nav-suivi").waitFor();
  await page.click("#nav-suivi");
  await page.locator("#suivi-contenu").waitFor();
  assert.equal(await page.locator(".activite-carte").count(), 3);
  assert.match(await page.locator("#suivi-performance").textContent(), /60 %.*score moyen aux évaluations/s);
  await page.click("#suivi-activite");
  await page.locator("#dialogue-activite[open]").waitFor();
  await page.locator("#activite-notions input").first().check();
  await page.click("#activite-valider");
  await page.locator("#dialogue-activite").waitFor({ state: "hidden" });
  await page.waitForFunction(() => document.querySelectorAll(".activite-carte").length === 4);
  assert.deepEqual(appelsProf, []);
  assert.deepEqual(erreurs, []);
  await session.contexte.close();
});
