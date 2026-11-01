import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { lireFrontMatter, lireMetaHtml } from "../../scripts/lib/catalogue.mjs";
import { validerContenu } from "../../scripts/lib/gabarit.mjs";
import { routerLocal } from "../../worker/src/router.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";

const NOTIONS = {
  mondialisation: { calculs: [60, 20], question: "Comment fonctionne une chaîne de valeur mondiale ?" },
  "mers-oceans": { calculs: [75, 1200], question: "Quel rôle jouent les mers et océans dans la mondialisation ?" },
  "union-europeenne": { calculs: [40, 75], question: "Quelle différence entre l'Union européenne et la zone euro ?" },
  "dynamiques-territoriales": { calculs: [10, 15], question: "Quelle différence entre métropolisation et périurbanisation ?" },
  "france-regions": { calculs: [18, 25], question: "Comment les régions de France sont-elles reliées au monde ?" },
  "espaces-productifs": { calculs: [50, 60], question: "Comment les espaces productifs sont-ils reliés au monde ?" },
  tourisme: { calculs: [12, 40], question: "Quelle différence entre un touriste et un excursionniste ?" },
  "afrique-australe": { calculs: [75, 2], question: "Comment le corridor de Maputo relie-t-il les territoires ?" }
};

const lire = (id, fichier) => readFile(new URL(`../../catalogue/${id}/${fichier}`, import.meta.url), "utf8");

for (const [id, attendu] of Object.entries(NOTIONS)) {
  test(`géographie : ${id}, contenu progressif, corrigés et page publiée`, async () => {
    const fiche = lireFrontMatter(await lire(id, "fiche.md"));
    const contenu = JSON.parse(await lire(id, "contenu.json"));
    validerContenu(contenu, id);
    assert.equal(fiche.id, id);
    assert.equal(fiche.sujet, `geographie/${id}`);
    assert.equal(fiche.langues, "fr");
    assert.equal(fiche.niveau, "college");
    assert.ok(contenu.niveaux.some((n) => /3e|4e/.test(n.niveau)), "un niveau collège");
    assert.ok(contenu.niveaux.some((n) => /première|terminale/.test(n.niveau)), "un approfondissement lycée");
    const exercices = [...contenu.application.exercices, ...contenu.situation.etapes];
    assert.deepEqual(exercices.filter((ex) => ex.type === "nombre").map((ex) => ex.reponse), attendu.calculs);
    for (const ex of exercices) {
      if (ex.type === "qcm") {
        assert.ok(ex.indice?.trim(), `${id} : indice du QCM`);
        assert.equal(new Set(ex.choix).size, ex.choix.length, "choix distincts");
      }
    }
    const index = CATALOGUE.index;
    assert.ok(index.maquettes.some((m) => m.id === id));
    for (const question of [attendu.question, ...fiche.questions]) {
      assert.equal(routerLocal(question, index), id, question);
      assert.equal(routerLocal(question.toUpperCase(), index), id, question);
    }
    const html = await lire(id, "page.html");
    assert.equal(CATALOGUE.pages[id].fr, html, "la page est servie telle quelle");
    const meta = lireMetaHtml(html);
    assert.equal(meta.id, id);
    assert.equal(meta.version, fiche.version);
    assert.equal(meta.sujet, fiche.sujet);
  });
}

test("géographie : les QCM distinguent les ensembles et les repères sensibles", async () => {
  const cas = [
    ["mers-oceans", "Les droits dans une ZEE", "L'État côtier y a des droits sur les ressources, avec maintien notamment de la liberté de navigation"],
    ["union-europeenne", "Europe ou UE ?", "L'UE regroupe une partie des pays européens"],
    ["union-europeenne", "La monnaie", "Les États de l'UE ayant adopté l'euro"],
    ["union-europeenne", "Une frontière", "Les deux ensembles ne sont pas identiques"],
    ["france-regions", "Un piège de localisation", "La Guyane"],
    ["tourisme", "Une visite à la journée", "un excursionniste"],
    ["afrique-australe", "Région ou État ?", "L'Afrique australe est une région et l'Afrique du Sud est un État"],
    ["afrique-australe", "Localiser Maputo", "Le Mozambique"]
  ];
  for (const [id, titre, reponse] of cas) {
    const contenu = JSON.parse(await lire(id, "contenu.json"));
    const ex = contenu.application.exercices.find((e) => e.titre === titre);
    assert.ok(ex, `${id} : ${titre}`);
    assert.equal(ex.choix[ex.bonne], reponse, `${id} : ${titre}`);
  }
});
