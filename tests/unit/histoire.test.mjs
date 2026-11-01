import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validerContenu } from "../../scripts/lib/gabarit.mjs";
import { lireFrontMatter, lireMetaHtml } from "../../scripts/lib/catalogue.mjs";
import { routerLocal } from "../../worker/src/router.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";

const IDS = ["antiquite", "moyen-age", "renaissance", "temps-modernes", "lumieres", "revolution-francaise", "napoleon", "revolution-industrielle"];
const lire = (id, fichier) => readFile(new URL(`../../catalogue/${id}/${fichier}`, import.meta.url), "utf8");

for (const id of IDS) {
  test(`histoire : ${id} couvre intuition, collège, lycée et un défi QCM`, async () => {
    const fiche = lireFrontMatter(await lire(id, "fiche.md"));
    const contenu = JSON.parse(await lire(id, "contenu.json"));
    assert.equal(fiche.id, id);
    assert.equal(fiche.sujet, `histoire/${id}`);
    assert.equal(fiche.niveau, "college");
    assert.doesNotThrow(() => validerContenu(contenu, id));
    assert.equal(contenu.niveaux.length, 3);
    assert.equal(contenu.niveaux[0].niveau, "pour démarrer");
    assert.match(contenu.niveaux[1].niveau, /6e|5e|4e/);
    assert.equal(contenu.niveaux[2].niveau, "seconde");
    for (const niveau of contenu.niveaux) {
      assert.ok(niveau.exemple.etapes.length >= 2, `${id} : exemple concret`);
      assert.ok(niveau.aRetenir.trim(), `${id} : à retenir`);
    }
    assert.equal(contenu.application.exercices.length, 5);
    assert.equal(contenu.situation.etapes.length, 3);
    assert.ok(contenu.application.exercices.some((ex) => /Date|Période/.test(ex.titre)));
    assert.ok(contenu.application.exercices.some((ex) => /Personnage/.test(ex.titre)));
    assert.ok(contenu.application.exercices.some((ex) => /Cause|Conséquence|conséquence/.test(ex.titre)));
    for (const ex of [...contenu.application.exercices, ...contenu.situation.etapes]) {
      assert.equal(ex.type, "qcm");
      assert.equal(new Set(ex.choix).size, ex.choix.length, `${id} : choix distincts`);
      assert.ok(ex.explication.trim(), `${id} : correction expliquée`);
    }
    const meta = lireMetaHtml(await lire(id, "page.html"));
    assert.equal(meta.id, id);
    assert.equal(meta.sujet, fiche.sujet);
    assert.equal(meta.langue, "fr");
    assert.ok(CATALOGUE.index.maquettes.some((m) => m.id === id), `${id} : index du catalogue`);
  });
}

test("histoire : accents, tirets et notions voisines restent distincts au routage", () => {
  for (const [question, attendu] of [
    ["ANTIQUITÉ : Grèce et Rome", "antiquite"],
    ["Le Moyen-Âge", "moyen-age"],
    ["L'humanisme à la Renaissance", "renaissance"],
    ["Les Temps modernes et la monarchie absolue", "temps-modernes"],
    ["Le siècle des Lumières et la raison", "lumieres"],
    ["La lumière et le son", "son-et-lumiere"],
    ["Les conséquences de la Révolution française", "revolution-francaise"],
    ["Les conséquences de la révolution industrielle", "revolution-industrielle"],
    ["NAPOLÉON et le Code civil", "napoleon"]
  ]) assert.equal(routerLocal(question, CATALOGUE.index), attendu, question);
});
