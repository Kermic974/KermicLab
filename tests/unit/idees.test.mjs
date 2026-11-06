import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { ajouterBoiteIdees } from "../../scripts/lib/idees.mjs";
import { scriptsEnLigne, hashScript } from "../../scripts/lib/catalogue.mjs";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";

const racine = new URL("../../", import.meta.url);
const configuration = (html) => JSON.parse(html.match(/id="boite-idees-config">([^]*?)<\/script>/)[1]);

test("boîte à idées : chaque page publiée possède le composant et ses traductions", async () => {
  for (const fichier of await readdir(new URL("dist/", racine))) {
    if (!fichier.endsWith(".html")) continue;
    const html = await readFile(new URL(`dist/${fichier}`, racine), "utf8");
    const config = configuration(html);
    assert.equal(config.page, fichier);
    assert.ok(config.version);
    assert.equal(config.site, undefined, "l'adresse du site n'est jamais lue dans le DOM");
    for (const langue of ["fr", "en"]) {
      assert.deepEqual(Object.keys(config.textes[langue]).sort(), ["ideeAction", "ideeAvertissement"]);
    }
    assert.match(html, /src="boite-idees\.js\?v=[a-f0-9]{10}"/);
    assert.match(html, /href="boite-idees\.css\?v=[a-f0-9]{10}"/);
  }
  const cercle = await readFile(new URL("dist/cercle/index.html", racine), "utf8");
  assert.equal(configuration(cercle).page, "cercle");
});

test("boîte à idées : toutes les langues et maquettes servies restent autonomes avec une CSP à jour", () => {
  for (const [id, traductions] of Object.entries(CATALOGUE.pages)) {
    for (const [langue, html] of Object.entries(traductions)) {
      const config = configuration(html);
      assert.equal(config.page, id);
      assert.ok(config.version);
      assert.ok(config.textes[langue].ideeAction);
      assert.doesNotMatch(html, /<script\b[^>]*\ssrc=|\b(fetch|XMLHttpRequest|WebSocket|eval)\s*\(/i);
      const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
      for (const script of scriptsEnLigne(html)) assert.ok(csp.includes(hashScript(script.contenu)), `${id}/${langue} : hash de script`);
      if (!/style-src[^;]*'unsafe-inline'/.test(csp)) {
        for (const [, style] of html.matchAll(/<style\b[^>]*>([^]*?)<\/style>/g)) {
          assert.ok(csp.includes(hashScript(style)), `${id}/${langue} : hash de style`);
        }
      }
      assert.ok(csp.includes("connect-src 'none'"));
    }
  }
});

test("boîte à idées : insertion unique et configuration échappée", () => {
  const html = ajouterBoiteIdees("<body></body>", { page: "</script><script>injection</script>" });
  assert.doesNotMatch(html, /<script>injection/);
  assert.equal(ajouterBoiteIdees(html, { page: "autre" }), html);
  assert.equal(configuration(html).page, "</script><script>injection</script>");
  assert.throws(() => ajouterBoiteIdees("<body>", { page: "invalide" }), /body.*absent/);
});

test("signal d'activité : ajouté une seule fois aux pages servies, sans aucune donnée transmise", async () => {
  const { ajouterSignalActivite, preparerPageServie } = await import("../../scripts/lib/idees.mjs");
  const html = ajouterSignalActivite("<body></body>", { page: "pythagore" });
  assert.equal((html.match(/id="signal-activite"/g) ?? []).length, 1);
  assert.equal(ajouterSignalActivite(html, { page: "pythagore" }), html, "idempotent");
  assert.throws(() => ajouterSignalActivite("<body>", { page: "x" }), /body.*absent/);
  const servie = preparerPageServie("<body></body>", { page: "pythagore", version: "1.0.0" });
  assert.ok(servie.indexOf('id="boite-idees-config"') < servie.indexOf('id="signal-activite"'));
  // Le message ne porte que son type : ni touche, ni position, ni contenu ; aucun réseau ni stockage.
  const script = html.match(/<script id="signal-activite">([\s\S]*?)<\/script>/)[1];
  assert.match(script, /postMessage\(\{ type: "kermiclab:activite" \}, "\*"\)/);
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|\.key\b|clientX|eval\(/);
});
