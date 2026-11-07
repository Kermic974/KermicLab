// Contributions au contenu des notions (ADR 0023) : logique pure (aucun accès au DOM ni au réseau), testable sous Node,
// partagée par l'interface (web/app.js) et le Worker (worker/src/contributions.js) : un seul jeu de règles.
// Scénario sans IA : un contributeur ou un prof propose de modifier (ou de compléter) un champ texte du `contenu.json`
// d'une notion ; un prof relit et décide. Une contribution validée ouvre une issue GitHub : la publication reste une PR
// validée par le CODEOWNER (déterminisme du catalogue).
// Ce module n'importe rien : les imports de app.js sont versionnés par le build.

/** Rôles d'un compte (`comptes.role`). `parent` est le rôle par défaut (ADR 0010). */
export const ROLES = ["parent", "contributeur", "prof", "admin"];
export const ROLES_CONTRIBUTION = ["contributeur", "prof", "admin"];
export const ROLES_RELECTURE = ["prof", "admin"];

export const STATUTS = ["proposee", "a_reviser", "validee", "refusee", "retiree", "integree"];
/** Statuts « en cours » : la contribution attend une action (relecture ou révision). */
export const STATUTS_OUVERTS = ["proposee", "a_reviser"];
export const TYPES = ["correction", "clarification", "exemple", "orthographe", "autre"];
export const NATURES = ["modification", "ajout"];
export const VERSION_CHARTE = "charte-contributeur-v1";

export const TEXTE_MAX = 2000;
export const MOTIF_MIN = 5;
export const MOTIF_MAX = 500;
export const COMMENTAIRE_MAX = 1000;
export const MAX_OUVERTES_PAR_AUTEUR = 20;

/** Clés textuelles éditables d'un `contenu.json` (docs/gabarit.md). Les nombres, types et figures restent hors champ. */
export const CLES_TEXTE = [
  "intro", "titre", "niveau", "paragraphes", "etapes", "aRetenir", "question", "choix", "explication", "indice",
  "indices", "solution", "histoire", "conclusion", "formule", "pointsCles"
];
/** Listes de textes : on peut y proposer un ajout (inséré après l'élément visé). */
export const LISTES_TEXTE = ["paragraphes", "etapes", "choix", "indices", "histoire", "pointsCles"];
const RACINES = ["intro", "niveaux", "application", "situation", "memo"];
const SEGMENT = /^(?:\d{1,3}|[a-zA-Z]{1,20})$/;

export const peutContribuer = (role) => ROLES_CONTRIBUTION.includes(role);
export const peutRelire = (role) => ROLES_RELECTURE.includes(role);

/** Chemin d'un champ : `niveaux.1.paragraphes.0`, `situation.conclusion`… (racine connue, feuille textuelle). */
export function cheminValide(chemin) {
  if (typeof chemin !== "string" || chemin.length > 80) return false;
  const segments = chemin.split(".");
  if (segments.length > 6 || !segments.every((s) => SEGMENT.test(s))) return false;
  if (!RACINES.includes(segments[0])) return false;
  if (segments.includes("figure") || segments.includes("titresOnglets")) return false;
  const feuille = /^\d+$/.test(segments.at(-1)) ? segments.at(-2) : segments.at(-1);
  return CLES_TEXTE.includes(feuille);
}

/** Une proposition d'ajout vise un élément d'une liste de textes (le nouveau texte est inséré après lui). */
export function ajoutPossible(chemin) {
  const segments = String(chemin).split(".");
  return /^\d+$/.test(segments.at(-1)) && LISTES_TEXTE.includes(segments.at(-2));
}

export function valeurAChemin(contenu, chemin) {
  let v = contenu;
  for (const s of String(chemin).split(".")) {
    if (v === null || typeof v !== "object") return undefined;
    v = v[/^\d+$/.test(s) ? Number(s) : s];
  }
  return v;
}

/**
 * Champs texte éditables d'une notion, dans l'ordre de la page, avec la section (pour grouper la liste).
 * @returns {{ chemin: string, section: string, valeur: string, liste: boolean }[]}
 */
export function champsEditables(contenu) {
  const champs = [];
  const parcourir = (v, segments) => {
    if (typeof v === "string") {
      const chemin = segments.join(".");
      if (cheminValide(chemin) && v.trim()) champs.push({ chemin, section: segments[0], valeur: v, liste: ajoutPossible(chemin) });
      return;
    }
    if (Array.isArray(v)) v.forEach((x, i) => parcourir(x, [...segments, String(i)]));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) parcourir(x, [...segments, k]);
  };
  if (contenu && typeof contenu === "object") for (const racine of RACINES) if (racine in contenu) parcourir(contenu[racine], [racine]);
  return champs;
}

/** Libellé lisible d'un chemin : « Niveau 2 › paragraphe 1 » (indices à partir de 1). `t` traduit les clés `champ_<clé>`. */
export function libelleChemin(chemin, t = (cle) => cle) {
  const parties = [];
  const segments = String(chemin).split(".");
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (/^\d+$/.test(s)) continue;
    const suivant = segments[i + 1];
    const numero = suivant !== undefined && /^\d+$/.test(suivant) ? ` ${Number(suivant) + 1}` : "";
    parties.push(`${t(`champ_${s}`)}${numero}`);
  }
  return parties.join(" › ");
}

const nettoyer = (texte) => (typeof texte === "string" ? texte.replace(/\r\n?/g, "\n").trim() : "");
const BALISE = /<\s*\/?\s*[a-zA-Z!]/;
const LIEN = /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\./i;

/**
 * Valide une proposition (interface et Worker). Les données personnelles sont filtrées en plus par le Worker
 * (worker/src/moderation.js) ; la relecture humaine reste le contrôle final.
 * @returns {{ ok: true, contribution: object } | { ok: false, erreurs: Record<string, string> }}
 */
export function validerContribution(donnees = {}, { texteActuel } = {}) {
  const erreurs = {};
  const d = donnees && typeof donnees === "object" ? donnees : {};
  if (typeof d.notion_id !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(d.notion_id)) erreurs.notion = "invalide";
  if (!cheminValide(d.chemin)) erreurs.chemin = "invalide";
  const nature = NATURES.includes(d.nature) ? d.nature : null;
  if (!nature) erreurs.nature = "invalide";
  else if (nature === "ajout" && !erreurs.chemin && !ajoutPossible(d.chemin)) erreurs.nature = "ajout-impossible";
  if (!TYPES.includes(d.type)) erreurs.type = "invalide";
  const texte = nettoyer(d.texte_propose);
  const actuel = nettoyer(texteActuel ?? d.texte_actuel);
  if (!texte) erreurs.texte = "vide";
  else if (texte.length > TEXTE_MAX) erreurs.texte = "trop-long";
  else if (BALISE.test(texte)) erreurs.texte = "balise";
  else if (LIEN.test(texte)) erreurs.texte = "lien";
  else if (nature === "modification" && texte === actuel) erreurs.texte = "identique";
  if (!actuel || actuel.length > TEXTE_MAX * 2) erreurs.chemin ??= "invalide";
  const motif = nettoyer(d.motif);
  if (motif.length < MOTIF_MIN) erreurs.motif = "trop-court";
  else if (motif.length > MOTIF_MAX) erreurs.motif = "trop-long";
  else if (BALISE.test(motif) || LIEN.test(motif)) erreurs.motif = "balise";
  if (d.charte_version !== VERSION_CHARTE) erreurs.charte = "requise";
  if (Object.keys(erreurs).length) return { ok: false, erreurs };
  return {
    ok: true,
    contribution: {
      notion_id: d.notion_id, chemin: d.chemin, nature, type: d.type,
      texte_actuel: actuel, texte_propose: texte, motif, charte_version: VERSION_CHARTE
    }
  };
}

/** Commentaire du relecteur : obligatoire pour refuser ou demander une révision. */
export function validerCommentaire(commentaire, action) {
  const c = nettoyer(commentaire);
  if (c.length > COMMENTAIRE_MAX) return { ok: false, erreur: "trop-long" };
  if (BALISE.test(c)) return { ok: false, erreur: "balise" };
  if (["refuser", "reviser"].includes(action) && c.length < MOTIF_MIN) return { ok: false, erreur: "requis" };
  return { ok: true, commentaire: c };
}

/**
 * Transitions : qui peut faire quoi, depuis quel statut.
 * - auteur : `modifier` (proposée ou à réviser → proposée), `retirer` (proposée ou à réviser → retirée) ;
 * - relecteur (prof ou admin) : `valider`, `refuser`, `reviser` (depuis proposée), `integrer` (validée → intégrée).
 *   Un prof ne décide jamais sur sa propre contribution (relecture à quatre yeux) ; l'admin (propriétaire) le peut.
 */
export const TRANSITIONS = {
  modifier: { depuis: ["proposee", "a_reviser"], vers: "proposee", qui: "auteur" },
  retirer: { depuis: ["proposee", "a_reviser"], vers: "retiree", qui: "auteur" },
  valider: { depuis: ["proposee"], vers: "validee", qui: "relecteur" },
  refuser: { depuis: ["proposee"], vers: "refusee", qui: "relecteur" },
  reviser: { depuis: ["proposee"], vers: "a_reviser", qui: "relecteur" },
  integrer: { depuis: ["validee"], vers: "integree", qui: "relecteur" }
};

/** @returns {{ ok: true, vers: string } | { ok: false, code: string }} */
export function transition(contribution, action, { compteId, role } = {}) {
  const regle = TRANSITIONS[action];
  if (!regle) return { ok: false, code: "action-inconnue" };
  if (!contribution || !regle.depuis.includes(contribution.statut)) return { ok: false, code: "statut-incompatible" };
  const auteur = contribution.auteur_id === compteId;
  if (regle.qui === "auteur" && !auteur) return { ok: false, code: "reserve-auteur" };
  if (regle.qui === "relecteur") {
    if (!peutRelire(role)) return { ok: false, code: "role-requis" };
    if (auteur && role !== "admin") return { ok: false, code: "relecture-quatre-yeux" };
  }
  return { ok: true, vers: regle.vers };
}

/** Actions proposées à l'écran pour une contribution, dans l'ordre d'affichage. */
export function actionsPossibles(contribution, contexte) {
  return Object.keys(TRANSITIONS).filter((a) => a !== "modifier" && transition(contribution, a, contexte).ok);
}

/** Compteurs du tableau de bord : un nombre par statut, plus le total. */
export function resumer(contributions = []) {
  const resume = Object.fromEntries(STATUTS.map((s) => [s, 0]));
  for (const c of contributions) if (c && c.statut in resume) resume[c.statut]++;
  resume.total = contributions.length;
  return resume;
}

/** Filtre du tableau de bord : statut (`tous` ou un statut), notion et matière (`""` pour toutes). */
export function filtrer(contributions = [], { statut = "proposee", notion = "", matiere = "" } = {}, matiereDe = () => "autres") {
  return contributions
    .filter((c) => (statut === "tous" || c.statut === statut) && (!notion || c.notion_id === notion)
      && (!matiere || (matiereDe(c.notion_id) || "autres") === matiere))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

/** Le texte de la notion a changé depuis la proposition (catalogue mis à jour entre-temps) : à relire avec soin. */
export function estObsolete(contribution, contenuActuel) {
  if (!contenuActuel) return false;
  const v = valeurAChemin(contenuActuel, contribution.chemin);
  return typeof v !== "string" || nettoyer(v) !== nettoyer(contribution.texte_actuel);
}

/** Applique une contribution à un contenu (copie) : utile à l'intégration et à l'aperçu. */
export function appliquer(contenu, { chemin, nature, texte_propose }) {
  const copie = structuredClone(contenu);
  const segments = chemin.split(".");
  const dernier = segments.pop();
  const parent = segments.length ? valeurAChemin(copie, segments.join(".")) : copie;
  if (!parent || typeof parent !== "object") throw new Error("chemin-introuvable");
  if (nature === "ajout") {
    if (!Array.isArray(parent)) throw new Error("ajout-impossible");
    parent.splice(Number(dernier) + 1, 0, texte_propose);
  } else {
    if (typeof parent[/^\d+$/.test(dernier) ? Number(dernier) : dernier] !== "string") throw new Error("chemin-introuvable");
    parent[/^\d+$/.test(dernier) ? Number(dernier) : dernier] = texte_propose;
  }
  return copie;
}

/**
 * Différence mot à mot (plus longue sous-suite commune) pour l'affichage avant / après.
 * @returns {{ type: "egal" | "retire" | "ajoute", texte: string }[]}
 */
export function diffMots(avant, apres) {
  // Un mot et l'espace qui le suit forment un seul jeton : les mots ajoutés à la suite restent dans un seul bloc.
  const jetons = (texte) => String(texte ?? "").match(/\s+|\S+\s*/gy) ?? [];
  const a = jetons(avant);
  const b = jetons(apres);
  if (a.length * b.length > 250_000) return [{ type: "retire", texte: a.join("") }, { type: "ajoute", texte: b.join("") }];
  const l = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) l[i][j] = a[i] === b[j] ? l[i + 1][j + 1] + 1 : Math.max(l[i + 1][j], l[i][j + 1]);
  }
  const morceaux = [];
  const pousser = (type, texte) => {
    const dernier = morceaux.at(-1);
    if (dernier?.type === type) dernier.texte += texte; else morceaux.push({ type, texte });
  };
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { pousser("egal", a[i]); i++; j++; }
    else if (l[i + 1][j] >= l[i][j + 1]) pousser("retire", a[i++]);
    else pousser("ajoute", b[j++]);
  }
  while (i < a.length) pousser("retire", a[i++]);
  while (j < b.length) pousser("ajoute", b[j++]);
  return morceaux;
}

/** Code court et stable d'un auteur, affiché à la place de toute identité (aucune donnée personnelle). */
export function codeAuteur(auteurId) {
  return String(auteurId ?? "").replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase() || "?";
}

/** Nettoie une liste reçue de l'API : seuls les champs attendus. */
export function normaliserContributions(liste) {
  if (!Array.isArray(liste)) return [];
  const champs = ["id", "auteur_id", "notion_id", "notion_version", "chemin", "nature", "type", "texte_actuel", "texte_propose",
    "motif", "statut", "commentaire", "issue_numero", "created_at", "updated_at", "decided_at"];
  return liste
    .filter((c) => c && typeof c.id === "string" && STATUTS.includes(c.statut) && cheminValide(c.chemin))
    .map((c) => Object.fromEntries(champs.map((k) => [k, c[k] ?? null])));
}

/* ---------- Édition ciblée et vue par matière ---------- */

/** Onglet de la page où apparaît un champ : `explication` (intro, niveaux), `memo`, `application` ou `mise-en-situation`. */
export function ongletDuChemin(chemin) {
  const racine = String(chemin).split(".")[0];
  return { intro: "explication", niveaux: "explication", memo: "memo", application: "application", situation: "mise-en-situation" }[racine]
    ?? "explication";
}
export const ORDRE_ONGLETS = ["explication", "memo", "application", "mise-en-situation"];

/**
 * Champs éditables regroupés par onglet, dans l'ordre de la page, avec le nombre de propositions en cours sur chacun.
 * @returns {{ onglet: string, champs: { chemin: string, valeur: string, liste: boolean, enCours: number }[] }[]}
 */
export function champsParOnglet(contenu, contributions = [], notionId = null) {
  const enCours = compterEnCoursParChemin(contributions, notionId);
  const groupes = new Map(ORDRE_ONGLETS.map((o) => [o, []]));
  for (const c of champsEditables(contenu)) groupes.get(ongletDuChemin(c.chemin)).push({ ...c, enCours: enCours.get(c.chemin) ?? 0 });
  return [...groupes].filter(([, champs]) => champs.length).map(([onglet, champs]) => ({ onglet, champs }));
}

/** Propositions en cours (à relire ou à réviser) par chemin, pour une notion. */
export function compterEnCoursParChemin(contributions = [], notionId = null) {
  const n = new Map();
  for (const c of contributions) {
    if (!c || (notionId && c.notion_id !== notionId) || !STATUTS_OUVERTS.includes(c.statut)) continue;
    n.set(c.chemin, (n.get(c.chemin) ?? 0) + 1);
  }
  return n;
}

/**
 * Synthèse matière par matière, puis notion par notion (tableau de bord du prof).
 * `matiereDe(notionId)` donne la matière d'une notion (index des contenus) ; inconnue → « autres ».
 * @returns {{ matiere: string, resume: object, notions: { id: string, resume: object }[] }[]}
 */
export function grouperParMatiere(contributions = [], matiereDe = () => "autres") {
  const matieres = new Map();
  for (const c of contributions) {
    if (!c) continue;
    const m = matiereDe(c.notion_id) || "autres";
    if (!matieres.has(m)) matieres.set(m, new Map());
    const notions = matieres.get(m);
    if (!notions.has(c.notion_id)) notions.set(c.notion_id, []);
    notions.get(c.notion_id).push(c);
  }
  return [...matieres].map(([matiere, notions]) => ({
    matiere,
    resume: resumer([...notions.values()].flat()),
    notions: [...notions].map(([id, liste]) => ({ id, resume: resumer(liste) }))
      .sort((a, b) => b.resume.proposee - a.resume.proposee || a.id.localeCompare(b.id))
  })).sort((a, b) => b.resume.proposee - a.resume.proposee || a.matiere.localeCompare(b.matiere));
}
