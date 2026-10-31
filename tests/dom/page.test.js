// Interface : ouvre le livrable index.html dans Chromium et lit le diagnostic intégré.
// Ignoré si Playwright n'est pas installé (aucune dépendance obligatoire).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let playwright = null;
try { playwright = createRequire(import.meta.url)('playwright'); } catch (_) { /* facultatif */ }

for (const [name, viewport] of [['ordinateur', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  test(`autotests de la page (${name})`, { skip: !playwright && 'Playwright absent' }, async () => {
    const browser = await playwright.chromium.launch();
    try {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(pathToFileURL(join(ROOT, 'index.html')).href);
      const status = await page.textContent('#status');
      const diag = await page.textContent('#diag');
      assert.deepEqual(errors, []);
      assert.match(status, /^Prêt · \d+ tests OK$/, diag);
      assert.doesNotMatch(diag, /Non exécutés/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width, 'pas de défilement horizontal');
    } finally {
      await browser.close();
    }
  });
}
