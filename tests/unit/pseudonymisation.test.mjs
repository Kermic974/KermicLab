import { test } from "node:test";
import assert from "node:assert/strict";
import { pseudonymiser } from "../../worker/src/pseudonymisation.js";

test("pseudonymisation : données personnelles remplacées par des jetons cohérents", () => {
  const r = pseudonymiser("Je m’appelle Léa Martin, j’habite à Lyon. Écris-moi : lea.m@example.org ou au 06 12 34 56 78, encore lea.m@example.org");
  assert.equal(r.texte, "Je m’appelle [PRENOM_1], j’habite [LIEU_1]. Écris-moi : [EMAIL_1] ou au [TELEPHONE_1], encore [EMAIL_1]");
  assert.deepEqual(r.remplacements, { PRENOM: 1, LIEU: 1, EMAIL: 1, TELEPHONE: 1 });
  assert.equal(r.total, 4);
  for (const [texte, attendu] of [
    ["mon école est le collège Jean Moulin", "mon école est [ECOLE_1]"],
    // Sans ponctuation, tout le reste de la proposition est masqué : on préfère trop masquer que pas assez.
    ["My name is Sam and I live in Leeds", "My name is [PRENOM_1]"],
    ["I live in Leeds, my name is Sam", "I live [LIEU_1], my name is [PRENOM_1]"],
    ["12 rue des Lilas, Paris", "[ADRESSE_1], Paris"],
    ["voir https://pirate.test/x et www.exemple.fr", "voir [URL_1] et [URL_2]"],
    ["numéro élève 123456789, IP 192.168.0.1", "numéro élève [IDENTIFIANT_1], IP [IP_1]"],
    ["+33 6 12 34 56 78", "[TELEPHONE_1]"]
  ]) assert.equal(pseudonymiser(texte).texte, attendu, texte);
});

test("pseudonymisation : le contenu pédagogique et les nombres ordinaires restent intacts", () => {
  for (const texte of [
    "je suis fan des échecs, un mode 2048 à 1000 points en 2026",
    "Explique plus simplement",
    "sin(30°) = 0,5 et 3,14159",
    "Propose un petit défi sur les fractions 3/4"
  ]) {
    const r = pseudonymiser(texte);
    assert.equal(r.texte, texte);
    assert.equal(r.total, 0);
  }
  assert.equal(pseudonymiser(undefined).texte, "");
});
