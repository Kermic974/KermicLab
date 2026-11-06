// Comptes famille : logique pure (aucun accès au DOM ni au réseau), testable sous Node.
// Parcours décrit par l'ADR 0017 : profil local par défaut ; un compte parent est nécessaire pour créer un profil enfant.

export const TRANCHES_AGE = ["6-10", "11-14", "15-17"];
export const MAX_ENFANTS = 6;
export const VERSION_CONSENTEMENT = "consentement-v1";
export const CLE_ENFANT_ACTIF = "kermiclab:enfant-actif";

/**
 * Mode de l'appareil :
 * - `desactive` : connexion désactivée (`connexionActive` faux), seul le profil local existe ;
 * - `local` : connexion possible, aucun parent connecté ;
 * - `parent` : parent connecté, aucun profil enfant utilisé sur l'appareil ;
 * - `enfant` : parent connecté et profil enfant actif sur l'appareil.
 */
export function modeCompte({ connexionActive = false, compte = null, enfants = [], enfantActifId = null } = {}) {
  if (!connexionActive) return "desactive";
  if (!compte) return "local";
  return enfantActif(enfants, enfantActifId) ? "enfant" : "parent";
}

/** Profil enfant actif s'il appartient bien à la liste du parent (un identifiant périmé est ignoré). */
export function enfantActif(enfants, enfantActifId) {
  if (!enfantActifId || !Array.isArray(enfants)) return null;
  return enfants.find((e) => e && e.id === enfantActifId) ?? null;
}

/**
 * Valide le formulaire « Ajouter un enfant ». `validerPrenom` est `profil.validerPseudo` (mêmes règles que le pseudo) :
 * il est passé en paramètre pour que ce module n'importe rien (les imports sont versionnés depuis app.js par le build).
 * @returns {{ ok: true, enfant: { prenom_affiche: string, age_tranche: string, consentement_version: string } }
 *         | { ok: false, erreurs: { prenom?: string, tranche?: true, consentement?: true, quota?: true } }}
 */
export function validerEnfant({ prenom, tranche, consentement } = {}, nombreExistant, validerPrenom) {
  const erreurs = {};
  if (nombreExistant >= MAX_ENFANTS) erreurs.quota = true;
  const p = validerPrenom(prenom);
  if (!p.ok) erreurs.prenom = p.erreur;
  if (!TRANCHES_AGE.includes(tranche)) erreurs.tranche = true;
  if (consentement !== true) erreurs.consentement = true;
  if (Object.keys(erreurs).length) return { ok: false, erreurs };
  return { ok: true, enfant: { prenom_affiche: p.pseudo, age_tranche: tranche, consentement_version: VERSION_CONSENTEMENT } };
}

/** Nettoie la liste renvoyée par `/api/eleves` : seuls les champs attendus, prénom non vide. */
export function normaliserEnfants(liste) {
  if (!Array.isArray(liste)) return [];
  return liste
    .filter((e) => e && typeof e.id === "string" && typeof e.prenom_affiche === "string" && e.prenom_affiche.trim())
    .map((e) => ({
      id: e.id,
      prenom_affiche: e.prenom_affiche.trim(),
      age_tranche: TRANCHES_AGE.includes(e.age_tranche) ? e.age_tranche : null
    }));
}

/** Clé i18n du type de profil affiché dans le dialogue Profil. */
export function cleTypeProfil(mode) {
  return { desactive: "typeProfilLocal", local: "typeProfilLocal", parent: "typeProfilParent", enfant: "typeProfilEnfant" }[mode]
    ?? "typeProfilLocal";
}

/** Clé i18n de l'aide sous le type de profil. */
export function cleAideProfil(mode) {
  return { desactive: "aideProfilBientot", local: "aideProfilLocal", parent: "aideProfilParent", enfant: "aideProfilEnfant" }[mode]
    ?? "aideProfilBientot";
}
