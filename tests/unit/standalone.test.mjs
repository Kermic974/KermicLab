import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../../index.html", import.meta.url), "utf8");

test("l’application autonome reste un fichier HTML accessible", () => {
  assert.match(page, /^<!doctype html>/i);
  assert.match(page, /<title>trigoLab · Cercle trigonométrique<\/title>/);
  assert.match(page, /<svg\b[^>]*role="slider"/);
  assert.match(page, /<input id="range" type="range"/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /role="tablist"/);
});

test("l’application autonome ne dépend d’aucune ressource externe", () => {
  assert.doesNotMatch(page, /<(?:script|link|img|iframe)\b[^>]*(?:src|href)\s*=/i);
  assert.doesNotMatch(page, /\b(?:fetch|XMLHttpRequest|eval)\s*\(/);
});
