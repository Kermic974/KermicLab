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

test("inclureModules : recopie un module partagé, refuse tout autre chemin ou la mauvaise balise", async () => {
  const { inclureModules } = await import("../../scripts/lib/catalogue.mjs");
  const { readFile } = await import("node:fs/promises");
  const source = (await readFile(new URL("../../gabarit/jeux/progression.js", import.meta.url), "utf8")).trimEnd();
  const page = `<p>a</p><script id="x" data-inclure="gabarit/jeux/progression.js">ancien</script><p>b</p>`;
  assert.equal(await inclureModules(page), `<p>a</p><script id="x" data-inclure="gabarit/jeux/progression.js">\n${source}\n</script><p>b</p>`);
  assert.equal(await inclureModules(await inclureModules(page)), await inclureModules(page), "idempotent");
  for (const chemin of ["../.env", "gabarit/jeux/../../package.json", "/etc/passwd", "worker/src/index.js", "gabarit/jeux/x.html"]) {
    await assert.rejects(inclureModules(`<script data-inclure="${chemin}"></script>`), /inclusion refusée/, chemin);
  }
  await assert.rejects(inclureModules(`<style data-inclure="gabarit/jeux/progression.js"></style>`), /mauvaise balise/);
  assert.equal(await inclureModules("<p>sans inclusion</p>"), "<p>sans inclusion</p>");
});
