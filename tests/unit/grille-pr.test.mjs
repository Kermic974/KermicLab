import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { lireGrille, notionsModifiees, verifierGrille, CRITERES, TITRE_SECTION } from "../../scripts/verifier-grille-pr.mjs";

// Grille de relecture dans les PR de notion (feuille de route, phase 5 ; issue #202).
const racine = new URL("../..", import.meta.url).pathname;
const modele = await readFile(`${racine}.github/pull_request_template.md`, "utf8");
const cocher = (texte) => texte.replace(/- \[ \]/g, "- [x]");
const fiche = (v) => `---\nid: x\nversion: ${v}\n---\n`;

test("modèle de PR : la section « Relecture pédagogique » porte les 7 critères, non cochés", () => {
  assert.match(modele, new RegExp(`^## ${TITRE_SECTION}$`, "m"));
  const grille = lireGrille(modele);
  assert.deepEqual(Object.keys(grille), CRITERES);
  assert.ok(Object.values(grille).every((c) => c === false));
  assert.ok(Object.values(lireGrille(cocher(modele))).every((c) => c === true));
});

test("notions concernées : contenu modifié, nouvelle notion ou version montée ; pas une page seulement régénérée", () => {
  const base = { "catalogue/a/fiche.md": fiche("1.0.0"), "catalogue/b/fiche.md": fiche("1.0.0"), "catalogue/c/fiche.md": fiche("1.0.0"), "catalogue/d/fiche.md": fiche("1.0.0") };
  const tete = { ...base, "catalogue/b/fiche.md": fiche("1.1.0"), "catalogue/n/fiche.md": fiche("1.0.0") };
  delete tete["catalogue/d/fiche.md"];
  const lire = (ref, chemin) => (ref === "base" ? base : tete)[chemin] ?? null;
  const modifies = ["catalogue/a/contenu.json", "catalogue/b/page.html", "catalogue/b/fiche.md", "catalogue/c/page.html", "catalogue/d/fiche.md", "catalogue/n/fiche.md", "web/app.js"];
  assert.deepEqual(notionsModifiees({ modifies, lire }), ["a", "b", "n"], "c : page régénérée par le build ; d : supprimée");
  assert.deepEqual(notionsModifiees({ modifies: ["gabarit/moteur.js", "catalogue/c/page.html"], lire }), []);
});

test("verdict : grille exigée seulement si une notion change, et alors entièrement cochée", () => {
  assert.equal(verifierGrille({ corps: "", notions: [] }).ok, true);
  const absente = verifierGrille({ corps: "## Résumé\nx", notions: ["pythagore"] });
  assert.equal(absente.ok, false);
  assert.match(absente.message, /absente/);
  const partielle = verifierGrille({ corps: modele.replace("- [ ] 1.", "- [x] 1.").replace("- [ ] 4.", "- [X] 4."), notions: ["pythagore"] });
  assert.equal(partielle.ok, false);
  assert.match(partielle.message, /Progression, Adaptation à l'âge, Neutralité et sources, Données personnelles, Aperçu/);
  assert.equal(verifierGrille({ corps: cocher(modele), notions: ["pythagore", "fractions"] }).ok, true);
  // Une case cochée dans un commentaire HTML ne compte pas.
  const cachee = modele.replace("## Relecture pédagogique", "## Relecture pédagogique\n<!-- - [x] 1. Exactitude -->");
  assert.equal(lireGrille(cachee)["Exactitude"], false);
});
