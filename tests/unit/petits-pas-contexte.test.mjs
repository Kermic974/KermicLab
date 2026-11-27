import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scriptsEnLigne } from "../../scripts/lib/catalogue.mjs";
import { choisirPetitPas, classerDecharge } from "../../Sample/lab/petits-pas-contexte.mjs";

test("choisit une action compatible avec le temps et l’énergie", () => {
  const taches = [
    { id: "courte", energy: 1, priorities: [], steps: [] },
    { id: "dossier", energy: 2, priorities: [], steps: [{ id: "ouvrir", text: "Ouvrir le dossier" }] },
    { id: "terminee", energy: 1, priorities: [], steps: [], done: true }
  ];
  assert.equal(choisirPetitPas(taches, { energie: 1, minutes: 2 }).minutes, 2);
  assert.equal(choisirPetitPas(taches, { energie: 2, minutes: 2 }).tache, "courte");
  const action = choisirPetitPas(taches, { energie: 2, minutes: 15 });
  assert.equal(action.tache, "dossier");
  assert.equal(action.etape, "ouvrir");
  assert.equal(action.minutes, 15);
  assert.equal(choisirPetitPas(taches, { energie: 1, minutes: 2, exclure: "courte" }), null);
  assert.equal(choisirPetitPas(taches, { energie: 4, minutes: 2 }), null);
  assert.equal(choisirPetitPas(taches, { energie: 1, minutes: 1 }), null);
});

test("classe les pensées, repère les doublons et n’invente aucune échéance", () => {
  assert.deepEqual(classerDecharge("  Faire le dossier\nIdée : ranger les papiers\nÉchéance : avant la réunion\nEst-ce prêt ?\nfaire   le dossier", ["Faire le dossier"]),
    [
      { titre: "Faire le dossier", categorie: "tâche", doublon: true },
      { titre: "ranger les papiers", categorie: "idée", doublon: false },
      { titre: "avant la réunion", categorie: "échéance", doublon: false },
      { titre: "Est-ce prêt ?", categorie: "préoccupation", doublon: false },
      { titre: "faire   le dossier", categorie: "tâche", doublon: true }
    ]);
});

test("le code contextuel testé est celui embarqué dans le labo", () => {
  const module = readFileSync(new URL("../../Sample/lab/petits-pas-contexte.mjs", import.meta.url), "utf8");
  const page = readFileSync(new URL("../../Sample/lab/remediation-tdah.html", import.meta.url), "utf8");
  assert.ok(scriptsEnLigne(page)[0].contenu.includes(module.replace(/^export /gm, "")));
});
