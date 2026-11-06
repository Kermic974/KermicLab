// API des comptes famille (ADR 0010, ADR 0017) : profils enfants et progression, réservés au parent connecté.
// Mêmes règles que l'interface (web/profil.js, web/comptes.js) : un seul jeu de règles, partagé.
import { validerPseudo } from "../../web/profil.js";
import { MAX_ENFANTS, TRANCHES_AGE, VERSION_CONSENTEMENT } from "../../web/comptes.js";
import { cookieSessionVide } from "./auth/session.js";

export const MAX_NOTIONS_PROGRES = 500;
const TAILLE_MAX_CORPS = 64 * 1024;
const ID_NOTION = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ROUTE_ENFANT = /^\/api\/eleves\/([0-9a-f-]{36})$/;

const json = (donnees, statut = 200) => new Response(JSON.stringify(donnees), {
  status: statut,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const erreur = (code, statut) => json({ erreur: code }, statut);

/** Routes servies par ce module : sans session valide, elles répondent 401 au lieu de tomber dans le 404 général. */
export function estRouteCompte(chemin) {
  return chemin === "/api/eleves" || chemin === "/api/progres" || chemin === "/api/compte" || ROUTE_ENFANT.test(chemin);
}

/**
 * Supprime le compte parent et tout ce qui en dépend (ADR 0010 §5) : progression, profils enfants, sessions, liaisons
 * OAuth, puis le compte. Suppression explicite table par table, en une requête groupée : D1 n'applique les clés étrangères
 * (ON DELETE CASCADE) que si elles sont activées.
 */
export async function supprimerCompte(env, compteId) {
  const db = env.DB;
  await db.batch([
    db.prepare("DELETE FROM progres WHERE eleve_id IN (SELECT id FROM eleves WHERE parent_id = ?)").bind(compteId),
    db.prepare("DELETE FROM eleves WHERE parent_id = ?").bind(compteId),
    db.prepare("DELETE FROM sessions WHERE compte_id = ?").bind(compteId),
    db.prepare("DELETE FROM auth_providers WHERE compte_id = ?").bind(compteId),
    db.prepare("DELETE FROM comptes WHERE id = ?").bind(compteId)
  ]);
}

async function lireCorps(requete) {
  const texte = await requete.text();
  if (texte.length > TAILLE_MAX_CORPS) return { erreur: erreur("corps-trop-grand", 413) };
  try {
    return { corps: JSON.parse(texte) };
  } catch {
    return { erreur: erreur("json-invalide", 400) };
  }
}

/** Prénom ou surnom, tranche d'âge et consentement versionné : la création est refusée sans consentement. */
export function validerCreationEnfant(corps) {
  if (!corps || typeof corps !== "object") return { ok: false, code: "corps-invalide" };
  const prenom = validerPseudo(corps.prenom_affiche);
  if (!prenom.ok) return { ok: false, code: `prenom-${prenom.erreur}` };
  if (!TRANCHES_AGE.includes(corps.age_tranche)) return { ok: false, code: "tranche-invalide" };
  if (corps.consentement_version !== VERSION_CONSENTEMENT) return { ok: false, code: "consentement-requis" };
  return { ok: true, prenom: prenom.pseudo, tranche: corps.age_tranche };
}

/** Garde les seules lignes de progression valides : identifiant de notion, étoiles 0–3, score 0–100. */
export function lignesProgres(notions) {
  if (!notions || typeof notions !== "object" || Array.isArray(notions)) return [];
  const entier = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);
  return Object.entries(notions)
    .filter(([id]) => ID_NOTION.test(id))
    .slice(0, MAX_NOTIONS_PROGRES)
    .map(([id, d]) => ({ id, score: entier(d?.score, 100), etoiles: entier(d?.etoiles, 3) }));
}

async function enfantDuParent(env, enfantId, compteId) {
  if (typeof enfantId !== "string") return false;
  return !!(await env.DB.prepare("SELECT 1 FROM eleves WHERE id = ? AND parent_id = ?").bind(enfantId, compteId).first());
}

/**
 * Traite une route de compte pour le parent `compteId` (déjà authentifié).
 * @returns {Promise<Response|null>} null si la route n'est pas une route de compte.
 */
export async function gererApiCompte(requete, env, compteId) {
  const { pathname: chemin, searchParams } = new URL(requete.url);
  const methode = requete.method;

  if (chemin === "/api/eleves" && methode === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT id, prenom_affiche, age_tranche, langue FROM eleves WHERE parent_id = ? ORDER BY created_at, id"
    ).bind(compteId).all();
    return json(results ?? []);
  }

  if (chemin === "/api/eleves" && methode === "POST") {
    const { corps, erreur: e } = await lireCorps(requete);
    if (e) return e;
    const v = validerCreationEnfant(corps);
    if (!v.ok) return erreur(v.code, 400);
    const { n } = await env.DB.prepare("SELECT count(*) AS n FROM eleves WHERE parent_id = ?").bind(compteId).first();
    if (n >= MAX_ENFANTS) return erreur("quota-atteint", 409);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO eleves (id, parent_id, prenom_affiche, age_tranche, consentement_version, consentement_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).bind(id, compteId, v.prenom, v.tranche, VERSION_CONSENTEMENT).run();
    await env.DB.prepare("UPDATE comptes SET consent_at = datetime('now'), consent_version = ? WHERE id = ?")
      .bind(VERSION_CONSENTEMENT, compteId).run();
    return json({ id }, 201);
  }

  if (chemin === "/api/compte" && methode === "DELETE") {
    await supprimerCompte(env, compteId);
    return new Response(null, { status: 204, headers: { "Set-Cookie": cookieSessionVide() } });
  }

  const route = chemin.match(ROUTE_ENFANT);
  if (route && methode === "DELETE") {
    // Effacement en cascade de la progression (ON DELETE CASCADE, ADR 0010 §5) ; suppression explicite en plus,
    // car D1 n'applique les clés étrangères que si elles sont activées.
    if (!(await enfantDuParent(env, route[1], compteId))) return erreur("introuvable", 404);
    await env.DB.prepare("DELETE FROM progres WHERE eleve_id = ?").bind(route[1]).run();
    await env.DB.prepare("DELETE FROM eleves WHERE id = ? AND parent_id = ?").bind(route[1], compteId).run();
    return new Response(null, { status: 204 });
  }

  if (chemin === "/api/progres" && methode === "GET") {
    const enfantId = searchParams.get("eleveId");
    if (!(await enfantDuParent(env, enfantId, compteId))) return erreur("interdit", 403);
    const { results } = await env.DB.prepare(
      "SELECT notion_id, score, etoiles, completed_at FROM progres WHERE eleve_id = ?"
    ).bind(enfantId).all();
    return json(results ?? []);
  }

  if (chemin === "/api/progres" && methode === "POST") {
    const { corps, erreur: e } = await lireCorps(requete);
    if (e) return e;
    if (!(await enfantDuParent(env, corps?.eleveId, compteId))) return erreur("interdit", 403);
    // Une seule requête groupée : D1 limite le nombre de requêtes par invocation (offre gratuite).
    const lignes = lignesProgres(corps.progres?.notions);
    if (lignes.length) {
      await env.DB.batch(lignes.map((l) => env.DB.prepare(`
        INSERT INTO progres (eleve_id, notion_id, score, etoiles, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(eleve_id, notion_id) DO UPDATE SET
          score = excluded.score, etoiles = excluded.etoiles, updated_at = excluded.updated_at
      `).bind(corps.eleveId, l.id, l.score, l.etoiles)));
    }
    return new Response(null, { status: 204 });
  }

  if (estRouteCompte(chemin)) return erreur("methode-non-autorisee", 405);
  return null;
}
