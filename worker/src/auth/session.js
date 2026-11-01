export async function creerSession(env, compteId) {
  const id = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    "INSERT INTO sessions (id, compte_id, expires_at) VALUES (?, ?, ?)"
  ).bind(id, compteId, expires).run();

  return id;
}

export async function lireSession(env, sessionId) {
  if (!sessionId) return null;
  const row = await env.DB.prepare(
    "SELECT compte_id FROM sessions WHERE id = ? AND expires_at > datetime('now')"
  ).bind(sessionId).first();
  return row?.compte_id || null;
}

export async function supprimerSession(env, sessionId) {
  if (!sessionId) return;
  await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

export function cookieSession(sessionId, maxAge = 2592000) {
  return `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function cookieSessionVide() {
  return "session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
}
