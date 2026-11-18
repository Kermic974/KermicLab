import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { JEUX, classificationJeu } from "../../web/contrat-jeux.js";

test("Lot 1 : les neuf jeux, des axes indépendants et des références canoniques résolues", async () => {
  const projection = JSON.parse(await readFile(new URL("../../referentiel/projection-v0.json", import.meta.url), "utf8"));
  assert.equal(Object.keys(JEUX).length, 9);
  for (const [id, c] of Object.entries(JEUX)) {
    assert.match(await readFile(new URL(`../../catalogue/${id}/fiche.md`, import.meta.url), "utf8"), /sujet: jeux\//);
    assert.equal(c.statut, "review");
    assert.ok(c.famille && c.intention && c.interaction && c.restitution && c.difficulte);
    if (c.activites.includes("revision")) assert.equal(c.typesActivite.revision, "exercice");
    for (const cible of c.cibles) assert.equal(projection.notions[cible.notion], cible.id);
    assert.equal(classificationJeu(id).famille, c.famille);
  }
  assert.equal(classificationJeu("absent"), null);
  assert.ok((await readdir(new URL("../../catalogue", import.meta.url))).includes("2048"));
});

