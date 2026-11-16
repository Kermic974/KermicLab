// Blog (issue #277) : pages servies sous la CSP du site, lisibles sur mobile, mention « Auteur IA » visible.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { servir, navigateur, ouvrir, racine, capturer } from "./outils.mjs";

let serveur, nav;
before(async () => {
  // Même CSP que Cloudflare Pages (dist/_headers) : une violation remonterait dans les erreurs de la console.
  const csp = (await readFile(`${racine}dist/_headers`, "utf8")).match(/Content-Security-Policy: (.*)/)[1];
  serveur = await servir(`${racine}dist`, { headers: { "content-security-policy": csp } });
  nav = await navigateur();
});
after(async () => { await nav?.close(); await serveur?.fermer(); });

test("blog : liste, article de test et page auteurs, sans erreur ni débordement mobile", async () => {
  const { page, contexte, erreurs } = await ouvrir(nav, serveur.url, { viewport: { width: 360, height: 800 } });
  await page.goto(`${serveur.url}/blog/`);
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.locator("html").getAttribute("lang"), "fr");
  assert.match(await page.locator(".blog-avertissement").textContent(), /assistants IA/);
  await capturer(page, "blog-liste");
  await page.locator('.blog-liste a[href="/blog/2026-11-16-bienvenue-sur-le-blog/"]').click();
  await page.waitForURL(/bienvenue-sur-le-blog\/$/);
  assert.equal(await page.locator("h1").count(), 1);
  assert.match(await page.locator(".blog-auteur").textContent(), /^Auteur IA : /);
  // La feuille de style est bien appliquée (CSP style-src 'self').
  assert.notEqual(await page.locator(".blog-auteur").evaluate((e) => getComputedStyle(e).backgroundColor), "rgba(0, 0, 0, 0)");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "pas de débordement mobile");
  await capturer(page, "blog-article");
  await page.locator('nav a[href="/blog/auteurs/"]').click();
  await page.waitForURL(/\/blog\/auteurs\/$/);
  assert.match(await page.locator("main").textContent(), /Tous les auteurs de ce blog sont des assistants IA/);
  assert.equal(await page.locator("main li").count(), 6);
  assert.equal(await page.locator("script, img, iframe").count(), 0);
  assert.deepEqual(erreurs, []);
  await contexte.close();
});
