import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, simulerApiKermiclab, capturer } from "./outils.mjs";

// Contributions au contenu (ADR 0023) : profils contributeur et prof, scénario sans IA, en démonstration et avec le Worker simulé.
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

async function demarrer({ url = "/", connexion = false, role = null, viewport = { width: 1280, height: 900 } } = {}) {
  const session = await ouvrir(nav, serveur.url, { locale: "fr-FR", viewport });
  const { page } = session;
  const appels = [];
  await simulerApiKermiclab(page, { origine: serveur.url, api, htmlMaquette });
  page.on("request", (r) => { if (/\/(auth|api\/contributions)/.test(r.url())) appels.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  const envoyees = [];
  if (connexion) {
    await page.route(`${serveur.url}/config.json`, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ ...config, connexionActive: true }) }));
    await page.route(`${api}/auth/me`, (r) => r.fulfill({
      status: role ? 200 : 401, contentType: "application/json", headers: cors(),
      body: JSON.stringify(role ? { connecte: true, compte: { id: "compte-1", role } } : { connecte: false })
    }));
    await page.route(`${api}/api/eleves`, (r) => r.fulfill({ contentType: "application/json", headers: cors(), body: "[]" }));
    await page.route(`${api}/api/contributions**`, (r) => {
      if (r.request().method() === "POST") {
        envoyees.push(r.request().postDataJSON());
        return r.fulfill({ status: 201, contentType: "application/json", headers: cors(), body: JSON.stringify({ id: "c-1" }) });
      }
      const liste = envoyees.map((c, i) => ({ ...c, id: `c-${i + 1}`, auteur_id: "compte-1", statut: "proposee", created_at: "2026-11-07T10:00:00Z" }));
      return r.fulfill({ contentType: "application/json", headers: cors(), body: JSON.stringify(liste) });
    });
  }
  await page.goto(`${serveur.url}${url}`);
  await page.locator("#dialogue-pseudo[open]").waitFor();
  await page.fill("#pseudo", "Sam");
  await page.click("#formulaire-pseudo button[type=submit]");
  await page.locator("#dialogue-pseudo").waitFor({ state: "hidden" });
  return { ...session, appels, envoyees };
}

/** Remplit le formulaire de proposition sur l'introduction de Pythagore. */
async function proposer(page, { texte = "Une seule page pour toute la notion. Commence par l'intuition !", motif = "Guider les débutants.", charte = true } = {}) {
  const details = page.locator("#contrib-proposer");
  if (!(await details.evaluate((d) => d.open))) await page.click("#contrib-proposer-titre");
  await page.selectOption("#contrib-notion", "pythagore");
  await page.locator("#contrib-champ:not([disabled])").waitFor();
  await page.selectOption("#contrib-champ", "intro");
  await page.locator("#contrib-actuel-bloc").waitFor({ state: "visible" });
  await page.fill("#contrib-texte", texte);
  await page.selectOption("#contrib-type", "clarification");
  await page.fill("#contrib-motif", motif);
  if (charte) await page.check("#contrib-charte");
  await page.click("#contrib-envoyer");
}

test("connexion désactivée : écran et entrée des contributions absents, aucun appel", async () => {
  const { page, contexte, erreurs, appels } = await demarrer();
  assert.equal(await page.locator("#entree-contributions").isHidden(), true);
  await page.goto(`${serveur.url}/#contributions`);
  await page.locator("#salut").waitFor();
  assert.equal(await page.locator("#contributions").isHidden(), true);
  assert.deepEqual(appels, []);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("démonstration : le contributeur propose, le prof demande une révision, le contributeur corrige, le prof valide", async () => {
  const { page, contexte, erreurs, appels } = await demarrer({ url: "/?demo=contributions#contributions" });
  await page.locator("#bandeau-demo").waitFor({ state: "visible" });
  assert.match(await page.locator("#bandeau-demo").textContent(), /contributions/);
  await page.locator("#contrib-invite").waitFor({ state: "visible" });
  await capturer(page, "contributions-demo-invitation");

  // Contributeur : la charte et le motif sont exigés avant l'envoi.
  await page.click("#contrib-demo-contributeur");
  await page.locator("#contrib-espace").waitFor({ state: "visible" });
  assert.equal(await page.locator("#contrib-tableau").isHidden(), true, "pas de tableau de relecture pour un contributeur");
  await proposer(page, { charte: false, motif: "ok" });
  assert.match(await page.locator("#contrib-charte-erreur").textContent(), /charte/);
  assert.match(await page.locator("#contrib-motif-erreur").textContent(), /5 caractères/);
  await page.fill("#contrib-motif", "Guider les débutants.");
  await page.check("#contrib-charte");
  await page.click("#contrib-envoyer");
  const mienne = page.locator("#contrib-miennes li").first();
  await mienne.waitFor();
  assert.match(await mienne.textContent(), /Pythagore/);
  assert.match(await mienne.locator(".contrib-statut").textContent(), /À relire/);
  assert.match(await mienne.locator("ins").textContent(), /intuition/);
  await capturer(page, "contributions-demo-contributeur");

  // Prof : tableau de bord, compteurs, demande de révision avec commentaire obligatoire.
  await page.click("#contrib-deconnexion");
  await page.click("#contrib-demo-prof");
  await page.locator("#contrib-tableau").waitFor({ state: "visible" });
  const compteurAReLire = page.locator(".contrib-compteur.statut-proposee strong");
  assert.equal(await compteurAReLire.textContent(), "3", "deux exemples + la nouvelle proposition");
  const carte = page.locator("#contrib-relecture li", { hasText: "intuition !" });
  await carte.locator("button", { hasText: "Demander une révision" }).click();
  assert.match(await carte.locator(".erreur-champ").textContent(), /commentaire/);
  await carte.locator("textarea").fill("Ajoute un exemple chiffré.");
  await carte.locator("button", { hasText: "Demander une révision" }).click();
  await page.locator(".contrib-compteur.statut-a_reviser strong", { hasText: "1" }).waitFor();
  await capturer(page, "contributions-demo-prof", { pleinePage: true });

  // Contributeur : corrige et renvoie.
  await page.click("#contrib-deconnexion");
  await page.click("#contrib-demo-contributeur");
  const aReviser = page.locator("#contrib-miennes li").first();
  await aReviser.locator(".contrib-statut", { hasText: "À réviser" }).waitFor();
  assert.match(await aReviser.textContent(), /Ajoute un exemple chiffré/);
  await aReviser.locator("button", { hasText: "Corriger et renvoyer" }).click();
  assert.match(await page.locator("#contrib-edition").textContent(), /Ajoute un exemple chiffré/);
  await page.fill("#contrib-texte", "Une seule page pour toute la notion. Exemple : 3² + 4² = 5².");
  await page.check("#contrib-charte");
  await page.click("#contrib-envoyer");
  await page.locator("#contrib-miennes .contrib-statut", { hasText: "À relire" }).waitFor();

  // Prof : valide ; une issue de suivi (fictive) est indiquée.
  await page.click("#contrib-deconnexion");
  await page.click("#contrib-demo-prof");
  const aValider = page.locator("#contrib-relecture li", { hasText: "5²" });
  await aValider.locator("button", { hasText: "Valider" }).click();
  await page.selectOption("#contrib-filtre-statut", "validee");
  await page.locator("#contrib-relecture li", { hasText: "issue n°" }).waitFor();
  assert.deepEqual(appels, [], "la démonstration n'appelle jamais le Worker");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("Worker simulé : un parent n'a pas accès, un contributeur envoie une proposition conforme", async () => {
  const parent = await demarrer({ connexion: true, role: "parent", url: "/#contributions" });
  assert.equal(await parent.page.locator("#entree-contributions").isHidden(), true);
  await parent.page.locator("#contrib-role-requis").waitFor({ state: "visible" });
  assert.equal(parent.appels.filter((a) => a.includes("contributions")).length, 0, "aucun appel sans rôle");
  await parent.contexte.close();

  const { page, contexte, erreurs, envoyees } = await demarrer({ connexion: true, role: "contributeur", viewport: { width: 390, height: 844 } });
  await page.click(".nav-mobile [data-nav=profil], .barre-laterale [data-nav=profil] >> visible=true");
  await page.click("#entree-contributions");
  await page.locator("#contrib-espace").waitFor({ state: "visible" });
  await proposer(page);
  await page.locator("#contrib-miennes li").first().waitFor();
  assert.equal(envoyees.length, 1);
  assert.equal(envoyees[0].notion_id, "pythagore");
  assert.equal(envoyees[0].chemin, "intro");
  assert.equal(envoyees[0].charte_version, "charte-contributeur-v1");
  assert.match(envoyees[0].texte_actuel, /^Une seule page/);
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(largeur <= 390, `pas de défilement horizontal sur mobile (${largeur})`);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

// TEMPORAIRE (issue #160) : à supprimer avec l'option « Tester les rôles » quand la gestion des comptes sera disponible.
test("option temporaire « Tester les rôles » : prof puis contributeur simulés depuis le Profil, sans appel au Worker", async () => {
  assert.equal(config.testRolesTemporaire, true, "option activée dans le site construit");
  const { page, contexte, erreurs, appels } = await demarrer();
  await page.click(".barre-laterale [data-nav=profil]");
  await page.locator("#test-roles").waitFor({ state: "visible" });
  assert.equal(await page.locator("#test-roles-choix").inputValue(), "");
  await page.selectOption("#test-roles-choix", "prof");
  await page.waitForURL(/demo=contributions/);
  await page.locator("#contrib-tableau").waitFor({ state: "visible" });
  assert.match(await page.locator("#contrib-role-nom").textContent(), /Prof/);
  await capturer(page, "contributions-test-roles-prof");

  await page.click(".barre-laterale [data-nav=profil]");
  assert.equal(await page.locator("#test-roles-choix").inputValue(), "prof", "le rôle simulé est affiché dans le Profil");
  await page.selectOption("#test-roles-choix", "contributeur");
  await page.waitForURL(/#contributions/);
  await page.locator("#contrib-espace").waitFor({ state: "visible" });
  await page.locator("#contrib-role-nom", { hasText: "Contributeur" }).waitFor();
  assert.equal(await page.locator("#contrib-tableau").isHidden(), true);

  await page.click(".barre-laterale [data-nav=profil]");
  await page.selectOption("#test-roles-choix", "");
  await page.waitForURL((url) => !url.search.includes("demo"));
  await page.locator("#salut").waitFor();
  assert.equal(await page.locator("#entree-contributions").isHidden(), true, "retour au profil habituel");
  assert.deepEqual(appels, [], "aucun appel aux comptes ni aux contributions");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("menu Contributions et édition ciblée : le prof propose depuis la notion ouverte, puis retrouve la proposition par matière", async () => {
  const { page, contexte, erreurs, appels } = await demarrer({ url: "/?demo=contributions#accueil" });
  // Sans rôle : ni menu Contributions ni édition dans la bulle.
  assert.equal(await page.locator("#nav-contributions").isHidden(), true);
  await page.goto(`${serveur.url}/?demo=contributions#contributions`);
  await page.click("#contrib-demo-prof");
  await page.locator("#contrib-tableau").waitFor({ state: "visible" });
  const menu = page.locator("#nav-contributions");
  await menu.waitFor({ state: "visible" });

  // Synthèse par matière : Maths regroupe les propositions d'exemple.
  const maths = page.locator("#contrib-matieres [data-matiere=mathematiques]");
  await maths.waitFor();
  assert.match(await maths.textContent(), /Maths/);
  assert.match(await maths.textContent(), /Le théorème de Pythagore \(2 à relire\)/);

  // Notion ouverte depuis Éducation : le panneau d'édition s'affiche à côté de la page.
  await page.click(".barre-laterale [data-nav=education]");
  await page.locator("#catalogue .accordeon-bouton", { hasText: "Collège" }).click();
  await page.locator("#edu-college .accordeon-bouton", { hasText: "Maths" }).click();
  await page.locator("#catalogue .notion", { hasText: "Pythagore" }).click();
  await page.locator("#bulle-lab[open][data-notion=pythagore]").waitFor();
  const panneau = page.locator("#bulle-edition");
  await panneau.waitFor({ state: "visible" });
  assert.equal(await page.locator("#bulle-editer").getAttribute("aria-pressed"), "true");
  const onglets = await page.locator(".edition-section").evaluateAll((s) => s.map((x) => x.dataset.onglet));
  assert.deepEqual(onglets, ["explication", "memo", "application", "mise-en-situation"]);
  const intro = page.locator('.edition-champ[data-chemin="intro"]');
  assert.match(await intro.locator(".edition-pastille").textContent(), /1 en cours/, "proposition d'exemple comptée sur ce champ");
  await capturer(page, "contributions-edition-ciblee", { pleinePage: false });

  // Ajout après un paragraphe, avec aperçu et validation (charte).
  const paragraphe = page.locator('.edition-champ[data-chemin="niveaux.1.paragraphes.0"]');
  await paragraphe.locator("button", { hasText: "Ajouter après" }).click();
  await page.fill("#edition-texte", "Astuce : l'hypoténuse est toujours en face de l'angle droit.");
  assert.match(await page.locator("#edition-apercu ins").textContent(), /Astuce/);
  await page.fill("#edition-motif", "Repère utile pour les élèves.");
  await page.click("#edition-formulaire button[type=submit]");
  assert.match(await page.locator("#edition-charte-erreur").textContent(), /charte/);
  await page.check("#edition-charte");
  await page.click("#edition-formulaire button[type=submit]");
  await page.locator("#edition-formulaire").waitFor({ state: "hidden" });
  await paragraphe.locator(".edition-pastille", { hasText: "2 en cours" }).waitFor(); // une proposition d'exemple + la nouvelle

  // Fermer le panneau puis le rouvrir ; aller aux contributions de la notion.
  await page.click("#bulle-editer");
  assert.equal(await panneau.isHidden(), true);
  await page.click("#bulle-editer");
  await page.click("#edition-vers-contributions");
  await page.locator("#bulle-lab").waitFor({ state: "hidden" });
  await page.locator("#contrib-tableau").waitFor({ state: "visible" });
  assert.equal(await menu.getAttribute("aria-current"), "page", "Contributions est une destination de la navigation");
  assert.equal(await page.locator("#contrib-filtre-matiere").inputValue(), "mathematiques");
  assert.equal(await page.locator("#contrib-filtre-notion").inputValue(), "pythagore");
  await page.locator("#contrib-relecture li", { hasText: "Astuce" }).waitFor();
  assert.match(await maths.textContent(), /\(3 à relire\)/);

  // Un contributeur voit le menu et l'édition, sans tableau de relecture.
  await page.click("#contrib-deconnexion");
  await page.click("#contrib-demo-contributeur");
  await page.locator("#contrib-espace").waitFor({ state: "visible" });
  assert.equal(await menu.isVisible(), true);
  assert.equal(await page.locator("#contrib-tableau").isHidden(), true);
  await page.click("#contrib-deconnexion");
  await page.locator("#contrib-invite").waitFor({ state: "visible" });
  assert.equal(await menu.isHidden(), true, "le menu disparaît sans rôle");
  assert.deepEqual(appels, [], "aucun appel au Worker en démonstration");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});

test("édition ciblée sur mobile : panneau sous la page, menu Contributions dans la barre du bas, sans débordement", async () => {
  const { page, contexte, erreurs } = await demarrer({ url: "/?demo=contributions#contributions", viewport: { width: 390, height: 844 } });
  await page.click("#contrib-demo-contributeur");
  const menuMobile = page.locator("#nav-mobile-contributions");
  await menuMobile.waitFor({ state: "visible" });
  await page.setViewportSize({ width: 320, height: 740 });
  const boutons = await page.locator(".nav-mobile-bouton:not([hidden])").evaluateAll((l) => l.map((n) => n.getBoundingClientRect()).map((r) => ({ l: r.width, h: r.height, d: r.right })));
  assert.equal(boutons.length, 6, "cinq destinations + Contributions");
  assert.ok(boutons.every((b) => b.l >= 44 && b.h >= 44 && b.d <= 320), "six entrées tactiles à 320 px");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click(".nav-mobile [data-nav=education]");
  await page.locator("#catalogue .accordeon-bouton", { hasText: "Collège" }).click();
  await page.locator("#edu-college .accordeon-bouton", { hasText: "Maths" }).click();
  await page.locator("#catalogue .notion", { hasText: "Les fractions" }).click();
  await page.locator("#bulle-edition").waitFor({ state: "visible" });
  const largeur = await page.evaluate(() => document.querySelector("#bulle-lab").scrollWidth);
  assert.ok(largeur <= 390, `pas de débordement horizontal (${largeur})`);
  await capturer(page, "contributions-edition-mobile");
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
