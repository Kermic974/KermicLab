/**
 * Journalisation anonyme des KPI dans D1. Aucune IP, aucun texte de message n'est stocké.
 * Types : demande, maquette_servie, exception, reponse, refus, erreur, support, idee, defi.
 */
export async function journaliser(env, evenement) {
  if (!env.DB) return;
  const { type, maquetteId = null, sujet = null, langue = null, routage = null, detail = null } = evenement;
  try {
    await env.DB.prepare(
      "INSERT INTO evenements (type, maquette_id, sujet, langue, routage, detail) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    ).bind(type, maquetteId, sujet, langue, routage, detail).run();
  } catch (e) {
    console.error("kpi", e?.message);
  }
}
