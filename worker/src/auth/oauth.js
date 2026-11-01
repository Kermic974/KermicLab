import { verifierIdToken } from "./jwt.js";

const CONFIG = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientIdKey: "GOOGLE_CLIENT_ID",
    clientSecretKey: "GOOGLE_CLIENT_SECRET"
  },
  microsoft: {
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    clientIdKey: "MICROSOFT_CLIENT_ID",
    clientSecretKey: "MICROSOFT_CLIENT_SECRET"
  }
};

function base64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function genererPKCE() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64url(digest);
  return { verifier, challenge };
}

export async function demarrerOAuth(env, provider, redirectUri) {
  const cfg = CONFIG[provider];
  if (!cfg) throw new Error("Provider inconnu");

  const { verifier, challenge } = await genererPKCE();
  const state = crypto.randomUUID();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await env.DB.prepare(
    "INSERT INTO oauth_states (state, provider, code_verifier, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(state, provider, verifier, expires).run();

  const params = new URLSearchParams({
    client_id: env[cfg.clientIdKey],
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  });

  return `${cfg.authUrl}?${params}`;
}

export async function terminerOAuth(env, code, state, redirectUri) {
  const row = await env.DB.prepare(
    "SELECT provider, code_verifier FROM oauth_states WHERE state = ? AND expires_at > datetime('now')"
  ).bind(state).first();

  if (!row) throw new Error("State invalide ou expiré");

  await env.DB.prepare("DELETE FROM oauth_states WHERE state = ?").bind(state).run();

  const cfg = CONFIG[row.provider];
  const body = new URLSearchParams({
    client_id: env[cfg.clientIdKey],
    client_secret: env[cfg.clientSecretKey],
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: row.code_verifier
  });

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });

  if (!res.ok) throw new Error("Échange de code échoué");
  const tokens = await res.json();

  const identity = await verifierIdToken(tokens.id_token, row.provider, env[cfg.clientIdKey]);
  return { provider: row.provider, identity };
}
