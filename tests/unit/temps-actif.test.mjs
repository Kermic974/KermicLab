import { test } from "node:test";
import assert from "node:assert/strict";
import { creerMoteurTemps, SEUIL_INACTIVITE_MS } from "../../web/temps-actif.js";

/** Horloge manuelle : les tests avancent le temps eux-mêmes (aucune attente réelle, résultat déterministe). */
function horloge(depart = 1_000_000) {
  let t = depart;
  return { maintenant: () => t, avancer: (ms) => { t += ms; } };
}
const S = 1000;
const MIN = 60 * S;

test("temps actif : rien n'est compté sans interaction", () => {
  const h = horloge();
  const m = creerMoteurTemps({ maintenant: h.maintenant });
  h.avancer(10 * MIN);
  assert.deepEqual(m.relever(), { total: 0, sections: {}, experiences: {} });
  assert.equal(m.actif, false);
});

test("temps actif : une interaction ouvre une fenêtre d'activité limitée au seuil documenté", () => {
  const h = horloge();
  const m = creerMoteurTemps({ maintenant: h.maintenant });
  assert.equal(SEUIL_INACTIVITE_MS, 60 * S);
  m.signal();
  h.avancer(30 * S);
  assert.equal(m.actif, true);
  assert.equal(m.relever().total, 30 * S);
  h.avancer(10 * MIN); // l'utilisateur est parti : seules les 30 s restantes de la fenêtre comptent
  assert.equal(m.actif, false);
  assert.equal(m.relever().total, 30 * S);
});

test("temps actif : des interactions régulières sont comptées en continu, sans double comptage", () => {
  const h = horloge();
  const m = creerMoteurTemps({ maintenant: h.maintenant });
  for (let i = 0; i < 20; i += 1) { m.signal(); h.avancer(20 * S); }
  // 20 intervalles de 20 s, tous couverts par une fenêtre active, comptés une seule fois chacun.
  assert.equal(m.relever().total, 400 * S);
  // Des relevés fréquents ne changent rien au total.
  const m2 = creerMoteurTemps({ maintenant: h.maintenant });
  let total = 0;
  for (let i = 0; i < 20; i += 1) { m2.signal(); h.avancer(20 * S); total += m2.relever().total; }
  assert.equal(total, 400 * S);
});

test("temps actif : une page cachée suspend le compte, qui ne reprend qu'à la prochaine interaction", () => {
  const h = horloge();
  const m = creerMoteurTemps({ maintenant: h.maintenant });
  m.signal();
  h.avancer(10 * S);
  m.visibilite(false);
  h.avancer(5 * MIN);
  assert.equal(m.actif, false);
  m.visibilite(true);
  h.avancer(20 * S); // visible mais sans interaction : rien
  assert.equal(m.relever().total, 10 * S);
  m.signal();
  h.avancer(15 * S);
  assert.equal(m.relever().total, 15 * S);
});

test("temps actif : une interaction alors que la page est cachée ne compte pas", () => {
  const h = horloge();
  const m = creerMoteurTemps({ maintenant: h.maintenant, visible: false });
  m.signal();
  h.avancer(30 * S);
  assert.equal(m.relever().total, 0);
});

test("temps actif : le temps est attribué au contexte (section et expérience) dans lequel il s'écoule", () => {
  const h = horloge();
  const m = creerMoteurTemps({ maintenant: h.maintenant });
  m.contexte({ section: "education" });
  m.signal();
  h.avancer(20 * S);
  m.contexte({ section: "jeux", experience: "jeu:demineur" });
  m.signal();
  h.avancer(30 * S);
  m.contexte({ section: "jeux" }); // fermeture de la bulle : l'expérience s'arrête, la section reste
  h.avancer(10 * S);
  const r = m.relever();
  assert.equal(r.total, 60 * S);
  assert.deepEqual(r.sections, { education: 20 * S, jeux: 40 * S });
  assert.deepEqual(r.experiences, { "jeu:demineur": 30 * S });
  assert.deepEqual(m.contexteCourant, { section: "jeux", experience: null });
  // Ventilation, jamais addition : la somme des sections ne dépasse pas le total.
  assert.ok(Object.values(r.sections).reduce((a, b) => a + b, 0) <= r.total);
});

test("temps actif : une horloge qui recule ne produit ni durée négative ni NaN", () => {
  const h = horloge();
  const m = creerMoteurTemps({ maintenant: h.maintenant });
  m.signal();
  h.avancer(-30 * S);
  const r = m.relever();
  assert.equal(r.total, 0);
  h.avancer(60 * S);
  assert.ok(Number.isFinite(m.relever().total));
});
