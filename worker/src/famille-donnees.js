// Données de l'Espace famille (ADR 0029) rattachées à un compte local : effacement en cascade, utilisé par la
// suppression du compte (par son titulaire ou depuis le back-office) et par la suppression d'un enfant par son parent.

/** Les tables de la famille existent-elles ? (migration 0003 appliquée) */
export async function tablesFamille(env) {
  try {
    return !!(await env.DB.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'familles_liens'").bind().first());
  } catch {
    return false;
  }
}

/**
 * Instructions (à exécuter dans un même lot) qui effacent tout ce qui rattache un compte à une famille, qu'il en soit
 * le parent ou l'enfant : liens, invitation, bilan, cahiers assignés ou reçus, consommations. Les comptes des enfants
 * d'un parent supprimé ne sont pas effacés : ils redeviennent des comptes solo.
 */
export function instructionsEffacementFamille(env, compteId) {
  const db = env.DB;
  return [
    db.prepare("DELETE FROM familles_bilans WHERE enfant_id = ?").bind(compteId),
    db.prepare("DELETE FROM familles_bilans WHERE enfant_id IN (SELECT enfant_id FROM familles_liens WHERE parent_id = ?)").bind(compteId),
    db.prepare("DELETE FROM familles_cahiers WHERE enfant_id = ? OR parent_id = ?").bind(compteId, compteId),
    db.prepare("DELETE FROM familles_invitations WHERE enfant_id = ?").bind(compteId),
    db.prepare("DELETE FROM familles_consommations WHERE compte_id = ?").bind(compteId),
    db.prepare("DELETE FROM familles_liens WHERE enfant_id = ? OR parent_id = ?").bind(compteId, compteId)
  ];
}

/** Lot d'effacement de la famille, vide si les tables n'existent pas encore. */
export async function effacementFamille(env, compteId) {
  return (await tablesFamille(env)) ? instructionsEffacementFamille(env, compteId) : [];
}
