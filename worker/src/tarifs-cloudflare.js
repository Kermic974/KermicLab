// Tarifs des modèles exposés par Cloudflare (ADR 0034) : le catalogue de modèles commun à AI Gateway et Workers AI
// (`GET /accounts/{compte}/ai/models/search`, format « openrouter » : prix par token) donne le prix d'entrée, de sortie
// et de lecture en cache de chaque modèle. Le back-office les charge à la demande pour préremplir les hypothèses
// financières ; rien n'est enregistré sans l'administrateur. Lecture seule, avec un jeton « Workers AI Read ».
import { FORMAT_MODELE, MODULES_COUT } from "../../web/admin/financier.js";

const API = "https://api.cloudflare.com/client/v4";
const FORMAT_COMPTE = /^[a-f0-9]{32}$/;
const DELAI_MS = 8000;

/** Le chargement exige l'identifiant du compte Cloudflare et un jeton de lecture (secrets du Worker). */
export function tarifsCloudflareDisponibles(env) {
  return FORMAT_COMPTE.test(String(env?.CLOUDFLARE_ACCOUNT_ID ?? "")) && typeof env?.CLOUDFLARE_TARIFS_TOKEN === "string" && env.CLOUDFLARE_TARIFS_TOKEN.length >= 20;
}

const parMillion = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1e6 * 10000) / 10000 : null;
};

/**
 * Prix d'un modèle dans une réponse du catalogue, en devise par million de tokens.
 * - format « openrouter » : `data[].pricing.prompt | completion | input_cache_read` (par token, en chaîne) ;
 * - format par défaut : `result[].properties[{ property_id: "price", value: [{ unit, price }] }]` (par million).
 * @returns {{ entree: number, sortie: number, cache: number | null } | null}
 */
export function prixDansCatalogue(corps, modele) {
  const nom = (m) => [m?.id, m?.name, m?.canonical_slug].filter((x) => typeof x === "string");
  const correspond = (m) => nom(m).some((x) => x === modele || x.endsWith(`/${modele}`));
  const ouvert = (corps?.data ?? []).find(correspond);
  if (ouvert?.pricing) {
    const entree = parMillion(ouvert.pricing.prompt);
    const sortie = parMillion(ouvert.pricing.completion);
    if (entree !== null && sortie !== null) return { entree, sortie, cache: parMillion(ouvert.pricing.input_cache_read) };
  }
  const natif = (corps?.result ?? []).find(correspond);
  const prix = natif?.properties?.find((p) => p?.property_id === "price")?.value;
  if (Array.isArray(prix)) {
    const unite = (motif) => prix.find((p) => motif.test(String(p?.unit ?? "")))?.price;
    const entree = Number(unite(/input/i));
    const sortie = Number(unite(/output/i));
    const cache = Number(unite(/cache/i));
    if (Number.isFinite(entree) && Number.isFinite(sortie)) return { entree, sortie, cache: Number.isFinite(cache) ? cache : null };
  }
  return null;
}

/**
 * Charge les tarifs des modèles demandés (un par module) depuis le catalogue Cloudflare.
 * @param {Record<string, string>} modeles identifiant du catalogue par module (`tuteur`, `defi`, `cahiers`)
 * @returns {Promise<{ chargeLe: string, modeles: Record<string, { modele: string, entree?: number, sortie?: number, cache?: number | null, erreur?: string }> }>}
 */
export async function chargerTarifsCloudflare(env, modeles, { fetchImpl = fetch } = {}) {
  const resultat = {};
  for (const module of Object.keys(MODULES_COUT)) {
    const modele = String(modeles?.[module] ?? "").trim();
    if (!FORMAT_MODELE.test(modele)) { resultat[module] = { modele, erreur: "modele-invalide" }; continue; }
    const recherche = modele.split("/").pop();
    const url = `${API}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/models/search?format=openrouter&per_page=100&search=${encodeURIComponent(recherche)}`;
    try {
      const reponse = await fetchImpl(url, {
        headers: { authorization: `Bearer ${env.CLOUDFLARE_TARIFS_TOKEN}`, accept: "application/json" },
        signal: AbortSignal.timeout(DELAI_MS)
      });
      if (!reponse.ok) { resultat[module] = { modele, erreur: `http-${reponse.status}` }; continue; }
      const prix = prixDansCatalogue(await reponse.json(), modele);
      resultat[module] = prix ? { modele, ...prix } : { modele, erreur: "modele-introuvable" };
    } catch {
      resultat[module] = { modele, erreur: "cloudflare-injoignable" };
    }
  }
  return { chargeLe: new Date().toISOString().slice(0, 10), modeles: resultat };
}

/**
 * Consommation mesurée par module sur `jours` jours (télémétrie, ADR 0026) : appels, taille moyenne d'une génération
 * et ratio entrée / sortie observés, pour confronter les hypothèses à la réalité. Compteurs seulement.
 */
export async function mesuresTelemetrie(env, jours = 30) {
  const depuis = new Date(Date.now() - (jours - 1) * 86400000).toISOString().slice(0, 10);
  let lignes = [];
  try {
    lignes = (await env.DB.prepare(`SELECT module, sum(appels) AS appels, sum(tokens_entree) AS entree, sum(tokens_sortie) AS sortie
      FROM telemetrie_llm WHERE heure >= ? AND statut IN ('ok', 'tronque') GROUP BY module`).bind(depuis).all()).results ?? [];
  } catch { lignes = []; }
  const mesures = {};
  for (const module of Object.keys(MODULES_COUT)) {
    const l = lignes.find((x) => x.module === module);
    const appels = l?.appels ?? 0;
    mesures[module] = appels > 0 && l.sortie > 0
      ? { appels, tokensParAppel: Math.round(l.sortie / appels), ratio: Math.round(l.entree / l.sortie * 100) / 100 }
      : { appels, tokensParAppel: null, ratio: null };
  }
  return { jours, mesures };
}
