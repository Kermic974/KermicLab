import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../../gabarit/jeux/trophees.js", import.meta.url), "utf8");
const ORIGINE = "https://www.kermiclab.online";

function monter(meta = {}) {
  const messages = [], restaurations = [], listeners = [];
  const parent = { postMessage: (data, origine) => messages.push({ data, origine }) };
  const window = { parent, addEventListener: (type, listener) => { if (type === "message") listeners.push(listener); } };
  const document = { referrer: "", getElementById: () => ({ textContent: JSON.stringify({ id: "echecs", ...meta }) }) };
  const pont = vm.runInNewContext(`${source}\nTrophees`, { window, document, URL });
  const publier = pont.monter({
    restaurer: (etat) => restaurations.push(etat),
    resumer: () => ({ genre: "jeux", xp: 70, etat: { xp: 70 }, badges: [] })
  });
  const envoyer = (data = {}, origin = ORIGINE, source = parent) => listeners.forEach((listener) => listener({
    source, origin, data: { type: "kermiclab:trophees:charger", module: "echecs", etat: null, ...data }
  }));
  return { messages, restaurations, publier, envoyer };
}

test("pont : sans Referer, ne transmet aucune progression avant la connexion puis cible uniquement le parent", () => {
  const p = monter();
  assert.equal(p.messages.length, 1);
  assert.equal(p.messages[0].data.type, "kermiclab:trophees:pret");
  assert.equal(p.messages[0].origine, "*");
  assert.equal(p.messages[0].data.etat, undefined);
  p.publier();
  assert.equal(p.messages.length, 1);
  p.envoyer({ etat: { xp: 50 } });
  assert.equal(p.restaurations.length, 1);
  assert.equal(p.messages[1].origine, ORIGINE);
  assert.equal(p.messages[1].data.xp, 70);
  p.envoyer({ etat: { xp: 999 } }, "https://autre.example");
  p.publier();
  assert.equal(p.restaurations.length, 1, "la restauration est unique");
  assert.equal(p.messages.at(-1).origine, ORIGINE);
});

test("pont : refuse une fenêtre étrangère, une origine opaque et un autre module", () => {
  const p = monter();
  p.envoyer({}, ORIGINE, {});
  p.envoyer({}, "null");
  p.envoyer({}, "file://");
  p.envoyer({ module: "sudoku" });
  p.envoyer({ type: "kermiclab:trophees:progres" });
  p.publier();
  assert.equal(p.messages.length, 1);
  assert.equal(p.restaurations.length, 0);
  p.envoyer();
  assert.equal(p.messages.length, 2);
});

test("pont : respecte les restrictions d'origine configurées", () => {
  for (const meta of [{ parentOrigin: ORIGINE }, { allowedParentOrigins: [ORIGINE] }]) {
    const p = monter(meta);
    p.envoyer({}, "https://autre.example");
    assert.equal(p.messages.length, 1);
    p.envoyer();
    assert.equal(p.messages.length, 2);
    assert.equal(p.messages[1].origine, ORIGINE);
  }
});
