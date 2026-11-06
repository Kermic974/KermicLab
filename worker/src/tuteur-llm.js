import { HARNESS_LLM } from "./contexte-llm.js";
import {
  MODELE_CHAT_PAR_DEFAUT, MODELE_WORKERS_AI_PAR_DEFAUT, SCHEMA_ROUTAGE,
  appelerClaude, appelerWorkersAI, claudeViaGatewayDisponible, normaliserResultat, promptSysteme
} from "./llm.js";
import { reserverTokens, solderTokens } from "./session-llm.js";

/**
 * Workers AI puis repli Claude. Tous les essais, y compris les échecs et le repli, passent par le même
 * compteur D1 de la session (1 000 tokens générés au plus).
 * `demande` : { system, message, schema, normaliser(contenu) → résultat validé (lève sinon) }.
 */
export async function interrogerFournisseurs(env, session, demande, clientClaude, harness = HARNESS_LLM) {
  const fournisseurs = [];
  if (env.AI?.run) fournisseurs.push({
    nom: "cloudflare-workers-ai", modele: env.MODELE_WORKERS_AI || MODELE_WORKERS_AI_PAR_DEFAUT,
    appeler: (parametres) => appelerWorkersAI(env, parametres)
  });
  if (env.ANTHROPIC_API_KEY && !claudeViaGatewayDisponible(env)) {
    console.error("llm configuration gateway Anthropic incomplète");
  }
  if (claudeViaGatewayDisponible(env)) fournisseurs.push({
    nom: "anthropic", modele: env.MODELE_CHAT || MODELE_CHAT_PAR_DEFAUT,
    appeler: (parametres) => appelerClaude(env, parametres, clientClaude)
  });
  const appels = [];
  for (const fournisseur of fournisseurs) {
    const reservation = await reserverTokens(env, session.id);
    if (!reservation) return { erreur: "quota-ou-en-cours" };
    let generation;
    try {
      generation = await fournisseur.appeler({
        system: demande.system, message: demande.message, schema: demande.schema, maxTokens: reservation.reservation
      });
    } catch {
      console.error("llm appel fournisseur échoué", fournisseur.nom);
    }
    // Sans usage fiable (timeout, erreur réseau…), la réservation entière reste facturée.
    // Si D1 échoue ici, on arrête : aucun autre appel ne doit contourner la réservation.
    const quota = await solderTokens(env, session.id, reservation.reservation, generation?.tokensSortie);
    appels.push({
      fournisseur: fournisseur.nom, modele: fournisseur.modele,
      tokensSortie: quota.tokens, comptage: quota.comptage
    });
    if (!generation) continue;
    let resultat;
    try {
      resultat = generation.refus ? { refus: true } : demande.normaliser(generation.contenu);
    } catch {
      console.error("llm sortie ou sources invalides", fournisseur.nom);
      continue;
    }
    return {
      resultat,
      llm: {
        fournisseur: fournisseur.nom, modele: fournisseur.modele,
        harness, repli: appels.length > 1, appels,
        // Transparence : nombre de données personnelles remplacées par un jeton avant l'envoi au modèle.
        pseudonymisation: { appliquee: true, remplacements: generation.pseudonymisations ?? 0 },
        quota: { limite: quota.limite, consommes: quota.consommes, restants: quota.restants }
      }
    };
  }
  return { erreur: "indisponible" };
}

/** Relance pédagogique sur une page du catalogue. */
export function interrogerTuteur(env, session, contexte, clientClaude) {
  return interrogerFournisseurs(env, session, {
    system: promptSysteme(contexte.source), message: contexte.message, schema: SCHEMA_ROUTAGE,
    normaliser: (contenu) => normaliserResultat(contenu, contexte.source)
  }, clientClaude);
}
