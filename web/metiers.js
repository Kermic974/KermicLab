// Espace Métiers (ADR 0041) : des notions KermicLab aux gestes professionnels. Quatre anneaux reliés : notions du
// référentiel → disciplines académiques → métiers → gestes métier. Module pur, sans DOM : partagé par le build
// (validation, enrichissement de `dist/metiers.json`) et par l'écran du site. Testé par tests/unit/metiers.test.mjs.

export const VERSION_METIERS = 1;
export const TYPES_SELECTION = Object.freeze(["metier", "discipline", "notion", "geste"]);

/**
 * Erreurs de cohérence de `referentiel/metiers-v0.json` (liste vide si tout va bien) : identifiants uniques, catégorie
 * et disciplines connues, notions présentes dans le référentiel (`notionsConnues` : ensemble d'identifiants).
 */
export function verifierMetiers(donnees, notionsConnues) {
  const erreurs = [];
  if (donnees?.version !== VERSION_METIERS) erreurs.push("version inconnue");
  const categories = new Set((donnees?.categories ?? []).map((c) => c.id));
  const disciplines = new Map();
  for (const d of donnees?.disciplines ?? []) {
    if (!d.id || disciplines.has(d.id)) erreurs.push(`discipline en double ou sans identifiant : ${d.id}`);
    disciplines.set(d.id, d);
    if (!["v5", "proposition"].includes(d.correspondance)) erreurs.push(`${d.id} : correspondance inconnue`);
    for (const n of d.notions ?? []) if (!notionsConnues.has(n)) erreurs.push(`${d.id} : notion inconnue ${n}`);
  }
  const metiers = new Set();
  for (const m of donnees?.metiers ?? []) {
    if (!m.id || metiers.has(m.id)) erreurs.push(`métier en double ou sans identifiant : ${m.id}`);
    metiers.add(m.id);
    if (!categories.has(m.categorie)) erreurs.push(`${m.id} : catégorie inconnue ${m.categorie}`);
    for (const d of m.disciplines ?? []) if (!disciplines.has(d)) erreurs.push(`${m.id} : discipline inconnue ${d}`);
    if (!m.gestes?.length) erreurs.push(`${m.id} : aucun geste métier`);
  }
  return erreurs;
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
  const disciplinesDeNotion = new Map();
  for (const d of donnees.disciplines) for (const n of d.notions) {
    if (!disciplinesDeNotion.has(n)) disciplinesDeNotion.set(n, []);
    disciplinesDeNotion.get(n).push(d.id);
  }
  return { donnees, disciplines, metiers, categories, notions, disciplinesDeNotion };
}

/** Métiers retenus par la catégorie et la recherche (métier, discipline, geste, savoir-faire ou notion). */
export function filtrerMetiers(carte, { categorie = "", recherche = "" } = {}) {
  const q = sansAccents(recherche.trim());
  return carte.donnees.metiers.filter((m) => {
    if (categorie && m.categorie !== categorie) return false;
    if (!q) return true;
    const ds = m.disciplines.map((id) => carte.disciplines.get(id));
    const textes = [m.nom, m.contexte, ...m.gestes, ...ds.flatMap((d) => [d.nom, ...d.savoirFaire]),
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
 * métier, pour limiter les croisements.
 */
export function disposerAnneaux(carte, { cx = 500, cy = 500, rayons = [120, 230, 340, 430] } = {}) {
  const pos = (r, angle) => ({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, angle });
  const ordreCategories = carte.donnees.categories.map((c) => c.id);
  const metiers = [...carte.donnees.metiers].sort((a, b) => ordreCategories.indexOf(a.categorie) - ordreCategories.indexOf(b.categorie));
  const angleMetier = new Map(metiers.map((m, i) => [m.id, (i / metiers.length) * 2 * Math.PI - Math.PI / 2]));
  // Disciplines : à l'angle moyen des métiers qui les mobilisent, puis réparties régulièrement dans cet ordre.
  const moyenne = (angles) => Math.atan2(angles.reduce((s, a) => s + Math.sin(a), 0), angles.reduce((s, a) => s + Math.cos(a), 0));
  const disciplines = carte.donnees.disciplines
    .map((d) => ({ d, a: moyenne(carte.donnees.metiers.filter((m) => m.disciplines.includes(d.id)).map((m) => angleMetier.get(m.id))) }))
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
