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
 * Ordre par défaut : « Mon tableau de bord » juste sous l'Accueil. Les entrées liées au rôle (Ma famille,
 * Contributions, Professeur) sont regroupées dans le tableau de bord, comme vues filtrables, et non dans la barre.
 */
export const ORDRE_NAVIGATION_DEFAUT = Object.freeze(["accueil", "tableau-de-bord", "education", "labs", "jeux", "progression"]);

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
