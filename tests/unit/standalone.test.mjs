import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../../index.html", import.meta.url), "utf8");

test("l’application autonome reste un fichier HTML hors ligne avec ses métadonnées", () => {
  assert.match(page, /^<!doctype html>/i);
  const metadonnees = page.match(/<script type="application\/json" id="kermiclab-meta">([\s\S]*?)<\/script>/);
  assert.ok(metadonnees);
  assert.deepEqual(Object.keys(JSON.parse(metadonnees[1])).sort(), [
    "date", "id", "langue", "onglets", "sujet", "titre", "version"
  ]);
  assert.doesNotMatch(page, /<(?:script|link|img|iframe)\b[^>]*(?:src|href)\s*=/i);
  assert.doesNotMatch(page, /\b(?:fetch|XMLHttpRequest|eval)\s*\(/);
  assert.match(page, /connect-src 'none'/);
});

test("les empreintes CSP correspondent aux scripts et styles en ligne", () => {
  const csp = page.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
  assert.ok(csp);
  const script = page.match(/<script>\n([\s\S]*?)<\/script>/)?.[1];
  const style = page.match(/<style>\n([\s\S]*?)<\/style>/)?.[1];
  assert.ok(script);
  assert.ok(style);
  for (const [directive, contenu] of [["script-src", script], ["style-src", style]]) {
    const empreinte = createHash("sha256").update(`\n${contenu}`).digest("base64");
    assert.ok(csp.includes(`${directive} 'sha256-${empreinte}'`), `${directive} doit autoriser son contenu exact`);
  }
});

test("l’application expose les commandes accessibles du cercle et du défi", () => {
  assert.match(page, /<input\b(?=[^>]*\bid="angle")(?=[^>]*\btype="range")[^>]*>/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /aria-controls="panneau-explorer"/);
  assert.match(page, /id="formulaire-defi"/);
});
