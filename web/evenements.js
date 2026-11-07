// Contrat d'événements pédagogiques v1 (ADR 0025), côté tableau de bord : validation stricte des messages reçus des
// pages (gabarit/jeux/evenements.js) et agrégation locale par notion. Rien n'est envoyé au serveur ; aucun texte libre,
// aucun horodatage précis (date du jour seulement). Les jeux et leur XP restent dans « Mes trophées » (trophees.js).
export const CLE_STOCKAGE = "kermiclab:evenements";
export const VERSION_CONTRAT = 1;
export const TYPES = Object.freeze(["demarre", "indice", "reponse", "termine"]);
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ID_EXERCICE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTIONS = 300;
const MAX_EXERCICES = 60;
const objet = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const entier = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

export const etatInitial = () => ({ v: VERSION_CONTRAT, notions: {} });

/**
 * Valide un message reçu d'une page : schéma v1 exact, notion égale à celle du cadre qui l'a envoyé, aucun champ en trop.
 * Renvoie l'événement normalisé, ou null.
 */
export function normaliserEvenement(brut, notionAttendue) {
  if (!objet(brut) || brut.type !== "kermiclab:evenement" || brut.v !== VERSION_CONTRAT) return null;
  if (!ID.test(String(brut.notion)) || brut.notion !== notionAttendue) return null;
  if (!SEMVER.test(String(brut.version)) || !TYPES.includes(brut.evenement)) return null;
  const autorises = { demarre: [], termine: [], indice: ["exercice", "rang"], reponse: ["exercice", "correct", "essai"] }[brut.evenement];
  const communs = ["type", "v", "notion", "version", "evenement"];
  if (Object.keys(brut).some((cle) => !communs.includes(cle) && !autorises.includes(cle))) return null;
  const ev = { notion: brut.notion, version: brut.version, evenement: brut.evenement };
  if (autorises.includes("exercice")) {
    if (!ID_EXERCICE.test(String(brut.exercice))) return null;
    ev.exercice = brut.exercice;
  }
  if (brut.evenement === "indice") {
    if (!entier(brut.rang, 1, 10)) return null;
    ev.rang = brut.rang;
  }
  if (brut.evenement === "reponse") {
    if (typeof brut.correct !== "boolean" || !entier(brut.essai, 1, 99)) return null;
    ev.correct = brut.correct;
    ev.essai = brut.essai;
  }
  return ev;
}

/**
 * Ajoute un événement validé à l'agrégat local (fonction pure). Par notion : version vue, ouvertures, dernier jour,
 * terminée ; par exercice : réponses, réussi, rang d'indice le plus élevé, réussi après un indice.
 */
export function enregistrer(etat, ev, jour) {
  const suivant = structuredClone(etat?.v === VERSION_CONTRAT && objet(etat.notions) ? etat : etatInitial());
  if (!suivant.notions[ev.notion] && Object.keys(suivant.notions).length >= MAX_NOTIONS) return suivant;
  const n = suivant.notions[ev.notion] ??= { version: ev.version, ouvertures: 0, dernierJour: jour, termine: false, validations: 0, derniereValidation: null, exercices: {} };
  n.version = ev.version;
  n.dernierJour = jour;
  if (ev.evenement === "demarre") n.ouvertures = Math.min(n.ouvertures + 1, 1e6);
  if (ev.evenement === "termine") {
    n.termine = true;
    // Une validation par jour au plus : rouvrir et réussir la page le même jour ne compte pas comme une révision.
    if (n.derniereValidation !== jour) { n.validations = Math.min((n.validations ?? 0) + 1, 1e6); n.derniereValidation = jour; }
  }
  if (ev.exercice) {
    if (!n.exercices[ev.exercice] && Object.keys(n.exercices).length >= MAX_EXERCICES) return suivant;
    const e = n.exercices[ev.exercice] ??= { reponses: 0, reussi: false, indice: 0, apresIndice: false };
    if (ev.evenement === "indice") e.indice = Math.max(e.indice, ev.rang);
    if (ev.evenement === "reponse") {
      e.reponses = Math.min(e.reponses + 1, 1e6);
      if (ev.correct && !e.reussi) { e.reussi = true; e.apresIndice = e.indice > 0; }
    }
  }
  return suivant;
}

/**
 * Résumé affichable d'une notion (« Mes trophées », issue #182) : des faits, pas une maîtrise. Les exercices tentés sont
 * ceux qui ont reçu au moins une réponse ; les réussis après indice sont comptés à part. Renvoie null sans activité.
 */
export function resumerNotion(n) {
  if (!n) return null;
  const exercices = Object.values(n.exercices ?? {});
  const tentes = exercices.filter((e) => e.reponses > 0);
  return {
    ouvertures: n.ouvertures, tentes: tentes.length,
    reussis: tentes.filter((e) => e.reussi).length,
    apresIndice: tentes.filter((e) => e.reussi && e.apresIndice).length,
    termine: n.termine
  };
}

/**
 * Maîtrise par notion (feuille de route, phase 2 ; issue #185), calculée localement à partir de l'agrégat, sans IA.
 * Règles déterministes, dans cet ordre :
 *   1. aucune activité                                   → « non-commencee »
 *   2. au moins une validation (tous les exercices réussis lors d'une visite, événement `termine`) :
 *        révision due (aujourd'hui ≥ dernière validation + intervalle) → « a-revoir », sinon → « maitrisee »
 *   3. au moins un exercice tenté                        → « en-cours »
 *   4. page ouverte seulement                            → « decouverte »
 * L'intervalle grandit avec les validations réussies (7, puis 30, puis 90 jours) ; une révision réussie, c'est-à-dire
 * une nouvelle validation un autre jour, repousse la suivante. Les réussites après indice restent un fait affiché à part.
 */
export const ETATS_MAITRISE = Object.freeze(["non-commencee", "decouverte", "en-cours", "maitrisee", "a-revoir"]);
export const INTERVALLES_REVISION = Object.freeze([7, 30, 90]);

export function ajouterJours(jour, n) {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function maitriseNotion(n, aujourdhui) {
  if (!n) return { etat: "non-commencee", revision: null };
  if (n.validations > 0 && n.derniereValidation) {
    const intervalle = INTERVALLES_REVISION[Math.min(n.validations, INTERVALLES_REVISION.length) - 1];
    const revision = ajouterJours(n.derniereValidation, intervalle);
    return { etat: aujourdhui >= revision ? "a-revoir" : "maitrisee", revision };
  }
  const tentes = Object.values(n.exercices ?? {}).some((e) => e.reponses > 0);
  if (tentes) return { etat: "en-cours", revision: null };
  return { etat: n.ouvertures > 0 ? "decouverte" : "non-commencee", revision: null };
}

/** Relit l'agrégat stocké en ne gardant que des entrées valides ; tout le reste est ignoré. */
export function charger(stockage) {
  try {
    const brut = JSON.parse(stockage?.getItem(CLE_STOCKAGE) ?? "null");
    if (!objet(brut) || brut.v !== VERSION_CONTRAT || !objet(brut.notions)) return etatInitial();
    const notions = {};
    for (const [id, n] of Object.entries(brut.notions).slice(0, MAX_NOTIONS)) {
      if (!ID.test(id) || !objet(n) || !SEMVER.test(String(n.version)) || !entier(n.ouvertures, 0, 1e6) ||
          !JOUR.test(String(n.dernierJour)) || typeof n.termine !== "boolean" || !objet(n.exercices)) continue;
      const exercices = {};
      for (const [ex, e] of Object.entries(n.exercices).slice(0, MAX_EXERCICES)) {
        if (!ID_EXERCICE.test(ex) || !objet(e) || !entier(e.reponses, 0, 1e6) || typeof e.reussi !== "boolean" ||
            !entier(e.indice, 0, 10) || typeof e.apresIndice !== "boolean") continue;
        exercices[ex] = { reponses: e.reponses, reussi: e.reussi, indice: e.indice, apresIndice: e.apresIndice };
      }
      // Validations (issue #185) : absentes des agrégats antérieurs ; une notion déjà terminée compte une validation.
      let validations = n.termine ? 1 : 0, derniereValidation = n.termine ? n.dernierJour : null;
      if (n.validations !== undefined || n.derniereValidation !== undefined) {
        const vOk = entier(n.validations, 0, 1e6), jOk = n.derniereValidation === null || JOUR.test(String(n.derniereValidation));
        if (!vOk || !jOk || (n.validations > 0) !== (n.derniereValidation !== null)) continue;
        validations = n.validations; derniereValidation = n.derniereValidation;
      }
      notions[id] = { version: n.version, ouvertures: n.ouvertures, dernierJour: n.dernierJour, termine: n.termine, validations, derniereValidation, exercices };
    }
    return { v: VERSION_CONTRAT, notions };
  } catch { return etatInitial(); }
}

export function sauver(stockage, etat) {
  try { stockage?.setItem(CLE_STOCKAGE, JSON.stringify(etat)); } catch { /* stockage indisponible : agrégat en mémoire */ }
}
