// Expérience Professeur (ADR 0030) : logique pure, sans accès au DOM ni au réseau, partagée avec le Worker et la
// démonstration. Un compte local dont le rôle donne la permission `professeur` configure ses matières et ses niveaux,
// gère ses classes et suit ses élèves. Un élève rejoint une classe (ou des cours particuliers) par un lien
// d'invitation, accepte explicitement de partager sa progression, et peut quitter à tout moment.
// Le suivi réutilise le bilan clair et borné de l'Espace famille (web/famille.js), restreint aux matières concernées.
import { ALPHABET_CODE, ecartJours, repartitionNotions, semaineBilan, validerBilan, JOURS_INACTIVITE } from "./famille.js";

/** Matières enseignables : celles du catalogue (les jeux ne sont pas une matière). */
export const MATIERES_PROF = Object.freeze(["mathematiques", "physique-chimie", "svt", "histoire", "geographie", "emc", "philosophie", "francais", "ses"]);
/** Niveaux d'enseignement, du collège au lycée ; chacun correspond à un niveau du catalogue. */
export const NIVEAUX_PROF = Object.freeze(["6e", "5e", "4e", "3e", "seconde", "premiere", "terminale"]);
const NIVEAU_CATALOGUE = Object.freeze({ "6e": "college", "5e": "college", "4e": "college", "3e": "college", seconde: "seconde", premiere: "premiere", terminale: "terminale" });

export const MODES = Object.freeze(["classe", "particulier"]);
/** Durées proposées pour un lien d'invitation (jours). */
export const DUREES_INVITATION_JOURS = Object.freeze([1, 7, 30]);
export const DUREE_INVITATION_DEFAUT = 7;
export const LONGUEUR_CODE_PROF = 10;
export const MAX_CLASSES = 20;
export const MAX_ELEVES_CLASSE = 40;
export const MAX_ELEVES_PROF = 200;
export const MAX_PROFS_ELEVE = 10;
export const MAX_INVITATIONS_ACTIVES = 20;
export const NOM_AFFICHE_MIN = 2;
export const NOM_AFFICHE_MAX = 40;
export const NOM_CLASSE_MAX = 30;
/** Accord de l'élève au partage de sa progression avec le professeur (version affichée à l'élève). */
export const VERSION_ACCORD_ELEVE = "partage-prof-v1";

/** Niveau du catalogue (college, seconde…) d'un niveau d'enseignement ; null s'il est inconnu. */
export const niveauCatalogue = (niveau) => NIVEAU_CATALOGUE[niveau] ?? null;

const nettoyer = (v) => String(v ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
// Lettres, chiffres, espaces et ponctuation courte ; jamais d'@ (adresse), jamais de suite de 6 chiffres (téléphone).
const TEXTE_COURT = /^[\p{L}\p{N} .'’()-]+$/u;

function texteCourt(brut, { min, max }) {
  const texte = nettoyer(brut);
  if ([...texte].length < min) return { ok: false, erreur: "court" };
  if ([...texte].length > max) return { ok: false, erreur: "long" };
  if (!TEXTE_COURT.test(texte) || !/[\p{L}\p{N}]/u.test(texte)) return { ok: false, erreur: "caracteres" };
  if (/\d{6,}/.test(texte.replace(/\s/g, ""))) return { ok: false, erreur: "chiffres" };
  return { ok: true, texte };
}

const listeFermee = (brut, connus, { min = 1, max = connus.length } = {}) => {
  const liste = [...new Set((Array.isArray(brut) ? brut : []).filter((v) => connus.includes(v)))];
  // Ordre canonique : celui de la liste connue, quel que soit l'ordre de saisie.
  const triee = connus.filter((v) => liste.includes(v));
  return triee.length >= min && triee.length <= max ? triee : null;
};

/**
 * Profil du professeur : nom affiché aux élèves (« M. Martin », « Mme Diallo »), matières et niveaux enseignés.
 * @returns {{ ok: true, profil: { nomAffiche: string, matieres: string[], niveaux: string[] } } | { ok: false, code: string }}
 */
export function validerProfilProf(corps) {
  const nom = texteCourt(corps?.nomAffiche, { min: NOM_AFFICHE_MIN, max: NOM_AFFICHE_MAX });
  if (!nom.ok) return { ok: false, code: `nom-${nom.erreur}` };
  const matieres = listeFermee(corps?.matieres, MATIERES_PROF, { max: 5 });
  if (!matieres) return { ok: false, code: "matieres-invalides" };
  const niveaux = listeFermee(corps?.niveaux, NIVEAUX_PROF);
  if (!niveaux) return { ok: false, code: "niveaux-invalides" };
  return { ok: true, profil: { nomAffiche: nom.texte, matieres, niveaux } };
}

/** Relit un profil gardé en base (JSON) ; null s'il est absent ou illisible. */
export function lireProfilProf(ligne) {
  if (!ligne) return null;
  const lire = (t) => { try { return JSON.parse(t); } catch { return []; } };
  const r = validerProfilProf({ nomAffiche: ligne.nom_affiche, matieres: lire(ligne.matieres), niveaux: lire(ligne.niveaux) });
  return r.ok ? r.profil : null;
}

/**
 * Classe : nom court (« 4e B », « Groupe de soutien »), une matière et un niveau pris dans le profil du professeur.
 * @returns {{ ok: true, classe: { nom: string, matiere: string, niveau: string } } | { ok: false, code: string }}
 */
export function validerClasse(corps, profil) {
  if (!profil) return { ok: false, code: "profil-requis" };
  const nom = texteCourt(corps?.nom, { min: 1, max: NOM_CLASSE_MAX });
  if (!nom.ok) return { ok: false, code: `classe-${nom.erreur}` };
  if (!profil.matieres.includes(corps?.matiere)) return { ok: false, code: "matiere-hors-profil" };
  if (!profil.niveaux.includes(corps?.niveau)) return { ok: false, code: "niveau-hors-profil" };
  return { ok: true, classe: { nom: nom.texte, matiere: corps.matiere, niveau: corps.niveau } };
}

/**
 * Demande de lien d'invitation : une classe (lien partagé à toute la classe, utilisable jusqu'à la capacité restante)
 * ou des cours particuliers (lien à usage unique).
 * @returns {{ ok: true, invitation: { mode: string, classeId: string | null, dureeJours: number } } | { ok: false, code: string }}
 */
export function validerDemandeInvitation(corps) {
  const mode = MODES.includes(corps?.mode) ? corps.mode : null;
  if (!mode) return { ok: false, code: "mode-invalide" };
  const dureeJours = corps?.dureeJours === undefined ? DUREE_INVITATION_DEFAUT : corps.dureeJours;
  if (!DUREES_INVITATION_JOURS.includes(dureeJours)) return { ok: false, code: "duree-invalide" };
  const classeId = mode === "classe" ? String(corps?.classeId ?? "") : null;
  if (mode === "classe" && !/^[0-9a-z-]{1,64}$/.test(classeId)) return { ok: false, code: "classe-requise" };
  return { ok: true, invitation: { mode, classeId, dureeJours } };
}

/** Tire un code d'invitation (alphabet sans caractère ambigu), sans biais de modulo. */
export function tirerCodeProf(octetsAleatoires, longueur = LONGUEUR_CODE_PROF) {
  let code = "";
  while (code.length < longueur) {
    for (const o of octetsAleatoires(24)) {
      if (o < 240 && code.length < longueur) code += ALPHABET_CODE[o % ALPHABET_CODE.length];
    }
  }
  return code;
}

/**
 * Code saisi ou lien collé : le code est extrait du paramètre `rejoindre` d'une adresse, puis normalisé
 * (majuscules, espaces et tirets retirés, alphabet et longueur contrôlés).
 * @returns {string | null}
 */
export function normaliserCodeProf(brut) {
  let texte = String(brut ?? "").trim();
  const dansLien = texte.match(/[?&#]rejoindre=([A-Za-z0-9-]+)/);
  if (dansLien) texte = dansLien[1];
  const code = texte.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== LONGUEUR_CODE_PROF) return null;
  return [...code].every((c) => ALPHABET_CODE.includes(c)) ? code : null;
}

/** Code lisible : groupes de cinq caractères (ABCDE-FGHJK). */
export const afficherCodeProf = (code) => `${code.slice(0, 5)}-${code.slice(5)}`;

/** Lien d'invitation à transmettre aux élèves : la page d'accueil du site avec le code en paramètre. */
export function lienInvitation(origine, code) {
  const url = new URL("/", origine);
  url.searchParams.set("rejoindre", code);
  return url.toString();
}

/**
 * Nom sous lequel l'élève apparaît chez le professeur : règles du pseudo (passées en paramètre, comme pour la famille)
 * et accord explicite au partage de la progression.
 */
export function validerAdhesion(corps, { validerPseudo }) {
  const p = validerPseudo(corps?.pseudo);
  if (!p.ok) return { ok: false, code: `pseudo-${p.erreur}` };
  if (corps?.accord !== VERSION_ACCORD_ELEVE) return { ok: false, code: "accord-requis" };
  return { ok: true, pseudo: p.pseudo };
}

/**
 * Bilan vu par le professeur : seules les notions des matières concernées (celle de la classe, ou celles de son profil
 * pour un cours particulier) ; ni badges ni cahiers de la famille. `matiereDe(id)` donne la matière d'une notion.
 */
export function bilanPourProfesseur(brut, matieres, matiereDe) {
  const bilan = validerBilan(brut);
  if (!bilan) return null;
  const notions = Object.fromEntries(Object.entries(bilan.notions).filter(([id]) => matieres.includes(matiereDe(id))));
  return { ...bilan, notions, badges: [], cahiers: [] };
}

/** Matières suivies pour un élève : celle de sa classe, sinon toutes celles du professeur. */
export const matieresSuivies = (eleve, classes, profil) => {
  const classe = eleve?.classeId ? classes.find((c) => c.id === eleve.classeId) : null;
  return classe ? [classe.matiere] : [...(profil?.matieres ?? [])];
};

/**
 * Synthèse des élèves affichés, calculée dans le navigateur du professeur : effectif, actifs sur 7 jours, minutes et
 * XP de la semaine, notions à revoir et points d'attention (`jamais` : aucun bilan, `inactif` : rien depuis
 * JOURS_INACTIVITE jours, `a-revoir` : notions à revoir).
 */
export function syntheseEleves(eleves, aujourdhui) {
  const s = { eleves: 0, actifs: 0, minutes: 0, xp: 0, aRevoir: 0, alertes: [] };
  for (const e of Array.isArray(eleves) ? eleves : []) {
    s.eleves += 1;
    const semaine = semaineBilan(e.bilan, aujourdhui);
    s.minutes += semaine.minutes;
    s.xp += semaine.xp;
    if (semaine.joursActifs > 0) s.actifs += 1;
    const derniere = e.bilan?.dernierJour ?? null;
    if (!e.bilan || !derniere) s.alertes.push({ eleve: e.id, type: "jamais" });
    else if (ecartJours(derniere, aujourdhui) >= JOURS_INACTIVITE) s.alertes.push({ eleve: e.id, type: "inactif", jours: ecartJours(derniere, aujourdhui) });
    const aRevoir = repartitionNotions(e.bilan)["a-revoir"];
    if (aRevoir) {
      s.aRevoir += aRevoir;
      s.alertes.push({ eleve: e.id, type: "a-revoir", n: aRevoir });
    }
  }
  return s;
}

/** Notions les plus souvent « à revoir » dans un groupe d'élèves : [{ id, n }] par fréquence décroissante. */
export function notionsARevoir(eleves, limite = 5) {
  const compte = new Map();
  for (const e of Array.isArray(eleves) ? eleves : []) {
    for (const [id, n] of Object.entries(e.bilan?.notions ?? {})) if (n.etat === "a-revoir") compte.set(id, (compte.get(id) ?? 0) + 1);
  }
  return [...compte].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id)).slice(0, limite);
}

/** Ajoute à chaque notion à revoir son repère national (ADR 0044), s'il existe : { id, n, repere: { taux, niveau, … } }. */
export const avecReperes = (liste, reperes) => liste.map((n) => (reperes?.[n.id] ? { ...n, repere: reperes[n.id] } : n));

/** Filtre des élèves : « tous », « particulier » (sans classe) ou l'identifiant d'une classe. */
export function filtrerEleves(eleves, filtre) {
  const liste = Array.isArray(eleves) ? eleves : [];
  if (!filtre || filtre === "tous") return liste;
  if (filtre === "particulier") return liste.filter((e) => !e.classeId);
  return liste.filter((e) => e.classeId === filtre);
}

/* ---------- Activités données par le professeur (ADR 0030 §9) ---------- */
// Défis, évaluations, cahiers et objectifs, donnés à un élève ou à toute une classe. Les questions des défis et des
// évaluations sont des QCM publiés du catalogue (dist/contenus/), tirés de façon reproductible : chaque élève de la
// classe reçoit les mêmes questions, et rien de saisi par l'élève ne quitte son appareil (seul le score remonte).

export const TYPES_ACTIVITE = Object.freeze(["defi", "evaluation", "cahier", "objectif"]);
export const QUESTIONS_DEFI = 5;
export const QUESTIONS_EVALUATION_MIN = 5;
export const QUESTIONS_EVALUATION_MAX = 40;
export const MAX_NOTIONS_ACTIVITE = 10;
export const MAX_ACTIVITES_ACTIVES = 60;
export const ECHEANCE_MAX_JOURS = 180;
export const LIBELLE_ACTIVITE_MAX = 60;
/** Cahiers que le professeur peut donner : mêmes types que l'Espace famille (le brouillon reste personnel). */
export const TYPES_CAHIER_PROF = Object.freeze(["exercices", "fiches", "vacances"]);
export const LONGUEURS_CAHIER_PROF = Object.freeze(["court", "standard", "complet"]);
export const UNIVERS_CAHIER_PROF = Object.freeze(["aucun", "aventure", "espace", "enquete", "sport", "nature", "cuisine", "jeux-video", "musique"]);
export const OBJECTIFS_CAHIER_PROF = Object.freeze(["decouvrir", "reviser", "approfondir", "controle"]);
/**
 * Objectifs mesurables à partir du bilan et des résultats, sans rien demander à l'élève :
 * minutes actives et XP sur les 7 derniers jours, notions choisies maîtrisées, activités du professeur terminées.
 */
export const MESURES_OBJECTIF = Object.freeze(["temps", "xp", "notions", "activites"]);
export const BORNES_OBJECTIF = Object.freeze({ temps: [10, 1200], xp: [10, 5000], notions: [1, MAX_NOTIONS_ACTIVITE], activites: [1, 20] });
/** Score en dessous duquel un résultat est signalé dans le tableau de bord (pourcentage). */
export const SEUIL_SCORE_FAIBLE = 50;

const JOUR_ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID_NOTION = /^[a-z0-9][a-z0-9-]{0,79}$/;
const decalerJour = (jour, n) => new Date(Date.parse(`${jour}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const parmiListe = (liste, valeur, defaut) => (liste.includes(valeur) ? valeur : defaut);

/**
 * Demande d'activité du professeur. `matiereDe(id)` donne la matière d'une notion du catalogue (null si elle n'existe
 * pas ou n'est pas une notion) ; seules les notions des matières du profil sont acceptées.
 * @returns {{ ok: true, activite: object } | { ok: false, code: string }}
 */
export function validerActivite(corps, { profil, matiereDe, aujourdhui }) {
  if (!profil) return { ok: false, code: "profil-requis" };
  const type = TYPES_ACTIVITE.includes(corps?.type) ? corps.type : null;
  if (!type) return { ok: false, code: "type-invalide" };
  const classeId = corps?.cible?.classeId ? String(corps.cible.classeId) : null;
  const eleveId = corps?.cible?.eleveId ? String(corps.cible.eleveId) : null;
  if (!classeId === !eleveId) return { ok: false, code: "cible-invalide" };
  if (![classeId, eleveId].filter(Boolean).every((v) => /^[0-9a-z-]{1,64}$/.test(v))) return { ok: false, code: "cible-invalide" };

  const brutes = Array.isArray(corps?.notions) ? corps.notions : [];
  const notions = [...new Set(brutes.filter((id) => typeof id === "string" && ID_NOTION.test(id)))];
  if (notions.length > MAX_NOTIONS_ACTIVITE) return { ok: false, code: "trop-de-notions" };
  if (notions.some((id) => !profil.matieres.includes(matiereDe(id)))) return { ok: false, code: "notion-hors-profil" };
  const besoinNotions = type !== "objectif" || corps?.objectif?.mesure === "notions";
  if (besoinNotions && !notions.length) return { ok: false, code: "notions-requises" };

  let libelle = null;
  if (corps?.libelle !== undefined && corps.libelle !== null && String(corps.libelle).trim()) {
    const l = texteCourt(corps.libelle, { min: 1, max: LIBELLE_ACTIVITE_MAX });
    if (!l.ok) return { ok: false, code: `libelle-${l.erreur}` };
    libelle = l.texte;
  }
  let echeance = null;
  if (corps?.echeance) {
    if (!JOUR_ISO.test(corps.echeance) || Number.isNaN(Date.parse(`${corps.echeance}T00:00:00Z`))) return { ok: false, code: "echeance-invalide" };
    if (corps.echeance < aujourdhui || corps.echeance > decalerJour(aujourdhui, ECHEANCE_MAX_JOURS)) return { ok: false, code: "echeance-invalide" };
    echeance = corps.echeance;
  }

  const activite = { type, cible: { classeId, eleveId }, notions, libelle, echeance };
  if (type === "defi") activite.nbQuestions = QUESTIONS_DEFI;
  if (type === "evaluation") {
    const n = corps?.nbQuestions;
    if (!Number.isInteger(n) || n < QUESTIONS_EVALUATION_MIN || n > QUESTIONS_EVALUATION_MAX) return { ok: false, code: "nb-questions-invalide" };
    activite.nbQuestions = n;
  }
  if (type === "cahier") {
    const c = corps?.cahier ?? {};
    if (!TYPES_CAHIER_PROF.includes(c.type)) return { ok: false, code: "cahier-invalide" };
    activite.cahier = {
      type: c.type, longueur: parmiListe(LONGUEURS_CAHIER_PROF, c.longueur, "standard"),
      univers: parmiListe(UNIVERS_CAHIER_PROF, c.univers, "aucun"), objectif: parmiListe(OBJECTIFS_CAHIER_PROF, c.objectif, "reviser"),
      ia: c.ia === true
    };
  }
  if (type === "objectif") {
    const mesure = MESURES_OBJECTIF.includes(corps?.objectif?.mesure) ? corps.objectif.mesure : null;
    if (!mesure) return { ok: false, code: "objectif-invalide" };
    const valeur = mesure === "notions" ? notions.length : corps?.objectif?.valeur;
    const [min, max] = BORNES_OBJECTIF[mesure];
    if (!Number.isInteger(valeur) || valeur < min || valeur > max) return { ok: false, code: "objectif-invalide" };
    activite.objectif = { mesure, valeur };
    if (mesure !== "notions") activite.notions = [];
  }
  return { ok: true, activite };
}

/** Paramètres gardés en base pour une activité validée (JSON), sans la cible ni l'échéance (colonnes à part). */
export const parametresActivite = (a) => ({
  notions: a.notions, libelle: a.libelle,
  ...(a.nbQuestions ? { nbQuestions: a.nbQuestions } : {}), ...(a.cahier ? { cahier: a.cahier } : {}), ...(a.objectif ? { objectif: a.objectif } : {})
});

/**
 * Résultat envoyé par l'appareil de l'élève : compteurs bornés seulement (aucune réponse donnée, aucun texte).
 * @returns {{ activite: string, reussis: number, total: number, dureeS: number, termine: boolean } | null}
 */
export function validerResultat(brut) {
  if (!brut || typeof brut !== "object" || typeof brut.activite !== "string" || !/^[0-9a-z-]{1,64}$/.test(brut.activite)) return null;
  const entierBorne = (v, max) => (Number.isInteger(v) && v >= 0 ? Math.min(v, max) : 0);
  const total = entierBorne(brut.total, 500);
  return {
    activite: brut.activite, total, reussis: Math.min(entierBorne(brut.reussis, 500), total),
    dureeS: entierBorne(brut.dureeS, 86400), termine: brut.termine === true
  };
}

/** Générateur pseudo-aléatoire reproductible (mulberry32) à partir d'une chaîne. */
function generateur(graine) {
  let h = 1779033703 ^ String(graine).length;
  for (const c of String(graine)) { h = Math.imul(h ^ c.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Questions d'un défi ou d'une évaluation : tirage reproductible (graine = identifiant de l'activité) dans les QCM
 * publiés des notions choisies, en alternant les notions. Moins de questions que demandé si le catalogue n'en a pas
 * assez. `banque` : { notion: [{ question, choix, bonne, ... }] } dans l'ordre des notions de l'activité.
 */
export function construireQuiz(graine, banque, nbQuestions) {
  const aleatoire = generateur(graine);
  const melanger = (liste) => {
    const l = [...liste];
    for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(aleatoire() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
    return l;
  };
  const files = Object.entries(banque ?? {}).map(([notion, qs]) => melanger((qs ?? []).map((q) => ({ notion, ...q }))));
  const questions = [];
  while (questions.length < nbQuestions && files.some((f) => f.length)) {
    for (const f of files) if (f.length && questions.length < nbQuestions) questions.push(f.shift());
  }
  return questions;
}

/** Élèves concernés par une activité : ceux de la classe ciblée, ou l'élève ciblé. */
export function elevesCibles(activite, eleves) {
  const liste = Array.isArray(eleves) ? eleves : [];
  return activite.eleveId ? liste.filter((e) => e.id === activite.eleveId) : liste.filter((e) => e.classeId === activite.classeId);
}

const pourcent = (n, d) => (d > 0 ? Math.round((100 * n) / d) : null);

/** Score d'un résultat en pourcentage (meilleur essai pour un défi), null s'il n'y en a pas. */
export function scoreResultat(activite, r) {
  if (!r || !r.total) return null;
  return pourcent(activite.type === "defi" ? Math.max(r.meilleur ?? 0, r.reussis) : r.reussis, r.total);
}

/**
 * Avancement d'un objectif pour un élève. `bilan` : bilan vu par le professeur ; `terminees` : nombre d'activités du
 * professeur terminées par l'élève. Les mesures « temps » et « xp » portent sur les 7 derniers jours.
 * @returns {{ valeur: number, cible: number, atteint: boolean }}
 */
export function avancementObjectif(activite, { bilan, terminees = 0 }, aujourdhui) {
  const { mesure, valeur: cible } = activite.parametres.objectif;
  let valeur = 0;
  if (mesure === "temps") valeur = semaineBilan(bilan, aujourdhui).minutes;
  else if (mesure === "xp") valeur = semaineBilan(bilan, aujourdhui).xp;
  else if (mesure === "notions") valeur = activite.parametres.notions.filter((id) => bilan?.notions?.[id]?.etat === "maitrisee").length;
  else valeur = terminees;
  return { valeur, cible, atteint: valeur >= cible };
}

/**
 * Indicateurs d'une activité sur les élèves ciblés : attendus, commencés, terminés (objectif : atteint), taux de
 * complétion, score moyen (défis et évaluations), élèves en retard (échéance passée, non terminé).
 */
export function indicateursActivite(activite, { eleves, resultats, aujourdhui, terminees = () => 0 }) {
  const cibles = elevesCibles(activite, eleves);
  const deLActivite = new Map((resultats ?? []).filter((r) => r.activite === activite.id).map((r) => [r.eleve, r]));
  let commences = 0, termines = 0, retard = 0;
  const scores = [];
  for (const e of cibles) {
    const r = deLActivite.get(e.id);
    const fini = activite.type === "objectif"
      ? avancementObjectif(activite, { bilan: e.bilan, terminees: terminees(e.id) }, aujourdhui).atteint
      : !!r?.termine;
    if (r || fini) commences += 1;
    if (fini) termines += 1;
    else if (activite.echeance && activite.echeance < aujourdhui) retard += 1;
    const s = ["defi", "evaluation"].includes(activite.type) && r?.termine ? scoreResultat(activite, r) : null;
    if (s !== null) scores.push(s);
  }
  return {
    attendus: cibles.length, commences, termines, retard,
    completion: pourcent(termines, cibles.length),
    score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  };
}

/**
 * Tableau de bord du professeur, calculé dans son navigateur : engagement (actifs sur 7 jours, temps moyen,
 * complétion des activités, retards), performance (scores moyens des évaluations et des défis, part des notions
 * maîtrisées, notions à revoir), puis indicateurs par classe, par activité et élèves à suivre.
 */
export function tableauDeBord({ eleves = [], classes = [], activites = [], resultats = [] }, aujourdhui) {
  const actives = activites.filter((a) => a.statut !== "archivee");
  const terminePar = new Map();
  for (const r of resultats) if (r.termine) terminePar.set(r.eleve, (terminePar.get(r.eleve) ?? 0) + 1);
  const terminees = (id) => terminePar.get(id) ?? 0;
  const parActivite = actives.map((a) => ({ ...a, indicateurs: indicateursActivite(a, { eleves, resultats, aujourdhui, terminees }) }));

  const groupe = (liste, filtreActivite) => {
    const s = syntheseEleves(liste, aujourdhui);
    const ids = new Set(liste.map((e) => e.id));
    let attendus = 0, termines = 0, retard = 0;
    const scoresEval = [], scoresDefi = [];
    for (const a of parActivite.filter(filtreActivite)) {
      for (const e of elevesCibles(a, liste)) {
        if (!ids.has(e.id)) continue;
        attendus += 1;
        const r = resultats.find((x) => x.activite === a.id && x.eleve === e.id);
        const fini = a.type === "objectif" ? avancementObjectif(a, { bilan: e.bilan, terminees: terminees(e.id) }, aujourdhui).atteint : !!r?.termine;
        if (fini) termines += 1;
        else if (a.echeance && a.echeance < aujourdhui) retard += 1;
        const sc = r?.termine ? scoreResultat(a, r) : null;
        if (sc !== null && a.type === "evaluation") scoresEval.push(sc);
        if (sc !== null && a.type === "defi") scoresDefi.push(sc);
      }
    }
    let vues = 0, maitrisees = 0;
    for (const e of liste) for (const n of Object.values(e.bilan?.notions ?? {})) { vues += 1; if (n.etat === "maitrisee") maitrisees += 1; }
    const moyenne = (l) => (l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : null);
    return {
      eleves: s.eleves, actifs: s.actifs, tauxActifs: pourcent(s.actifs, s.eleves),
      minutesMoyennes: s.eleves ? Math.round(s.minutes / s.eleves) : 0,
      attendus, termines, completion: pourcent(termines, attendus), retard,
      scoreEvaluations: moyenne(scoresEval), scoreDefis: moyenne(scoresDefi),
      maitrise: pourcent(maitrisees, vues), aRevoir: s.aRevoir
    };
  };

  const global = groupe(eleves, () => true);
  const parClasse = [...classes.map((c) => ({ id: c.id, nom: c.nom, matiere: c.matiere, niveau: c.niveau, ...groupe(eleves.filter((e) => e.classeId === c.id), () => true) })),
    ...(eleves.some((e) => !e.classeId) ? [{ id: "particulier", nom: null, ...groupe(eleves.filter((e) => !e.classeId), () => true) }] : [])];

  // Élèves à suivre : inactifs, en retard, ou score moyen faible.
  const aSuivre = [];
  for (const e of eleves) {
    const raisons = [];
    const derniere = e.bilan?.dernierJour;
    if (!derniere) raisons.push("jamais");
    else if (ecartJours(derniere, aujourdhui) >= JOURS_INACTIVITE) raisons.push("inactif");
    const siens = parActivite.filter((a) => elevesCibles(a, [e]).length);
    const enRetard = siens.filter((a) => a.echeance && a.echeance < aujourdhui && a.type !== "objectif"
      && !resultats.some((r) => r.activite === a.id && r.eleve === e.id && r.termine)).length;
    if (enRetard) raisons.push("retard");
    const scores = siens.filter((a) => ["defi", "evaluation"].includes(a.type))
      .map((a) => scoreResultat(a, resultats.find((r) => r.activite === a.id && r.eleve === e.id && r.termine))).filter((v) => v !== null);
    const moyenne = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    if (moyenne !== null && moyenne < SEUIL_SCORE_FAIBLE) raisons.push("score");
    if (raisons.length) aSuivre.push({ eleve: e.id, raisons, retard: enRetard, score: moyenne });
  }
  return { global, parClasse, activites: parActivite, aSuivre };
}
