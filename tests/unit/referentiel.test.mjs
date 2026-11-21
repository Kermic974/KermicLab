import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCatalogue, lireReferentiel, indicateurReferentiel, NIVEAUX_SCOLAIRES } from "../../scripts/lib/catalogue.mjs";

// Référentiel des notions (feuille de route, phase 1 ; issue #179) : champs facultatifs de fiche.md.
const racine = fileURLToPath(new URL("../..", import.meta.url));
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
  assert.deepEqual(NIVEAUX_SCOLAIRES, ["cycle-2", "cycle-3", "cycle-4", "seconde", "premiere", "terminale"]);
});

test("référentiel : classes du primaire (CP à CM2), cycles 2 et 3", () => {
  assert.deepEqual(valider({ niveau: "primaire", niveaux: "cycle-2", classes: "CP, CE1, CE2" }), { niveaux: ["cycle-2"], classes: ["CP", "CE1", "CE2"] });
  assert.throws(() => valider({ niveau: "primaire", niveaux: "cycle-3", classes: "CE2" }), /cycle-2/);
  assert.deepEqual(valider({ niveau: "primaire", niveaux: "cycle-3", classes: "CM1, CM2" }), { niveaux: ["cycle-3"], classes: ["CM1", "CM2"] });
  assert.deepEqual(valider({ niveau: "primaire", classes: ["CM2"] }), { classes: ["CM2"] });
  for (const [fiche, attendu] of [
    [{ niveau: "primaire", classes: "6e" }, /inconnue/],
    [{ niveau: "primaire", classes: "CM2, CM1" }, /du CP au CM2/],
    [{ niveau: "primaire", niveaux: "cycle-4", classes: "CM1" }, /cycle-3/],
    [{ niveau: "college", classes: "CM2" }, /inconnue/]
  ]) assert.throws(() => valider(fiche), attendu);
});

test("référentiel : classes du collège (6e à 3e), cohérentes avec le niveau et les cycles", () => {
  assert.deepEqual(valider({ niveau: "college", niveaux: "cycle-3, cycle-4", classes: "6e, 5e" }), { niveaux: ["cycle-3", "cycle-4"], classes: ["6e", "5e"] });
  assert.deepEqual(valider({ niveau: "college", classes: ["4e"] }), { classes: ["4e"] }, "sans niveaux : seule la liste est contrôlée");
  const cas = [
    [{ niveau: "college", classes: [] }, /classes.*vide/],
    [{ niveau: "seconde", classes: "3e" }, /réservé.*college/],
    [{ niveau: "college", classes: "CM2" }, /inconnue/],
    [{ niveau: "college", classes: "4e, 5e" }, /de la 6e à la 3e/],
    [{ niveau: "college", classes: "5e, 5e" }, /sans doublon/],
    [{ niveau: "college", niveaux: "cycle-4", classes: "6e" }, /cycle-3/],
    [{ niveau: "college", niveaux: "cycle-3", classes: "6e, 5e" }, /cycle-4/]
  ];
  for (const [champs, motif] of cas) assert.throws(() => valider(champs), motif, JSON.stringify(champs));
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
