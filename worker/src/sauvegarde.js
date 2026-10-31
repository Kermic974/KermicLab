/**
 * Sauvegarde quotidienne des KPI D1 dans R2 (ADR 0007).
 * Copie les événements d'un jour UTC dans `sauvegardes/kpi/AAAA-MM-JJ.json`.
 * Les KPI sont déjà anonymes (ni IP ni texte de message) : rien d'autre n'est ajouté.
 */
export const PREFIXE_KPI = "sauvegardes/kpi/";

/** Jour UTC (AAAA-MM-JJ) qui précède l'instant donné. */
export function jourPrecedent(instant) {
  const d = new Date(instant);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Écrit les événements du jour `jour` dans R2. Rejouable : le même jour réécrit le même fichier. */
export async function sauvegarderKpi(env, jour) {
  if (!env.DB || !env.DONNEES) return { ok: false, raison: "binding-absent" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) throw new Error(`jour invalide : ${jour}`);
  const { results = [] } = await env.DB.prepare(
    "SELECT id, horodatage, type, maquette_id, sujet, langue, routage, detail FROM evenements WHERE horodatage >= ?1 AND horodatage < date(?1, '+1 day') ORDER BY id"
  ).bind(jour).all();
  const cle = `${PREFIXE_KPI}${jour}.json`;
  await env.DONNEES.put(cle, JSON.stringify({ jour, nombre: results.length, evenements: results }), {
    httpMetadata: { contentType: "application/json; charset=utf-8" }
  });
  return { ok: true, cle, nombre: results.length };
}
