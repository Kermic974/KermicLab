import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { lireFrontMatter, lireReferentiel, NIVEAUX_SCOLAIRES } from "./fiche-catalogue.mjs";

const champs = ["prerequis", "niveaux", "competences"];
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const estObjet = v => v !== null && typeof v === "object" && !Array.isArray(v);
const erreur = message => new Error("Projection S4 : " + message);

function texteFiche(texte, valeurs) {
  const eol = texte.includes("\r\n") ? "\r\n" : "\n";
  const lignes = texte.split(eol);
  const fin = lignes.indexOf("---", 1);
  if (lignes[0] !== "---" || fin < 0) throw erreur("front matter absent.");
  const vus = new Set();
  for (let i = 1; i < fin; i++) {
    const champ = lignes[i]?.match(/^([\w-]+):/)?.[1];
    if (!champs.includes(champ)) continue;
    if (vus.has(champ)) throw erreur("champ généré dupliqué : " + champ);
    vus.add(champ);
    if (lignes[i].slice(champ.length + 1).trim() === "") {
      for (let j = i + 1; j < fin && !/^[\w-]+:/.test(lignes[j]); j++) {
        if (/^\s+-\s+/.test(lignes[j])) lignes[j] = null;
      }
      // Les commentaires et lignes vides sont conservés.
    }
  }
  const cellules = lignes.slice(1, fin).filter(l => l !== null && !champs.includes(l.match(/^([\w-]+):/)?.[1]));
  const generes = champs.filter(c => Object.hasOwn(valeurs, c)).map(c =>
    valeurs[c].length ? c + ": " + valeurs[c].join(", ") : c + ":");
  return [lignes[0], ...cellules, ...generes, ...lignes.slice(fin)].join(eol);
}

function ordonner(valeurs, ordre, champ, id) {
  const uniques = new Set(valeurs);
  if (ordre === undefined && uniques.size === 0) return undefined;
  if (!Array.isArray(ordre) || new Set(ordre).size !== ordre.length ||
      ordre.length !== uniques.size || ordre.some(v => !uniques.has(v))) {
    throw erreur(id + " : ordre " + champ + " manquant ou différent de la projection.");
  }
  return ordre;
}

function lireCorrespondances(table, objets, type, inverse = false) {
  const resultat = new Map();
  const noms = new Set();
  for (const [cle, valeur] of Object.entries(table)) {
    const [id, nom] = inverse ? [valeur, cle] : [cle, valeur];
    if (typeof nom !== "string" || nom.trim() !== nom || !slug.test(nom) || objets.get(id)?.type !== type ||
        resultat.has(id) || noms.has(nom)) {
      throw erreur("correspondance " + type + " absente ou ambiguë : " + cle);
    }
    resultat.set(id, nom);
    noms.add(nom);
  }
  return resultat;
}

export function projeterFiches(config, corpus) {
  if (!estObjet(config) || !estObjet(config.notions) || !estObjet(config.competences) || !estObjet(config.fiches)) {
    throw erreur("configuration invalide.");
  }
  const objets = new Map();
  for (const objet of corpus) {
    if (typeof objet?.id !== "string" || objets.has(objet.id)) throw erreur("objet sans ID ou ID dupliqué.");
    objets.set(objet.id, objet);
  }
  if (objets.get(config.curriculum)?.type !== "curriculum") throw erreur("curriculum de projection introuvable.");
  const notions = lireCorrespondances(config.notions, objets, "notion", true);
  const competences = lireCorrespondances(config.competences, objets, "microskill");
  const notionsParSlug = new Map([...notions].map(([id, nom]) => [nom, id]));
  const resultats = new Map();
  for (const [nom, ordres] of Object.entries(config.fiches)) {
    const id = notionsParSlug.get(nom);
    if (!id || !estObjet(ordres) || Object.keys(ordres).some(c => !["prerequis", "competences"].includes(c))) {
      throw erreur("fiche ou ordres de migration invalides : " + nom);
    }
    const pr = [], cp = [], niveaux = new Set();
    for (const o of corpus) {
      if (o.status === "deprecated") continue;
      if (o.source === id && (o.type === "requires" || o.type === "teaches")) {
        const noms = o.type === "requires" ? notions : competences;
        const cible = noms.get(o.target);
        if (!cible) throw erreur(id + " : aucune correspondance pour " + o.target);
        (o.type === "requires" ? pr : cp).push(cible);
      }
      if (o.type === "curriculum-mapping" && o.object === id && o.curriculum === config.curriculum) {
        const etape = objets.get(o.stage);
        if (etape?.type !== "stage" || etape.curriculum !== config.curriculum || !NIVEAUX_SCOLAIRES.includes(etape.code)) {
          throw erreur(id + " : étape incompatible " + o.stage);
        }
        niveaux.add(etape.code);
      }
    }
    const valeurs = {};
    for (const [champ, liste] of [["prerequis", pr], ["competences", cp]]) {
      const ordre = ordonner(liste, ordres[champ], champ, id);
      if (ordre !== undefined) valeurs[champ] = ordre;
    }
    if (niveaux.size) valeurs.niveaux = NIVEAUX_SCOLAIRES.filter(n => niveaux.has(n));
    resultats.set(nom, lireReferentiel({ id: nom, ...valeurs }));
  }
  return resultats;
}

async function lireJson(fichier) {
  return JSON.parse(await readFile(fichier, "utf8"));
}

function lireChamps(texte) {
  const meta = lireFrontMatter(texte);
  const champsV0 = Object.fromEntries(champs.filter(c => Object.hasOwn(meta, c)).map(c => [c, meta[c]]));
  return { id: meta.id, valeurs: lireReferentiel({ id: meta.id, ...champsV0 }) };
}

export async function synchroniserProjectionV0(racine, { ecrire = false } = {}) {
  let config;
  try { config = await lireJson(join(racine, "referentiel", "projection-v0.json")); }
  catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  const dossier = join(racine, "referentiel", "objets");
  const noms = await readdir(dossier, { recursive: true, withFileTypes: true });
  const corpus = await Promise.all(noms.filter(e => e.isFile() && e.name.endsWith(".json"))
    .map(e => join(e.parentPath, e.name)).sort().map(lireJson));
  const changements = [];
  for (const [nom, attendu] of projeterFiches(config, corpus)) {
    const fichier = join(racine, "catalogue", nom, "fiche.md");
    const texte = await readFile(fichier, "utf8");
    // Une fiche obsolète peut contenir des niveaux dans le mauvais ordre.
    const id = lireFrontMatter(texte).id;
    if (id !== nom) throw erreur("le slug de la fiche ne correspond pas à son ID : " + nom);
    let actuel;
    try { actuel = lireChamps(texte).valeurs; } catch { actuel = null; }
    const nouveau = texteFiche(texte, attendu);
    if (!isDeepStrictEqual(actuel, attendu)) {
      if (!isDeepStrictEqual(lireChamps(nouveau).valeurs, attendu)) throw erreur("écriture incohérente : " + nom);
      changements.push({ fichier, nouveau, nom });
    }
  }
  if (ecrire) for (const { fichier, nouveau } of changements) await writeFile(fichier, nouveau, "utf8");
  return changements.map(({ nom }) => "catalogue/" + nom + "/fiche.md");
}
