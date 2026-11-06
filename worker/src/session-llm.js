import { SignJWT, jwtVerify } from "jose";
import { defaut, lireConfiguration } from "./configuration.js";

/** Valeurs par défaut ; les budgets effectifs viennent de `LIMITE_TOKENS_SESSION` et `MAX_TOKENS_APPEL` (configuration.js). */
export const LIMITE_TOKENS_SESSION = defaut("LIMITE_TOKENS_SESSION");
export const MAX_TOKENS_APPEL = defaut("MAX_TOKENS_APPEL");
const DUREE_SESSION = 24 * 60 * 60;
const NOM_COOKIE = "__Host-kermiclab_llm";
const EMETTEUR = "kermiclab-llm";

function cleSession(env) {
  if (typeof env.LLM_SESSION_SECRET !== "string" || env.LLM_SESSION_SECRET.length < 32) {
    throw new Error("LLM_SESSION_SECRET absent ou trop court");
  }
  return new TextEncoder().encode(env.LLM_SESSION_SECRET);
}

export const llmActive = (env) => lireConfiguration(env).LLM_ACTIF;

export async function lireSessionLlm(requete, env) {
  const jeton = (requete.headers.get("cookie") || "").split(";")
    .map((v) => v.trim()).find((v) => v.startsWith(`${NOM_COOKIE}=`))?.slice(NOM_COOKIE.length + 1);
  if (!jeton) return null;
  let payload;
  try {
    ({ payload } = await jwtVerify(jeton, cleSession(env), {
      algorithms: ["HS256"], issuer: EMETTEUR, audience: EMETTEUR
    }));
  } catch {
    // Un cookie invalide n'autorise jamais un appel ni la remise à zéro du quota.
    return null;
  }
  if (typeof payload.sub !== "string") return null;
  return env.DB.prepare("SELECT * FROM sessions_llm WHERE id = ? AND expire_a > ?")
    .bind(payload.sub, Math.floor(Date.now() / 1000)).first();
}

async function creerSessionLlm(env, maquetteId) {
  const cle = cleSession(env);
  const maintenant = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const expiration = maintenant + DUREE_SESSION;
  await env.DB.prepare("INSERT INTO sessions_llm (id, expire_a, maquette_id) VALUES (?, ?, ?)")
    .bind(id, expiration, maquetteId).run();
  const jeton = await new SignJWT({}).setProtectedHeader({ alg: "HS256" })
    .setSubject(id).setIssuer(EMETTEUR).setAudience(EMETTEUR)
    .setIssuedAt(maintenant).setExpirationTime(expiration).sign(cle);
  // Sans Max-Age ni Expires : cookie de session, expiration serveur absolue de 24 h.
  return { id, cookie: `${NOM_COOKIE}=${jeton}; HttpOnly; Secure; SameSite=None; Path=/` };
}

export async function definirContexteLlm(requete, env, maquetteId) {
  cleSession(env);
  const session = await lireSessionLlm(requete, env);
  if (!session) return (await creerSessionLlm(env, maquetteId)).cookie;
  await env.DB.prepare("UPDATE sessions_llm SET maquette_id = ? WHERE id = ?")
    .bind(maquetteId, session.id).run();
  return undefined;
}

/** Session sans page (boîte à idées, défi express) : celle du tuteur si elle existe, sinon une nouvelle. */
export const SESSION_SANS_PAGE = "boite-idees";
export const SESSION_DEFI = "defi-express";
export async function sessionSansPage(requete, env, contexte) {
  const existante = await lireSessionLlm(requete, env);
  if (existante) return { session: existante };
  const { id, cookie } = await creerSessionLlm(env, contexte);
  return { session: { id, maquette_id: contexte }, cookie };
}
export const sessionPourIdee = (requete, env) => sessionSansPage(requete, env, SESSION_SANS_PAGE);

/** Une réservation atomique et un seul appel en vol évitent les dépassements concurrents. */
export async function reserverTokens(env, sessionId) {
  const { LIMITE_TOKENS_SESSION: limite, MAX_TOKENS_APPEL: parAppel } = lireConfiguration(env);
  return env.DB.prepare(`
    UPDATE sessions_llm
    SET en_cours = 1,
        reservation = min(?, ? - tokens_factures),
        tokens_factures = tokens_factures + min(?, ? - tokens_factures)
    WHERE id = ? AND expire_a > ? AND en_cours = 0 AND tokens_factures < ?
    RETURNING reservation, tokens_factures
  `).bind(parAppel, limite, parAppel, limite, sessionId, Math.floor(Date.now() / 1000), limite).first();
}

export async function solderTokens(env, sessionId, reservation, usage) {
  const limite = lireConfiguration(env).LIMITE_TOKENS_SESSION;
  const connu = Number.isSafeInteger(usage) && usage >= 0 && usage <= reservation;
  const depassement = Number.isSafeInteger(usage) && usage > reservation;
  const tokens = connu ? usage : reservation;
  const ligne = await env.DB.prepare(`
    UPDATE sessions_llm
    SET tokens_factures = CASE WHEN ? THEN ? ELSE tokens_factures - reservation + ? END,
        reservation = 0, en_cours = 0
    WHERE id = ? AND en_cours = 1 AND reservation = ?
    RETURNING tokens_factures
  `).bind(depassement ? 1 : 0, limite, tokens, sessionId, reservation).first();
  if (!ligne) throw new Error("réservation LLM introuvable");
  if (depassement) throw new Error("limite fournisseur dépassée");
  return {
    tokens, comptage: connu ? "fournisseur" : "reservation-prudente",
    limite, consommes: ligne.tokens_factures,
    restants: Math.max(0, limite - ligne.tokens_factures)
  };
}

export async function purgerSessionsLlm(env, maintenant = Date.now()) {
  if (!env.DB) return;
  await env.DB.prepare("DELETE FROM sessions_llm WHERE expire_a <= ?")
    .bind(Math.floor(maintenant / 1000)).run();
}
