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
