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
    assert.equal(config.site, "https://www.kermiclab.online/");
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
