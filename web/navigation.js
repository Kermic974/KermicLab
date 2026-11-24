/**
 * Navigation principale : ordre configurable des entrées et « Mon tableau de bord ».
 *
 * L'ordre se règle dans `web/config.json` (clé `navigation`) : une liste d'identifiants d'entrées, du haut vers le bas
 * de la barre latérale (et de gauche à droite dans la barre du bas sur mobile). Une entrée absente de la liste est
 * retirée de la barre ; une entrée liée au compte ou au rôle (Ma famille, Contributions, Professeur) n'apparaît que si
 * elle est listée **et** que le compte y a droit. Sans liste valide, l'ordre par défaut s'applique.
 *
 * Module pur (aucun accès global) : testé par tests/unit/navigation.test.mjs.
 */

/** Entrées connues de la navigation (attribut `data-nav-id` des boutons). */
export const ENTREES_NAVIGATION = Object.freeze([
  "accueil", "tableau-de-bord", "education", "labs", "jeux", "progression", "profil",
  "famille", "contributions", "suivi", "classes", "eleves",
]);

/**
 * Ordre par défaut (ADR 0039 § 3) : cinq destinations. « Mon tableau de bord » a fusionné avec l'Accueil ; ses vues
 * (Profil, Mon compte, Famille, Contributions, Professeur) s'ouvrent par l'avatar (« Mon espace ») et par leur barre de
 * filtres. L'entrée reste configurable : il suffit de l'ajouter à la clé `navigation` de `web/config.json`.
 */
export const ORDRE_NAVIGATION_DEFAUT = Object.freeze(["accueil", "education", "labs", "jeux", "progression"]);

/** Vues du tableau de bord, dans l'ordre de la barre de filtres. */
export const VUES_TABLEAU_DE_BORD = Object.freeze([
  "profil", "compte", "famille", "espace-famille", "contributions", "suivi", "classes", "eleves", "connexion-en-cours",
]);

/** Liste validée : identifiants connus, sans doublon ; liste vide ou invalide → ordre par défaut. */
export function ordreNavigation(valeur) {
  if (!Array.isArray(valeur)) return [...ORDRE_NAVIGATION_DEFAUT];
  const ordre = [...new Set(valeur.filter((id) => typeof id === "string" && ENTREES_NAVIGATION.includes(id)))];
  return ordre.length ? ordre : [...ORDRE_NAVIGATION_DEFAUT];
}

/**
 * Range les entrées `[data-nav-id]` d'un conteneur selon l'ordre ; les autres passent dans la réserve (masquée), où le
 * reste de l'application peut toujours les lire et les modifier. `avant` : élément qui doit rester en dernier.
 */
export function appliquerOrdre(conteneur, reserve, ordre, { avant = null } = {}) {
  const entrees = [...conteneur.querySelectorAll(":scope > [data-nav-id]"), ...reserve.querySelectorAll(":scope > [data-nav-id]")]
    .filter((e) => e.dataset.navGroupe === conteneur.dataset.navGroupe);
  const parId = new Map(entrees.map((e) => [e.dataset.navId, e]));
  for (const id of ordre) {
    const e = parId.get(id);
    if (!e) continue;
    conteneur.insertBefore(e, avant && avant.parentNode === conteneur ? avant : null);
    delete e.dataset.navRetire;
    parId.delete(id);
  }
  for (const e of parId.values()) {
    reserve.append(e);
    e.dataset.navRetire = "";
  }
}

/**
 * Vue ouverte par « Mon tableau de bord » : la dernière vue consultée si elle est encore proposée, sinon le tableau de
 * bord du professeur pour ce rôle, sinon le profil.
 */
export function vueTableauDeBord({ derniere = null, disponibles = [], prof = false } = {}) {
  if (derniere && disponibles.includes(derniere)) return derniere;
  if (prof && disponibles.includes("suivi")) return "suivi";
  return "profil";
}

/**
 * Espaces colorés (ADR 0039 § 4) : chaque écran appartient à un espace dont la couleur habille le bandeau d'en-tête.
 * Les vues de « Mon tableau de bord » prennent la couleur de leur rôle ; un écran inconnu reste dans l'espace Accueil.
 */
export const ESPACES = Object.freeze(["accueil", "education", "labs", "jeux", "progression", "famille", "professeur", "contributions"]);
const ESPACE_DES_ECRANS = Object.freeze({
  education: "education", defi: "education", labs: "labs", jeux: "jeux", progression: "progression",
  famille: "famille", "espace-famille": "famille", suivi: "professeur", classes: "professeur", eleves: "professeur",
  contributions: "contributions",
});
export const espaceDe = (ecran) => ESPACE_DES_ECRANS[ecran] ?? "accueil";

/**
 * Menu « Mes espaces » (accès rapides de la barre de navigation) : les espaces liés au compte et au rôle, avec des
 * raccourcis directs. Un parent y trouve l'Espace famille, chacun de ses enfants (sa progression) et les actions
 * « Donner une activité » et « Ajouter un enfant » ; un professeur, ses trois écrans, chacune de ses classes (ses élèves)
 * et « Donner une activité » / « Nouvelle classe » ; un contributeur, l'écran Contributions. Liste vide : pas de menu.
 *
 * @param {object} p
 * @param {"parent"|"membre"|null} p.famille rôle dans la famille (`membre` : compte lié sans rôle parent)
 * @param {Array<{id: string, prenom?: string}>} [p.enfants]
 * @param {boolean} [p.prof]
 * @param {Array<{id: string, nom?: string}>} [p.classes]
 * @param {boolean} [p.contributions]
 * @returns {Array<{id: string, liens: Array<object>}>}
 */
export function sectionsEspaces({ famille = null, enfants = [], prof = false, classes = [], contributions = false } = {}) {
  const sections = [];
  if (famille === "parent") {
    const liste = (Array.isArray(enfants) ? enfants : []).filter((e) => e && typeof e.id === "string");
    sections.push({ id: "famille", liens: [
      { type: "ecran", cle: "espace-famille" },
      ...liste.map((e) => ({ type: "compte", cle: `famille:${e.id}`, texte: String(e.prenom ?? "") })),
      { type: "action", action: "activite-famille" },
      { type: "action", action: "ajouter-enfant" },
    ] });
  } else if (famille === "membre") {
    sections.push({ id: "famille", liens: [{ type: "ecran", cle: "compte", texte: "famille" }] });
  }
  if (prof) {
    const liste = (Array.isArray(classes) ? classes : []).filter((c) => c && typeof c.id === "string");
    sections.push({ id: "professeur", liens: [
      { type: "ecran", cle: "suivi" }, { type: "ecran", cle: "classes" }, { type: "ecran", cle: "eleves" },
      ...liste.map((c) => ({ type: "classe", id: c.id, texte: String(c.nom ?? "") })),
      { type: "action", action: "activite-prof" },
      { type: "action", action: "nouvelle-classe" },
    ] });
  }
  if (contributions) sections.push({ id: "contributions", liens: [{ type: "ecran", cle: "contributions" }] });
  return sections;
}

/**
 * Sous-navigation des vues personnelles : seules les vues de l'espace affiché restent (Profil et Mon compte ensemble,
 * les trois écrans du professeur ensemble…) ; les autres espaces s'ouvrent par le menu « Mes espaces ».
 */
const GROUPE_VUE = Object.freeze({
  profil: "personnel", compte: "personnel", "connexion-en-cours": "personnel", famille: "personnel",
  "espace-famille": "famille", suivi: "professeur", classes: "professeur", eleves: "professeur", contributions: "contributions",
});
export const groupeVue = (vue) => GROUPE_VUE[vue] ?? null;
