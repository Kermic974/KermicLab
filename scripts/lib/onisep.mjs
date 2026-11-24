// Import des fiches métiers de l'ONISEP (chantier Métiers, lot 2, ADR 0042). Module pur et déterministe : il lit un
// instantané déjà téléchargé (CSV ou JSON du jeu ouvert « Idéo – Fiches métiers »), le normalise et le rapproche du
// référentiel `referentiel/metiers-v0.json`. Aucun appel réseau. Testé par tests/unit/onisep.test.mjs.
//
// Le format exact du jeu n'a pas encore pu être vérifié (sites inaccessibles depuis les sessions d'agents) : les
// colonnes sont reconnues par alias, sans accents ni casse. Un alias manquant se corrige dans COLONNES.

import { lireCsv } from "./csv.mjs";
import { NIVEAUX_ACCES } from "../../web/metiers.js";

export const COLONNES = Object.freeze({
  onisep: ["identifiant", "id", "code metier", "identifiant metier", "id metier"],
  nom: ["libelle metier", "nom metier", "libelle", "intitule", "nom", "metier"],
  synonymes: ["synonymes", "synonyme", "appellations", "autres appellations"],
  rome: ["codes rome", "code rome", "rome", "romes", "codes rome v4", "code rome v4"],
  niveau: ["niveau d acces min", "niveau d acces minimum", "niveau acces min", "niveau minimum", "niveau d acces"],
  domaines: ["domaine sous domaine", "domaines sous domaines", "domaines", "domaine"],
  centresInteret: ["centres d interet", "centre d interet", "centres interet"],
  lien: ["lien site onisep fr", "lien onisep", "url", "lien"]
});

export const sansAccents = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const normaliserEntete = (s) => sansAccents(s).replace(/[^a-z0-9]+/g, " ").trim();

/** Identifiant lisible d'un métier : « Infirmier/Infirmière » → « infirmier », « Chef(fe) de rayon » → « chef-de-rayon ». */
export function slugMetier(nom) {
  return sansAccents(String(nom ?? "").split("/")[0].replace(/\([^)]*\)/g, " "))
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Clé de comparaison d'un intitulé (sans accents, ponctuation ni forme féminine après « / »). */
export const cleIntitule = (nom) => slugMetier(nom).replace(/-/g, " ");

/** Niveau d'accès du référentiel à partir d'un libellé ONISEP (« bac + 2 », « CAP ou équivalent »…), sinon undefined. */
export function niveauDepuisLibelle(libelle) {
  const s = sansAccents(libelle);
  const plus = s.match(/bac\s*\+\s*(\d)/);
  if (plus) {
    const niveau = `bac+${plus[1]}`;
    return NIVEAUX_ACCES.includes(niveau) ? niveau : undefined;
  }
  if (/\b(cap|bep|infra|brevet|sans diplome)\b/.test(s)) return "cap";
  if (/\bbac\b|baccalaureat/.test(s)) return "bac";
  return undefined;
}

const liste = (valeur) => (Array.isArray(valeur) ? valeur : String(valeur ?? "").split(/\s*[|;\n]\s*/))
  .map((v) => String(v).trim()).filter(Boolean);

/** Lignes d'un instantané : tableau d'objets (JSON) ou CSV (séparateur `;` ou `,`, détecté sur l'en-tête). */
export function lireInstantane(texte, format) {
  const brut = String(texte).replace(/^﻿/, "");
  if (format === "json") {
    const donnees = JSON.parse(brut);
    const lignes = Array.isArray(donnees) ? donnees : donnees.metiers ?? donnees.records ?? donnees.data;
    if (!Array.isArray(lignes)) throw new Error("JSON : tableau de fiches attendu");
    return lignes.map((l) => l.fields ?? l);
  }
  const entete = brut.slice(0, brut.search(/\r?\n|$/));
  const separateur = (entete.match(/;/g) ?? []).length > (entete.match(/,/g) ?? []).length ? ";" : ",";
  const [colonnes, ...lignes] = lireCsv(brut, { separateur });
  if (!colonnes) return [];
  return lignes.filter((l) => l.some((c) => c.trim())).map((l) => Object.fromEntries(colonnes.map((c, i) => [c, l[i] ?? ""])));
}

/** Associe chaque champ du référentiel à la colonne de l'instantané qui le porte (première correspondance d'alias). */
export function reconnaitreColonnes(entetes, alias = COLONNES) {
  const parCle = new Map(entetes.map((e) => [normaliserEntete(e), e]));
  const trouve = {};
  for (const [champ, noms] of Object.entries(alias)) {
    const nom = noms.find((n) => parCle.has(n));
    if (nom) trouve[champ] = parCle.get(nom);
  }
  return trouve;
}

/** Fiche normalisée : { onisep, nom, slug, synonymes, rome, niveauAcces, domaines, centresInteret, lien }. */
export function normaliserFiche(ligne, colonnes) {
  const val = (champ) => (colonnes[champ] ? ligne[colonnes[champ]] : undefined);
  const identifiant = String(val("onisep") ?? "").trim();
  const numero = identifiant.match(/(?:MET\.)?(\d+)$/i);
  const rome = [...new Set(liste(val("rome")).flatMap((r) => String(r).toUpperCase().match(/\b[A-N]\d{4}\b/g) ?? []))].sort();
  const fiche = {
    onisep: numero ? `MET.${numero[1]}` : undefined,
    nom: String(val("nom") ?? "").trim(),
    synonymes: liste(val("synonymes")),
    rome,
    niveauAcces: niveauDepuisLibelle(val("niveau")),
    domaines: liste(val("domaines")),
    centresInteret: liste(val("centresInteret")),
    lien: String(val("lien") ?? "").trim() || undefined
  };
  fiche.slug = slugMetier(fiche.nom);
  return fiche;
}

/**
 * Rapproche les fiches de l'instantané des métiers du référentiel. Un métier est rattaché par son identifiant ONISEP,
 * sinon par son intitulé (ou un synonyme de la fiche). Retourne les rattachements, les candidats (fiches nouvelles,
 * slug rendu unique) et les anomalies (fiche sans identifiant ou sans intitulé, identifiant en double).
 */
export function rapprocher(fiches, metiers) {
  const parOnisep = new Map(metiers.filter((m) => m.onisep).map((m) => [m.onisep, m]));
  const parIntitule = new Map(metiers.map((m) => [cleIntitule(m.nom), m]));
  const vus = new Set();
  const slugs = new Set(metiers.map((m) => m.id));
  const rattachements = [], candidats = [], anomalies = [];
  for (const fiche of [...fiches].sort((a, b) => numero(a.onisep) - numero(b.onisep) || a.nom.localeCompare(b.nom, "fr"))) {
    if (!fiche.onisep || !fiche.nom) { anomalies.push({ type: "incomplete", fiche: fiche.onisep ?? fiche.nom }); continue; }
    if (vus.has(fiche.onisep)) { anomalies.push({ type: "doublon", fiche: fiche.onisep }); continue; }
    vus.add(fiche.onisep);
    const metier = parOnisep.get(fiche.onisep)
      ?? [fiche.nom, ...fiche.synonymes].map((n) => parIntitule.get(cleIntitule(n))).find((m) => m && (!m.onisep || m.onisep === fiche.onisep));
    if (metier) {
      rattachements.push({ metier: metier.id, ...fiche });
      continue;
    }
    let slug = fiche.slug || `metier-${numero(fiche.onisep)}`;
    if (slugs.has(slug)) slug = `${slug}-${numero(fiche.onisep)}`;
    slugs.add(slug);
    candidats.push({ ...fiche, slug });
  }
  return { rattachements, candidats, anomalies };
}

const numero = (id) => Number(String(id ?? "").replace(/\D/g, "")) || 0;

/**
 * Applique les rattachements au référentiel : ajoute onisep, rome, niveauAcces, domaines et synonymes sans écraser l'existant.
 * Les valeurs existantes qui diffèrent de la fiche ONISEP sont listées dans `conflits` (à trancher par une relecture).
 */
export function appliquerRattachements(donnees, rattachements) {
  const parId = new Map(rattachements.map((r) => [r.metier, r]));
  const conflits = [];
  return {
    conflits,
    ...donnees,
    metiers: donnees.metiers.map((m) => {
      const r = parId.get(m.id);
      if (!r) return m;
      if (m.niveauAcces && r.niveauAcces && m.niveauAcces !== r.niveauAcces) conflits.push({ metier: m.id, champ: "niveauAcces", referentiel: m.niveauAcces, onisep: r.niveauAcces });
      if (m.rome?.length && r.rome.length && m.rome.join() !== r.rome.join()) conflits.push({ metier: m.id, champ: "rome", referentiel: m.rome, onisep: r.rome });
      const ajout = {};
      if (!m.onisep) ajout.onisep = r.onisep;
      if (!m.rome?.length && r.rome.length) ajout.rome = r.rome;
      if (!m.niveauAcces && r.niveauAcces) ajout.niveauAcces = r.niveauAcces;
      if (!m.domaines?.length && r.domaines.length) ajout.domaines = r.domaines;
      const synonymes = r.synonymes.filter((x) => x !== m.nom);
      if (!m.synonymes?.length && synonymes.length) ajout.synonymes = [...new Set(synonymes)];
      return { ...m, ...ajout };
    })
  };
}

/**
 * Disciplines proposées pour des codes ROME (lot 3) : pour chaque code, la règle au préfixe le plus long ; disciplines
 * dédoublonnées dans l'ordre des codes puis des règles, limitées à `maxDisciplines`.
 */
export function proposerDisciplines(rome, { regles = [], maxDisciplines = 3 } = {}) {
  const triees = [...regles].sort((a, b) => b.prefixe.length - a.prefixe.length);
  const disciplines = [];
  for (const code of rome ?? []) {
    const regle = triees.find((r) => code.startsWith(r.prefixe));
    for (const d of regle?.disciplines ?? []) if (!disciplines.includes(d)) disciplines.push(d);
  }
  return disciplines.slice(0, maxDisciplines);
}

/** Erreurs des règles : préfixe ROME bien formé et unique, disciplines connues du référentiel. */
export function verifierRegles(regles, disciplinesConnues) {
  const erreurs = [];
  const vus = new Set();
  for (const r of regles?.regles ?? []) {
    if (!/^[A-N](\d{2}(\d{2})?)?$/.test(r.prefixe ?? "")) erreurs.push(`préfixe ROME invalide : ${r.prefixe}`);
    if (vus.has(r.prefixe)) erreurs.push(`préfixe en double : ${r.prefixe}`);
    vus.add(r.prefixe);
    if (!r.disciplines?.length) erreurs.push(`${r.prefixe} : aucune discipline`);
    for (const d of r.disciplines ?? []) if (!disciplinesConnues.has(d)) erreurs.push(`${r.prefixe} : discipline inconnue ${d}`);
  }
  return erreurs;
}

/** Rapport déterministe : volumes, rattachements, candidats par niveau d'accès et par domaine (premier niveau). */
export function rapportImport({ rattachements, candidats, anomalies }, colonnes) {
  const compter = (valeurs) => Object.fromEntries([...valeurs.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map())]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "fr")));
  const fiches = [...rattachements, ...candidats];
  return {
    colonnes,
    colonnesManquantes: Object.keys(COLONNES).filter((c) => !colonnes[c]),
    fiches: fiches.length,
    rattachements: rattachements.map((r) => ({ metier: r.metier, onisep: r.onisep })),
    candidats: candidats.length,
    anomalies,
    parNiveau: compter(fiches.map((f) => f.niveauAcces ?? "inconnu")),
    parDomaine: compter(fiches.map((f) => (f.domaines[0] ?? "inconnu").split(/\s*\/\s*/)[0])),
    sansRome: fiches.filter((f) => !f.rome.length).length
  };
}
