import test from "node:test";
import assert from "node:assert/strict";
import { appliquerMetadonnees, genererRobotsTxt, genererSitemapXml, routeDepuisFichier } from "../../scripts/lib/seo.mjs";

const ORIGINE = "https://www.kermiclab.online";

test("mappe les fichiers HTML vers les routes Cloudflare Pages", () => {
  assert.equal(routeDepuisFichier("index.html"), "/");
  assert.equal(routeDepuisFichier("equipe.html"), "/equipe");
  assert.equal(routeDepuisFichier("blog/2026-11-16-article/index.html"), "/blog/2026-11-16-article/");
  assert.equal(routeDepuisFichier("admin/index.html"), null);
  assert.equal(routeDepuisFichier("404.html"), null);
});

test("robots.txt référence le sitemap sans bloquer les pages noindex", () => {
  assert.equal(genererRobotsTxt(ORIGINE), `User-agent: *\nAllow: /\nSitemap: ${ORIGINE}/sitemap.xml\n`);
});

test("le sitemap XML est déterministe, échappé et sans doublons", () => {
  const xml = genererSitemapXml(["/", "/equipe", "/", "/blog?a=1", "/p&x"], ORIGINE);
  assert.match(xml, /https:\/\/www\.kermiclab\.online\/p&amp;x/);
  assert.equal((xml.match(/<loc>/g) ?? []).length, 3);
  assert.match(xml, /https:\/\/www\.kermiclab\.online\//);
});

test("ajoute une canonical unique et des métadonnées sociales fidèles au title et à la description", () => {
  const html = '<!doctype html><html><head><title>Exemple</title><meta name="description" content="Une page utile."></head><body></body></html>';
  const resultat = appliquerMetadonnees(html, "/exemple");
  assert.match(resultat, /rel="canonical" href="https:\/\/www\.kermiclab\.online\/exemple"/);
  assert.match(resultat, /property="og:title" content="Exemple"/);
  assert.match(resultat, /property="og:description" content="Une page utile\."/);
  assert.equal((resultat.match(/rel="canonical"/g) ?? []).length, 1);
});

test("l’accueil reçoit un title, une description et un H1 présents dès le HTML statique", () => {
  const html = '<html><head><title>KermicLab</title><meta name="description" content="Description générique"></head><body><h1 id="salut" tabindex="-1"></h1></body></html>';
  const resultat = appliquerMetadonnees(html, "/");
  assert.match(resultat, /<title>KermicLab — apprendre par l’interaction<\/title>/);
  assert.match(resultat, /name="description" content="Découvrez des notions, des jeux et des activités interactives pour apprendre en explorant, à votre rythme\."/);
  assert.match(resultat, /<h1 id="salut" tabindex="-1">Apprendre en explorant<\/h1>/);
});
