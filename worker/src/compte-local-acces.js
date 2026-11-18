// Droit d'accès d'un compte local (RGPD art. 15) : tout ce que la base contient sur un compte, tel quel. Une seule
// fonction sert l'export du back-office (ADR 0026) et le libre-service « Ce que Kermiclab sait de moi » (ADR 0024 §3 ter) :
// l'utilisateur voit exactement ce que voit l'administrateur. Les données synchronisées n'y figurent pas : chiffrées
// dans le navigateur et rangées sous un pseudonyme sans lien avec le compte, le serveur ne peut ni les lire ni les retrouver.
import { profilDuCompte } from "./comportement.js";

const tenter = async (lire, defaut) => { try { return await lire(); } catch { return defaut; } };
const toutes = async (env, sql, ...valeurs) => (await env.DB.prepare(sql).bind(...valeurs).all()).results ?? [];
const une = (env, sql, ...valeurs) => tenter(() => env.DB.prepare(sql).bind(...valeurs).first(), null);
const liste = (env, sql, ...valeurs) => tenter(() => toutes(env, sql, ...valeurs), []);

export const NOTE_DONNEES_SYNCHRONISEES = "Les données synchronisées sont chiffrées dans le navigateur et ne sont reliées à aucun compte : le serveur ne peut ni les lire ni les retrouver.";

/**
 * Données d'un compte local, ou null s'il n'existe pas.
 * @returns {Promise<object | null>}
 */
export async function donneesCompteLocal(env, id) {
  const compte = await une(env, "SELECT id, cree_le, mdp_provisoire FROM comptes_locaux WHERE id = ?", id)
    ?? await une(env, "SELECT id, cree_le FROM comptes_locaux WHERE id = ?", id);
  if (!compte) return null;
  const profil = await profilDuCompte(env, "compte-local", id);
  const sessions = await une(env, "SELECT count(*) AS n FROM sessions_locales WHERE compte_id = ? AND expire_a > ?", id, Math.floor(Date.now() / 1000));
  return {
    type: "compte-local",
    id,
    exporteLe: new Date().toISOString(),
    compte: { id: compte.id, cree_le: compte.cree_le, mot_de_passe_provisoire: compte.mdp_provisoire === 1, sessions_actives: sessions?.n ?? 0 },
    note: NOTE_DONNEES_SYNCHRONISEES,
    // Espace famille (ADR 0029) : liens, bilans, cahiers assignés et consommations du compte.
    famille: {
      liens: await liste(env, "SELECT enfant_id, parent_id, prenom, tranche_age, consentement_version, consentement_le, origine, lie_le FROM familles_liens WHERE enfant_id = ? OR parent_id = ?", id, id),
      bilan: await une(env, "SELECT bilan, maj_le FROM familles_bilans WHERE enfant_id = ?", id),
      cahiers: await liste(env, "SELECT id, parent_id, enfant_id, demande, statut, calibrage, reussis, total, cree_le, maj_le FROM familles_cahiers WHERE enfant_id = ? OR parent_id = ?", id, id),
      consommations: await liste(env, "SELECT jour, module, appels, tokens FROM familles_consommations WHERE compte_id = ? ORDER BY jour", id)
    },
    // Expérience Professeur (ADR 0030) : profil, classes, affiliations (comme professeur ou comme élève) et bilan.
    professeur: {
      profil: await une(env, "SELECT nom_affiche, matieres, niveaux, maj_le FROM professeurs_profils WHERE compte_id = ?", id),
      classes: await liste(env, "SELECT id, nom, matiere, niveau, cree_le FROM professeurs_classes WHERE prof_id = ?", id),
      affiliations: await liste(env, "SELECT prof_id, eleve_id, classe_id, pseudo, accord_version, rejoint_le FROM professeurs_eleves WHERE prof_id = ? OR eleve_id = ?", id, id),
      bilan: await une(env, "SELECT bilan, maj_le FROM professeurs_bilans WHERE eleve_id = ?", id),
      activites: await liste(env, "SELECT id, type, classe_id, eleve_id, parametres, echeance, statut, cree_le FROM professeurs_activites WHERE prof_id = ? OR eleve_id = ?", id, id),
      resultats: await liste(env, "SELECT activite_id, reussis, total, meilleur, tentatives, duree_s, termine, debut_le, maj_le FROM professeurs_resultats WHERE eleve_id = ?", id)
    },
    // Contributions au contenu (ADR 0023 §6 ter).
    contributions: await liste(env, "SELECT id, notion_id, chemin, nature, type, texte_propose, motif, statut, created_at FROM contributions_locales WHERE auteur_id = ?", id),
    attribution: await une(env, "SELECT role_id, roles, niveau, maj_le FROM attributions_roles WHERE type_compte = 'compte-local' AND compte_id = ?", id)
      ?? await une(env, "SELECT role_id, niveau, maj_le FROM attributions_roles WHERE type_compte = 'compte-local' AND compte_id = ?", id),
    // Changements de souscription (ADR 0034) : niveaux, mode de paiement, date au jour près.
    souscriptions: await liste(env, "SELECT de, vers, paiement, change_le FROM souscriptions_changements WHERE type_compte = 'compte-local' AND compte_id = ? ORDER BY id", id),
    securite: profil ? {
      etat: await une(env, "SELECT etat, motifs, decide_par, maj_le, expire_le FROM profils_securite WHERE profil = ?", profil),
      compteurs: await liste(env, "SELECT jour, categorie, module, n FROM signaux_securite WHERE profil = ? ORDER BY jour", profil)
    } : null
  };
}
