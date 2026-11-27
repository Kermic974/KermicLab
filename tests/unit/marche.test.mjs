import { test } from "node:test";
import assert from "node:assert/strict";
import { appliquerMarche, codesAInterroger, extraitCompact, lireExtrait, niveauTension, normaliserReponse } from "../../scripts/lib/marche.mjs";
import { verifierMetiers } from "../../web/metiers.js";

// API « Marché du travail » de France Travail (chantier Métiers, ADR 0044, lot 8). Réponses FACTICES, de la forme
// supposée dans scripts/lib/marche.mjs : à remplacer par une réponse réelle dès le premier import.
const valeur = (rome, nom, { territoire = ["NAT", "FR"], periode = "2026-T3", nomenclature = "PERSP_2" } = {}) => ({
  codeTypeTerritoire: territoire[0], codeTerritoire: territoire[1], codeTypeActivite: "ROME", codeActivite: rome,
  codeNomenclature: nomenclature, codeTypePeriode: "TRIMESTRE", codePeriode: periode, libPeriode: periode, valeurPrincipaleNom: nom
});
const reponse = {
  listeValeursParPeriode: [
    valeur("D1102", "Très élevée"),
    valeur("D1102", "Moyenne", { periode: "2026-T2" }),
    valeur("D1102", "Faible", { territoire: ["REG", "04"] }),
    valeur("M1419", "Faible"),
    valeur("M1419", "123", { nomenclature: "OFF_1" })
  ]
};

test("marché : tranches de tension lues depuis un libellé ou un nombre", () => {
  assert.equal(niveauTension("Très faible"), 1);
  assert.equal(niveauTension("très élevée"), 5);
  assert.equal(niveauTension("Tension moyenne"), 3);
  assert.equal(niveauTension(4), 4);
  assert.equal(niveauTension("4"), 4);
  assert.equal(niveauTension("énorme"), null);
  assert.equal(niveauTension(7), null);
});

test("marché : réponse normalisée, autres indicateurs ignorés, forme inconnue refusée", () => {
  const lignes = normaliserReponse(reponse);
  assert.equal(lignes.length, 4, "OFF_1 ignoré");
  assert.deepEqual(lignes[0], { rome: "D1102", territoire: "NAT:FR", indicateur: "PERSP_2", periode: "2026-T3", niveau: 5 });
  assert.throws(() => normaliserReponse({ resultats: [] }), /listeValeursParPeriode absent/);
  assert.throws(() => normaliserReponse({ listeValeursParPeriode: [{ ...valeur("D1102", "Haute") }] }), /tension « Haute »/);
  assert.throws(() => normaliserReponse({ listeValeursParPeriode: [{ ...valeur("D1102", "Faible"), codeTypeActivite: "FAP" }] }), /code ROME attendu/);
});

test("marché : extrait France, période la plus récente par code ROME", () => {
  const extrait = extraitCompact(normaliserReponse(reponse), { date: "2026-11-27", source: "factice" });
  assert.deepEqual(extrait.tensions, [{ rome: "D1102", periode: "2026-T3", tension: 5 }, { rome: "M1419", periode: "2026-T3", tension: 2 }]);
  assert.throws(() => lireExtrait({ format: "autre" }), /format d'extrait inattendu/);
});

test("marché : enrichissement du référentiel, tension la plus forte, source citée seulement avec des données", () => {
  const extrait = extraitCompact(normaliserReponse(reponse), { date: "2026-11-27", source: "factice" });
  const referentiel = {
    version: 2, source: "Fixture.", sources: [],
    categories: [{ id: "craft", libelle: "Artisanat", couleur: "#000000" }],
    disciplines: [{ id: "chimie", nom: "Chimie", savoirFaire: ["Dosage"], notions: [], correspondance: "v5" }],
    metiers: [
      { id: "boulanger", nom: "Boulanger", categorie: "craft", disciplines: ["chimie"], gestes: ["Pétrissage"], contexte: "Pain.", correspondance: "v5", rome: ["M1419", "D1102"] },
      { id: "autre", nom: "Autre", categorie: "craft", disciplines: ["chimie"], gestes: ["Geste"], contexte: "Rien.", correspondance: "v5", rome: ["A1101"] }
    ]
  };
  assert.deepEqual(codesAInterroger(referentiel), ["A1101", "D1102", "M1419"]);
  const { referentiel: r, rapport } = appliquerMarche(referentiel, extrait);
  assert.deepEqual(r.metiers[0].marche, { tension: 5, periode: "2026-T3" });
  assert.deepEqual(rapport, { rattaches: 1, sansDonnees: ["autre"] });
  assert.equal(r.sources.length, 1);
  assert.deepEqual(verifierMetiers(r, new Set()), []);
  const vide = appliquerMarche(r, extraitCompact([], { date: "2026-11-27", source: "vide" })).referentiel;
  assert.equal(vide.sources.length, 0, "pas de source citée sans donnée");
  assert.equal(vide.metiers[0].marche, undefined);
  const fautif = structuredClone(r);
  fautif.metiers[0].marche.tension = 9;
  assert.match(verifierMetiers(fautif, new Set()).join(" | "), /tension de recrutement hors de 1 à 5/);
});
