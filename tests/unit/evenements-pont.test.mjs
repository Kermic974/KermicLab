import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { injecterOriginesParent, originesParent } from "../../worker/src/origines-pages.js";
import { lireMetaHtml } from "../../scripts/lib/catalogue.mjs";

// Module des pages (gabarit/jeux/evenements.js) : ne parle qu'à une origine déclarée (ADR 0025, alerte de sécurité #220).
const source = await readFile(new URL("../../gabarit/jeux/evenements.js", import.meta.url), "utf8");
const WWW = "https://www.kermiclab.online", PAGES = "https://kermiclab.pages.dev";

function charger(meta = {}, { isole = false } = {}) {
  const messages = [], listeners = [];
  const parent = { postMessage: (data, origine) => messages.push({ data, origine }) };
  const window = { addEventListener: (type, l) => { if (type === "message") listeners.push(l); } };
  window.parent = isole ? window : parent;
  const document = { getElementById: () => ({ textContent: JSON.stringify({ id: "pythagore", version: "1.0.0", ...meta }) }) };
  const ev = vm.runInNewContext(`${source}\nEvenements`, { window, document, URL });
  const ecouter = (origin, data = {}, source = parent) => listeners.forEach((l) => l({
    source, origin, data: { type: "kermiclab:evenements:ecouter", v: 1, notion: "pythagore", ...data }
  }));
  return { ev, messages, ecouter, listeners };
}

test("pont d'événements : sans origine déclarée, la page n'annonce rien, n'écoute rien et n'émet rien", () => {
  const p = charger();
  p.ev.emettre("demarre");
  assert.deepEqual(p.messages, []);
  assert.equal(p.listeners.length, 0);
});

test("pont d'événements : annonce à chaque origine autorisée, puis n'émet que vers le parent reconnu", () => {
  const p = charger({ allowedParentOrigins: [WWW, PAGES, "*", "javascript:alert(1)", "https://x.example/chemin"] });
  assert.deepEqual(p.messages.map((m) => [m.data.type, m.origine]),
    [["kermiclab:evenements:pret", WWW], ["kermiclab:evenements:pret", PAGES]], "jamais « * », origines invalides ignorées");
  p.ev.emettre("demarre");
  p.ev.emettre("reponse", { exercice: "app-1", correct: true, essai: 1 });
  assert.equal(p.messages.length, 2, "en file tant que le parent n'est pas reconnu");
  p.ecouter("https://autre.example");
  p.ecouter(PAGES, {}, {}); // fenêtre étrangère
  p.ecouter("null");
  assert.equal(p.messages.length, 2);
  p.ecouter(PAGES); // tableau de bord ouvert sur kermiclab.pages.dev : pas seulement la première origine
  assert.deepEqual(p.messages.slice(2).map((m) => [m.data.evenement, m.origine]), [["demarre", PAGES], ["reponse", PAGES]]);
  p.ev.emettre("termine");
  assert.equal(p.messages.at(-1).origine, PAGES);
  p.ecouter(WWW);
  p.ev.emettre("indice", { exercice: "app-2", rang: 1 });
  assert.equal(p.messages.at(-1).origine, PAGES, "l'origine du parent, une fois fixée, ne change plus");
});

test("pont d'événements : une page ouverte seule n'émet rien ; un événement hors schéma n'est jamais envoyé", () => {
  const seule = charger({ allowedParentOrigins: [WWW] }, { isole: true });
  seule.ev.emettre("demarre");
  assert.deepEqual(seule.messages, []);
  const p = charger({ parentOrigin: WWW });
  p.ecouter(WWW);
  p.ev.emettre("reponse", { exercice: "app-1", correct: "oui", essai: 1 });
  p.ev.emettre("abandon");
  p.ev.emettre("demarre");
  p.ev.emettre("demarre");
  assert.deepEqual(p.messages.slice(1).map((m) => m.data.evenement), ["demarre"], "demarre une seule fois, rien d'invalide");
});

test("Worker : origines autorisées tirées de ORIGINES_AUTORISEES et écrites dans les métadonnées servies", async () => {
  assert.deepEqual(originesParent({ ORIGINES_AUTORISEES: `${WWW}, ${PAGES},*, ftp://x.example, https://x.example/chemin, ${WWW}` }), [WWW, PAGES]);
  assert.deepEqual(originesParent({}), []);
  const html = await readFile(new URL("../../catalogue/pythagore/page.html", import.meta.url), "utf8");
  const servie = injecterOriginesParent(html, [WWW, PAGES]);
  assert.deepEqual(lireMetaHtml(servie).allowedParentOrigins, [WWW, PAGES]);
  assert.equal(lireMetaHtml(servie).id, "pythagore");
  assert.equal(servie.replace(/<script type="application\/json" id="kermiclab-meta">[\s\S]*?<\/script>/, ""),
    html.replace(/<script type="application\/json" id="kermiclab-meta">[\s\S]*?<\/script>/, ""), "seules les métadonnées changent (CSP intacte)");
  assert.equal(injecterOriginesParent(html, []), html);
  assert.equal(injecterOriginesParent("<p>sans métadonnées</p>", [WWW]), "<p>sans métadonnées</p>");
});
