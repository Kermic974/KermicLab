import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMAT, CHAMPS, TAILLE_MAX, exporter, lireFichier, appliquer, texteFichier, nomFichier } from "../../web/fichier-progression.js";
import * as progression from "../../web/progression.js";
import * as trophees from "../../web/trophees.js";
import * as evenements from "../../web/evenements.js";
import * as profil from "../../web/profil.js";

// Export et import de la progression en fichier (feuille de route, phase 2 ; issue #189), avec les vraies fonctions de
// chargement du tableau de bord comme normaliseurs (mêmes règles que dans web/app.js).
const zone = (cle, v) => ({ getItem: (k) => (k === cle ? JSON.stringify(v) : null), setItem: () => {} });
const estObjet = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const normaliser = {
  pseudo: (v) => { const r = typeof v === "string" ? profil.validerPseudo(v) : { ok: false }; return r.ok ? r.pseudo : null; },
  progression: (v) => (estObjet(v) ? progression.charger(zone(progression.CLE_STOCKAGE, v)) : null),
  trophees: (v) => (estObjet(v) ? trophees.charger(zone(trophees.CLE_STOCKAGE, v)) : null),
  evenements: (v) => (estObjet(v) && v.v === evenements.VERSION_CONTRAT ? evenements.charger(zone(evenements.CLE_STOCKAGE, v)) : null),
  cahiers: (v) => (Array.isArray(v) ? v : null)
};

/** Un appareil : un stockage en mémoire, avec une progression réaliste produite par les modules eux-mêmes. */
function appareil() {
  const memoire = new Map();
  return { memoire, lire: (champ) => memoire.get(champ) ?? null, ecrire: (champ, v) => memoire.set(champ, v), effacer: (champ) => memoire.delete(champ) };
}
function remplir(a) {
  let p = progression.etatInitial();
  p = progression.enregistrerQuestion(p, "2026-11-07").p;
  p = progression.enregistrerNotion(p, "pythagore", "2026-11-07").p;
  const ev = (evenement, extra = {}) => evenements.normaliserEvenement({ type: "kermiclab:evenement", v: 1, notion: "pythagore", version: "1.1.0", evenement, ...extra }, "pythagore");
  let e = evenements.etatInitial();
  for (const x of [ev("demarre"), ev("reponse", { exercice: "app-1", correct: true, essai: 1 }), ev("termine")]) {
    e = evenements.enregistrer(e, x, "2026-11-07", { planifier: () => ({ boite: 1, prochaine: "2026-11-08" }) });
  }
  a.ecrire("pseudo", "Inès");
  a.ecrire("progression", JSON.stringify(p));
  a.ecrire("trophees", JSON.stringify({ pythagore: { genre: "notions", etat: [1, 2], etoiles: 2, etoilesTotal: 6, badges: [] } }));
  a.ecrire("evenements", JSON.stringify(e));
  a.ecrire("cahiers", JSON.stringify([{ id: "c1", titre: "Mon cahier" }]));
}

test("fichier : aller-retour export → import sans perte, d'un appareil à l'autre", () => {
  const source = appareil();
  remplir(source);
  const contenu = exporter({ lire: source.lire, jour: "2026-11-08" });
  assert.equal(contenu.format, FORMAT);
  assert.equal(contenu.v, 1);
  assert.equal(contenu.cree, "2026-11-08");
  assert.deepEqual(Object.keys(contenu.donnees), CHAMPS, "tous les champs, dans l'ordre");
  assert.equal(nomFichier("2026-11-08"), "kermiclab-progression-2026-11-08.json");

  const lu = lireFichier(texteFichier(contenu), { normaliser });
  assert.equal(lu.ok, true, JSON.stringify(lu));
  const cible = appareil();
  cible.ecrire("pseudo", "Autre");
  cible.ecrire("cahiers", "[]");
  appliquer(lu.valeurs, cible);
  for (const champ of CHAMPS) {
    const avant = source.lire(champ), apres = cible.lire(champ);
    if (champ === "pseudo") assert.equal(apres, avant);
    else assert.deepEqual(JSON.parse(apres), JSON.parse(avant), champ);
  }
  // Le second export est identique au premier : rien ne s'est perdu ni ajouté.
  assert.deepEqual(exporter({ lire: cible.lire, jour: "2026-11-08" }), contenu);
});

test("fichier : un champ absent du fichier est effacé sur l'appareil (remplacement complet, sans mélange)", () => {
  const lu = lireFichier(texteFichier({ format: FORMAT, v: 1, cree: "2026-11-08", donnees: { pseudo: "Nina" } }), { normaliser });
  assert.equal(lu.ok, true);
  const cible = appareil();
  remplir(cible);
  appliquer(lu.valeurs, cible);
  assert.deepEqual([...cible.memoire.keys()], ["pseudo"]);
  assert.equal(cible.lire("pseudo"), "Nina");
});

test("fichier : tout fichier invalide est refusé proprement, avec une raison, sans rien écrire", () => {
  const valide = { format: FORMAT, v: 1, cree: "2026-11-08", donnees: { pseudo: "Nina" } };
  const cas = [
    [null, "taille"], ["x".repeat(TAILLE_MAX + 1), "taille"],
    ["{pas du json", "illisible"], ["[]", "format"], ["42", "format"],
    [JSON.stringify({ ...valide, format: "autre" }), "format"],
    [JSON.stringify({ ...valide, v: 0 }), "format"], [JSON.stringify({ ...valide, v: "1" }), "format"],
    [JSON.stringify({ ...valide, v: 2 }), "version"],
    [JSON.stringify({ ...valide, cree: "08/11/2026" }), "format"],
    [JSON.stringify({ ...valide, donnees: [] }), "format"],
    [JSON.stringify({ ...valide, donnees: { pseudo: "Nina", motDePasse: "x" } }), "champ"],
    [JSON.stringify({ ...valide, donnees: { pseudo: "06 12 34 56 78 90" } }), "champ"],
    [JSON.stringify({ ...valide, donnees: { progression: [] } }), "champ"],
    [JSON.stringify({ ...valide, donnees: { evenements: { v: 9, notions: {} } } }), "champ"],
    [JSON.stringify({ ...valide, donnees: { cahiers: {} } }), "champ"]
  ];
  for (const [texte, erreur] of cas) {
    const lu = lireFichier(texte, { normaliser });
    assert.equal(lu.ok, false, String(texte).slice(0, 60));
    assert.equal(lu.erreur, erreur, String(texte).slice(0, 60));
  }
  assert.equal(lireFichier(JSON.stringify({ ...valide, donnees: { pseudo: "Nina", motDePasse: "x" } }), { normaliser }).champ, "motDePasse");
});

test("fichier : les entrées invalides à l'intérieur d'un champ sont écartées par les fonctions de chargement", () => {
  const e = { v: 1, notions: { pythagore: { version: "1.1.0", ouvertures: 1, dernierJour: "2026-11-07", termine: false, exercices: {} },
    "Mauvais Id": { version: "1.1.0", ouvertures: 1, dernierJour: "2026-11-07", termine: false, exercices: {} } } };
  const lu = lireFichier(JSON.stringify({ format: FORMAT, v: 1, cree: "2026-11-08", donnees: { evenements: e } }), { normaliser });
  assert.equal(lu.ok, true);
  assert.deepEqual(Object.keys(lu.valeurs.evenements.notions), ["pythagore"]);
});
