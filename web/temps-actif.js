// Moteur de temps actif : UNE seule source de vérité pour tout le temps compté par Kermiclab.
// Logique pure : l'horloge est injectée (tests déterministes), le navigateur ne fait que lui transmettre des signaux.
//
// Règle : un instant compte s'il est
//   1. visible (la page n'est pas cachée : onglet en arrière-plan, écran verrouillé…) ;
//   2. à moins de SEUIL_INACTIVITE_MS du dernier signe d'activité (clavier, souris, toucher, molette, navigation,
//      ou signal d'une page ouverte dans la bulle).
// Après une pause (page cachée), le compte ne reprend qu'à la prochaine interaction réelle.
//
// Chaque intervalle compté est attribué en une seule fois au total ET au contexte courant (section, expérience) :
// le total n'est jamais la somme des contextes, il n'y a donc pas de double comptage.

/** Au-delà d'une minute sans aucune interaction, on considère que personne n'utilise Kermiclab. */
export const SEUIL_INACTIVITE_MS = 60_000;

export function creerMoteurTemps({ maintenant = () => Date.now(), seuil = SEUIL_INACTIVITE_MS, visible = true } = {}) {
  let estVisible = visible;
  let dernierSignal = -Infinity;
  let dernierCompte = maintenant();
  let contexte = { section: null, experience: null };
  let attente = vide();

  function vide() { return { total: 0, sections: {}, experiences: {} }; }

  /** Ajoute au cumul la part active de [dernierCompte, t]. */
  function compter(t) {
    if (estVisible) {
      // Le dernier signal n'est jamais postérieur au dernier relevé : seule la fin de la fenêtre d'activité limite.
      const duree = Math.min(t, dernierSignal + seuil) - dernierCompte;
      if (duree > 0 && Number.isFinite(duree)) {
        attente.total += duree;
        if (contexte.section) attente.sections[contexte.section] = (attente.sections[contexte.section] ?? 0) + duree;
        if (contexte.experience) attente.experiences[contexte.experience] = (attente.experiences[contexte.experience] ?? 0) + duree;
      }
    }
    dernierCompte = Math.max(dernierCompte, t);
  }

  return {
    /** Signe d'activité de l'utilisateur. */
    signal() { const t = maintenant(); compter(t); dernierSignal = t; },
    /** Page visible ou cachée (document.hidden). Une page cachée suspend le compte ; il reprend à la prochaine interaction. */
    visibilite(v) {
      const t = maintenant();
      compter(t);
      estVisible = Boolean(v);
      if (!estVisible) dernierSignal = -Infinity;
    },
    /** Contexte auquel attribuer le temps à partir de maintenant (le temps écoulé reste à l'ancien contexte). */
    contexte({ section = contexte.section, experience = null } = {}) {
      compter(maintenant());
      contexte = { section, experience };
    },
    get contexteCourant() { return { ...contexte }; },
    /** Vrai si l'instant présent est compté. */
    get actif() { return estVisible && maintenant() < dernierSignal + seuil; },
    /** Rend le temps actif accumulé depuis le dernier relevé (en millisecondes) et remet l'attente à zéro. */
    relever() { compter(maintenant()); const r = attente; attente = vide(); return r; }
  };
}
