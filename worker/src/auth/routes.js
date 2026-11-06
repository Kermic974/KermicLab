import { demarrerOAuth, terminerOAuth } from "./oauth.js";
import { creerSession, lireSession, supprimerSession, cookieSession, cookieSessionVide } from "./session.js";

async function hashEmail(email) {
  const data = new TextEncoder().encode(email.toLowerCase().trim());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function trouverOuCreerCompte(env, provider, identity) {
  const emailHash = await hashEmail(identity.email);

  let row = await env.DB.prepare(
    "SELECT compte_id FROM auth_providers WHERE provider = ? AND provider_sub = ?"
  ).bind(provider, identity.sub).first();

  if (row) {
    await env.DB.prepare("UPDATE comptes SET last_login_at = datetime('now') WHERE id = ?")
      .bind(row.compte_id).run();
    return row.compte_id;
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO comptes (id, email_hash) VALUES (?, ?)"
  ).bind(id, emailHash).run();

  await env.DB.prepare(
    "INSERT INTO auth_providers (compte_id, provider, provider_sub) VALUES (?, ?, ?)"
  ).bind(id, provider, identity.sub).run();

  return id;
}

/** Un fournisseur est utilisable si ses identifiants OAuth et la base des comptes sont présents. */
export function fournisseursConfigures(env) {
  const pret = (id, secret) => !!env.DB && typeof env[id] === "string" && !!env[id] && typeof env[secret] === "string" && !!env[secret];
  return { google: pret("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"), microsoft: pret("MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET") };
}

export async function gererAuth(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Fournisseurs réellement configurés : le site n'envoie pas vers une connexion qui échouerait.
  if (path === "/auth/fournisseurs" && request.method === "GET") {
    return Response.json(fournisseursConfigures(env), { headers: { "cache-control": "no-store" } });
  }

  if (path === "/auth/login" && request.method === "GET") {
    const provider = url.searchParams.get("provider");
    if (!["google", "microsoft"].includes(provider)) {
      return new Response("Provider invalide", { status: 400 });
    }
    if (!fournisseursConfigures(env)[provider]) {
      return new Response("Connexion indisponible : fournisseur non configuré", {
        status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
      });
    }
    const redirect = env.AUTH_CALLBACK_URL || `${url.origin}/auth/callback`;
    const location = await demarrerOAuth(env, provider, redirect);
    return Response.redirect(location, 302);
  }

  if (path === "/auth/callback" && request.method === "GET") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return new Response("Code ou state manquant", { status: 400 });

    const redirect = env.AUTH_CALLBACK_URL || `${url.origin}/auth/callback`;
    const { provider, identity } = await terminerOAuth(env, code, state, redirect);
    const compteId = await trouverOuCreerCompte(env, provider, identity);
    const sessionId = await creerSession(env, compteId);

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": cookieSession(sessionId)
      }
    });
  }

  if (path === "/auth/me" && request.method === "GET") {
    const cookie = request.headers.get("cookie") || "";
    const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
    const compteId = await lireSession(env, match?.[1]);
    if (!compteId) return new Response(JSON.stringify({ connecte: false }), { status: 401 });

    const compte = await env.DB.prepare(
      "SELECT id, role, created_at FROM comptes WHERE id = ?"
    ).bind(compteId).first();

    return Response.json({ connecte: true, compte });
  }

  if (path === "/auth/logout" && request.method === "POST") {
    const cookie = request.headers.get("cookie") || "";
    const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
    await supprimerSession(env, match?.[1]);
    return new Response(null, {
      status: 204,
      headers: { "Set-Cookie": cookieSessionVide() }
    });
  }

  return null;
}
