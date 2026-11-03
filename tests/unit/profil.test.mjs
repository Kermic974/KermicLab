import { test } from "node:test";
import assert from "node:assert/strict";
import * as Profil from "../../web/profil.js";

test("pseudo : accepte un surnom simple, nettoie les espaces", () => {
  assert.deepEqual(Profil.validerPseudo("  Élo  la   comète "), { ok: true, pseudo: "Élo la comète" });
  assert.deepEqual(Profil.validerPseudo("Max_92"), { ok: true, pseudo: "Max_92" });
});

test("pseudo : refuse trop court, trop long, caractères spéciaux et numéros", () => {
  assert.equal(Profil.validerPseudo("a").erreur, "court");
  assert.equal(Profil.validerPseudo("x".repeat(21)).erreur, "long");
  assert.equal(Profil.validerPseudo("moi@mail.fr").erreur, "caracteres");
  assert.equal(Profil.validerPseudo("<script>").erreur, "caracteres");
  assert.equal(Profil.validerPseudo("12345").erreur, "caracteres", "au moins une lettre");
  assert.equal(Profil.validerPseudo("Léa 0612345678").erreur, "chiffres");
});

test("cookie de mémorisation : sans donnée personnelle, lu et effacé", () => {
  const cookie = Profil.cookieMemoire();
  assert.match(cookie, /^kermiclab_memoire=1; Max-Age=31536000; Path=\/; SameSite=Strict; Secure$/);
  assert.doesNotMatch(Profil.cookieMemoire({ securise: false }), /Secure/);
  assert.equal(Profil.memoireActive("a=b; kermiclab_memoire=1"), true);
  assert.equal(Profil.memoireActive("kermiclab_memoire=0"), false);
  assert.equal(Profil.memoireActive(""), false);
  assert.match(Profil.cookieEffacement(), /^kermiclab_memoire=; Max-Age=0;/);
});

test("initiale de l'avatar", () => {
  assert.equal(Profil.initiale("élo"), "É");
  assert.equal(Profil.initiale(""), "?");
});
