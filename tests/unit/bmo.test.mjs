import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deflateRawSync } from "node:zlib";
import { agregerBmo, appliquerBmo, extraitCompact, lireExtrait, lireFeuille, lireZip, paliers } from "../../scripts/lib/bmo.mjs";
import { verifierMetiers } from "../../web/metiers.js";

// Enquête BMO de France Travail (chantier Métiers, ADR 0045, lot 9) : lecture xlsx minimale, agrégation France,
// paliers, enrichissement du référentiel. Le classeur de test a la structure du fichier « Base open data BMO ».

/** Archive zip minimale : `fichiers` { nom: texte }, chaque entrée compressée (deflate) ou stockée. */
function zip(fichiers, { compresser = true } = {}) {
  const locaux = [], central = [];
  let decalage = 0;
  for (const [nom, texte] of Object.entries(fichiers)) {
    const brut = Buffer.from(texte, "utf8");
    const donnees = compresser ? deflateRawSync(brut) : brut;
    const n = Buffer.from(nom, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(compresser ? 8 : 0, 8);
    local.writeUInt32LE(donnees.length, 18); local.writeUInt32LE(brut.length, 22); local.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(compresser ? 8 : 0, 10);
    c.writeUInt32LE(donnees.length, 20); c.writeUInt32LE(brut.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(decalage, 42);
    locaux.push(local, n, donnees);
    central.push(c, n);
    decalage += 30 + n.length + donnees.length;
  }
  const taille = central.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(Object.keys(fichiers).length, 8); fin.writeUInt16LE(Object.keys(fichiers).length, 10);
  fin.writeUInt32LE(taille, 12); fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, ...central, fin]);
}

const entete = ["annee", "Code métier BMO", "Nom métier BMO", "Famille_met", "Lbl_fam_met", "REG", "NOM_REG", "Dept", "NomDept", "BE26", "NOMBE26", "clpe", "met", "xmet", "smet"];
const ligne = (code, nom, met, xmet, smet) => ["2026", code, nom, "S", "Services", "04", "La Réunion", "974", "La Réunion", "401", "Nord", "CLPE", met, xmet, smet];
const lignes = [
  entete,
  ligne("S0X42", "Boulangers, pâtissiers", "100", "60", "10"),
  ligne("S0X42", "Boulangers, pâtissiers", "50", "*", "5"),
  ligne("V2X92", "Vétérinaires", "8", "4", "0"),
  ligne("M2X90", "Ingénieurs & cadres <informatique>", "40", "20", "*"),
  ["", "Total", "", "", "", "", "", "", "", "", "", "", "198", "", ""]
];
/** Classeur xlsx : chaînes partagées, une feuille de description et la feuille de données (deuxième relation). */
function classeur() {
  const partagees = [...new Set(lignes.flat())];
  const echapper = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cellules = (l, r) => l.map((v, k) => `<c r="${String.fromCharCode(65 + k)}${r}" t="s"><v>${partagees.indexOf(v)}</v></c>`).join("");
  return zip({
    "xl/workbook.xml": `<workbook xmlns:r="r"><sheets><sheet name="Description_des_variables" sheetId="2" r:id="rId1"/><sheet name="BMO_2026_open_data" sheetId="1" r:id="rId2"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Type="w" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="w" Target="worksheets/sheet2.xml"/></Relationships>`,
    "xl/sharedStrings.xml": `<sst>${partagees.map((s) => `<si><t xml:space="preserve">${echapper(s)}</t></si>`).join("")}</sst>`,
    "xl/worksheets/sheet1.xml": `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Variables</t></is></c></row></sheetData></worksheet>`,
    "xl/worksheets/sheet2.xml": `<worksheet><sheetData>${lignes.map((l, i) => `<row r="${i + 1}">${cellules(l, i + 1)}</row>`).join("")}</sheetData></worksheet>`
  });
}

test("bmo : lecture zip (stockée et deflate) et feuille xlsx par son nom, entités XML décodées", () => {
  assert.equal(lireZip(zip({ "a.txt": "bonjour" }, { compresser: false })).get("a.txt").toString(), "bonjour");
  assert.equal(lireZip(zip({ "a.txt": "bonjour" })).get("a.txt").toString(), "bonjour");
  assert.throws(() => lireZip(Buffer.from("pas un zip")), /archive zip invalide/);
  const feuille = lireFeuille(classeur(), "BMO_2026_open_data");
  assert.deepEqual(feuille[0], entete);
  assert.equal(feuille[4][2], "Ingénieurs & cadres <informatique>");
  assert.throws(() => lireFeuille(classeur(), "Absente"), /feuille introuvable/);
});

test("bmo : totaux France par métier, valeurs masquées comptées et exclues, lignes hors code ignorées", () => {
  const { annee, metiers } = agregerBmo(lireFeuille(classeur(), "BMO_2026_open_data"));
  assert.equal(annee, 2026);
  assert.deepEqual(metiers.map((m) => [m.code, m.projets, m.difficiles, m.saisonniers, m.masquees]), [
    ["M2X90", 40, 20, 0, 1],
    ["S0X42", 150, 60, 15, 1],
    ["V2X92", 8, 4, 0, 0]
  ]);
  assert.throws(() => agregerBmo([["autre"], ["x"]]), /colonne BMO introuvable/);
});

test("bmo : paliers par tiers du nombre de projets", () => {
  const p = paliers([1, 2, 3, 4, 5, 6].map((n) => ({ code: `C${n}`, projets: n * 10 })));
  assert.deepEqual([...p.values()], ["faible", "faible", "moyen", "moyen", "fort", "fort"]);
});

test("bmo : perspectives des métiers rattachés, source citée, validation", () => {
  const extrait = extraitCompact(agregerBmo(lireFeuille(classeur(), "BMO_2026_open_data")), { date: "2026-04-21", source: "test" });
  assert.match(extrait.licence, /Licence Ouverte/);
  const referentiel = {
    version: 2, source: "Fixture.", sources: [],
    categories: [{ id: "craft", libelle: "Artisanat", couleur: "#000000" }],
    disciplines: [{ id: "chimie", nom: "Chimie", savoirFaire: ["Dosage"], notions: [], correspondance: "v5" }],
    metiers: [
      { id: "boulanger", nom: "Boulanger", categorie: "craft", disciplines: ["chimie"], gestes: ["Pétrissage"], contexte: "Pain.", correspondance: "v5", fap: "S0X42" },
      { id: "veto", nom: "Vétérinaire", categorie: "craft", disciplines: ["chimie"], gestes: ["Soin"], contexte: "Animaux.", correspondance: "v5", fap: "Z9Z99" },
      { id: "prof", nom: "Professeur", categorie: "craft", disciplines: ["chimie"], gestes: ["Cours"], contexte: "École.", correspondance: "v5" },
      { id: "dev", nom: "Développeur", categorie: "craft", disciplines: ["chimie"], gestes: ["Code"], contexte: "Logiciel.", correspondance: "v5", rome: ["M1855"] },
      { id: "gendarme", nom: "Gendarme", categorie: "craft", disciplines: ["chimie"], gestes: ["Patrouille"], contexte: "Sécurité.", correspondance: "v5", rome: ["K1706"] }
    ]
  };
  // Familles ROME → métiers BMO : M1855 a pour parent M1805 ; K1706 est hors champ (concours publics).
  const options = { familles: { M1805: "M2X90", K1706: null }, parentDe: (code) => ({ M1855: "M1805" })[code] ?? code };
  const { referentiel: r, rapport } = appliquerBmo(referentiel, extrait, options);
  assert.deepEqual(r.metiers[0].perspectives, { annee: 2026, groupe: "Boulangers, pâtissiers", projets: 150, partDifficile: 40, partSaisonnier: 10, palier: "fort", origine: "metier" });
  assert.equal(r.metiers[1].perspectives, undefined);
  assert.equal(r.metiers[3].perspectives.origine, "famille");
  assert.equal(r.metiers[3].perspectives.groupe, "Ingénieurs & cadres <informatique>");
  assert.equal(r.metiers[4].perspectives, undefined, "famille hors champ de l'enquête");
  assert.deepEqual(rapport, { rattaches: 2, parMetier: 1, parFamille: 1, horsChamp: ["gendarme"], sansFap: ["prof"], inconnus: ["veto:Z9Z99"] });
  assert.equal(r.sources.at(-1).nom, "Enquête Besoins en main-d'œuvre 2026");
  assert.equal(appliquerBmo(r, extrait, options).referentiel.sources.length, 1, "source non dupliquée");
  assert.deepEqual(verifierMetiers(r, new Set()), []);
  const fautif = structuredClone(r);
  fautif.metiers[0].fap = "boulanger";
  fautif.metiers[0].perspectives.palier = "enorme";
  fautif.metiers[2].perspectives = { ...r.metiers[0].perspectives };
  fautif.metiers[1].perspectives = { ...r.metiers[3].perspectives };
  const erreurs = verifierMetiers(fautif, new Set()).join(" | ");
  for (const motif of [/code BMO \(FAP\) invalide boulanger/, /palier de recrutement inconnu enorme/, /prof : perspectives sans code BMO/, /veto : perspectives par famille sans code ROME/]) assert.match(erreurs, motif);
});

test("bmo : l'extrait versionné et le référentiel sont alignés", async () => {
  const lire = async (f) => JSON.parse(await readFile(new URL(`../../${f}`, import.meta.url), "utf8"));
  const [vrai, metiers, regles, rome] = await Promise.all([lire("referentiel/sources/france-travail/bmo-2026.json"), lire("referentiel/metiers-v0.json"),
    lire("referentiel/regles-bmo.json"), lire("referentiel/sources/france-travail/rome-4.0-v62.json")]);
  const { parCode } = lireExtrait(vrai);
  for (const m of metiers.metiers) if (m.fap) assert.ok(parCode.has(m.fap), `${m.id} : ${m.fap} absent de la BMO`);
  for (const [famille, fap] of Object.entries(regles.familles)) assert.ok(fap === null || parCode.has(fap), `${famille} : ${fap} absent de la BMO`);
  const parents = new Map(rome.fiches.map((f) => [f.code, f.parent ?? f.code]));
  const options = { familles: regles.familles, parentDe: (code) => parents.get(code) ?? code };
  for (const m of metiers.metiers) if (!m.fap && m.rome?.length) assert.ok(parents.get(m.rome[0]) in regles.familles, `${m.id} : famille ${parents.get(m.rome[0])} absente de regles-bmo.json`);
  assert.deepEqual(appliquerBmo(metiers, vrai, options).referentiel.metiers, metiers.metiers, "perspectives à jour (npm run import:bmo -- <extrait> --appliquer)");
});

test("bmo : lecture xlsx en temps linéaire, même sur un fichier piégé (pas de retour arrière polynomial)", () => {
  const piege = "<sheet " + "name=\"x\" ".repeat(40000);
  const relations = "<Relationship " + "Id=\"r\" ".repeat(40000);
  const classeurPiege = zip({ "xl/workbook.xml": `<workbook>${piege}</workbook>`, "xl/_rels/workbook.xml.rels": relations, "xl/sharedStrings.xml": "<sst>" + "<si><t>".repeat(20000) });
  const debut = performance.now();
  assert.throws(() => lireFeuille(classeurPiege, "BMO_2026_open_data"), /feuille introuvable/);
  assert.ok(performance.now() - debut < 2000, "lecture bornée");
});
