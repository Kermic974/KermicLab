import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCatalogue, verifierGraphePrerequis } from "../../scripts/lib/catalogue.mjs";

// Graphe des prérequis vérifié en CI (feuille de route, phase 1 ; issue #180).
const racine = new URL("../..", import.meta.url).pathname;
const notion = (id, prerequis, niveaux) => ({ id, sujet: `mathematiques/${id}`, ...(prerequis && { prerequis }), ...(niveaux && { niveaux }) });

test("graphe : un graphe sans erreur est accepté, prérequis vides ou absents compris", () => {
  assert.deepEqual(verifierGraphePrerequis([
    notion("a", [], ["cycle-3"]), notion("b", ["a"], ["cycle-3", "cycle-4"]), notion("c", ["a", "b"], ["cycle-4"]), notion("d")
  ]), []);
});

test("graphe : prérequis inconnu ou jeu refusé", () => {
  assert.deepEqual(verifierGraphePrerequis([notion("a", ["inconnue"])]), ["a : prérequis « inconnue » inconnu"]);
  assert.deepEqual(verifierGraphePrerequis([notion("a", ["echecs"]), { id: "echecs", sujet: "jeux/echecs" }]),
    ["a : prérequis « echecs » est un jeu, pas une notion"]);
});

test("graphe : cycles détectés, avec leur chemin", () => {
  assert.deepEqual(verifierGraphePrerequis([notion("a", ["b"]), notion("b", ["a"])]), ["cycle de prérequis : a → b → a"]);
  assert.deepEqual(verifierGraphePrerequis([notion("a", ["b"]), notion("b", ["c"]), notion("c", ["a"]), notion("d", ["a"])]),
    ["cycle de prérequis : a → b → c → a"]);
});

test("graphe : un prérequis ne commence pas après la notion qui en dépend", () => {
  assert.deepEqual(verifierGraphePrerequis([notion("a", [], ["seconde"]), notion("b", ["a"], ["cycle-4", "seconde"])]),
    ["b : prérequis « a » commence en seconde, après cycle-4"]);
  assert.deepEqual(verifierGraphePrerequis([notion("a", [], ["cycle-4"]), notion("b", ["a"], ["cycle-4"])]), [], "même niveau accepté");
  assert.deepEqual(verifierGraphePrerequis([notion("a"), notion("b", ["a"], ["cycle-3"])]), [], "niveaux absents : non vérifiés");
});

test("graphe : le catalogue réel est valide (chargerCatalogue échoue sinon)", async () => {
  const { index } = await chargerCatalogue([`${racine}catalogue`, `${racine}catalogue-prive`]);
  assert.deepEqual(verifierGraphePrerequis(index.maquettes), []);
});
