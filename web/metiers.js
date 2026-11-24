// Espace Métiers (ADR 0041) : des notions KermicLab aux gestes professionnels. Quatre anneaux reliés : notions du
// référentiel → disciplines académiques → métiers → gestes métier. Module pur, sans DOM : partagé par le build
// (validation, enrichissement de `dist/metiers.json`) et par l'écran du site. Testé par tests/unit/metiers.test.mjs.

export const VERSION_METIERS = 2;
export const TYPES_SELECTION = Object.freeze(["metier", "discipline", "notion", "geste"]);
// Statut d'une correspondance (discipline → notions, métier → disciplines) : reprise de la maquette V5, proposée par un
// agent ou un import, ou validée par une relecture humaine (date `relue`, que seul un humain renseigne). Plan : chantier
// docs/chantiers/metiers.md, ADR 0042.
export const STATUTS_CORRESPONDANCE = Object.freeze(["v5", "proposition", "validee"]);
// Niveau d'accès minimum au métier, aligné sur les niveaux de l'ONISEP (Idéo-Fiches métiers) : « sans-diplome »
// regroupe « sans diplôme », « 3e » et le brevet ; « bac+9 » vaut « bac + 9 et plus ».
export const NIVEAUX_ACCES = Object.freeze(["sans-diplome", "cap", "bac", "bac+1", "bac+2", "bac+3", "bac+4", "bac+5", "bac+6", "bac+7", "bac+8", "bac+9"]);
// Transitions repérées par le ROME 4.0 de France Travail (ADR 0043) : emploi vert ou stratégique pour la transition
// écologique, métier transformé par le numérique.
export const TRANSITIONS = Object.freeze(["ecologique", "numerique"]);
export const MAX_PROCHES = 5;
const MOTIF_ONISEP = /^MET\.\d+$/;
const MOTIF_ROME = /^[A-N]\d{4}$/;
const MOTIF_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Statut et relecture d'un élément : « validee » exige une date de relecture humaine.
function verifierCorrespondance(element, erreurs) {
  if (!STATUTS_CORRESPONDANCE.includes(element.correspondance)) erreurs.push(`${element.id} : correspondance inconnue`);
  if (element.relue !== undefined && !MOTIF_DATE.test(String(element.relue))) erreurs.push(`${element.id} : date de relecture invalide`);
  if (element.correspondance === "validee" && element.relue === undefined) erreurs.push(`${element.id} : correspondance validée sans relecture`);
}

/**
 * Erreurs de cohérence de `referentiel/metiers-v0.json` (liste vide si tout va bien) : identifiants uniques, catégorie
 * et disciplines connues, notions présentes dans le référentiel (`notionsConnues` : ensemble d'identifiants), statut
 * des correspondances, identifiants externes (ONISEP, ROME) et niveau d'accès bien formés, champs dérivés du ROME 4.0
 * (contextes de travail présents dans `contextesTravail`, transitions connues, métiers proches existants).
 */
export function verifierMetiers(donnees, notionsConnues) {
  const erreurs = [];
  if (donnees?.version !== VERSION_METIERS) erreurs.push("version inconnue");
  const categories = new Set((donnees?.categories ?? []).map((c) => c.id));
  const disciplines = new Map();
  for (const d of donnees?.disciplines ?? []) {
    if (!d.id || disciplines.has(d.id)) erreurs.push(`discipline en double ou sans identifiant : ${d.id}`);
    disciplines.set(d.id, d);
    verifierCorrespondance(d, erreurs);
    for (const n of d.notions ?? []) if (!notionsConnues.has(n)) erreurs.push(`${d.id} : notion inconnue ${n}`);
  }
  const contextes = new Set();
  for (const c of donnees?.contextesTravail ?? []) {
    if (!c.id || contextes.has(c.id)) erreurs.push(`contexte de travail en double ou sans identifiant : ${c.id}`);
    contextes.add(c.id);
  }
  const metiers = new Set();
  const tousLesMetiers = new Set((donnees?.metiers ?? []).map((m) => m.id));
  const onisep = new Map();
  for (const m of donnees?.metiers ?? []) {
    if (!m.id || metiers.has(m.id)) erreurs.push(`métier en double ou sans identifiant : ${m.id}`);
    metiers.add(m.id);
    if (!categories.has(m.categorie)) erreurs.push(`${m.id} : catégorie inconnue ${m.categorie}`);
    for (const d of m.disciplines ?? []) if (!disciplines.has(d)) erreurs.push(`${m.id} : discipline inconnue ${d}`);
    if (!m.gestes?.length) erreurs.push(`${m.id} : aucun geste métier`);
    verifierCorrespondance(m, erreurs);
    if (m.onisep !== undefined) {
      if (!MOTIF_ONISEP.test(String(m.onisep))) erreurs.push(`${m.id} : identifiant ONISEP invalide ${m.onisep}`);
      else if (onisep.has(m.onisep)) erreurs.push(`${m.id} : identifiant ONISEP déjà utilisé par ${onisep.get(m.onisep)}`);
      else onisep.set(m.onisep, m.id);
    }
    if (m.rome !== undefined) {
      if (!Array.isArray(m.rome) || !m.rome.length) erreurs.push(`${m.id} : codes ROME attendus en liste non vide`);
      else for (const code of m.rome) if (!MOTIF_ROME.test(String(code))) erreurs.push(`${m.id} : code ROME invalide ${code}`);
    }
    if (m.niveauAcces !== undefined && !NIVEAUX_ACCES.includes(m.niveauAcces)) erreurs.push(`${m.id} : niveau d'accès inconnu ${m.niveauAcces}`);
    for (const c of m.contextes ?? []) if (!contextes.has(c)) erreurs.push(`${m.id} : contexte de travail inconnu ${c}`);
    for (const t of m.transitions ?? []) if (!TRANSITIONS.includes(t)) erreurs.push(`${m.id} : transition inconnue ${t}`);
    if ((m.proches ?? []).length > MAX_PROCHES) erreurs.push(`${m.id} : plus de ${MAX_PROCHES} métiers proches`);
    for (const p of m.proches ?? []) if (p === m.id || !tousLesMetiers.has(p)) erreurs.push(`${m.id} : métier proche inconnu ${p}`);
  }
  return erreurs;
}

/**
 * Indicateurs de couverture (chantier Métiers) : métiers rattachés à l'ONISEP et au ROME, statuts des correspondances,
 * notions du référentiel reliées à au moins un métier, au total et par matière (`notion.<matière>.<slug>`).
 * `notionsDuReferentiel` : identifiants canoniques de toutes les notions (valeurs de `projection.notions`).
 */
export function couvertureMetiers(donnees, notionsDuReferentiel) {
  const compter = (liste) => {
    const statuts = Object.fromEntries(STATUTS_CORRESPONDANCE.map((s) => [s, 0]));
    for (const e of liste) if (e.correspondance in statuts) statuts[e.correspondance] += 1;
    return statuts;
  };
  const disciplinesUtilisees = new Set(donnees.metiers.flatMap((m) => m.disciplines));
  const reliees = new Set(donnees.disciplines.filter((d) => disciplinesUtilisees.has(d.id)).flatMap((d) => d.notions));
  const parMatiere = {};
  for (const id of new Set(notionsDuReferentiel)) {
    const matiere = String(id).split(".")[1] ?? "";
    parMatiere[matiere] ??= { reliees: 0, total: 0 };
    parMatiere[matiere].total += 1;
    if (reliees.has(id)) parMatiere[matiere].reliees += 1;
  }
  const total = Object.values(parMatiere).reduce((s, m) => s + m.total, 0);
  return {
    metiers: donnees.metiers.length,
    avecOnisep: donnees.metiers.filter((m) => m.onisep).length,
    avecRome: donnees.metiers.filter((m) => m.rome?.length).length,
    avecNiveau: donnees.metiers.filter((m) => m.niveauAcces).length,
    avecContextes: donnees.metiers.filter((m) => m.contextes?.length).length,
    avecProches: donnees.metiers.filter((m) => m.proches?.length).length,
    correspondances: { metiers: compter(donnees.metiers), disciplines: compter(donnees.disciplines) },
    notions: { reliees: Object.values(parMatiere).reduce((s, m) => s + m.reliees, 0), total, parMatiere }
  };
}

/**
 * Données publiées : le fichier source enrichi, pour chaque notion citée, du titre du catalogue et des MicroSkills
 * réelles du référentiel (`projection.fiches[slug].competences`, identifiants canoniques de `projection.competences`).
 */
export function enrichirMetiers(donnees, projection, titres = new Map()) {
  const slugDe = new Map(Object.entries(projection.notions ?? {}).map(([slug, id]) => [id, slug]));
  const idCompetence = new Map(Object.entries(projection.competences ?? {}).map(([id, slug]) => [slug, id]));
  const notions = {};
  for (const d of donnees.disciplines) for (const id of d.notions) {
    if (notions[id]) continue;
    const slug = slugDe.get(id);
    notions[id] = {
      slug,
      titre: titres.get(slug) ?? libelleSlug(slug),
      microskills: (projection.fiches?.[slug]?.competences ?? []).map((c) => idCompetence.get(c) ?? c)
    };
  }
  return { ...donnees, notions };
}

export function libelleSlug(texte) {
  const s = String(texte ?? "").replace(/^(notion|microskill)\.[^.]+\./, "").replace(/[-_]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

const sansAccents = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Index de travail : accès par identifiant et relations inverses. */
export function preparerCarte(donnees) {
  const disciplines = new Map(donnees.disciplines.map((d) => [d.id, d]));
  const metiers = new Map(donnees.metiers.map((m) => [m.id, m]));
  const categories = new Map(donnees.categories.map((c) => [c.id, c]));
  const notions = new Map(Object.entries(donnees.notions ?? {}));
  const contextes = new Map((donnees.contextesTravail ?? []).map((c) => [c.id, c]));
  const disciplinesDeNotion = new Map();
  for (const d of donnees.disciplines) for (const n of d.notions) {
    if (!disciplinesDeNotion.has(n)) disciplinesDeNotion.set(n, []);
    disciplinesDeNotion.get(n).push(d.id);
  }
  return { donnees, disciplines, metiers, categories, notions, contextes, disciplinesDeNotion };
}

/**
 * Contextes de travail d'un métier (ROME 4.0, ADR 0043) groupés par type, dans l'ordre de première apparition :
 * `[{ type, libelles }]`. Les identifiants absents du dictionnaire sont ignorés.
 */
export function contextesParType(carte, metier) {
  const groupes = new Map();
  for (const id of metier?.contextes ?? []) {
    const c = carte.contextes.get(id);
    if (!c) continue;
    if (!groupes.has(c.type)) groupes.set(c.type, []);
    groupes.get(c.type).push(c.libelle);
  }
  return [...groupes].map(([type, libelles]) => ({ type, libelles }));
}

/**
 * Métiers retenus par la catégorie, le niveau d'accès et la recherche (métier, synonyme, domaine, code ROME,
 * discipline, geste, savoir-faire ou notion). Un métier sans niveau connu n'est retenu que sans filtre de niveau.
 */
export function filtrerMetiers(carte, { categorie = "", niveau = "", recherche = "" } = {}) {
  const q = sansAccents(recherche.trim());
  return carte.donnees.metiers.filter((m) => {
    if (categorie && m.categorie !== categorie) return false;
    if (niveau && m.niveauAcces !== niveau) return false;
    if (!q) return true;
    const ds = m.disciplines.map((id) => carte.disciplines.get(id));
    const textes = [m.nom, m.contexte, ...(m.synonymes ?? []), ...(m.domaines ?? []), ...(m.rome ?? []), ...m.gestes, ...ds.flatMap((d) => [d.nom, ...d.savoirFaire]),
      ...ds.flatMap((d) => d.notions.map((n) => carte.notions.get(n)?.titre ?? n))];
    return textes.some((t) => sansAccents(t).includes(q));
  });
}

/**
 * Chaîne complète d'une sélection : les métiers, disciplines, notions et gestes qu'elle relie. Sans sélection, la
 * chaîne couvre les métiers donnés (`metiersVisibles`, ceux du filtre).
 */
export function chaine(carte, selection, metiersVisibles = carte.donnees.metiers) {
  const metiers = new Set(), disciplines = new Set(), notions = new Set(), gestes = new Set();
  const ajouterMetier = (m) => {
    metiers.add(m.id);
    m.gestes.forEach((g) => gestes.add(`${m.id}::${g}`));
    m.disciplines.forEach((d) => disciplines.add(d));
  };
  if (!selection) metiersVisibles.forEach(ajouterMetier);
  else if (selection.type === "metier") ajouterMetier(carte.metiers.get(selection.id));
  else if (selection.type === "geste") {
    const [idMetier] = selection.id.split("::");
    ajouterMetier(carte.metiers.get(idMetier));
    gestes.clear();
    gestes.add(selection.id);
  } else if (selection.type === "discipline") {
    disciplines.add(selection.id);
    carte.donnees.metiers.filter((m) => m.disciplines.includes(selection.id)).forEach((m) => {
      metiers.add(m.id);
      m.gestes.forEach((g) => gestes.add(`${m.id}::${g}`));
    });
  } else if (selection.type === "notion") {
    notions.add(selection.id);
    for (const d of carte.disciplinesDeNotion.get(selection.id) ?? []) {
      disciplines.add(d);
      carte.donnees.metiers.filter((m) => m.disciplines.includes(d)).forEach((m) => {
        metiers.add(m.id);
        m.gestes.forEach((g) => gestes.add(`${m.id}::${g}`));
      });
    }
  }
  if (selection?.type !== "notion") for (const d of disciplines) carte.disciplines.get(d)?.notions.forEach((n) => notions.add(n));
  return { metiers, disciplines, notions, gestes };
}

/**
 * Disposition en quatre anneaux concentriques (centre cx, cy) : notions, disciplines, métiers, gestes. Les métiers sont
 * groupés par catégorie ; chaque notion se place près de la première discipline qui la cite, chaque geste près de son
 * métier, pour limiter les croisements. `metiers` : métiers placés sur l'anneau (tous par défaut, voir `metiersDesAnneaux`).
 */
export function disposerAnneaux(carte, { cx = 500, cy = 500, rayons = [120, 230, 340, 430], metiers: places = carte.donnees.metiers } = {}) {
  const pos = (r, angle) => ({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, angle });
  const ordreCategories = carte.donnees.categories.map((c) => c.id);
  const metiers = [...places].sort((a, b) => ordreCategories.indexOf(a.categorie) - ordreCategories.indexOf(b.categorie));
  const angleMetier = new Map(metiers.map((m, i) => [m.id, (i / metiers.length) * 2 * Math.PI - Math.PI / 2]));
  // Disciplines : à l'angle moyen des métiers qui les mobilisent, puis réparties régulièrement dans cet ordre.
  const moyenne = (angles) => Math.atan2(angles.reduce((s, a) => s + Math.sin(a), 0), angles.reduce((s, a) => s + Math.cos(a), 0));
  const disciplines = carte.donnees.disciplines
    .map((d) => ({ d, a: moyenne(metiers.filter((m) => m.disciplines.includes(d.id)).map((m) => angleMetier.get(m.id))) }))
    .sort((x, y) => x.a - y.a);
  const positions = { metier: new Map(), discipline: new Map(), notion: new Map(), geste: new Map() };
  disciplines.forEach(({ d }, i) => positions.discipline.set(d.id, pos(rayons[1], (i / disciplines.length) * 2 * Math.PI - Math.PI / 2)));
  metiers.forEach((m) => {
    const a = angleMetier.get(m.id);
    positions.metier.set(m.id, pos(rayons[2], a));
    const pas = (2 * Math.PI) / metiers.length;
    m.gestes.forEach((g, k) => positions.geste.set(`${m.id}::${g}`, pos(rayons[3], a + (k - (m.gestes.length - 1) / 2) * pas * 0.3)));
  });
  const notionsOrdonnees = [];
  const vues = new Set();
  for (const { d } of disciplines) for (const n of d.notions) if (!vues.has(n)) { vues.add(n); notionsOrdonnees.push(n); }
  notionsOrdonnees.forEach((n, i) => positions.notion.set(n, pos(rayons[0], (i / notionsOrdonnees.length) * 2 * Math.PI - Math.PI / 2)));
  return positions;
}

/** Au-delà de ce nombre de métiers, l'anneau des métiers ne montre que ceux du filtre (chantier Métiers, lot 5). */
export const SEUIL_ANNEAUX = 120;

/**
 * Métiers placés sur les anneaux : tous tant que le référentiel reste sous le seuil (la chaîne estompe le reste),
 * sinon ceux du filtre, limités au seuil. `limites` signale qu'une partie des métiers filtrés n'est pas dessinée.
 */
export function metiersDesAnneaux(carte, visibles, seuil = SEUIL_ANNEAUX) {
  if (carte.donnees.metiers.length <= seuil) return { metiers: carte.donnees.metiers, limites: false };
  return { metiers: visibles.slice(0, seuil), limites: visibles.length > seuil };
}
