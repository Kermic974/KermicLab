// Données de l'expérience Professeur (ADR 0030) rattachées à un compte local : effacement en cascade, utilisé par la
// suppression du compte (par son titulaire ou depuis le back-office).

/** Les tables du professeur existent-elles ? (migration 0004 appliquée) */
export async function tablesProfesseur(env) {
  try {
    return !!(await env.DB.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'professeurs_eleves'").bind().first());
  } catch {
    return false;
  }
}

/**
 * Instructions (à exécuter dans un même lot) qui effacent tout ce qui rattache un compte à l'expérience Professeur,
 * qu'il soit professeur ou élève : profil, classes, invitations, affiliations et bilan. Les comptes des élèves d'un
 * professeur supprimé ne sont pas effacés ; leur bilan l'est s'ils n'ont plus aucun professeur.
 */
export function instructionsEffacementProfesseur(env, compteId) {
  const db = env.DB;
  return [
    db.prepare("DELETE FROM professeurs_bilans WHERE eleve_id = ?").bind(compteId),
    db.prepare("DELETE FROM professeurs_eleves WHERE eleve_id = ? OR prof_id = ?").bind(compteId, compteId),
    db.prepare("DELETE FROM professeurs_bilans WHERE eleve_id NOT IN (SELECT eleve_id FROM professeurs_eleves)").bind(),
    db.prepare("DELETE FROM professeurs_invitations WHERE prof_id = ?").bind(compteId),
    db.prepare("DELETE FROM professeurs_classes WHERE prof_id = ?").bind(compteId),
    db.prepare("DELETE FROM professeurs_profils WHERE compte_id = ?").bind(compteId)
  ];
}

/** Lot d'effacement du professeur, vide si les tables n'existent pas encore. */
export async function effacementProfesseur(env, compteId) {
  return (await tablesProfesseur(env)) ? instructionsEffacementProfesseur(env, compteId) : [];
}
