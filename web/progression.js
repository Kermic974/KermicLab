// Progression locale du visiteur : série de jours, XP, niveaux et badges.
// Logique pure (aucun accès au DOM) : testable sous Node et prête à être synchronisée
// vers la table `progres` quand les comptes parent seront activés (ADR 0010, phase C).
// Aucune donnée personnelle : uniquement des compteurs et des identifiants de notions du catalogue.

export const CLE_STOCKAGE = "kermiclab:progression";
export const XP_QUESTION = 10;
export const XP_NOTION = 25;
export const XP_PAR_NIVEAU = 100;
const MAX_NOTIONS = 200;

/** Badges : l'icône est décorative, le nom et la description viennent de i18n (`badge_<id>`, `badge_<id>_desc`). */
export const BADGES = [
  { id: "premier-pas", icone: "👣", obtenu: (p) => p.questions >= 1 },
  { id: "explorateur", icone: "🧭", obtenu: (p) => p.notions.length >= 1 },
  { id: "curieux", icone: "🔍", obtenu: (p) => p.questions >= 5 },
  { id: "serie-3", icone: "🔥", obtenu: (p) => p.serieMax >= 3 },
  { id: "collectionneur", icone: "🗂️", obtenu: (p) => p.notions.length >= 3 },
  { id: "passionne", icone: "🚀", obtenu: (p) => p.questions >= 25 },
  { id: "serie-7", icone: "🏆", obtenu: (p) => p.serieMax >= 7 }
];

export function etatInitial() {
  return { version: 1, questions: 0, xp: 0, notions: [], serie: 0, serieMax: 0, dernierJour: null, badges: [] };
}

/** Date locale au format AAAA-MM-JJ (la série suit le calendrier de l'utilisateur, pas UTC). */
export function jourLocal(date = new Date()) {
  const deux = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

function veille(jour) {
  const [a, m, j] = jour.split("-").map(Number);
  return jourLocal(new Date(a, m - 1, j - 1));
}

function entierPositif(v) {
  return Number.isInteger(v) && v >= 0 ? v : 0;
}

/** Relit un état stocké en le validant : un stockage corrompu ou modifié à la main repart de zéro champ par champ. */
export function normaliser(brut) {
  const base = etatInitial();
  if (!brut || typeof brut !== "object") return base;
  const jourValide = typeof brut.dernierJour === "string" && /^\d{4}-\d{2}-\d{2}$/.test(brut.dernierJour);
  const ids = (l) => (Array.isArray(l) ? [...new Set(l.filter((x) => typeof x === "string" && x.length <= 80))] : []);
  return {
    ...base,
    questions: entierPositif(brut.questions),
    xp: entierPositif(brut.xp),
    notions: ids(brut.notions).slice(0, MAX_NOTIONS),
    serie: entierPositif(brut.serie),
    serieMax: entierPositif(brut.serieMax),
    dernierJour: jourValide ? brut.dernierJour : null,
    badges: ids(brut.badges).filter((id) => BADGES.some((b) => b.id === id))
  };
}

function attribuerBadges(p) {
  const nouveaux = BADGES.filter((b) => !p.badges.includes(b.id) && b.obtenu(p));
  return { p: { ...p, badges: [...p.badges, ...nouveaux.map((b) => b.id)] }, nouveaux };
}

function avecNiveau(avant, resultat) {
  return { ...resultat, niveauGagne: niveau(resultat.p).niveau > niveau(avant).niveau };
}

/** Une question posée : met à jour la série du jour et l'XP. */
export function enregistrerQuestion(avant, jour = jourLocal()) {
  let { serie, dernierJour } = avant;
  if (dernierJour !== jour) {
    serie = dernierJour === veille(jour) ? serie + 1 : 1;
    dernierJour = jour;
  }
  const p = {
    ...avant,
    questions: avant.questions + 1,
    xp: avant.xp + XP_QUESTION,
    serie,
    serieMax: Math.max(avant.serieMax, serie),
    dernierJour
  };
  return { ...avecNiveau(avant, attribuerBadges(p)), xpGagne: XP_QUESTION, nouvelleNotion: false };
}

/** Une page (notion du catalogue) ouverte : bonus d'XP la première fois seulement. */
export function enregistrerNotion(avant, id) {
  if (typeof id !== "string" || !id || avant.notions.includes(id)) {
    return { p: avant, nouveaux: [], niveauGagne: false, xpGagne: 0, nouvelleNotion: false };
  }
  const p = { ...avant, notions: [...avant.notions, id].slice(-MAX_NOTIONS), xp: avant.xp + XP_NOTION };
  return { ...avecNiveau(avant, attribuerBadges(p)), xpGagne: XP_NOTION, nouvelleNotion: true };
}

/** Série affichée : elle tombe à 0 si le dernier jour actif n'est ni aujourd'hui ni hier. */
export function serieCourante(p, jour = jourLocal()) {
  return p.dernierJour === jour || p.dernierJour === veille(jour) ? p.serie : 0;
}

export function niveau(p) {
  return {
    niveau: Math.floor(p.xp / XP_PAR_NIVEAU) + 1,
    xpDansNiveau: p.xp % XP_PAR_NIVEAU,
    xpParNiveau: XP_PAR_NIVEAU
  };
}

export function charger(stockage) {
  try { return normaliser(JSON.parse(stockage?.getItem(CLE_STOCKAGE) ?? "null")); } catch { return etatInitial(); }
}

export function sauver(stockage, p) {
  try { stockage?.setItem(CLE_STOCKAGE, JSON.stringify(p)); } catch { /* stockage indisponible : la progression reste en mémoire */ }
}
