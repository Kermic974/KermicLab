import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  appliquerCodesPrecis, appliquerRome, codesPrecis, completerCandidats, decoderRome, extraitCompact, ficheCompacte, formesIntitule,
  lireExtrait, MAX_PROCHES, reparerChaine
} from "../../scripts/lib/rome.mjs";
import { verifierMetiers } from "../../web/metiers.js";

// Import du ROME 4.0 de France Travail (chantier Métiers, ADR 0045). Fixtures de même structure que les fichiers
// « Toutes les données du ROME » (JSON) : unix_fiche_emploi_metier, unix_referentiel_code_rome, unix_referentiel_contexte_travail.
const groupe = (libelle, items) => ({ libelle, items });
const fiche = (code, intitule, { contextes = [], mobilites = [], coeur = [], autres = [], savoirs = [] } = {}) => ({
  numero: 1,
  rome: { code_rome: code, intitule, code_ogr: 1 },
  appellations: [],
  definition: "Texte long non repris.",
  acces_metier: "Texte long non repris.",
  competences: {
    savoir_faire: { enjeux: [groupe("Production", [...coeur.map((l, i) => ({ libelle: l, code_ogr: 100 + i, coeur_metier: "Principale" })), ...autres.map((l, i) => ({ libelle: l, code_ogr: 200 + i, coeur_metier: null }))])] },
    savoirs: { categories: [groupe("Domaines d'expertise", savoirs.map((l, i) => ({ libelle: l, code_ogr: 300 + i }))), groupe("Certifications et habilitations", [{ libelle: "CAP boulanger", code_ogr: 999 }])] }
  },
  contextes_travail: contextes,
  mobilites: mobilites.map((c, i) => ({ rome_cible: `${c} - Intitulé`, code_org_rome_cible: i, ordre_mobilite: mobilites.length - i }))
});
const brut = {
  fiches: [
    fiche("D1102", "Boulanger / Boulangère", {
      contextes: [groupe("Horaires et durée du travail", [{ libelle: "Travail de nuit", code_ogr: 23380 }]), groupe("Lieux et déplacements", [{ libelle: "Zone locale", code_ogr: 9 }])],
      mobilites: ["D1104", "D1103", "X99"], coeur: ["Pétrir une pâte"], autres: ["Accueillir un client"], savoirs: ["Hygiène alimentaire"]
    }),
    fiche("D1104", "Pâtissier / Pâtissière", { mobilites: ["D1102"], coeur: ["Monter une crème"] }),
    fiche("D1103", "Charcutier / Charcutière"),
    fiche("M1403", "Chargé / Chargée d'études socio-économiques", { mobilites: ["D1102"] }),
    fiche("M1419", "Data analyst"),
    fiche("F1703", "Maçon / Maçonne"),
    fiche("F1707", "Maçon / Maçonne du paysage")
  ],
  codes: [
    { code_rome: "D1102", code_rome_parent: "D1102", transition_eco: "Emploi Blanc", transition_num: "N" },
    { code_rome: "D1104", code_rome_parent: "D1104", transition_eco: "Emploi Vert", transition_num: "O" },
    { code_rome: "M1403", code_rome_parent: "M1403", transition_eco: "Emploi stratégique pour la Transition écologique" },
    { code_rome: "M1419", code_rome_parent: "M1403", transition_num: "O" },
    { code_rome: "F1703", code_rome_parent: "F1703" },
    { code_rome: "F1707", code_rome_parent: "F1703" }
  ],
  contextes: [{ code_ogr: 23380, libelle: "Travail de nuit", type_contexte: "Horaires et durée du travail" }]
};
const extrait = extraitCompact(brut, { version: "62", date: "2026-10-19", source: "fixture" });
const referentiel = {
  version: 2,
  source: "Fixture.",
  sources: [],
  categories: [{ id: "craft", libelle: "Artisanat", couleur: "#000000" }],
  disciplines: [{ id: "chimie", nom: "Chimie", savoirFaire: ["Dosage"], notions: [], correspondance: "v5" }],
  metiers: [
    { id: "boulanger", nom: "Boulanger", categorie: "craft", disciplines: ["chimie"], gestes: ["Pétrissage"], contexte: "Pain.", correspondance: "v5", rome: ["D1102"] },
    { id: "patissier", nom: "Pâtissier", categorie: "craft", disciplines: ["chimie"], gestes: ["Crème"], contexte: "Gâteaux.", correspondance: "v5", rome: ["D1104"] },
    { id: "data-analyst", nom: "Data Analyst", categorie: "craft", disciplines: ["chimie"], gestes: ["SQL"], contexte: "Données.", correspondance: "v5", rome: ["M1403"] },
    { id: "macon", nom: "Maçon", categorie: "craft", disciplines: ["chimie"], gestes: ["Mortier"], contexte: "Murs.", correspondance: "v5", rome: ["F1703"] },
    { id: "sans-code", nom: "Sans code", categorie: "craft", disciplines: ["chimie"], gestes: ["Geste"], contexte: "Rien.", correspondance: "v5" }
  ]
};

test("rome : décodage Latin-1 et réparation des chaînes UTF-8 lues en Latin-1", () => {
  assert.equal(reparerChaine("Macro-compÃ©tence"), "Macro-compétence");
  assert.equal(reparerChaine("Boulangère"), "Boulangère", "une chaîne correcte reste intacte");
  assert.equal(reparerChaine(42), 42);
  const octets = Buffer.from(JSON.stringify([{ a: "Pâtissière", b: "compÃ©tence" }]), "latin1");
  assert.deepEqual(decoderRome(octets), [{ a: "Pâtissière", b: "compétence" }]);
});

test("rome : fiche compacte, sans textes longs ni certifications, mobilités dans l'ordre du ROME", () => {
  const f = ficheCompacte(brut.fiches[0], brut.codes[0]);
  assert.deepEqual(f, {
    code: "D1102", intitule: "Boulanger / Boulangère", contextes: ["23380", "9"], competences: ["Pétrir une pâte"],
    savoirs: ["Hygiène alimentaire"], mobilites: ["D1103", "D1104"]
  });
  assert.deepEqual(ficheCompacte(brut.fiches[1], brut.codes[1]).transitions, ["ecologique", "numerique"]);
  assert.equal(ficheCompacte(brut.fiches[4], brut.codes[3]).parent, "M1403");
});

test("rome : extrait daté, contextes complétés par les groupes des fiches, format vérifié", () => {
  assert.equal(extrait.rome, "62");
  assert.match(extrait.licence, /Licence Ouverte 2\.0/);
  assert.deepEqual(extrait.fiches.map((f) => f.code), ["D1102", "D1103", "D1104", "F1703", "F1707", "M1403", "M1419"]);
  assert.deepEqual(extrait.contextes, [
    { id: "9", libelle: "Zone locale", type: "Lieux et déplacements" },
    { id: "23380", libelle: "Travail de nuit", type: "Horaires et durée du travail" }
  ]);
  assert.throws(() => lireExtrait({ format: "autre" }), /format d'extrait inattendu/);
});

test("rome : formes d'un intitulé, complément recopié après la forme masculine", () => {
  assert.deepEqual(formesIntitule("Maçon / Maçonne du paysage"), ["Maçon du paysage", "Maçonne du paysage"]);
  assert.deepEqual(formesIntitule("Greffier / Greffière"), ["Greffier", "Greffière"]);
  assert.deepEqual(formesIntitule("Data analyst"), ["Data analyst"]);
});

test("rome : code plus précis de la même famille, seulement sur l'intitulé exact", () => {
  const changements = codesPrecis(referentiel, extrait);
  assert.deepEqual(changements, [{ metier: "data-analyst", avant: "M1403", apres: "M1419" }], "le maçon n'est pas rattaché au maçon du paysage");
  const precise = appliquerCodesPrecis(referentiel, changements);
  assert.deepEqual(precise.metiers.find((m) => m.id === "data-analyst").rome, ["M1419"]);
  assert.deepEqual(codesPrecis(precise, extrait), [], "idempotent");
});

test("rome : enrichissement du référentiel (contextes, transitions, métiers proches) et source citée", () => {
  const { referentiel: r, rapport } = appliquerRome(referentiel, extrait);
  const boulanger = r.metiers.find((m) => m.id === "boulanger");
  assert.deepEqual(boulanger.contextes, ["9", "23380"]);
  assert.deepEqual(boulanger.proches, ["patissier"], "mobilités limitées aux métiers du référentiel");
  assert.equal(boulanger.transitions, undefined);
  assert.deepEqual(r.metiers.find((m) => m.id === "patissier").transitions, ["ecologique", "numerique"]);
  assert.deepEqual(r.metiers.find((m) => m.id === "data-analyst").proches, ["boulanger"]);
  assert.deepEqual(r.contextesTravail.map((c) => c.id), ["9", "23380"]);
  assert.deepEqual(rapport.sansRome, ["sans-code"]);
  assert.equal(rapport.rattaches, 4);
  assert.equal(r.sources.at(-1).producteur, "France Travail");
  assert.deepEqual(verifierMetiers(r, new Set()), [], "le référentiel enrichi reste cohérent");
  // Ré-appliquer remplace les champs dérivés sans doublon de source.
  const encore = appliquerRome(r, extrait).referentiel;
  assert.equal(encore.sources.length, 1);
  assert.deepEqual(encore.metiers, r.metiers);
  assert.ok(MAX_PROCHES >= 1);
});

test("rome : validation des champs dérivés dans le référentiel des métiers", () => {
  const { referentiel: r } = appliquerRome(referentiel, extrait);
  const fautif = structuredClone(r);
  fautif.metiers[0].contextes.push("404");
  fautif.metiers[0].transitions = ["spatiale"];
  fautif.metiers[0].proches = ["boulanger", "fantome"];
  const erreurs = verifierMetiers(fautif, new Set()).join(" | ");
  for (const motif of [/contexte de travail inconnu 404/, /transition inconnue spatiale/, /métier proche inconnu boulanger/, /métier proche inconnu fantome/]) assert.match(erreurs, motif);
});

test("rome : candidats des vagues complétés par les compétences et savoirs du ROME", () => {
  const [c, sans] = completerCandidats([{ slug: "boulanger", rome: ["D1102", "D1104"] }, { slug: "x", rome: ["Z0000"] }], extrait);
  assert.deepEqual(c.competencesRome, ["Pétrir une pâte", "Monter une crème"]);
  assert.deepEqual(c.savoirsRome, ["Hygiène alimentaire"]);
  assert.deepEqual(sans, { slug: "x", rome: ["Z0000"] });
});

test("rome : l'extrait versionné et le référentiel sont alignés", async () => {
  const lire = async (f) => JSON.parse(await readFile(new URL(`../../${f}`, import.meta.url), "utf8"));
  const [vrai, metiers] = await Promise.all([lire("referentiel/sources/france-travail/rome-4.0-v62.json"), lire("referentiel/metiers-v0.json")]);
  const { parCode } = lireExtrait(vrai);
  for (const m of metiers.metiers) for (const code of m.rome ?? []) assert.ok(parCode.has(code), `${m.id} : ${code} absent du ROME 4.0`);
  const { referentiel: recalcule } = appliquerRome(metiers, vrai);
  assert.deepEqual(recalcule.metiers, metiers.metiers, "champs dérivés à jour (npm run import:rome -- <extrait> --appliquer)");
  assert.deepEqual(recalcule.contextesTravail, metiers.contextesTravail);
});
