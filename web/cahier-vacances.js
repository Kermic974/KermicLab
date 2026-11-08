// Cahier de vacances local (feuille de route, phase 2 ; issue #188) : niveau, période et rythme → diagnostic court →
// planning jour par jour. Module pur, sans DOM ni stockage ni réseau : les dates (AAAA-MM-JJ) sont fournies par
// l'appelant. Une absence ne pénalise jamais : le planning est recalculé à partir d'aujourd'hui, la suite se décale.
export const VERSION_PLAN = 1;
export const NIVEAUX = Object.freeze(["cycle-3", "cycle-4", "seconde", "premiere", "terminale"]);
/** Jours de séance selon le rythme (0 = dimanche … 6 = samedi). */
export const RYTHMES = Object.freeze({ 3: [1, 3, 5], 5: [1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] });
export const DUREE_MAX_JOURS = 120;
export const MAX_NOTIONS = 60;
export const NB_DIAGNOSTIC = 5;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

const dateUTC = (jour) => new Date(`${jour}T00:00:00Z`);
export function ajouterJours(jour, n) {
  const d = dateUTC(jour);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const jourValide = (v) => typeof v === "string" && JOUR.test(v) && dateUTC(v).toISOString().slice(0, 10) === v;
const ecartJours = (a, b) => Math.round((dateUTC(b) - dateUTC(a)) / 86400000);

/** Jours de séance entre deux dates incluses, selon le rythme. */
export function joursActifs(debut, fin, rythme) {
  const jours = RYTHMES[rythme];
  if (!jours || !jourValide(debut) || !jourValide(fin) || fin < debut) return [];
  const liste = [];
  for (let j = debut; j <= fin && liste.length <= DUREE_MAX_JOURS; j = ajouterJours(j, 1)) {
    if (jours.includes(dateUTC(j).getUTCDay())) liste.push(j);
  }
  return liste;
}

/** Matières et niveaux pour lesquels le référentiel permet un cahier (notions qui renseignent `niveaux`). */
export function choixPossibles(notions) {
  const choix = {};
  for (const n of notions ?? []) {
    if (!n || n.matiere === "jeux" || !Array.isArray(n.niveaux)) continue;
    for (const niveau of n.niveaux) if (NIVEAUX.includes(niveau)) (choix[n.matiere] ??= new Set()).add(niveau);
  }
  return Object.fromEntries(Object.entries(choix).map(([m, s]) => [m, NIVEAUX.filter((n) => s.has(n))]));
}

/**
 * Notions du cahier dans l'ordre d'apprentissage : celles de la matière qui couvrent le niveau, chaque prérequis avant
 * la notion qui en dépend (tri topologique), puis le niveau de début le plus jeune, puis l'ordre du catalogue.
 */
export function ordonnerNotions(notions, { matiere, niveau }) {
  const choisies = (notions ?? []).filter((n) => n && n.matiere === matiere && Array.isArray(n.niveaux) && n.niveaux.includes(niveau));
  const ids = new Set(choisies.map((n) => n.id));
  const rang = new Map(choisies.map((n, i) => [n.id, i]));
  const debut = (n) => NIVEAUX.indexOf(n.niveaux[0]);
  const avant = (a, b) => debut(a) - debut(b) || rang.get(a.id) - rang.get(b.id);
  const restants = new Map(choisies.map((n) => [n.id, (n.prerequis ?? []).filter((p) => ids.has(p)).length]));
  const ordre = [];
  while (ordre.length < choisies.length) {
    const prets = choisies.filter((n) => restants.get(n.id) === 0 && !ordre.includes(n.id)).sort(avant);
    if (!prets.length) { ordre.push(...choisies.filter((n) => !ordre.includes(n.id)).sort(avant).map((n) => n.id)); break; }
    const n = prets[0];
    ordre.push(n.id);
    for (const m of choisies) if ((m.prerequis ?? []).includes(n.id)) restants.set(m.id, restants.get(m.id) - 1);
  }
  return ordre.slice(0, MAX_NOTIONS);
}

/** Notions testées par le diagnostic court : les premières du parcours, que l'élève connaît peut-être déjà. */
export const notionsDiagnostic = (ordre, dejaAcquises = []) => ordre.filter((id) => !dejaAcquises.includes(id)).slice(0, NB_DIAGNOSTIC);

/** Plan du cahier : notions à travailler (dans l'ordre) et notions déjà acquises (diagnostic ou maîtrise locale). */
export function creerPlan({ matiere, niveau, debut, fin, rythme, ordre, acquises = [] }) {
  return {
    v: VERSION_PLAN, matiere, niveau, debut, fin, rythme,
    notions: ordre.filter((id) => !acquises.includes(id)), acquises: ordre.filter((id) => acquises.includes(id)), faites: {}
  };
}

/** Journée terminée pour une notion (fonction pure). */
export function terminerJournee(plan, notion, jour) {
  if (!plan.notions.includes(notion) || plan.faites[notion]) return plan;
  return { ...plan, faites: { ...plan.faites, [notion]: jour } };
}

/**
 * Planning recalculé à `aujourdhui` : les notions restantes sont réparties, une par jour de séance, sur les jours de
 * séance restants de la période. Les jours passés ne comptent pas : manquer une séance décale simplement la suite.
 * Les jours de séance en trop deviennent des journées de révision ; les notions qui ne tiennent pas sont comptées à part.
 */
export function planning(plan, aujourdhui) {
  const restantes = plan.notions.filter((id) => !plan.faites[id]);
  const faiteAujourdhui = plan.notions.find((id) => plan.faites[id] === aujourdhui) ?? null;
  const base = { total: plan.notions.length, faites: plan.notions.length - restantes.length, restantes: restantes.length, faiteAujourdhui };
  if (aujourdhui > plan.fin) return { ...base, etat: restantes.length ? "periode-finie" : "termine", aujourdhui: null, jours: [], horsPlanning: restantes.length };
  if (!restantes.length) return { ...base, etat: "termine", aujourdhui: null, jours: [], horsPlanning: 0 };
  // Une séance déjà faite aujourd'hui : la suite commence demain.
  const depart = aujourdhui < plan.debut ? plan.debut : faiteAujourdhui ? ajouterJours(aujourdhui, 1) : aujourdhui;
  const actifs = joursActifs(depart, plan.fin, plan.rythme);
  const jours = actifs.map((date, i) => (i < restantes.length ? { date, type: "notion", notion: restantes[i] } : { date, type: "revision" }));
  const horsPlanning = Math.max(0, restantes.length - actifs.length);
  let jour = null;
  if (aujourdhui < plan.debut) jour = { type: "avant", prochain: jours[0]?.date ?? null };
  else if (faiteAujourdhui) jour = { type: "faite", notion: faiteAujourdhui, prochain: jours[0]?.date ?? null };
  else if (jours[0]?.date === aujourdhui) jour = jours[0];
  else jour = { type: "repos", prochain: jours[0]?.date ?? null };
  return { ...base, etat: aujourdhui < plan.debut ? "a-venir" : "en-cours", aujourdhui: jour, jours, horsPlanning };
}

/** Relit un plan stocké : seuls les champs connus et valides sont gardés ; null si le plan est inutilisable. */
export function validerPlan(p) {
  if (!p || p.v !== VERSION_PLAN || typeof p.matiere !== "string" || !NIVEAUX.includes(p.niveau)) return null;
  if (!jourValide(p.debut) || !jourValide(p.fin) || p.fin < p.debut || ecartJours(p.debut, p.fin) > DUREE_MAX_JOURS) return null;
  if (!RYTHMES[p.rythme] || !Array.isArray(p.notions) || !Array.isArray(p.acquises)) return null;
  const ids = (liste) => [...new Set(liste.filter((id) => typeof id === "string" && ID.test(id)))].slice(0, MAX_NOTIONS);
  const notions = ids(p.notions);
  const faites = {};
  for (const [id, jour] of Object.entries(p.faites ?? {})) if (notions.includes(id) && jourValide(jour)) faites[id] = jour;
  return { v: VERSION_PLAN, matiere: p.matiere.slice(0, 40), niveau: p.niveau, debut: p.debut, fin: p.fin, rythme: p.rythme, notions, acquises: ids(p.acquises), faites };
}
