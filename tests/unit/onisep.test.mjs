import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { appliquerRattachements, completerFiches, extraitCompact, fichesDeLExtrait, fusionnerFiches, lireInstantane, niveauDepuisLibelle, normaliserFiche, proposerDisciplines, rapportImport, rapprocher, reconnaitreColonnes, slugMetier, verifierRegles } from "../../scripts/lib/onisep.mjs";
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
  assert.equal(slugMetier("gardien/ne de police municipale"), "gardien-de-police-municipale", "écriture inclusive ONISEP");
  assert.equal(slugMetier("accompagnant / accompagnante d'élèves"), "accompagnant-d-eleves");
  assert.equal(slugMetier("moniteur/trice-éducateur/trice"), "moniteur-educateur", "trait d'union conservé");
  assert.equal(slugMetier("contrôleur / euse aérien/ne"), "controleur-aerien");
  assert.equal(slugMetier("Restaurateur d’œuvres d’art"), slugMetier("restaurateur/trice d'oeuvres d'art"));
  assert.equal(niveauDepuisLibelle("bac + 4"), "bac+4");
  assert.equal(niveauDepuisLibelle("bac + 9 et plus"), "bac+9");
  assert.equal(niveauDepuisLibelle("CAP ou équivalent + 1 an"), "cap");
  for (const l of ["3E", "sans diplôme", "diplôme national du brevet"]) assert.equal(niveauDepuisLibelle(l), "sans-diplome", l);
  assert.equal(niveauDepuisLibelle("autre formation"), undefined);
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
  assert.deepEqual(applique.metiers[0].synonymes, ["IDE"], "synonymes repris pour la recherche");
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
  const script = fileURLToPath(new URL("../../scripts/importer-onisep.mjs", import.meta.url));
  const { stdout } = await exec(process.execPath, [script, fileURLToPath(fixture), "--candidats", join(dossier, "c.json"), "--json"]);
  const rapport = JSON.parse(stdout);
  assert.equal(rapport.fiches, 5);
  assert.equal(rapport.rattachements.length + rapport.candidats, 5, "chaque fiche est rattachée ou candidate");
  const candidats = JSON.parse(await readFile(join(dossier, "c.json"), "utf8")).candidats;
  assert.ok(candidats.every((c) => c.onisep && c.slug));
  assert.deepEqual(candidats.find((c) => c.onisep === "MET.1004").disciplinesProposees, ["calcul-professionnel", "communication", "gestion"], "règles ROME appliquées aux candidats");
  await assert.rejects(exec(process.execPath, [script]), (e) => e.code === 2);
});

test("onisep : le référentiel réel reste valide après application (forme des champs importés)", async () => {
  const lire = async (f) => JSON.parse(await readFile(new URL(`../../referentiel/${f}`, import.meta.url), "utf8"));
  const [metiers, proj] = await Promise.all([lire("metiers-v0.json"), lire("projection-v0.json")]);
  const r = rapprocher(fiches, metiers.metiers);
  assert.deepEqual(verifierMetiers(appliquerRattachements(metiers, r.rattachements), new Set(Object.values(proj.notions))), []);
});

test("onisep : application, conflits signalés sans écraser la valeur du référentiel", () => {
  const r = rapprocher(fiches, referentiel);
  const { conflits } = appliquerRattachements({ version: 2, metiers: referentiel }, r.rattachements);
  assert.deepEqual(conflits, [{ metier: "geometre-topographe", champ: "niveauAcces", referentiel: "bac+3", onisep: "bac+2" }]);
});

test("règles ROME (lot 3) : préfixe le plus long, dédoublonnage, limite", () => {
  const regles = { maxDisciplines: 3, regles: [
    { prefixe: "J", disciplines: ["physiologie", "biologie", "chimie"] },
    { prefixe: "J13", disciplines: ["physiologie", "sport"] },
    { prefixe: "D", disciplines: ["calcul", "vente"] }
  ] };
  assert.deepEqual(proposerDisciplines(["J1301"], regles), ["physiologie", "sport"]);
  assert.deepEqual(proposerDisciplines(["J1506", "D1102"], regles), ["physiologie", "biologie", "chimie"], "limité à trois");
  assert.deepEqual(proposerDisciplines(["Z0000"], regles), []);
  assert.deepEqual(verifierRegles({ regles: [{ prefixe: "J1", disciplines: ["x"] }, { prefixe: "D", disciplines: [] }, { prefixe: "D", disciplines: ["y"] }] }, new Set(["y"])), [
    "préfixe ROME invalide : J1", "J1 : discipline inconnue x", "D : aucune discipline", "préfixe en double : D"
  ]);
});

test("règles ROME réelles : disciplines connues, chaque discipline du référentiel atteignable ou utilisée", async () => {
  const lire = async (f) => JSON.parse(await readFile(new URL(`../../referentiel/${f}`, import.meta.url), "utf8"));
  const [regles, metiers] = await Promise.all([lire("regles-metiers.json"), lire("metiers-v0.json")]);
  assert.deepEqual(verifierRegles(regles, new Set(metiers.disciplines.map((d) => d.id))), []);
  assert.deepEqual(proposerDisciplines(["F1602"], regles), ["calcul-professionnel", "geometrie", "science-des-materiaux"]);
  assert.deepEqual(proposerDisciplines(["G1602"], regles), ["nutrition-alimentation", "calcul-professionnel"]);
});

// Formats réels du jeu ouvert (data.gouv.fr, organisation ONISEP, ODbL) : fixtures fictives de même structure.
const xml = new URL("../fixtures/onisep/ideo-fiches-extrait.xml", import.meta.url);
const csvReel = new URL("../fixtures/onisep/ideo-metiers-extrait.csv", import.meta.url);
const fichesDe = async (url, format) => {
  const l = lireInstantane(await readFile(url, "utf8"), format);
  return fusionnerFiches(l.map((x) => normaliserFiche(x, reconnaitreColonnes(Object.keys(l[0])))));
};

test("onisep : XML Idéo-Fiches métiers (CDATA ignorés, synonymes et formes, entités, niveau)", async () => {
  const [phare, marin] = await fichesDe(xml, "xml");
  assert.equal(phare.onisep, "MET.2001");
  assert.equal(phare.slug, "gardien-de-phare");
  assert.deepEqual(phare.synonymes, ["veilleur/euse de côte", "gardien de phare", "gardienne de phare"]);
  assert.deepEqual(phare.rome, ["N3101"]);
  assert.equal(phare.niveauAcces, "sans-diplome");
  assert.deepEqual(phare.centresInteret, ["j'aime la mer & le vent"]);
  assert.equal(marin.nom, "marin/e", "le <metier> d'un texte CDATA et les métiers associés ne créent pas de fiche");
  assert.equal(marin.niveauAcces, "bac+9");
});

test("onisep : CSV Idéo-Métiers Onisep (identifiant lu dans le lien, lignes par publication fusionnées), complément", async () => {
  const csv = await fichesDe(csvReel, "csv");
  assert.deepEqual(csv.map((f) => [f.onisep, f.rome, f.domaines]), [
    ["MET.2001", ["N3101", "N3102"], ["transport/maritime", "environnement/littoral"]],
    ["MET.2002", ["N3103"], ["transport/maritime"]]
  ]);
  const completes = completerFiches(await fichesDe(xml, "xml"), csv);
  assert.deepEqual(completes[0].domaines, ["transport/maritime", "environnement/littoral"]);
  assert.deepEqual(completes[0].rome, ["N3101"], "les codes ROME du XML priment");
  assert.deepEqual(completes[1].rome, ["N3103"], "complétés quand le XML n'en a pas");
  assert.match(completes[1].lien, /MET\.2002$/);
});

test("onisep : extrait compact (licence, attribution, champs utilisés) et relecture", async () => {
  const fiches = completerFiches(await fichesDe(xml, "xml"), await fichesDe(csvReel, "csv"));
  const extrait = extraitCompact(fiches, { source: "test", date: "2026-11-24" });
  assert.match(extrait.licence, /ODbL/);
  assert.match(extrait.attribution, /Onisep/);
  assert.equal(Object.hasOwn(extrait.fiches[0], "centresInteret"), false, "seuls les champs utilisés sont gardés");
  assert.deepEqual(fichesDeLExtrait(JSON.parse(JSON.stringify(extrait))).map((f) => f.slug), ["gardien-de-phare", "marin"]);
  assert.throws(() => fichesDeLExtrait({ fiches: [] }), /extrait ONISEP inconnu/);
});

test("onisep : rapprochement en trois passes, un seul rattachement par métier, remplacement des propositions", () => {
  const fiches = [
    { onisep: "MET.1", nom: "aide/e de cuisine", synonymes: ["cuisinier"], rome: [], domaines: [], centresInteret: [], slug: "aide-de-cuisine" },
    { onisep: "MET.2", nom: "cuisinier/ère", synonymes: [], rome: ["G1602"], domaines: [], centresInteret: [], slug: "cuisinier", niveauAcces: "cap" }
  ];
  const metiersTest = [{ id: "cuisinier", nom: "Cuisinier", correspondance: "proposition", niveauAcces: "bac" }];
  const r = rapprocher(fiches, metiersTest);
  assert.deepEqual(r.rattachements.map((x) => [x.metier, x.onisep]), [["cuisinier", "MET.2"]], "l'intitulé exact l'emporte sur un synonyme");
  assert.deepEqual(r.candidats.map((c) => c.onisep), ["MET.1"]);
  const garde = appliquerRattachements({ metiers: metiersTest }, r.rattachements);
  assert.equal(garde.metiers[0].niveauAcces, "bac");
  assert.equal(garde.conflits.length, 1);
  const remplace = appliquerRattachements({ metiers: metiersTest }, r.rattachements, { remplacerPropositions: true });
  assert.equal(remplace.metiers[0].niveauAcces, "cap");
  assert.equal(remplace.conflits.length, 0);
  const valide = appliquerRattachements({ metiers: [{ ...metiersTest[0], correspondance: "validee" }] }, r.rattachements, { remplacerPropositions: true });
  assert.equal(valide.metiers[0].niveauAcces, "bac", "une fiche validée n'est jamais écrasée");
});

test("onisep : l'extrait versionné est cohérent avec le référentiel (identifiants existants, attribution)", async () => {
  const lire = async (f) => JSON.parse(await readFile(new URL(`../../referentiel/${f}`, import.meta.url), "utf8"));
  const [extrait, metiers] = await Promise.all([lire("sources/onisep/ideo-metiers-2026-11-24.json"), lire("metiers-v0.json")]);
  assert.equal(extrait.format, "kermiclab-onisep-extrait");
  assert.match(extrait.licence, /ODbL/);
  const ids = new Set(extrait.fiches.map((f) => f.onisep));
  assert.ok(ids.size > 1000, "plus de 1 000 fiches métiers");
  const inconnus = metiers.metiers.filter((m) => m.onisep && !ids.has(m.onisep)).map((m) => m.id);
  assert.deepEqual(inconnus, [], "chaque identifiant ONISEP du référentiel existe dans l'extrait");
  assert.ok(metiers.sources.some((s) => /ODbL/.test(s.licence) && s.producteur === "Onisep"), "attribution de la source");
});
