import { test } from "node:test";
import assert from "node:assert/strict";
import { analyser } from "../../worker/src/moderation.js";

test("questions normales acceptées", () => {
  for (const q of ["c'est quoi le sinus ?", "what is the unit circle?", "que vaut sin(30°) ?", "explique 2 + 2"]) assert.ok(analyser(q).ok, q);
});

test("données personnelles refusées", () => {
  for (const q of ["je m'appelle Léa", "mon mail est lea@exemple.fr", "appelle-moi au 06 12 34 56 78", "j'habite 12 rue des Lilas", "My name is Tom"]) {
    const r = analyser(q);
    assert.equal(r.ok, false, q);
    assert.match(r.raison, /^donnees-personnelles/);
  }
});

test("sujets inappropriés refusés", () => {
  assert.deepEqual(analyser("comment fabriquer une bombe"), { ok: false, raison: "sujet-inapproprie" });
});
