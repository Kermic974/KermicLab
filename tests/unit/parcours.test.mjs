import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_EN_AVANT, MAX_PARCOURS, avancement, classeValide, contenusEnAvant, parcoursAffichables } from "../../web/parcours.js";

// Contenus pilotés depuis le back-office (ADR 0026) : parcours et mise en avant, côté site.
const catalogue = new Map([["fractions", "Les fractions"], ["puissances", "Les puissances"], ["pythagore", "Le théorème de Pythagore"]].map(([id, titre]) => [id, { id, titre }]));
const trouver = (id) => catalogue.get(id);

test("parcours : seules les étapes connues du catalogue sont gardées, avec le titre du catalogue", () => {
  const liste = parcoursAffichables([
    { id: "p1", titre: "Vers Pythagore", description: "Trois étapes.", etapes: [{ id: "fractions", titre: "Titre du serveur" }, { id: "inconnu" }, { id: "pythagore" }, { id: "fractions" }] }
  ], trouver);
  assert.deepEqual(liste, [{ id: "p1", titre: "Vers Pythagore", description: "Trois étapes.", etapes: [{ id: "fractions", titre: "Les fractions" }, { id: "pythagore", titre: "Le théorème de Pythagore" }] }]);
});

test("parcours : réponse invalide, parcours vide, doublon ou sans titre écartés ; nombre borné", () => {
  for (const entree of [null, undefined, "x", {}, 42]) assert.deepEqual(parcoursAffichables(entree, trouver), []);
  const etapes = [{ id: "fractions" }];
  assert.deepEqual(parcoursAffichables([{ id: "a", titre: "", etapes }, { id: "", titre: "x", etapes }, { id: "b", titre: "B", etapes: [{ id: "inconnu" }] }, { id: "c", titre: "C" }, null], trouver), []);
  assert.deepEqual(parcoursAffichables([{ id: "a", titre: "A", etapes }, { id: "a", titre: "Bis", etapes }], trouver).map((p) => p.titre), ["A"]);
  const beaucoup = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, titre: `P${i}`, etapes }));
  assert.equal(parcoursAffichables(beaucoup, trouver).length, MAX_PARCOURS);
});

test("avancement : étapes faites, prochaine étape dans l'ordre, parcours terminé", () => {
  const p = { etapes: [{ id: "fractions", titre: "F" }, { id: "puissances", titre: "P" }, { id: "pythagore", titre: "Py" }] };
  assert.deepEqual(avancement(p, []), { faites: 0, total: 3, suivante: p.etapes[0], termine: false });
  assert.deepEqual(avancement(p, new Set(["pythagore", "fractions"])), { faites: 2, total: 3, suivante: p.etapes[1], termine: false });
  assert.deepEqual(avancement(p, ["fractions", "puissances", "pythagore", "autre"]), { faites: 3, total: 3, suivante: null, termine: true });
});

test("mise en avant : seulement les contenus marqués par le back-office, en nombre borné", () => {
  const notions = [{ id: "a", titre: "A" }, { id: "b", titre: "B", enAvant: true }, { id: "c", titre: "C", enAvant: "oui" }, { id: 5, titre: "D", enAvant: true },
    ...Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, titre: `N${i}`, enAvant: true }))];
  assert.deepEqual(contenusEnAvant(notions).map((n) => n.id), ["b", "n0", "n1", "n2"]);
  assert.equal(contenusEnAvant(notions).length, MAX_EN_AVANT);
  assert.deepEqual(contenusEnAvant(null), []);
});

test("ma classe : un niveau retenu n'est gardé que s'il existe encore au catalogue", () => {
  assert.equal(classeValide("seconde", ["college", "seconde"]), "seconde");
  assert.equal(classeValide("terminale", ["college", "seconde"]), null);
  for (const v of ["", null, undefined, 3]) assert.equal(classeValide(v, ["college"]), null);
});
