import { test } from "node:test";
import assert from "node:assert/strict";
import { intentionConversation } from "../../worker/src/conversation.js";

test("formules de politesse reconnues sans modèle, en français et en anglais", () => {
  for (const [message, intention] of [
    ["Bonjour", "salutation"], ["bonjour !", "salutation"], ["Salut Kermiclab", "salutation"], ["coucou, ça va ?", "salutation"],
    ["Bonsoir à tous", "salutation"], ["Hello", "salutation"], ["hi there", "salutation"], ["Good morning, how are you?", "salutation"],
    ["Que sais-tu faire ?", "aide"], ["What can you do?", "aide"], ["aide", "aide"], ["Qui es-tu ?", "aide"],
    ["Merci beaucoup !", "remerciement"], ["thank you", "remerciement"],
    ["Au revoir", "au-revoir"], ["À bientôt", "au-revoir"], ["bye", "au-revoir"]
  ]) assert.equal(intentionConversation(message), intention, message);
});

test("un message qui contient une vraie question n'est pas pris pour une politesse", () => {
  for (const message of ["bonjour, c'est quoi le sinus ?", "salut je veux apprendre les fractions", "merci pour Pythagore", "", "aide-moi en maths", "hello world"]) {
    assert.equal(intentionConversation(message), null, message);
  }
});
