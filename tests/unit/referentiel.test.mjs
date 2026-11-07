import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCatalogue, lireReferentiel, indicateurReferentiel, NIVEAUX_SCOLAIRES } from "../../scripts/lib/catalogue.mjs";

// Référentiel des notions (feuille de route, phase 1 ; issue #179) : champs facultatifs de fiche.md.
const racine = new URL("../..", import.meta.url).pathname;
const valider = (champs) => lireReferentiel({ id: "fractions", ...champs });

test("référentiel : champs absents → rien, la fiche reste valide", () => {
  assert.deepEqual(valider({}), {});
});

test("référentiel : champs valides normalisés (listes YAML ou séparées par des virgules, durée en nombre)", () => {
  assert.deepEqual(valider({
    prerequis: ["nombres-decimaux"], competences: "comparer-des-fractions, simplifier-une-fraction",
    niveaux: "cycle-3, cycle-4", duree: "20"
  }), {
    prerequis: ["nombres-decimaux"], competences: ["comparer-des-fractions", "simplifier-une-fraction"],
    niveaux: ["cycle-3", "cycle-4"], duree: 20
  });
  assert.deepEqual(valider({ prerequis: [] }), { prerequis: [] }, "prerequis vide = renseigné, aucun prérequis");
  assert.deepEqual(NIVEAUX_SCOLAIRES, ["cycle-3", "cycle-4", "seconde", "premiere", "terminale"]);
});

test("référentiel : formats invalides refusés avec un message explicite", () => {
  const cas = [
    [{ prerequis: ["Nombres Décimaux"] }, /identifiant/],
    [{ prerequis: ["fractions"] }, /son propre prérequis/],
    [{ prerequis: ["a", "a"] }, /doublon/],
    [{ competences: [] }, /competences.*vide/],
    [{ competences: ["comparer_fractions"] }, /identifiant/],
    [{ niveaux: "college" }, /inconnu/],
    [{ niveaux: "cycle-4, cycle-3" }, /du plus jeune au plus avancé/],
    [{ niveaux: "seconde, seconde" }, /sans doublon/],
    [{ niveaux: [] }, /niveaux.*vide/],
    [{ duree: "20 min" }, /entier/],
    [{ duree: "0" }, /entre 1 et 240/],
    [{ duree: "241" }, /entre 1 et 240/]
  ];
  for (const [champs, message] of cas) assert.throws(() => valider(champs), message, JSON.stringify(champs));
});

test("référentiel : notions pilotes renseignées et indicateur des prérequis", async () => {
  const { index } = await chargerCatalogue([`${racine}catalogue`]);
  const parId = Object.fromEntries(index.maquettes.map((m) => [m.id, m]));
  for (const id of ["fractions", "nombres-decimaux", "proportionnalite", "pythagore"]) {
    const m = parId[id];
    assert.ok(Array.isArray(m.prerequis) && m.competences.length && m.niveaux.length && m.duree, `${id} incomplète`);
    for (const p of m.prerequis) assert.ok(parId[p], `${id} : prérequis inconnu ${p}`);
  }
  assert.deepEqual(parId.proportionnalite.prerequis, ["fractions", "nombres-decimaux"]);
  assert.equal(parId.echecs.prerequis, undefined, "les champs restent facultatifs");
  const indicateur = indicateurReferentiel(index.maquettes);
  assert.ok(indicateur.avecPrerequis >= 4 && indicateur.avecPrerequis <= indicateur.notions);
  assert.equal(indicateur.notions, index.maquettes.filter((m) => !m.sujet.startsWith("jeux/")).length, "les jeux ne sont pas des notions");
});
