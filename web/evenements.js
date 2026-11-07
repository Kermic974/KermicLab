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
  const n = suivant.notions[ev.notion] ??= { version: ev.version, ouvertures: 0, dernierJour: jour, termine: false, exercices: {} };
  n.version = ev.version;
  n.dernierJour = jour;
  if (ev.evenement === "demarre") n.ouvertures = Math.min(n.ouvertures + 1, 1e6);
  if (ev.evenement === "termine") n.termine = true;
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
      notions[id] = { version: n.version, ouvertures: n.ouvertures, dernierJour: n.dernierJour, termine: n.termine, exercices };
    }
    return { v: VERSION_CONTRAT, notions };
  } catch { return etatInitial(); }
}

export function sauver(stockage, etat) {
  try { stockage?.setItem(CLE_STOCKAGE, JSON.stringify(etat)); } catch { /* stockage indisponible : agrégat en mémoire */ }
}
