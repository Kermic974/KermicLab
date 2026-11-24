import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import { chaine, couvertureMetiers, disposerAnneaux, enrichirMetiers, filtrerMetiers, metiersDesAnneaux, preparerCarte, verifierMetiers } from "../../web/metiers.js";

// Espace Métiers (ADR 0041) : validation, enrichissement, filtres, chaîne d'une sélection, disposition en anneaux.
const source = {
  version: 2,
  source: "Fixture des tests.",
  categories: [{ id: "app", libelle: "Numérique", couleur: "#000000" }, { id: "craft", libelle: "Artisanat", couleur: "#111111" }],
  disciplines: [
    { id: "stats", nom: "Statistiques", savoirFaire: ["Régression"], notions: ["notion.maths.stats"], correspondance: "v5" },
    { id: "geo", nom: "Géométrie", savoirFaire: ["Volumes"], notions: ["notion.maths.volumes", "notion.maths.stats"], correspondance: "proposition" }
  ],
  metiers: [
    { id: "analyste", nom: "Data Analyst", categorie: "app", disciplines: ["stats"], gestes: ["Requêtage SQL", "Datavisualisation"], contexte: "Indicateurs.", correspondance: "v5", onisep: "MET.123", rome: ["M1403"], niveauAcces: "bac+5" },
    { id: "ebeniste", nom: "Ébéniste", categorie: "craft", disciplines: ["geo"], gestes: ["Lecture de plan"], contexte: "Mobilier.", correspondance: "validee", relue: "2026-11-24" }
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

test("métiers : statut des correspondances, identifiants ONISEP et ROME, niveau d'accès", () => {
  const connues = new Set(Object.values(projection.notions));
  const fautif = structuredClone(source);
  fautif.disciplines[0].correspondance = "devinee";
  fautif.metiers[1].relue = undefined;
  fautif.metiers[0].rome = ["M14"];
  fautif.metiers[0].niveauAcces = "bac+10";
  fautif.metiers.push({ ...structuredClone(source.metiers[0]), id: "autre", onisep: "MET.123" });
  fautif.metiers.push({ ...structuredClone(source.metiers[0]), id: "mal-forme", onisep: "123", rome: [] });
  const erreurs = verifierMetiers(fautif, connues).join(" | ");
  for (const motif of [/stats : correspondance inconnue/, /ebeniste : correspondance validée sans relecture/, /code ROME invalide M14/, /niveau d'accès inconnu bac\+10/, /autre : identifiant ONISEP déjà utilisé par analyste/, /mal-forme : identifiant ONISEP invalide 123/, /mal-forme : codes ROME attendus/]) assert.match(erreurs, motif);
  const sansStatut = structuredClone(source);
  delete sansStatut.metiers[0].correspondance;
  assert.match(verifierMetiers(sansStatut, connues).join(), /analyste : correspondance inconnue/, "le statut d'un métier est obligatoire");
  assert.match(verifierMetiers({ ...source, version: 1 }, connues).join(), /version inconnue/);
});

test("métiers : indicateurs de couverture, au total et par matière", () => {
  const c = couvertureMetiers(source, ["notion.maths.stats", "notion.maths.volumes", "notion.maths.aires", "notion.svt.cellule"]);
  assert.deepEqual({ metiers: c.metiers, onisep: c.avecOnisep, rome: c.avecRome, niveau: c.avecNiveau }, { metiers: 2, onisep: 1, rome: 1, niveau: 1 });
  assert.deepEqual(c.correspondances.metiers, { v5: 1, proposition: 0, validee: 1 });
  assert.deepEqual(c.correspondances.disciplines, { v5: 1, proposition: 1, validee: 0 });
  assert.deepEqual(c.notions, { reliees: 2, total: 4, parMatiere: { maths: { reliees: 2, total: 3 }, svt: { reliees: 0, total: 1 } } });
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
  const schema = JSON.parse(await readFile(new URL("../../referentiel/metiers.schema.json", import.meta.url), "utf8"));
  const valider = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.ok(valider(metiers), JSON.stringify(valider.errors));
  assert.ok(valider(source), JSON.stringify(valider.errors));
  assert.equal(valider({ ...source, metiers: [{ ...source.metiers[0], inconnu: 1 }] }), false, "propriété inattendue refusée");
});

test("métiers (lot 5) : filtre par niveau d'accès, recherche par synonyme, domaine et code ROME", () => {
  assert.deepEqual(filtrerMetiers(carte, { niveau: "bac+5" }).map((m) => m.id), ["analyste"]);
  assert.deepEqual(filtrerMetiers(carte, { niveau: "cap" }), [], "un métier sans niveau n'est retenu que sans filtre");
  assert.deepEqual(filtrerMetiers(carte, { recherche: "m1403" }).map((m) => m.id), ["analyste"]);
  const avecSynonymes = preparerCarte({ ...donnees, metiers: [{ ...donnees.metiers[1], synonymes: ["Menuisier en meubles"], domaines: ["Bois"] }] });
  assert.equal(filtrerMetiers(avecSynonymes, { recherche: "menuisier en meubles" }).length, 1);
  assert.equal(filtrerMetiers(avecSynonymes, { recherche: "bois" }).length, 1);
});

test("métiers (lot 5) : anneaux limités au filtre au-delà du seuil, disposition des seuls métiers placés", () => {
  assert.deepEqual(metiersDesAnneaux(carte, [donnees.metiers[0]], 10), { metiers: donnees.metiers, limites: false }, "sous le seuil : tous les métiers");
  assert.deepEqual(metiersDesAnneaux(carte, donnees.metiers, 1), { metiers: [donnees.metiers[0]], limites: true });
  assert.deepEqual(metiersDesAnneaux(carte, [donnees.metiers[1]], 1), { metiers: [donnees.metiers[1]], limites: false });
  const p = disposerAnneaux(carte, { metiers: [donnees.metiers[1]] });
  assert.deepEqual([...p.metier.keys()], ["ebeniste"]);
  assert.deepEqual([...p.geste.keys()], ["ebeniste::Lecture de plan"]);
  assert.equal(p.discipline.size, 2, "toutes les disciplines restent placées");
});
