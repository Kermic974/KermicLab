// Import des fiches métiers de l'ONISEP (chantier Métiers, lot 2, ADR 0042). Module pur et déterministe : il lit un
// instantané déjà téléchargé (CSV ou JSON du jeu ouvert « Idéo – Fiches métiers »), le normalise et le rapproche du
// référentiel `referentiel/metiers-v0.json`. Aucun appel réseau. Testé par tests/unit/onisep.test.mjs.
//
// Sources (data.gouv.fr, organisation ONISEP, licence ODbL) : « Idéo-Fiches métiers » (XML, une fiche par métier :
// identifiant, intitulé, synonymes, codes ROME, niveau d'accès minimum, centres d'intérêt) et « Idéo-Métiers Onisep »
// (CSV `;`, une ligne par métier et par publication : intitulé, lien de la fiche portant l'identifiant MET.<n>, code
// ROME, domaines/sous-domaines séparés par « | »). Les colonnes CSV sont reconnues par alias, sans accents ni casse.

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

export const sansAccents = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae");
export const normaliserEntete = (s) => sansAccents(s).replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Identifiant lisible d'un métier, sans les formes féminines de l'écriture ONISEP : « Infirmier/Infirmière » →
 * « infirmier », « gardien/ne de police municipale » → « gardien-de-police-municipale », « Chef(fe) de rayon » →
 * « chef-de-rayon », « accompagnant / accompagnante d'élèves » → « accompagnant-d-eleves ».
 */
export function slugMetier(nom) {
  return sansAccents(String(nom ?? "").replace(/\s*\/\s*[^\s/]+/g, "").replace(/\([^)]*\)/g, " "))
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Clé de comparaison d'un intitulé (sans accents, ponctuation ni forme féminine après « / »). */
export const cleIntitule = (nom) => slugMetier(nom).replace(/-/g, " ");

/**
 * Niveau d'accès du référentiel à partir d'un libellé ONISEP (« bac + 2 », « bac + 9 et plus », « CAP ou équivalent »,
 * « CAP ou équivalent + 1 an », « 3E », « sans diplôme »…), sinon undefined (« autre formation »).
 */
export function niveauDepuisLibelle(libelle) {
  const s = sansAccents(libelle);
  const plus = s.match(/bac\s*\+\s*(\d)/);
  if (plus) {
    const niveau = `bac+${plus[1]}`;
    return NIVEAUX_ACCES.includes(niveau) ? niveau : undefined;
  }
  if (/\b(cap|bep)\b/.test(s)) return "cap";
  if (/sans diplome|\b3e\b|brevet/.test(s)) return "sans-diplome";
  if (/\bbac\b|baccalaureat/.test(s)) return "bac";
  return undefined;
}

const ENTITES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const SANS_CDATA = /<!\[CDATA\[[\s\S]*?\]\]>/g;
const texteXml = (s) => String(s ?? "").replace(SANS_CDATA, "")
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITES[e] ?? m)).trim();
const balise = (xml, nom) => String(xml ?? "").match(new RegExp(`<${nom}>([\\s\\S]*?)</${nom}>`))?.[1];
const toutes = (xml, nom) => [...String(xml ?? "").matchAll(new RegExp(`<${nom}>([\\s\\S]*?)</${nom}>`, "g"))].map((m) => m[1]);

/**
 * Lignes du XML « Idéo-Fiches métiers » (un bloc <metier> par fiche), dans la forme des lignes CSV : les textes
 * descriptifs (CDATA) sont ignorés, seuls les identifiants et classifications sont lus.
 */
export function lireFichesXml(texte) {
  return toutes(String(texte).replace(SANS_CDATA, ""), "metier").map((bloc) => {
    const synonymes = balise(bloc, "synonymes") ?? "";
    const principal = bloc.replace(/<synonymes>[\s\S]*?<\/synonymes>/, "").replace(/<metiers_associes>[\s\S]*?<\/metiers_associes>/, "");
    return {
      identifiant: texteXml(balise(principal, "identifiant")),
      "libellé métier": texteXml(balise(principal, "nom_metier")),
      // Synonymes ONISEP, puis formes masculine et féminine de l'intitulé (rapprochement et recherche).
      synonymes: [...toutes(synonymes, "synonyme").map((x) => texteXml(balise(x, "nom_metier"))),
        texteXml(balise(principal, "libelle_masculin")), texteXml(balise(principal, "libelle_feminin"))].filter(Boolean).join(" | "),
      "codes ROME": toutes(balise(principal, "romesV3"), "romeV3").map(texteXml).join(" "),
      "niveau d'accès min": texteXml(balise(balise(principal, "niveau_acces_min"), "libelle")),
      "centres d'intérêt": toutes(balise(principal, "centres_interet"), "centre_interet").map((x) => texteXml(balise(x, "libelle"))).join(" | ")
    };
  });
}

const liste = (valeur) => (Array.isArray(valeur) ? valeur : String(valeur ?? "").split(/\s*[|;\n]\s*/))
  .map((v) => String(v).trim()).filter(Boolean);

/** Lignes d'un instantané : XML Idéo, tableau d'objets (JSON) ou CSV (séparateur `;` ou `,`, détecté sur l'en-tête). */
export function lireInstantane(texte, format) {
  const brut = String(texte).replace(/^\uFEFF/, "");
  if (format === "xml") return lireFichesXml(brut);
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
  // L'identifiant est une colonne (XML, JSON) ou se lit dans le lien de la fiche (CSV « Idéo-Métiers Onisep »).
  const identifiant = String(val("onisep") ?? "").trim() || (String(val("lien") ?? "").match(/MET\.\d+/)?.[0] ?? "");
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
 * Fusionne les fiches de même identifiant (le CSV « Idéo-Métiers Onisep » a une ligne par publication) : listes
 * réunies, premier intitulé, niveau et lien non vides. Les fiches sans identifiant sont gardées telles quelles.
 */
export function fusionnerFiches(fiches) {
  const parId = new Map();
  const sans = [];
  for (const f of fiches) {
    if (!f.onisep) { sans.push(f); continue; }
    const deja = parId.get(f.onisep);
    if (!deja) { parId.set(f.onisep, { ...f, synonymes: [...f.synonymes], rome: [...f.rome], domaines: [...f.domaines], centresInteret: [...f.centresInteret] }); continue; }
    for (const cle of ["synonymes", "rome", "domaines", "centresInteret"]) deja[cle] = [...new Set([...deja[cle], ...f[cle]])];
    deja.rome.sort();
    for (const cle of ["nom", "niveauAcces", "lien", "slug"]) deja[cle] ||= f[cle];
  }
  return [...parId.values(), ...sans];
}

/** Complète des fiches (XML) par une autre source (CSV) de même identifiant : domaines, lien, codes ROME, synonymes. */
export function completerFiches(fiches, complement) {
  const parId = new Map(fusionnerFiches(complement).filter((f) => f.onisep).map((f) => [f.onisep, f]));
  return fiches.map((f) => {
    const c = parId.get(f.onisep);
    if (!c) return f;
    return { ...f, domaines: f.domaines.length ? f.domaines : c.domaines, lien: f.lien ?? c.lien, rome: f.rome.length ? f.rome : c.rome, synonymes: f.synonymes.length ? f.synonymes : c.synonymes };
  });
}

/** Extrait compact versionné dans le dépôt (base de données dérivée, licence ODbL) : seulement les champs utilisés. */
export function extraitCompact(fiches, { source, date }) {
  const champs = ["onisep", "nom", "synonymes", "rome", "niveauAcces", "domaines", "lien"];
  return {
    format: "kermiclab-onisep-extrait",
    version: 1,
    date,
    source,
    licence: "ODbL 1.0 (Open Database License), https://opendatacommons.org/licenses/odbl/1-0/",
    attribution: "Onisep, jeux « Idéo-Fiches métiers » et « Idéo-Métiers Onisep », data.gouv.fr",
    fiches: fusionnerFiches(fiches).filter((f) => f.onisep && f.nom).sort((a, b) => numero(a.onisep) - numero(b.onisep))
      .map((f) => Object.fromEntries(champs.filter((c) => (Array.isArray(f[c]) ? f[c].length : f[c])).map((c) => [c, f[c]])))
  };
}

/** Fiches d'un extrait compact, dans la forme normalisée (listes toujours présentes). */
export function fichesDeLExtrait(extrait) {
  if (extrait?.format !== "kermiclab-onisep-extrait") throw new Error("extrait ONISEP inconnu");
  return extrait.fiches.map((f) => ({ synonymes: [], rome: [], domaines: [], centresInteret: [], ...f, slug: slugMetier(f.nom) }));
}

/**
 * Rapproche les fiches de l'instantané des métiers du référentiel. Un métier est rattaché par son identifiant ONISEP,
 * sinon par son intitulé (ou un synonyme de la fiche). Retourne les rattachements, les candidats (fiches nouvelles,
 * slug rendu unique) et les anomalies (fiche sans identifiant ou sans intitulé, identifiant en double).
 */
export function rapprocher(fiches, metiers) {
  const parOnisep = new Map(metiers.filter((m) => m.onisep).map((m) => [m.onisep, m]));
  const parIntitule = new Map(metiers.filter((m) => !m.onisep).map((m) => [cleIntitule(m.nom), m]));
  const vus = new Set();
  const anomalies = [];
  const valides = [];
  for (const fiche of [...fiches].sort((a, b) => numero(a.onisep) - numero(b.onisep) || a.nom.localeCompare(b.nom, "fr"))) {
    if (!fiche.onisep || !fiche.nom) { anomalies.push({ type: "incomplete", fiche: fiche.onisep ?? fiche.nom }); continue; }
    if (vus.has(fiche.onisep)) { anomalies.push({ type: "doublon", fiche: fiche.onisep }); continue; }
    vus.add(fiche.onisep);
    valides.push(fiche);
  }
  // Trois passes, un seul rattachement par métier : identifiant ONISEP, puis intitulé exact, puis synonyme ou forme
  // masculine / féminine (un métier sans identifiant prend la première fiche qui lui correspond).
  const attribution = new Map();
  const pris = new Set();
  const attribuer = (fiche, metier) => {
    if (!metier || pris.has(metier.id) || attribution.has(fiche.onisep)) return;
    attribution.set(fiche.onisep, metier);
    pris.add(metier.id);
  };
  for (const fiche of valides) attribuer(fiche, parOnisep.get(fiche.onisep));
  for (const fiche of valides) attribuer(fiche, parIntitule.get(cleIntitule(fiche.nom)));
  for (const fiche of valides) for (const n of fiche.synonymes) attribuer(fiche, parIntitule.get(cleIntitule(n)));
  const slugs = new Set(metiers.map((m) => m.id));
  const rattachements = [], candidats = [];
  for (const fiche of valides) {
    const metier = attribution.get(fiche.onisep);
    if (metier) { rattachements.push({ metier: metier.id, ...fiche }); continue; }
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
export function appliquerRattachements(donnees, rattachements, { remplacerPropositions = false } = {}) {
  const parId = new Map(rattachements.map((r) => [r.metier, r]));
  const conflits = [];
  return {
    conflits,
    ...donnees,
    metiers: donnees.metiers.map((m) => {
      const r = parId.get(m.id);
      if (!r) return m;
      // Une fiche encore en « proposition » (préparée par un agent) cède la place aux valeurs de l'ONISEP sur demande.
      const remplacer = remplacerPropositions && m.correspondance === "proposition";
      const ajout = {};
      if (m.niveauAcces && r.niveauAcces && m.niveauAcces !== r.niveauAcces) {
        if (remplacer) ajout.niveauAcces = r.niveauAcces;
        else conflits.push({ metier: m.id, champ: "niveauAcces", referentiel: m.niveauAcces, onisep: r.niveauAcces });
      }
      if (m.rome?.length && r.rome.length && m.rome.join() !== r.rome.join()) {
        if (remplacer) ajout.rome = r.rome;
        else conflits.push({ metier: m.id, champ: "rome", referentiel: m.rome, onisep: r.rome });
      }
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

/** Erreurs des règles : préfixe ROME bien formé et unique, disciplines connues ; table de repli par domaine. */
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
  // Repli par domaine ONISEP (vagues complémentaires) : domaine unique, disciplines connues.
  const domaines = new Set();
  for (const r of regles?.domaines ?? []) {
    if (!r.domaine || domaines.has(r.domaine)) erreurs.push(`domaine en double ou vide : ${r.domaine}`);
    domaines.add(r.domaine);
    if (!r.disciplines?.length) erreurs.push(`${r.domaine} : aucune discipline`);
    for (const d of r.disciplines ?? []) if (!disciplinesConnues.has(d)) erreurs.push(`${r.domaine} : discipline inconnue ${d}`);
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
