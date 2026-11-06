// Registre des expériences, dérivé du catalogue (/api/catalogue) : aucune liste dupliquée, aucun contenu codé en dur.
// Logique pure, testable sans navigateur.
//
// Une expérience = { type, id, titre, niveau, matiere, resume? }. Le type vient de la catégorie du catalogue :
// les entrées rangées sous « jeux/ » sont des jeux, toutes les autres sont des notions scolaires. Un nouveau jeu
// ou une nouvelle notion apparaît donc ici dès qu'il est publié dans le catalogue, sans toucher à ce fichier.

/** Catégorie du catalogue qui regroupe les jeux (sujet « jeux/<id> » dans la fiche). */
export const CATEGORIE_JEUX = "jeux";
/** Ordre d'affichage des niveaux scolaires ; un niveau inconnu est rangé à la fin, jamais perdu. */
export const ORDRE_NIVEAUX = ["college", "seconde", "premiere", "terminale", "autres"];

export const typeDeCatalogue = (entree) => (entree?.matiere === CATEGORIE_JEUX ? "jeu" : "notion");

export function creerRegistre(catalogue) {
  const entrees = (Array.isArray(catalogue) ? catalogue : [])
    .filter((n) => n && typeof n.id === "string" && n.id)
    .map((n) => ({
      type: typeDeCatalogue(n),
      id: n.id,
      titre: typeof n.titre === "string" && n.titre ? n.titre : n.id,
      niveau: typeof n.niveau === "string" && n.niveau ? n.niveau : "autres",
      matiere: typeof n.matiere === "string" && n.matiere ? n.matiere : "autres",
      ...(typeof n.resume === "string" && n.resume ? { resume: n.resume } : {})
    }));
  const parId = new Map(entrees.map((e) => [e.id, e]));
  return {
    entrees,
    /** L'expérience du catalogue, ou undefined si elle n'existe pas (ou plus). */
    trouver: (id) => parId.get(id),
    /** Type d'un identifiant du catalogue, null s'il est inconnu (utile à la migration : on ne devine rien). */
    typeDe: (id) => parId.get(id)?.type ?? null,
    deType: (type) => entrees.filter((e) => e.type === type)
  };
}

const rangNiveau = (n) => { const i = ORDRE_NIVEAUX.indexOf(n); return i < 0 ? ORDRE_NIVEAUX.length : i; };

/**
 * Arbre Éducation : Niveau > Matière > Notions, construit uniquement à partir des métadonnées du catalogue.
 * Seuls les niveaux et matières qui contiennent au moins une notion apparaissent. `ordreMatieres` fixe l'ordre connu.
 */
export function arbreEducation(registre, ordreMatieres = []) {
  const rangMatiere = (m) => { const i = ordreMatieres.indexOf(m); return i < 0 ? ordreMatieres.length : i; };
  const niveaux = new Map();
  for (const e of registre.deType("notion")) {
    if (!niveaux.has(e.niveau)) niveaux.set(e.niveau, new Map());
    const matieres = niveaux.get(e.niveau);
    if (!matieres.has(e.matiere)) matieres.set(e.matiere, []);
    matieres.get(e.matiere).push(e);
  }
  return [...niveaux]
    .sort(([a], [b]) => rangNiveau(a) - rangNiveau(b) || a.localeCompare(b))
    .map(([niveau, matieres]) => ({
      niveau,
      matieres: [...matieres]
        .sort(([a], [b]) => rangMatiere(a) - rangMatiere(b) || a.localeCompare(b))
        .map(([matiere, notions]) => ({ matiere, notions }))
    }));
}

const decouvertesDe = (p, type) => Object.keys(p?.decouvertes?.[type] ?? {});
const entier = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/**
 * Compteurs globaux : uniquement des valeurs calculables de façon fiable, toujours des entiers (jamais NaN/null).
 * Les matières explorées ne comptent que les notions retrouvées dans le catalogue (sinon leur matière est inconnue).
 */
export function compteurs(p, registre) {
  const notions = decouvertesDe(p, "notion");
  const matieres = new Set(notions.map((id) => registre.trouver(id)).filter((e) => e?.type === "notion").map((e) => e.matiere));
  return {
    tempsActif: entier(p?.tempsActif?.total),
    notions: notions.length,
    matieres: matieres.size,
    jeux: decouvertesDe(p, "jeu").length,
    questions: entier(p?.questions),
    badges: Array.isArray(p?.badges) ? p.badges.length : 0
  };
}

/**
 * Progression par matière : notions explorées / notions publiées dans le catalogue. Le dénominateur est le catalogue
 * réel, donc fiable ; seules les matières déjà commencées apparaissent (divulgation progressive).
 */
export function progressionParMatiere(p, registre, ordreMatieres = []) {
  const vues = new Set(decouvertesDe(p, "notion"));
  const parMatiere = new Map();
  for (const e of registre.deType("notion")) {
    const m = parMatiere.get(e.matiere) ?? { matiere: e.matiere, explorees: 0, total: 0 };
    m.total += 1;
    if (vues.has(e.id)) m.explorees += 1;
    parMatiere.set(e.matiere, m);
  }
  const rang = (m) => { const i = ordreMatieres.indexOf(m); return i < 0 ? ordreMatieres.length : i; };
  return [...parMatiere.values()].filter((m) => m.explorees > 0).sort((a, b) => rang(a.matiere) - rang(b.matiere) || a.matiere.localeCompare(b.matiere));
}

/**
 * Expériences découvertes d'un type, avec leurs statistiques quand elles existent vraiment :
 * nombre d'ouvertures (compté depuis la v2 : 0 = inconnu, non affiché) et temps actif attribué (0 = non affiché).
 * Une expérience retirée du catalogue reste listée (sa progression n'est pas effacée), sous son identifiant.
 */
export function experiencesDecouvertes(p, registre, type) {
  const liste = p?.decouvertes?.[type] ?? {};
  return Object.entries(liste).map(([id, d]) => {
    const e = registre.trouver(id);
    return {
      type, id,
      titre: e?.titre ?? id,
      matiere: e?.matiere ?? null,
      disponible: Boolean(e),
      premiere: d?.premiere ?? null,
      ouvertures: entier(d?.ouvertures),
      tempsActif: entier(p?.tempsActif?.experiences?.[`${type}:${id}`])
    };
  }).sort((a, b) => b.tempsActif - a.tempsActif || b.ouvertures - a.ouvertures || a.titre.localeCompare(b.titre));
}

/** Durée affichable sans secondes : { heures, minutes }, arrondie à la minute inférieure, jamais négative. */
export function decomposerDuree(ms) {
  const minutes = Math.floor(entier(ms) / 60_000);
  return { heures: Math.floor(minutes / 60), minutes: minutes % 60 };
}
