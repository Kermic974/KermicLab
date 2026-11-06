// Progression locale du visiteur : série de jours, XP, niveaux, badges, temps actif et découvertes.
// Logique pure (aucun accès au DOM) : testable sous Node et prête à être synchronisée
// vers la table `progres` quand les comptes parent seront activés (ADR 0010, phase C).
// Aucune donnée personnelle : uniquement des compteurs, des durées et des identifiants du catalogue.
//
// Schéma v2 (docs/progression.md) : ajoute à la v1, sans rien retirer,
//   - tempsActif : { total, sections: { id: ms }, experiences: { "type:id": ms } } en millisecondes (web/temps-actif.js) ;
//   - jours[j].s : temps actif du jour (ms) ;
//   - decouvertes : { type: { id: { premiere: "AAAA-MM-JJ" | null, ouvertures } } } pour tout type d'expérience
//     (section, matiere, notion, jeu… : le modèle ne connaît aucun type en particulier) ;
//   - derniere : { type, id } dernière expérience ouverte (notion ou jeu), pour « Reprendre ».
// Une donnée v1 est relue sans perte : ses notions deviennent des découvertes de type « notion », sans date ni nombre
// d'ouvertures inventés (premiere: null, ouvertures: 0 = « pas encore compté »).

export const CLE_STOCKAGE = "kermiclab:progression";
export const XP_QUESTION = 10;
export const XP_NOTION = 25;
export const XP_PAR_NIVEAU = 100;
/** Défi express : XP par bonne réponse, une seule fois par jour. */
export const XP_DEFI_BONNE = 5;
const MAX_NOTIONS = 200;
export const VERSION = 2;
/** Limites de taille : la progression reste petite, même manipulée à la main. */
const MAX_PAR_TYPE = 500;
const MAX_TYPES = 12;
const TYPE = /^[a-z][a-z-]{0,19}$/;
const IDENTIFIANT = /^[a-z0-9][a-z0-9-]{0,79}$/;
/** Temps actif maximal accepté pour un relevé : protège contre une horloge déréglée (une journée). */
const MAX_RELEVE_MS = 24 * 3600 * 1000;
/** Historique par jour gardé pour le tableau de bord (graphique de la semaine). */
const MAX_JOURS = 31;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Badges : l'icône est décorative, le nom et la description viennent de i18n (`badge_<id>`, `badge_<id>_desc`). */
export const BADGES = [
  { id: "premier-pas", icone: "👣", obtenu: (p) => p.questions >= 1 },
  { id: "explorateur", icone: "🧭", obtenu: (p) => p.notions.length >= 1 },
  { id: "curieux", icone: "🔍", obtenu: (p) => p.questions >= 5 },
  { id: "serie-3", icone: "🔥", obtenu: (p) => p.serieMax >= 3 },
  { id: "collectionneur", icone: "🗂️", obtenu: (p) => p.notions.length >= 3 },
  { id: "passionne", icone: "🚀", obtenu: (p) => p.questions >= 25 },
  { id: "serie-7", icone: "🏆", obtenu: (p) => p.serieMax >= 7 },
  { id: "assidu", icone: "⏱️", obtenu: (p) => p.tempsActif.total >= 3_600_000 }
];

/** Avancement d'un badge, pour montrer « ce qui est à portée » sans afficher une grille de badges verrouillés. */
const AVANCES = {
  "premier-pas": (p) => [p.questions, 1], explorateur: (p) => [p.notions.length, 1], curieux: (p) => [p.questions, 5],
  "serie-3": (p) => [p.serieMax, 3], collectionneur: (p) => [p.notions.length, 3], passionne: (p) => [p.questions, 25],
  "serie-7": (p) => [p.serieMax, 7], assidu: (p) => [Math.floor(p.tempsActif.total / 60_000), 60]
};
export function avancementBadges(p) {
  return BADGES.map((b) => {
    const [actuel, cible] = AVANCES[b.id](p);
    return { id: b.id, icone: b.icone, obtenu: p.badges.includes(b.id), actuel: Math.max(0, Math.min(actuel, cible)), cible };
  });
}

export function etatInitial() {
  return {
    version: VERSION, questions: 0, xp: 0, notions: [], serie: 0, serieMax: 0, dernierJour: null, badges: [], jours: {},
    derniereNotion: null, defiJour: null, tempsActif: { total: 0, sections: {}, experiences: {} }, decouvertes: {}, derniere: null
  };
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
  const estJour = (v) => typeof v === "string" && JOUR.test(v);
  const jourValide = estJour(brut.dernierJour);
  const ids = (l) => (Array.isArray(l) ? [...new Set(l.filter((x) => typeof x === "string" && x.length <= 80))] : []);
  const p = {
    ...base,
    questions: entierPositif(brut.questions),
    xp: entierPositif(brut.xp),
    notions: ids(brut.notions).slice(0, MAX_NOTIONS),
    serie: entierPositif(brut.serie),
    serieMax: entierPositif(brut.serieMax),
    dernierJour: jourValide ? brut.dernierJour : null,
    badges: ids(brut.badges).filter((id) => BADGES.some((b) => b.id === id)),
    jours: normaliserJours(brut.jours),
    derniereNotion: typeof brut.derniereNotion === "string" && brut.derniereNotion.length <= 80 ? brut.derniereNotion : null,
    defiJour: estJour(brut.defiJour) ? brut.defiJour : null,
    tempsActif: normaliserTemps(brut.tempsActif),
    decouvertes: {},
    derniere: null
  };
  // Découvertes : celles qui sont stockées, plus les notions de la v1 (et de toute version) qui n'y seraient pas.
  p.decouvertes = normaliserDecouvertes(brut.decouvertes);
  for (const id of p.notions) if (IDENTIFIANT.test(id)) p.decouvertes.notion = { ...p.decouvertes.notion, [id]: p.decouvertes.notion?.[id] ?? { premiere: null, ouvertures: 0 } };
  const d = brut.derniere;
  p.derniere = d && TYPE.test(d.type) && IDENTIFIANT.test(d.id) ? { type: d.type, id: d.id }
    : p.derniereNotion && IDENTIFIANT.test(p.derniereNotion) ? { type: "notion", id: p.derniereNotion } : null;
  return p;
}

const objet = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const duree = (v) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);

function normaliserTemps(brut) {
  const b = objet(brut);
  const carte = (o, motif) => Object.fromEntries(Object.entries(objet(o)).filter(([k, v]) => motif.test(k) && duree(v) > 0).slice(0, MAX_PAR_TYPE).map(([k, v]) => [k, duree(v)]));
  return { total: duree(b.total), sections: carte(b.sections, IDENTIFIANT), experiences: carte(b.experiences, /^[a-z][a-z-]{0,19}:[a-z0-9][a-z0-9-]{0,79}$/) };
}

function normaliserDecouvertes(brut) {
  const sortie = {};
  for (const [type, liste] of Object.entries(objet(brut)).filter(([type]) => TYPE.test(type)).slice(0, MAX_TYPES)) {
    const entrees = Object.entries(objet(liste)).filter(([id]) => IDENTIFIANT.test(id)).slice(0, MAX_PAR_TYPE);
    if (!entrees.length) continue;
    sortie[type] = Object.fromEntries(entrees.map(([id, v]) => {
      const e = objet(v);
      return [id, { premiere: typeof e.premiere === "string" && JOUR.test(e.premiere) ? e.premiere : null, ouvertures: entierPositif(e.ouvertures) }];
    }));
  }
  return sortie;
}

/** Historique par jour : { "AAAA-MM-JJ": { q, n, xp, s } }, limité aux derniers jours (s : temps actif en ms). */
function normaliserJours(brut) {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const cles = Object.keys(brut).filter((j) => JOUR.test(j) && brut[j] && typeof brut[j] === "object").sort().slice(-MAX_JOURS);
  return Object.fromEntries(cles.map((j) => {
    const jour = { q: entierPositif(brut[j].q), n: entierPositif(brut[j].n), xp: entierPositif(brut[j].xp) };
    const s = duree(brut[j].s);
    return [j, s ? { ...jour, s } : jour];
  }));
}

function ajouterAuJour(jours, jour, { q = 0, n = 0, xp = 0, s = 0 }) {
  const avant = jours?.[jour] ?? { q: 0, n: 0, xp: 0, s: 0 };
  return normaliserJours({ ...jours, [jour]: { q: avant.q + q, n: avant.n + n, xp: avant.xp + xp, s: (avant.s ?? 0) + s } });
}

/** Série de jours actifs : +1 si le dernier jour actif était la veille, 1 après un trou, inchangée le même jour. */
function avecSerie(p, jour) {
  if (p.dernierJour === jour) return p;
  const serie = p.dernierJour === veille(jour) ? p.serie + 1 : 1;
  return { ...p, serie, serieMax: Math.max(p.serieMax, serie), dernierJour: jour };
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
  const p = {
    ...avecSerie(avant, jour),
    questions: avant.questions + 1,
    xp: avant.xp + XP_QUESTION,
    jours: ajouterAuJour(avant.jours, jour, { q: 1, xp: XP_QUESTION })
  };
  return { ...avecNiveau(avant, attribuerBadges(p)), xpGagne: XP_QUESTION, nouvelleNotion: false };
}

/** Une page (notion du catalogue) ouverte : bonus d'XP la première fois seulement ; toujours retenue comme « à reprendre ». */
export function enregistrerNotion(avant, id, jour = jourLocal()) {
  if (typeof id !== "string" || !id || id.length > 80) {
    return { p: avant, nouveaux: [], niveauGagne: false, xpGagne: 0, nouvelleNotion: false };
  }
  const { p: decouvert } = decouvrir(avant, "notion", id, jour);
  const repere = { ...decouvert, derniereNotion: id, derniere: { type: "notion", id } };
  if (avant.notions.includes(id)) {
    return { p: repere, nouveaux: [], niveauGagne: false, xpGagne: 0, nouvelleNotion: false };
  }
  const p = {
    ...repere,
    notions: [...avant.notions, id].slice(-MAX_NOTIONS),
    xp: avant.xp + XP_NOTION,
    jours: ajouterAuJour(avant.jours, jour, { n: 1, xp: XP_NOTION })
  };
  return { ...avecNiveau(avant, attribuerBadges(p)), xpGagne: XP_NOTION, nouvelleNotion: true };
}

/**
 * Découverte générique d'une expérience (section, matière, notion, jeu… : n'importe quel type).
 * La première fois, l'expérience devient « découverte » ; chaque ouverture suivante est comptée.
 * Aucune règle propre à un contenu : le type et l'identifiant suffisent.
 */
export function decouvrir(avant, type, id, jour = jourLocal()) {
  if (typeof type !== "string" || typeof id !== "string" || !TYPE.test(type) || !IDENTIFIANT.test(id)) return { p: avant, nouvelle: false };
  const liste = avant.decouvertes?.[type];
  const tropDeTypes = !liste && Object.keys(avant.decouvertes ?? {}).length >= MAX_TYPES;
  const pleine = liste && !liste[id] && Object.keys(liste).length >= MAX_PAR_TYPE;
  if (tropDeTypes || pleine) return { p: avant, nouvelle: false };
  const existante = liste?.[id];
  const entree = { premiere: existante ? existante.premiere : jour, ouvertures: (existante?.ouvertures ?? 0) + 1 };
  return { p: { ...avant, decouvertes: { ...avant.decouvertes, [type]: { ...liste, [id]: entree } } }, nouvelle: !existante };
}

/**
 * Une expérience autre qu'une notion (un jeu…) est lancée : découverte, retenue comme « à reprendre », et bonus d'XP
 * d'exploration la première fois (le même qu'une notion : avant la séparation Éducation / Jeux, ouvrir un jeu passait
 * par enregistrerNotion). Elle ne compte pas comme une notion explorée.
 */
export function enregistrerExperience(avant, type, id, jour = jourLocal()) {
  const rien = { p: avant, nouveaux: [], niveauGagne: false, xpGagne: 0, nouvelleNotion: false, nouvelle: false };
  if (type === "notion") return { ...enregistrerNotion(avant, id, jour), nouvelle: !avant.notions.includes(id) };
  const { p: decouvert, nouvelle } = decouvrir(avant, type, id, jour);
  if (decouvert === avant) return rien;
  const repere = { ...decouvert, derniere: { type, id } };
  if (!nouvelle) return { ...rien, p: repere };
  const p = { ...repere, xp: avant.xp + XP_NOTION, jours: ajouterAuJour(avant.jours, jour, { xp: XP_NOTION }) };
  return { ...avecNiveau(avant, attribuerBadges(p)), xpGagne: XP_NOTION, nouvelleNotion: false, nouvelle: true };
}

export const estDecouverte = (p, type, id) => Boolean(p.decouvertes?.[type]?.[id]);

/**
 * Ajoute un relevé du moteur de temps actif : { total, sections, experiences } en ms. Le total du jour suit le total
 * global ; les sections et les expériences sont des ventilations du même temps (jamais additionnées au total).
 */
export function ajouterTemps(avant, releve, jour = jourLocal()) {
  const total = duree(releve?.total);
  if (!total || total > MAX_RELEVE_MS) return { p: avant, nouveaux: [] };
  const ajouter = (base, ajout) => {
    const sortie = { ...base };
    for (const [k, v] of Object.entries(objet(ajout))) if (duree(v) > 0) sortie[k] = (sortie[k] ?? 0) + Math.min(duree(v), total);
    return sortie;
  };
  const p = {
    ...avant,
    tempsActif: normaliserTemps({
      total: avant.tempsActif.total + total,
      sections: ajouter(avant.tempsActif.sections, releve.sections),
      experiences: ajouter(avant.tempsActif.experiences, releve.experiences)
    }),
    jours: ajouterAuJour(avant.jours, jour, { s: total })
  };
  return attribuerBadges(p);
}

/**
 * Reclasse, d'après le catalogue, les identifiants enregistrés comme « notions » qui sont en réalité d'un autre type
 * (un jeu ouvert avant la séparation Éducation / Jeux). Rien n'est perdu : l'entrée change seulement de type.
 * `typeDe(id)` rend le type d'une entrée du catalogue, ou null si l'identifiant est inconnu (on ne touche à rien).
 */
export function reclasser(avant, typeDe) {
  const deplaces = avant.notions.filter((id) => { const type = typeDe(id); return type && type !== "notion"; });
  if (!deplaces.length) return avant;
  const decouvertes = { ...avant.decouvertes, notion: { ...avant.decouvertes.notion } };
  for (const id of deplaces) {
    const type = typeDe(id);
    const entree = decouvertes.notion[id] ?? { premiere: null, ouvertures: 0 };
    delete decouvertes.notion[id];
    decouvertes[type] = { ...decouvertes[type], [id]: decouvertes[type]?.[id] ?? entree };
  }
  if (!Object.keys(decouvertes.notion).length) delete decouvertes.notion;
  const derniere = avant.derniere && deplaces.includes(avant.derniere.id) ? { type: typeDe(avant.derniere.id), id: avant.derniere.id } : avant.derniere;
  return { ...avant, notions: avant.notions.filter((id) => !deplaces.includes(id)), decouvertes, derniere };
}

/**
 * Fusionne les notions connues du serveur (compte élève) sans rien retirer ni inventer d'XP : une notion distante
 * absente localement devient simplement « explorée ». Corrige l'ancienne fusion qui transformait `notions` en objet.
 */
export function fusionnerNotionsDistantes(avant, ids) {
  const nouvelles = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === "string" && IDENTIFIANT.test(id)))]
    .filter((id) => !avant.notions.includes(id));
  if (!nouvelles.length) return avant;
  const notion = { ...avant.decouvertes.notion };
  for (const id of nouvelles) notion[id] ??= { premiere: null, ouvertures: 0 };
  return { ...avant, notions: [...avant.notions, ...nouvelles].slice(-MAX_NOTIONS), decouvertes: { ...avant.decouvertes, notion } };
}

/** Forme attendue par /api/progres (POST) : { notions: { id: {} } }. Le temps et les découvertes restent locaux. */
export function pourSynchronisation(p) {
  return { notions: Object.fromEntries(p.notions.map((id) => [id, {}])) };
}

/** Défi express terminé : XP par bonne réponse, une seule fois par jour ; compte comme un jour actif. */
export function enregistrerDefi(avant, bonnes, jour = jourLocal()) {
  const total = Math.max(0, Math.min(5, Number.isInteger(bonnes) ? bonnes : 0));
  if (avant.defiJour === jour) return { p: avant, nouveaux: [], niveauGagne: false, xpGagne: 0, nouvelleNotion: false };
  const xp = total * XP_DEFI_BONNE;
  const p = { ...avecSerie(avant, jour), xp: avant.xp + xp, defiJour: jour, jours: ajouterAuJour(avant.jours, jour, { xp }) };
  return { ...avecNiveau(avant, attribuerBadges(p)), xpGagne: xp, nouvelleNotion: false };
}

/** Activité des `n` derniers jours (du plus ancien à aujourd'hui), pour le graphique de la semaine. */
export function activite(p, jour = jourLocal(), n = 7) {
  const liste = [jour];
  while (liste.length < n) liste.unshift(veille(liste[0]));
  return liste.map((j) => ({ jour: j, q: 0, n: 0, xp: 0, s: 0, ...p.jours?.[j] }));
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
