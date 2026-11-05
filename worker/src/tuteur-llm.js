import { HARNESS_LLM } from "./contexte-llm.js";
import {
  MODELE_CHAT_PAR_DEFAUT, MODELE_WORKERS_AI_PAR_DEFAUT,
  normaliserResultat, routerAvecClaude, routerAvecWorkersAI
} from "./llm.js";
import { reserverTokens, solderTokens } from "./session-llm.js";

/** Tous les essais, y compris les échecs et le repli, passent par le même compteur D1. */
export async function interrogerTuteur(env, session, contexte, clientClaude) {
  const fournisseurs = [];
  if (env.AI?.run) fournisseurs.push({
    nom: "cloudflare-workers-ai", modele: env.MODELE_WORKERS_AI || MODELE_WORKERS_AI_PAR_DEFAUT,
    appeler: (parametres) => routerAvecWorkersAI(env, parametres)
  });
  if (env.ANTHROPIC_API_KEY) fournisseurs.push({
    nom: "anthropic", modele: env.MODELE_CHAT || MODELE_CHAT_PAR_DEFAUT,
    appeler: (parametres) => routerAvecClaude(env, parametres, clientClaude)
  });
  const appels = [];
  for (const fournisseur of fournisseurs) {
    const reservation = await reserverTokens(env, session.id);
    if (!reservation) return { erreur: "quota-ou-en-cours" };
    let generation;
    try {
      generation = await fournisseur.appeler({ ...contexte, maxTokens: reservation.reservation });
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
      resultat = generation.refus
        ? { refus: true }
        : normaliserResultat(generation.contenu, contexte.source);
    } catch {
      console.error("llm sortie ou sources invalides", fournisseur.nom);
      continue;
    }
    return {
      resultat,
      llm: {
        fournisseur: fournisseur.nom, modele: fournisseur.modele,
        harness: HARNESS_LLM, repli: appels.length > 1, appels,
        quota: { limite: quota.limite, consommes: quota.consommes, restants: quota.restants }
      }
    };
  }
  return { erreur: "indisponible" };
}
