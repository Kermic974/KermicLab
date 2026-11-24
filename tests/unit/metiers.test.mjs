import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chaine, disposerAnneaux, enrichirMetiers, filtrerMetiers, preparerCarte, verifierMetiers } from "../../web/metiers.js";

// Espace Métiers (ADR 0041) : validation, enrichissement, filtres, chaîne d'une sélection, disposition en anneaux.
const source = {
  version: 1,
  categories: [{ id: "app", libelle: "Numérique", couleur: "#000" }, { id: "craft", libelle: "Artisanat", couleur: "#111" }],
  disciplines: [
    { id: "stats", nom: "Statistiques", savoirFaire: ["Régression"], notions: ["notion.maths.stats"], correspondance: "v5" },
    { id: "geo", nom: "Géométrie", savoirFaire: ["Volumes"], notions: ["notion.maths.volumes", "notion.maths.stats"], correspondance: "proposition" }
  ],
  metiers: [
    { id: "analyste", nom: "Data Analyst", categorie: "app", disciplines: ["stats"], gestes: ["Requêtage SQL", "Datavisualisation"], contexte: "Indicateurs." },
    { id: "ebeniste", nom: "Ébéniste", categorie: "craft", disciplines: ["geo"], gestes: ["Lecture de plan"], contexte: "Mobilier." }
  ]
};
const projection = {
  notions: { stats: "notion.maths.stats", volumes: "notion.maths.volumes" },
  competences: { "microskill.maths.calculer-une-moyenne": "calculer-une-moyenne" },
  fiches: { stats: { competences: ["calculer-une-moyenne"] }, volumes: { competences: [] } }
};
const donnees = enrichirMetiers(source, projection, new Map([["stats", "Statistiques descriptives"]]));
const carte = preparerCarte(donnees);

test("métiers : validation des identifiants, catégories, disciplines et notions", () => {
  const connues = new Set(Object.values(projection.notions));
  assert.deepEqual(verifierMetiers(source, connues), []);
  const fautif = structuredClone(source);
  fautif.metiers[1].categorie = "inconnue";
  fautif.metiers[1].disciplines.push("absente");
  fautif.disciplines[0].notions.push("notion.maths.fantome");
  fautif.metiers.push({ ...fautif.metiers[0], gestes: [] });
  const erreurs = verifierMetiers(fautif, connues).join(" | ");
  for (const motif of [/catégorie inconnue/, /discipline inconnue absente/, /notion inconnue notion\.maths\.fantome/, /métier en double/, /aucun geste/]) assert.match(erreurs, motif);
});

test("métiers : enrichissement par les titres du catalogue et les MicroSkills réelles", () => {
  assert.deepEqual(donnees.notions["notion.maths.stats"], { slug: "stats", titre: "Statistiques descriptives", microskills: ["microskill.maths.calculer-une-moyenne"] });
  assert.equal(donnees.notions["notion.maths.volumes"].titre, "Volumes", "sans titre du catalogue : libellé du slug");
  assert.equal(Object.keys(donnees.notions).length, 2, "une notion citée deux fois n'est enrichie qu'une fois");
});

test("métiers : filtres par catégorie et recherche (sans accents, jusqu'aux notions)", () => {
  assert.equal(filtrerMetiers(carte).length, 2);
  assert.deepEqual(filtrerMetiers(carte, { categorie: "craft" }).map((m) => m.id), ["ebeniste"]);
  assert.deepEqual(filtrerMetiers(carte, { recherche: "ebeniste" }).map((m) => m.id), ["ebeniste"]);
  assert.deepEqual(filtrerMetiers(carte, { recherche: "sql" }).map((m) => m.id), ["analyste"]);
  assert.deepEqual(filtrerMetiers(carte, { recherche: "descriptives" }).map((m) => m.id).sort(), ["analyste", "ebeniste"], "par le titre d'une notion");
});

test("métiers : chaîne d'une sélection dans les deux sens", () => {
  const m = chaine(carte, { type: "metier", id: "analyste" });
  assert.deepEqual([...m.disciplines], ["stats"]);
  assert.deepEqual([...m.notions], ["notion.maths.stats"]);
  assert.equal(m.gestes.size, 2);
  const n = chaine(carte, { type: "notion", id: "notion.maths.stats" });
  assert.deepEqual([...n.metiers].sort(), ["analyste", "ebeniste"], "une notion mène aux métiers de toutes ses disciplines");
  assert.deepEqual([...n.notions], ["notion.maths.stats"]);
  const g = chaine(carte, { type: "geste", id: "analyste::Requêtage SQL" });
  assert.deepEqual([...g.gestes], ["analyste::Requêtage SQL"]);
  assert.deepEqual([...chaine(carte, { type: "discipline", id: "geo" }).metiers], ["ebeniste"]);
  assert.equal(chaine(carte, null, filtrerMetiers(carte, { categorie: "app" })).metiers.size, 1, "sans sélection : les métiers filtrés");
});

test("métiers : quatre anneaux, chaque élément placé une fois", () => {
  const p = disposerAnneaux(carte, { cx: 0, cy: 0, rayons: [10, 20, 30, 40] });
  assert.equal(p.metier.size, 2);
  assert.equal(p.discipline.size, 2);
  assert.equal(p.notion.size, 2);
  assert.equal(p.geste.size, 3);
  for (const [famille, r] of [["notion", 10], ["discipline", 20], ["metier", 30], ["geste", 40]]) {
    for (const { x, y } of p[famille].values()) assert.ok(Math.abs(Math.hypot(x, y) - r) < 1e-9, famille);
  }
});

test("métiers : le fichier du référentiel est cohérent avec la projection réelle", async () => {
  const lire = async (f) => JSON.parse(await readFile(new URL(`../../referentiel/${f}`, import.meta.url), "utf8"));
  const [metiers, proj] = await Promise.all([lire("metiers-v0.json"), lire("projection-v0.json")]);
  assert.deepEqual(verifierMetiers(metiers, new Set(Object.values(proj.notions))), []);
  const utilisees = new Set(metiers.metiers.flatMap((m) => m.disciplines));
  assert.deepEqual(metiers.disciplines.map((d) => d.id).filter((d) => !utilisees.has(d)), [], "aucune discipline orpheline");
});
