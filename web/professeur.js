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

/** Filtre des élèves : « tous », « particulier » (sans classe) ou l'identifiant d'une classe. */
export function filtrerEleves(eleves, filtre) {
  const liste = Array.isArray(eleves) ? eleves : [];
  if (!filtre || filtre === "tous") return liste;
  if (filtre === "particulier") return liste.filter((e) => !e.classeId);
  return liste.filter((e) => e.classeId === filtre);
}
