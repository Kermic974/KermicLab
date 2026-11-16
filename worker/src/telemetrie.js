// Télémétrie anonyme des appels aux modèles (ADR 0026) : compteurs agrégés à l'heure par module, fournisseur, modèle
// et statut. Aucun identifiant de session, de profil ou de requête, aucun texte. Une panne de D1 n'empêche jamais
// la réponse : la télémétrie est facultative.

const entier = (v) => (Number.isSafeInteger(v) && v > 0 ? v : 0);

/** Heure courante au format AAAA-MM-JJTHH (UTC). */
export const heureCourante = (maintenant = Date.now()) => new Date(maintenant).toISOString().slice(0, 13);

/**
 * @param {{ module: string, fournisseur: string, modele: string, statut: "ok"|"refus"|"tronque"|"erreur",
 *   tokensEntree?: number, tokensSortie?: number, dureeMs?: number, pseudonymisations?: number }} appel
 */
export async function enregistrerAppel(env, appel, maintenant = Date.now()) {
  if (!env?.DB) return;
  try {
    await env.DB.prepare(`
      INSERT INTO telemetrie_llm (heure, module, fournisseur, modele, statut, appels, tokens_entree, tokens_sortie, duree_ms, pseudonymisations)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT (heure, module, fournisseur, modele, statut) DO UPDATE SET
        appels = appels + 1,
        tokens_entree = tokens_entree + excluded.tokens_entree,
        tokens_sortie = tokens_sortie + excluded.tokens_sortie,
        duree_ms = duree_ms + excluded.duree_ms,
        pseudonymisations = pseudonymisations + excluded.pseudonymisations
    `).bind(
      heureCourante(maintenant), String(appel.module), String(appel.fournisseur), String(appel.modele), String(appel.statut),
      entier(appel.tokensEntree), entier(appel.tokensSortie), entier(appel.dureeMs), entier(appel.pseudonymisations)
    ).run();
  } catch {
    // Table absente ou D1 indisponible : aucune conséquence pour l'utilisateur.
  }
}

/** Mesure un appel à un fournisseur et l'enregistre, qu'il réussisse ou qu'il échoue. */
export async function mesurerAppel(env, { module, fournisseur, modele }, appeler) {
  const debut = Date.now();
  let r;
  try {
    r = await appeler();
  } catch (e) {
    await enregistrerAppel(env, { module, fournisseur, modele, statut: "erreur", dureeMs: Date.now() - debut });
    throw e;
  }
  await enregistrerAppel(env, {
    module, fournisseur, modele,
    statut: r?.refus ? "refus" : r?.tronque ? "tronque" : "ok",
    tokensEntree: r?.tokensEntree, tokensSortie: r?.tokensSortie,
    dureeMs: Date.now() - debut, pseudonymisations: r?.pseudonymisations
  });
  return r;
}

/** Synthèse des `jours` derniers jours pour le back-office : totaux, par jour, par modèle et par module. */
export async function syntheseTelemetrie(env, jours = 7, maintenant = Date.now()) {
  const depuis = new Date(maintenant - jours * 86400000).toISOString().slice(0, 13);
  const somme = "sum(appels) AS appels, sum(tokens_entree) AS tokensEntree, sum(tokens_sortie) AS tokensSortie, sum(duree_ms) AS dureeMs, sum(pseudonymisations) AS pseudonymisations";
  const lire = async (colonnes, groupe) => (await env.DB.prepare(
    `SELECT ${colonnes}, ${somme} FROM telemetrie_llm WHERE heure >= ? GROUP BY ${groupe} ORDER BY ${groupe}`
  ).bind(depuis).all()).results ?? [];
  const [parJour, parModele, parModule, parStatut] = await Promise.all([
    lire("substr(heure, 1, 10) AS jour", "substr(heure, 1, 10)"),
    lire("fournisseur, modele", "fournisseur, modele"),
    lire("module", "module"),
    lire("statut", "statut")
  ]);
  const total = (await env.DB.prepare(`SELECT ${somme} FROM telemetrie_llm WHERE heure >= ?`).bind(depuis).first()) ?? {};
  return { jours, total: Object.fromEntries(Object.entries(total).map(([k, v]) => [k, v ?? 0])), parJour, parModele, parModule, parStatut };
}

/** Efface la télémétrie plus ancienne que `jours` jours (cron quotidien). */
export async function purgerTelemetrie(env, jours, maintenant = Date.now()) {
  if (!env?.DB) return 0;
  const limite = new Date(maintenant - jours * 86400000).toISOString().slice(0, 13);
  const r = await env.DB.prepare("DELETE FROM telemetrie_llm WHERE heure < ?").bind(limite).run();
  return r?.meta?.changes ?? 0;
}
