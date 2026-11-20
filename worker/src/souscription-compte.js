// Souscription d'un compte local, vue et changée par l'utilisateur depuis « Mon compte » (ADR 0034). Le compte voit son
// niveau, ce qu'il inclut et les offres proposées ; il en change à la demande. Le paiement viendra plus tard : pendant
// la phase de développement (SOUSCRIPTIONS_LIBRE_CHOIX), il est considéré comme acquis et le changement est immédiat,
// noté dans `souscriptions_changements` (paiement « dev »). Ni montant ni moyen de paiement ne sont enregistrés.
import { lireConfiguration } from "./configuration.js";
import { attributionDuCompte, ecrireAttribution } from "./attributions.js";
import { chargerReglages, envAvecReglages } from "./reglages.js";
import { SOUSCRIPTION_GRATUITE, decrireSouscription } from "./souscriptions.js";
import { listerRoles } from "./roles.js";

const TYPE = "compte-local";
const FORMAT_NIVEAU = /^[a-z][a-z0-9-]{1,20}$/;

/** Ce qu'un utilisateur voit d'une offre : jamais le coût de revient ni la marge. */
function offrePublique(s, env, finances, roles, souscriptions) {
  const d = decrireSouscription(s, env, finances, souscriptions);
  const e = d.estimation;
  return {
    id: s.id, libelle: s.libelle, description: s.description, statut: s.statut,
    role: s.role, roleLibelle: roles.find((r) => r.id === s.role)?.libelle ?? s.role,
    fonctionnalites: s.fonctionnalites, limites: d.limites,
    prix: { devise: e.devise, mensuelHT: e.prixMensuelHT, mensuelTTC: e.prixMensuelTTC, annuelHT: e.prixAnnuelHT, annuelTTC: e.prixAnnuelTTC }
  };
}

/** Offres proposées au compte : celles au statut « active » ; en phase de développement, aussi celles « en projet ». */
const proposables = (souscriptions, libreChoix) => souscriptions.filter((s) => s.id === SOUSCRIPTION_GRATUITE || s.statut === "active" || libreChoix);

/** État de la souscription d'un compte local. */
export async function etatSouscriptionCompte(env, compteId) {
  const reglages = await chargerReglages(env);
  const envEffectif = envAvecReglages(env, reglages);
  const libreChoix = lireConfiguration(envEffectif).SOUSCRIPTIONS_LIBRE_CHOIX;
  const attribution = await attributionDuCompte(env, TYPE, compteId, { reglages });
  let roles = [];
  try { roles = await listerRoles(env); } catch { roles = []; }
  const actuelle = reglages.souscriptions.find((s) => s.id === attribution.niveau) ?? reglages.souscriptions.find((s) => s.id === SOUSCRIPTION_GRATUITE);
  let historique = [];
  try {
    historique = (await env.DB.prepare("SELECT de, vers, paiement, change_le FROM souscriptions_changements WHERE type_compte = ? AND compte_id = ? ORDER BY id DESC LIMIT 10")
      .bind(TYPE, compteId).all()).results ?? [];
  } catch { historique = []; }
  return {
    niveau: actuelle.id,
    actuelle: offrePublique(actuelle, envEffectif, reglages.finances, roles, reglages.souscriptions),
    offres: proposables(reglages.souscriptions, libreChoix).map((s) => offrePublique(s, envEffectif, reglages.finances, roles, reglages.souscriptions)),
    roles: attribution.roles.map((id) => ({ id, libelle: roles.find((r) => r.id === id)?.libelle ?? id })),
    paiement: libreChoix ? "dev" : "a-venir",
    historique
  };
}

/**
 * Change la souscription d'un compte local. Les rôles attribués à la main sont gardés : la nouvelle offre apporte son
 * rôle, qui se cumule (ADR 0034). Sans phase de développement, le paiement n'existant pas encore, le changement vers
 * une offre payante est refusé (`paiement-requis`).
 */
export async function changerSouscriptionCompte(env, compteId, corps) {
  const niveau = String(corps?.niveau ?? "");
  if (!FORMAT_NIVEAU.test(niveau)) return { statut: 400, corps: { erreur: "niveau-invalide" } };
  const reglages = await chargerReglages(env);
  const envEffectif = envAvecReglages(env, reglages);
  const libreChoix = lireConfiguration(envEffectif).SOUSCRIPTIONS_LIBRE_CHOIX;
  const offre = proposables(reglages.souscriptions, libreChoix).find((s) => s.id === niveau);
  if (!offre) return { statut: 404, corps: { erreur: "offre-indisponible" } };
  const attribution = await attributionDuCompte(env, TYPE, compteId, { reglages });
  if (attribution.niveau === niveau) return { statut: 200, corps: await etatSouscriptionCompte(env, compteId) };
  const payante = decrireSouscription(offre, envEffectif, reglages.finances, reglages.souscriptions).estimation.prixMensuelHT > 0;
  if (payante && !libreChoix) return { statut: 402, corps: { erreur: "paiement-requis" } };
  await ecrireAttribution(env, TYPE, compteId, { roles: attribution.manuels, niveau });
  await env.DB.prepare("INSERT INTO souscriptions_changements (type_compte, compte_id, de, vers, paiement) VALUES (?, ?, ?, ?, ?)")
    .bind(TYPE, compteId, attribution.niveau, niveau, payante ? "dev" : "gratuit").run();
  return { statut: 200, corps: await etatSouscriptionCompte(env, compteId) };
}
