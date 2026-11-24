import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appliquerRattachements, lireInstantane, niveauDepuisLibelle, normaliserFiche, rapportImport, rapprocher, reconnaitreColonnes, slugMetier } from "../../scripts/lib/onisep.mjs";
import { verifierMetiers } from "../../web/metiers.js";

// Chantier Métiers, lot 2 : import déterministe d'un instantané ONISEP (fixture fictive, identifiants inventés).
const fixture = new URL("../fixtures/onisep/ideo-extrait.csv", import.meta.url);
const lignes = lireInstantane(await readFile(fixture, "utf8"), "csv");
const colonnes = reconnaitreColonnes(Object.keys(lignes[0]));
const fiches = lignes.map((l) => normaliserFiche(l, colonnes));
const referentiel = [
  { id: "infirmier", nom: "Infirmier", categorie: "health", disciplines: ["biologie"], gestes: ["Soins"], contexte: "", correspondance: "v5" },
  { id: "geometre-topographe", nom: "Géomètre-topographe", categorie: "disc", disciplines: ["geometrie"], gestes: ["Relevé"], contexte: "", correspondance: "v5", niveauAcces: "bac+3" }
];

test("onisep : CSV à point-virgule, colonnes reconnues par alias sans accents", () => {
  assert.equal(lignes.length, 7, "la ligne vide finale est ignorée");
  for (const champ of ["onisep", "nom", "synonymes", "rome", "niveau", "domaines", "lien"]) assert.ok(colonnes[champ], champ);
  assert.equal(colonnes.centresInteret, undefined);
  assert.deepEqual(lireInstantane('[{"fields":{"Identifiant":"MET.1"}}]', "json"), [{ Identifiant: "MET.1" }], "JSON de type open data (fields)");
});

test("onisep : normalisation des fiches (slug, ROME, niveau, listes)", () => {
  const chef = fiches.find((f) => f.onisep === "MET.1004");
  assert.equal(chef.slug, "chef-de-rayon");
  assert.deepEqual(chef.rome, ["D1502", "D1507"]);
  assert.equal(chef.niveauAcces, "bac");
  assert.deepEqual(chef.synonymes, ["Responsable de rayon", "Manager de rayon"]);
  assert.equal(fiches.find((f) => f.onisep === "MET.1003").niveauAcces, "cap");
  assert.equal(slugMetier("Infirmier/Infirmière"), "infirmier");
  assert.equal(slugMetier("Ingénieur(e) acousticien(ne)"), "ingenieur-acousticien");
  assert.equal(niveauDepuisLibelle("bac + 4"), undefined, "niveau hors liste");
  assert.equal(niveauDepuisLibelle("Bac+8"), "bac+8");
  assert.equal(niveauDepuisLibelle(""), undefined);
});

test("onisep : rapprochement, candidats, anomalies et application sans écrasement", () => {
  const r = rapprocher(fiches, referentiel);
  assert.deepEqual(r.rattachements.map((x) => [x.metier, x.onisep]), [["infirmier", "MET.1001"], ["geometre-topographe", "MET.1002"]]);
  assert.deepEqual(r.candidats.map((c) => c.slug), ["boulanger", "chef-de-rayon", "ingenieur-acousticien"]);
  assert.deepEqual(r.anomalies, [{ type: "incomplete", fiche: "Sans identifiant" }, { type: "doublon", fiche: "MET.1003" }]);
  const applique = appliquerRattachements({ version: 2, metiers: referentiel }, r.rattachements);
  assert.deepEqual(applique.metiers[0].rome, ["J1506"]);
  assert.equal(applique.metiers[1].niveauAcces, "bac+3", "valeur existante conservée");
  assert.equal(applique.metiers[1].onisep, "MET.1002");
  const rapport = rapportImport(r, colonnes);
  assert.equal(rapport.fiches, 5);
  assert.equal(rapport.sansRome, 1);
  assert.deepEqual(rapport.colonnesManquantes, ["centresInteret"]);
  assert.equal(rapport.parNiveau.cap, 1);
});

test("onisep : un métier déjà rattaché ne reçoit pas une autre fiche de même intitulé", () => {
  const r = rapprocher([{ ...fiches[0], onisep: "MET.9" }], [{ ...referentiel[0], onisep: "MET.1001" }]);
  assert.equal(r.rattachements.length, 0);
  assert.deepEqual(r.candidats.map((c) => c.slug), ["infirmier-9"], "slug rendu unique");
});

test("onisep : la commande produit le rapport et les candidats, codes de sortie", async () => {
  const exec = promisify(execFile);
  const dossier = await mkdtemp(join(tmpdir(), "onisep-"));
  const script = new URL("../../scripts/importer-onisep.mjs", import.meta.url).pathname;
  const { stdout } = await exec(process.execPath, [script, fixture.pathname, "--candidats", join(dossier, "c.json"), "--json"]);
  const rapport = JSON.parse(stdout);
  assert.deepEqual(rapport.rattachements.map((r) => r.metier), ["infirmier", "geometre-topographe"], "rattachés au référentiel réel par l'intitulé");
  assert.equal(rapport.candidats, 3);
  const candidats = JSON.parse(await readFile(join(dossier, "c.json"), "utf8")).candidats;
  assert.ok(candidats.every((c) => c.onisep && c.slug));
  await assert.rejects(exec(process.execPath, [script]), (e) => e.code === 2);
});

test("onisep : le référentiel réel reste valide après application (forme des champs importés)", async () => {
  const lire = async (f) => JSON.parse(await readFile(new URL(`../../referentiel/${f}`, import.meta.url), "utf8"));
  const [metiers, proj] = await Promise.all([lire("metiers-v0.json"), lire("projection-v0.json")]);
  const r = rapprocher(fiches, metiers.metiers);
  assert.deepEqual(verifierMetiers(appliquerRattachements(metiers, r.rattachements), new Set(Object.values(proj.notions))), []);
});
