import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import * as suivi from "../../web/suivi-jeux.js";
import { JEUX, classificationJeu } from "../../web/contrat-jeux.js";
import * as evenements from "../../web/evenements.js";
import { validerBilan, construireBilan } from "../../web/famille.js";
import { bilanPourProfesseur } from "../../web/professeur.js";

const jour = "2026-11-18";
const message = (evenement, sequence, extra = {}) => ({ type: "kermiclab:evenement", v: 2, notion: "2048", version: "1.0.1",
  tentative: "00000000-0000-4000-8000-000000000001", activite: "tuile-64", mode: "partie", evenement, sequence, ...extra });
const enregistrer = (etat, ev, date = jour) => suivi.enregistrerJeu(etat, suivi.normaliserEvenementJeu(ev, ev.notion), date);

test("Jeux v2 : schéma strict, sans réponses, cibles ni données libres", () => {
  assert.ok(suivi.normaliserEvenementJeu(message("demarre", 0), "2048"));
  for (const extra of [{ texte: "secret" }, { reponse: "secret" }, { cibles: [] }, { correct: true },
    { activite: ["mot"] }, { version: ["1.0.1"] }, { sequence: -1 }, { mode: "inconnu" }, { notion: "pythagore" }, { v: 3 }]) {
    assert.equal(suivi.normaliserEvenementJeu(message("demarre", 0, extra), "2048"), null, JSON.stringify(extra));
  }
  assert.equal(suivi.normaliserEvenementJeu(message("termine", 1, { resultat: "gagne" }), "2048"), null);
  assert.equal(suivi.normaliserEvenementJeu(message("demarre", 0), "pendu"), null);
});

test("Jeux : doublons, ordre, résultat terminal immuable, version et activité stables", () => {
  let e = enregistrer({}, message("demarre", 0));
  e = enregistrer(e, message("reponse", 1, { correct: false }));
  const avant = structuredClone(e);
  assert.deepEqual(enregistrer(e, message("reponse", 1, { correct: false })), avant);
  assert.deepEqual(enregistrer(e, message("termine", 3, { resultat: "reussite" })), avant);
  assert.deepEqual(enregistrer(e, message("indice", 2, { version: "2.0.0" })), avant);
  assert.deepEqual(enregistrer(e, message("indice", 2, { activite: "autre" })), avant);
  e = enregistrer(e, message("indice", 2));
  e = enregistrer(e, message("reponse", 3, { correct: true }));
  e = enregistrer(e, message("termine", 4, { resultat: "reussite" }));
  assert.deepEqual(suivi.indicateursJeu(e["2048"], jour), { commencees: 1, terminees: 1, evaluables: 1, reussies: 1,
    abandons: 0, enCours: 0, autonomieEvaluables: 0, autonomes: 0, avecAide: 1, joursActifs: 1, revisions: 0, revisionsReussies: 0 });
  assert.deepEqual(enregistrer(e, message("termine", 5, { resultat: "echec" })), e);
});

test("Jeux : abandon distinct d'échec, jours actifs à minuit et fenêtre de 64 tentatives", () => {
  let e = enregistrer({}, message("demarre", 0), "2026-11-17");
  e = enregistrer(e, message("interaction", 1));
  assert.equal(suivi.indicateursJeu(e["2048"], jour).joursActifs, 2);
  e = suivi.interrompreJeu(e, "2048");
  const k = suivi.indicateursJeu(e["2048"], jour);
  assert.equal(k.abandons, 1); assert.equal(k.evaluables, 0); assert.equal(k.reussies, 0);
  for (let i = 0; i < 70; i++) e = enregistrer(e, message("demarre", 0, { tentative: randomUUID() }));
  assert.equal(e["2048"].tentatives.length, 64);
  assert.deepEqual(suivi.normaliserSuivi(e), e);
  assert.deepEqual(suivi.enregistrerJeu(e, message("efface", 0), jour), {});
});

test("Jeux : persistance dans l'enveloppe v1 et coexistence avec les événements scolaires", () => {
  const jeux = enregistrer({}, message("demarre", 0));
  const zone = new Map();
  const stockage = { getItem: (k) => zone.get(k), setItem: (k, v) => zone.set(k, v) };
  evenements.sauver(stockage, { ...evenements.etatInitial(), jeux });
  const e = evenements.charger(stockage);
  assert.deepEqual(e.jeux, jeux);
  const scolaire = evenements.enregistrer(e, { notion: "pythagore", version: "1.0.0", evenement: "termine" }, jour);
  assert.deepEqual(scolaire.jeux, jeux);
  assert.equal(evenements.maitriseNotion(scolaire.notions["2048"], jour).etat, "non-commencee");
  assert.deepEqual(suivi.normaliserSuivi({ inconnu: jeux["2048"] }), {});
  assert.deepEqual(evenements.charger({ getItem: () => '{"v":1,"notions":{}}' }), evenements.etatInitial());
});

test("Pont : origine déclarée, fenêtre parente, poignée de main, tentative paresseuse et aucune liste de mots", async () => {
  const source = await readFile(new URL("../../gabarit/jeux/suivi.js", import.meta.url), "utf8");
  function monter(origines) {
    const messages = [], listeners = {};
    const parent = { postMessage: (ev, origine) => messages.push({ ev, origine }) };
    const contexte = vm.createContext({ crypto: { randomUUID }, URL, Map, Set,
      document: { getElementById: () => ({ textContent: JSON.stringify({ id: "pendu", version: "1.1.1", allowedParentOrigins: origines }) }) },
      window: { parent, addEventListener: (nom, fn) => { listeners[nom] = fn; } } });
    vm.runInContext(source + "\nthis.suivi = SuiviJeux;", contexte);
    return { api: contexte.suivi, messages, listeners, parent };
  }
  const sansOrigine = monter([]);
  sansOrigine.api.preparer("mes-mots", "orthographe"); sansOrigine.api.reponse(true);
  assert.equal(sansOrigine.messages.length, 0);
  const p = monter(["https://ecole.test"]);
  p.api.preparer("mes-mots", "orthographe");
  assert.equal(p.messages.length, 1, "ouvrir ne compte pas comme une tentative");
  p.api.reponse(false);
  const accord = { source: p.parent, origin: "https://ecole.test", data: { type: "kermiclab:evenements:ecouter", v: 2, notion: "pendu" } };
  p.listeners.message({ ...accord, source: {} });
  assert.equal(p.messages.length, 1);
  p.listeners.message({ ...accord, origin: "https://pirate.test" });
  assert.equal(p.messages.length, 1);
  p.listeners.message(accord);
  p.api.terminer("echec"); p.api.terminer("reussite");
  assert.deepEqual(p.messages.slice(1).map(({ ev }) => ev.evenement), ["demarre", "reponse", "termine"]);
  assert.ok(p.messages.every((m) => m.origine === "https://ecole.test"));
  for (const { ev } of p.messages.slice(1)) assert.ok(suivi.normaliserEvenementJeu(ev, "pendu"));
});
