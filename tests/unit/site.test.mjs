import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Ces tests lisent dist/ : ils supposent `npm run build` (déjà lancé par `npm run ci` avant `npm test`).
const racine = new URL("../..", import.meta.url).pathname;

test("dist/ publie l'application autonome sous /cercle/, identique à index.html", async () => {
  const [source, publie] = await Promise.all([
    readFile(`${racine}index.html`, "utf8"),
    readFile(`${racine}dist/cercle/index.html`, "utf8")
  ]);
  assert.equal(publie, source);
});

test("la CSP du chat n'est pas appliquée à /cercle/ (l'application garde sa propre CSP)", async () => {
  const entetes = await readFile(`${racine}dist/_headers`, "utf8");
  assert.match(entetes, /^\/cercle\/\*\n {2}! Content-Security-Policy$/m);
});

test("le chat propose un lien vers l'application, traduit dans chaque langue", async () => {
  const html = await readFile(`${racine}web/index.html`, "utf8");
  assert.match(html, /<a href="cercle\/" data-i18n="application">/);
  for (const l of ["fr", "en"]) {
    const textes = JSON.parse(await readFile(`${racine}web/i18n/${l}.json`, "utf8"));
    assert.ok(textes.application, `clé « application » absente de ${l}.json`);
  }
});

test("mesure d'audience : présente sur le chat, absente de l'application autonome", async () => {
  const [chat, autonome] = await Promise.all([
    readFile(`${racine}web/index.html`, "utf8"),
    readFile(`${racine}index.html`, "utf8")
  ]);
  assert.match(chat, /<script type="module" src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js" data-cf-beacon=/);
  assert.doesNotMatch(autonome, /cloudflareinsights/);
});

test("les CSS et JS du chat portent l'empreinte de leur contenu (pas de mélange avec une version en cache)", async () => {
  const [html, app, confidentialite] = await Promise.all(["index.html", "app.js", "confidentialite.html"].map((f) => readFile(`${racine}dist/${f}`, "utf8")));
  assert.match(html, /<link rel="stylesheet" href="style\.css\?v=[0-9a-f]{10}">/);
  assert.match(html, /<script type="module" src="app\.js\?v=[0-9a-f]{10}"><\/script>/);
  assert.match(app, /from "\.\/progression\.js\?v=[0-9a-f]{10}"/);
  assert.match(confidentialite, /href="style\.css\?v=[0-9a-f]{10}"/);
});

test("la feuille de route est publiée et accessible depuis Profil, entre « Configuration » et « Signaler un problème »", async () => {
  const [html, page] = await Promise.all([
    readFile(`${racine}web/index.html`, "utf8"),
    readFile(`${racine}dist/feuille-de-route.html`, "utf8")
  ]);
  const profil = html.slice(html.indexOf('<section id="profil"'), html.indexOf("</section>\n\n<!-- Espace famille"));
  const ordre = ['id="configuration-titre"', "navFeuilleDeRoute", 'data-nav="aide"'].map((cle) => profil.indexOf(cle));
  assert.ok(ordre.every((i) => i > 0) && ordre[0] < ordre[1] && ordre[1] < ordre[2], "ordre dans l'écran Profil");
  assert.match(profil, /<a class="lien-profil" href="feuille-de-route\.html">/);
  assert.match(page, /href="style\.css\?v=[0-9a-f]{10}"/);
  // Seul le JSON de configuration est en ligne ; le composant utilise des ressources locales.
  assert.doesNotMatch(page, /<script(?! type="(?:application\/json|module)")|<style|style="/);
  assert.match(page, /src="boite-idees\.js\?v=[0-9a-f]{10}"/);
  for (const l of ["fr", "en"]) {
    const textes = JSON.parse(await readFile(`${racine}web/i18n/${l}.json`, "utf8"));
    assert.ok(textes.navFeuilleDeRoute, `clé « navFeuilleDeRoute » absente de ${l}.json`);
  }
});

test("la page L'équipe est publiée et accessible depuis la barre latérale, le Profil et le pied de page", async () => {
  const [html, page, redirections] = await Promise.all([
    readFile(`${racine}web/index.html`, "utf8"),
    readFile(`${racine}dist/equipe.html`, "utf8"),
    readFile(`${racine}dist/_redirects`, "utf8")
  ]);
  const laterale = html.slice(html.indexOf('<aside class="barre-laterale"'), html.indexOf("</aside>"));
  assert.match(laterale, /<a class="nav-bouton" href="equipe\.html">[\s\S]*?data-i18n="navEquipe"/);
  const profil = html.slice(html.indexOf('<section id="profil"'), html.indexOf("<!-- Espace famille"));
  assert.match(profil, /<a class="lien-profil" href="equipe\.html">/);
  const pied = html.slice(html.indexOf('<footer class="pied">'), html.indexOf("</footer>"));
  assert.match(pied, /<a href="equipe\.html" data-i18n="navEquipe"><\/a>/);
  assert.match(page, /href="style\.css\?v=[0-9a-f]{10}"/);
  assert.match(page, /src="boite-idees\.js\?v=[0-9a-f]{10}"/);
  assert.doesNotMatch(page, /<script(?! type="(?:application\/json|module)")|<style|style="|<img\b|https?:\/\/|eval\(/);
  assert.match(page, /Les six personnes présentées ici sont des agents d'intelligence artificielle/);
  for (const nom of ["Émile Grok", "Inès Grok", "Chloé Grok", "Paul Grok", "Hugo Grok", "Manon Grok"]) {
    assert.match(page, new RegExp(`<h2 id="nom-[a-z]+">${nom}</h2>`));
  }
  assert.match(redirections, /^\/equipe\s+\/equipe\.html\s+200$/m);
  for (const l of ["fr", "en"]) {
    const textes = JSON.parse(await readFile(`${racine}web/i18n/${l}.json`, "utf8"));
    assert.ok(textes.navEquipe, `clé « navEquipe » absente de ${l}.json`);
  }
});

test("le lien de participation reste visible (barre latérale et Profil), hors des destinations, et traduit", async () => {
  const html = await readFile(`${racine}web/index.html`, "utf8");
  assert.equal((html.match(/https:\/\/www\.onparticipe\.fr\/c\/yDvp6lpc/g) ?? []).length, 2);
  const pied = html.slice(html.indexOf('<div class="barre-pied">'), html.indexOf("</aside>"));
  assert.match(pied, /class="nav-bouton nav-participer"[^>]*target="_blank" rel="noopener noreferrer"/);
  const profil = html.slice(html.indexOf('<section id="profil"'), html.indexOf("<!-- Espace famille"));
  assert.match(profil, /class="lien-profil" href="https:\/\/www\.onparticipe\.fr\/c\/yDvp6lpc" target="_blank" rel="noopener noreferrer"/);
  // Les deux navigations ne contiennent que les 5 destinations, sans action secondaire, plus l'entrée « Contributions »
  // réservée aux rôles contributeur, prof ou admin (ADR 0023 §6 bis), masquée par défaut.
  for (const classe of ["nav", "nav-mobile"]) {
    const bloc = html.match(new RegExp(`<nav class="${classe}"[\\s\\S]*?</nav>`))[0];
    assert.deepEqual([...bloc.matchAll(/data-nav="([a-z]+)"/g)].map((m) => m[1]), ["accueil", "education", "jeux", "progression", "profil", "contributions"], classe);
    assert.match(bloc, /<button [^>]*data-nav="contributions"[^>]*\shidden>/, `${classe} : Contributions masquée par défaut`);
    assert.doesNotMatch(bloc, /<a\b/, `${classe} : aucun lien, seulement des destinations`);
  }
  for (const l of ["fr", "en"]) {
    const textes = JSON.parse(await readFile(`${racine}web/i18n/${l}.json`, "utf8"));
    assert.ok(textes.navParticiper, `clé « navParticiper » absente de ${l}.json`);
  }
});
