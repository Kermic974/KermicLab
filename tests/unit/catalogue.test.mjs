import { test } from "node:test";
import assert from "node:assert/strict";
import { scriptsEnLigne, appliquerCsp, hashScript } from "../../scripts/lib/catalogue.mjs";

test("scriptsEnLigne : insensible à la casse, ignore le JSON de métadonnées", () => {
  const html = `<script type="application/json" id="kermiclab-meta">{}</script><SCRIPT>a()</SCRIPT ><script>b()</script>`;
  assert.deepEqual(scriptsEnLigne(html).map((s) => s.contenu), ["a()", "b()"]);
});

test("appliquerCsp : hash de chaque script exécutable, y compris en majuscules", () => {
  const html = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'x'; style-src 'self'"><SCRIPT>a()</SCRIPT>`;
  assert.ok(appliquerCsp(html).includes(`script-src ${hashScript("a()")};`));
});

test("appliquerCsp : calcule aussi les hashes des styles quand demandé", () => {
  const html = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'x'; style-src 'self'"><script>a()</script><style>b{color:red}</style>`;
  assert.ok(appliquerCsp(html, { styles: true }).includes(`style-src ${hashScript("b{color:red}")}`));
});
