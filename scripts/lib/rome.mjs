// Import du ROME 4.0 de France Travail (chantier Métiers, ADR 0043) : fonctions pures, sans réseau ni accès disque,
// testées par tests/unit/rome.test.mjs. Le script scripts/importer-rome.mjs lit les fichiers et écrit les résultats.
//
// Source : « Toutes les données du ROME » (JSON, zip) publié par France Travail sur data.gouv.fr, Licence Ouverte 2.0
// (Etalab). Les fichiers sont encodés en Latin-1, avec quelques chaînes en UTF-8 lues comme du Latin-1 (« Ã© ») :
// `decoderRome` remet les deux au propre.

export const FORMAT_EXTRAIT = "kermiclab-rome-extrait";
export const VERSION_EXTRAIT = 1;
// Nombre maximal de métiers proches retenus pour un métier du référentiel (ordre de mobilité du ROME).
export const MAX_PROCHES = 5;
// Libellés de transition écologique du ROME retenus comme « métier de la transition écologique ».
const TRANSITION_ECOLOGIQUE = new Set(["Emploi Vert", "Emploi stratégique pour la Transition écologique"]);
const MOTIF_CODE = /^[A-N]\d{4}$/;

/** Chaîne mal décodée (UTF-8 lu comme Latin-1) remise en UTF-8 ; inchangée si elle ne l'est pas. */
export function reparerChaine(s) {
  if (typeof s !== "string" || !/[ÃÂâ][\u0080-¿]/.test(s)) return s;
  const repare = Buffer.from(s, "latin1").toString("utf8");
  return repare.includes("�") ? s : repare;
}

/** Contenu d'un fichier JSON du ROME (octets Latin-1) en objet, chaînes réparées. */
export function decoderRome(octets) {
  const texte = Buffer.isBuffer(octets) ? octets.toString("latin1") : String(octets);
  return JSON.parse(texte.replace(/^﻿/, ""), (_cle, valeur) => reparerChaine(valeur));
}

const unique = (liste) => [...new Set(liste)];
const items = (groupes) => (groupes ?? []).flatMap((g) => (g.items ?? []).map((i) => ({ ...i, groupe: g.libelle })));

/**
 * Fiche compacte d'un métier du ROME : code, intitulé, code parent, transitions, contextes de travail (codes),
 * compétences cœur de métier et savoirs (libellés courts), métiers de mobilité (codes, dans l'ordre du ROME).
 * Les textes longs (définition, accès au métier) ne sont pas repris.
 */
export function ficheCompacte(fiche, codeRome = {}) {
  const code = fiche.rome?.code_rome;
  const comp = fiche.competences ?? {};
  const savoirFaire = items(comp.savoir_faire?.enjeux);
  // Savoirs (connaissances), sans les certifications et habilitations : diplômes et titres restent du ressort de l'ONISEP.
  const savoirs = items(comp.savoirs?.categories).filter((i) => i.groupe !== "Certifications et habilitations");
  const transitions = [];
  if (TRANSITION_ECOLOGIQUE.has(codeRome.transition_eco)) transitions.push("ecologique");
  if (codeRome.transition_num === "O") transitions.push("numerique");
  return {
    code,
    intitule: fiche.rome?.intitule,
    ...(codeRome.code_rome_parent && codeRome.code_rome_parent !== code ? { parent: codeRome.code_rome_parent } : {}),
    ...(transitions.length ? { transitions } : {}),
    contextes: unique(items(fiche.contextes_travail).map((i) => String(i.code_ogr))).sort(),
    competences: unique(savoirFaire.filter((i) => i.coeur_metier === "Principale").map((i) => i.libelle)),
    savoirs: unique(savoirs.map((s) => s.libelle).filter(Boolean)),
    mobilites: unique((fiche.mobilites ?? [])
      .slice().sort((a, b) => (a.ordre_mobilite ?? 0) - (b.ordre_mobilite ?? 0))
      .map((m) => String(m.rome_cible ?? "").split(" ")[0])
      .filter((c) => MOTIF_CODE.test(c) && c !== code))
  };
}

/**
 * Extrait compact et versionné (une fiche par code ROME, dictionnaire des contextes de travail), à partir des fichiers
 * `unix_fiche_emploi_metier_*.json`, `unix_referentiel_code_rome_*.json` et `unix_referentiel_contexte_travail_*.json`.
 */
export function extraitCompact({ fiches, codes, contextes }, { version, date, source }) {
  const parCode = new Map((codes ?? []).map((c) => [c.code_rome, c]));
  const compactes = fiches.map((f) => ficheCompacte(f, parCode.get(f.rome?.code_rome))).filter((f) => MOTIF_CODE.test(f.code ?? ""));
  compactes.sort((a, b) => a.code.localeCompare(b.code));
  const utilises = new Set(compactes.flatMap((f) => f.contextes));
  // Libellés et types : le référentiel des contextes, complété par les groupes des fiches (contextes absents du référentiel).
  const dictionnaire = new Map((contextes ?? []).map((c) => [String(c.code_ogr), { libelle: c.libelle, type: c.type_contexte }]));
  for (const f of fiches) for (const i of items(f.contextes_travail)) {
    const id = String(i.code_ogr);
    if (!dictionnaire.has(id)) dictionnaire.set(id, { libelle: i.libelle, type: i.groupe });
  }
  return {
    format: FORMAT_EXTRAIT,
    version: VERSION_EXTRAIT,
    rome: String(version),
    date,
    source,
    licence: "Licence Ouverte 2.0 (Etalab), https://www.etalab.gouv.fr/licence-ouverte-open-licence/",
    attribution: "France Travail, « Répertoire opérationnel des métiers et des emplois (ROME 4.0) », data.gouv.fr",
    contextes: [...utilises].sort((a, b) => Number(a) - Number(b)).map((id) => ({ id, ...dictionnaire.get(id) })),
    fiches: compactes
  };
}

/** Extrait relu : vérifie son format et renvoie un accès par code ROME. */
export function lireExtrait(extrait) {
  if (extrait?.format !== FORMAT_EXTRAIT) throw new Error(`format d'extrait inattendu : ${extrait?.format}`);
  return { ...extrait, parCode: new Map(extrait.fiches.map((f) => [f.code, f])) };
}

/**
 * Formes d'un intitulé du ROME : « Maçon / Maçonne du paysage » → « Maçon du paysage », « Maçonne du paysage ». Le
 * complément n'est écrit qu'une fois, après la forme féminine : il est recopié après la forme masculine.
 */
export function formesIntitule(intitule) {
  const parties = String(intitule ?? "").split(" / ").map((p) => p.trim()).filter(Boolean);
  if (parties.length !== 2) return parties;
  const [masculin, feminin] = parties.map((p) => p.split(/\s+/));
  return [[...masculin, ...feminin.slice(masculin.length)].join(" "), parties[1]];
}

const normaliser = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, " ").trim();

/**
 * Codes ROME 4.0 plus précis : les codes venus de l'ONISEP sont ceux du ROME v3 (fiches « parents ») ; le ROME 4.0 les
 * a découpés. Un code est remplacé par une fiche de la même famille (même parent) dont l'intitulé, masculin ou
 * féminin, est exactement le nom du métier (sans accents ni casse). Renvoie `[{ metier, avant, apres }]`.
 */
export function codesPrecis(referentiel, extrait) {
  const { parCode } = lireExtrait(extrait);
  const famille = (code) => parCode.get(code)?.parent ?? code;
  const parIntitule = new Map();
  for (const f of extrait.fiches) for (const forme of formesIntitule(f.intitule)) {
    const cle = normaliser(forme);
    if (!parIntitule.has(cle)) parIntitule.set(cle, []);
    parIntitule.get(cle).push(f);
  }
  const changements = [];
  for (const m of referentiel.metiers) {
    if (!m.rome?.length) continue;
    const familles = new Set(m.rome.map(famille));
    const trouves = (parIntitule.get(normaliser(m.nom)) ?? []).filter((f) => familles.has(famille(f.code)) && !m.rome.includes(f.code));
    if (trouves.length !== 1) continue;
    const [precis] = trouves;
    const remplace = m.rome.find((c) => famille(c) === famille(precis.code));
    changements.push({ metier: m.id, avant: remplace, apres: precis.code });
  }
  return changements;
}

/** Applique `codesPrecis` : remplace chaque code par le code précis, à la même place. */
export function appliquerCodesPrecis(referentiel, changements) {
  const parMetier = new Map(changements.map((c) => [c.metier, c]));
  return {
    ...referentiel,
    metiers: referentiel.metiers.map((m) => {
      const c = parMetier.get(m.id);
      return c ? { ...m, rome: [...new Set(m.rome.map((code) => (code === c.avant ? c.apres : code)))] } : m;
    })
  };
}

/**
 * Enrichit le référentiel des métiers à partir de l'extrait (champs dérivés, recalculés à chaque import) :
 * `contextes` (codes des contextes de travail, union sur les codes ROME du métier), `transitions` et `proches`
 * (métiers du référentiel atteints par les mobilités du ROME, `MAX_PROCHES` au plus). À la racine,
 * `contextesTravail` ne garde que les contextes utilisés. Renvoie le référentiel enrichi et un rapport.
 */
export function appliquerRome(referentiel, extrait, { maxProches = MAX_PROCHES } = {}) {
  const { parCode } = lireExtrait(extrait);
  const metiersDeCode = new Map();
  for (const m of referentiel.metiers) for (const code of m.rome ?? []) {
    if (!metiersDeCode.has(code)) metiersDeCode.set(code, []);
    metiersDeCode.get(code).push(m.id);
  }
  const rapport = { rattaches: 0, absents: [], sansRome: [], avecContextes: 0, avecTransitions: 0, avecProches: 0 };
  const metiers = referentiel.metiers.map((m) => {
    const { contextes: _c, transitions: _t, proches: _p, ...reste } = m;
    if (!m.rome?.length) { rapport.sansRome.push(m.id); return reste; }
    const fiches = m.rome.map((code) => parCode.get(code)).filter(Boolean);
    for (const code of m.rome) if (!parCode.has(code)) rapport.absents.push(`${m.id}:${code}`);
    if (!fiches.length) return reste;
    rapport.rattaches += 1;
    const contextes = unique(fiches.flatMap((f) => f.contextes)).sort((a, b) => Number(a) - Number(b));
    const transitions = ["ecologique", "numerique"].filter((t) => fiches.some((f) => f.transitions?.includes(t)));
    const proches = unique(fiches.flatMap((f) => f.mobilites).flatMap((c) => metiersDeCode.get(c) ?? [])).filter((id) => id !== m.id).slice(0, maxProches);
    if (contextes.length) rapport.avecContextes += 1;
    if (transitions.length) rapport.avecTransitions += 1;
    if (proches.length) rapport.avecProches += 1;
    return { ...reste, ...(contextes.length ? { contextes } : {}), ...(transitions.length ? { transitions } : {}), ...(proches.length ? { proches } : {}) };
  });
  const utilises = new Set(metiers.flatMap((m) => m.contextes ?? []));
  const contextesTravail = extrait.contextes.filter((c) => utilises.has(c.id));
  const source = {
    nom: `ROME 4.0 (version ${extrait.rome})`,
    producteur: "France Travail",
    licence: "Licence Ouverte 2.0",
    url: "https://www.data.gouv.fr/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome",
    date: extrait.date,
    champs: ["contextes", "transitions", "proches"]
  };
  const sources = [...(referentiel.sources ?? []).filter((s) => s.producteur !== "France Travail" || !s.nom.startsWith("ROME")), source];
  return { referentiel: { ...referentiel, sources, contextesTravail, metiers }, rapport };
}

/**
 * Candidats des vagues (chantier Métiers, lot 6) complétés par le ROME : compétences cœur de métier et savoirs des
 * codes ROME de chaque candidat ONISEP, pour aider à formuler disciplines et gestes (relecture humaine obligatoire).
 */
export function completerCandidats(candidats, extrait) {
  const { parCode } = lireExtrait(extrait);
  return candidats.map((c) => {
    const fiches = (c.rome ?? []).map((code) => parCode.get(code)).filter(Boolean);
    if (!fiches.length) return c;
    return { ...c, competencesRome: unique(fiches.flatMap((f) => f.competences)), savoirsRome: unique(fiches.flatMap((f) => f.savoirs)) };
  });
}
