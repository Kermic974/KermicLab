// Compte local : identifiant + mot de passe, et synchronisation pseudonymisée (ADR 0024).
// Mêmes règles que l'interface (web/compte-local.js). Le serveur :
// - authentifie un compte par identifiant et mot de passe (jeton porteur, pas de cookie : aucun souci de cookie tiers
//   ni de CSRF) ; l'identifiant n'est gardé que sous forme d'empreinte HMAC ;
// - stocke des instantanés chiffrés sous un pseudonyme dérivé, dans le navigateur, d'une phrase secrète qu'il ne voit
//   jamais. Aucune table ne relie un pseudonyme à un compte et rien n'est journalisé (ni pseudonyme ni identifiant).
import {
  FORMAT_CHIFFRE, FORMAT_IV, FORMAT_JETON, FORMAT_PSEUDONYME, TAILLE_MAX_CHIFFRE,
  depuisBase64, egalesTempsConstant, sha256Hex, validerIdentifiant, validerMotDePasse, versBase64, versBase64Url, versHex
} from "../../web/compte-local.js";

export const PREFIXE = "/api/compte-local/";
/** PBKDF2 côté Worker : 100 000 itérations est le maximum accepté par Cloudflare Workers. */
export const ITERATIONS_SERVEUR = 100000;
export const DUREE_SESSION_S = 12 * 3600;
export const ECHECS_AVANT_BLOCAGE = 10;
export const DUREE_BLOCAGE_S = 15 * 60;
/** Conservation des données pseudonymisées sans lecture ni écriture (décision du propriétaire, ADR 0024). Durée légale,
 * pas un réglage d'exploitation : la modifier exige de mettre à jour l'ADR et la page de confidentialité. */
export const CONSERVATION_JOURS = 365;
const TAILLE_MAX_CORPS = TAILLE_MAX_CHIFFRE + 4096;
const encodeur = new TextEncoder();

const json = (donnees, statut = 200) => new Response(JSON.stringify(donnees), {
  status: statut,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const erreur = (code, statut, extra = {}) => json({ erreur: code, ...extra }, statut);
const vide = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
const maintenant = () => Math.floor(Date.now() / 1000);

export function estRouteCompteLocal(chemin) {
  return chemin.startsWith(PREFIXE);
}

/** La synchronisation exige la base D1 et un secret de 32 caractères au moins (HMAC des identifiants et mots de passe). */
export function compteLocalDisponible(env) {
  return !!env.DB && typeof env.COMPTES_LOCAUX_SECRET === "string" && env.COMPTES_LOCAUX_SECRET.length >= 32;
}

async function hmac(env, message) {
  const cle = await crypto.subtle.importKey("raw", encodeur.encode(env.COMPTES_LOCAUX_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cle, encodeur.encode(message)));
}

export async function empreinteIdentifiant(env, identifiant) {
  return versHex(await hmac(env, `identifiant:${identifiant}`));
}

/** Mot de passe : HMAC du secret (poivre) puis PBKDF2-SHA256 salé. Une fuite de la base seule ne suffit pas. */
export async function hacherMotDePasse(env, motDePasse, sel, iterations = ITERATIONS_SERVEUR) {
  const poivre = await hmac(env, `mot-de-passe:${String(motDePasse).normalize("NFC")}`);
  const cle = await crypto.subtle.importKey("raw", poivre, "PBKDF2", false, ["deriveBits"]);
  return versBase64(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sel, iterations }, cle, 256));
}

async function lireCorps(requete) {
  const texte = await requete.text();
  if (texte.length > TAILLE_MAX_CORPS) return { reponse: erreur("corps-trop-grand", 413) };
  try {
    const corps = JSON.parse(texte);
    if (!corps || typeof corps !== "object" || Array.isArray(corps)) return { reponse: erreur("corps-invalide", 400) };
    return { corps };
  } catch {
    return { reponse: erreur("json-invalide", 400) };
  }
}

async function ouvrirSession(env, compteId) {
  const jeton = versBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expire = maintenant() + DUREE_SESSION_S;
  await env.DB.prepare("INSERT INTO sessions_locales (jeton_hash, compte_id, expire_a) VALUES (?, ?, ?)")
    .bind(await sha256Hex(jeton), compteId, expire).run();
  return json({ jeton, expire });
}

/** Compte de la session porteuse (`Authorization: Bearer …`), ou null. */
export async function compteDeSession(requete, env) {
  const jeton = (requete.headers.get("authorization") || "").match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!jeton) return null;
  const ligne = await env.DB.prepare("SELECT compte_id FROM sessions_locales WHERE jeton_hash = ? AND expire_a > ?")
    .bind(await sha256Hex(jeton), maintenant()).first();
  return ligne ? { compteId: ligne.compte_id, jeton } : null;
}

/** Vérifie identifiant et mot de passe ; compte les échecs et bloque temporairement après trop d'essais. */
async function authentifier(env, identifiant, motDePasse) {
  const ligne = await env.DB.prepare(
    "SELECT id, mdp_sel, mdp_hash, mdp_iterations, echecs, bloque_jusqua FROM comptes_locaux WHERE identifiant_hmac = ?"
  ).bind(await empreinteIdentifiant(env, identifiant)).first();
  // Compte inconnu : même calcul pour un temps de réponse comparable (pas d'énumération par le temps).
  const calcule = await hacherMotDePasse(env, motDePasse, ligne ? depuisBase64(ligne.mdp_sel) : new Uint8Array(16), ligne?.mdp_iterations ?? ITERATIONS_SERVEUR);
  if (!ligne) return { ok: false, code: "identifiants-invalides", statut: 401 };
  if (ligne.bloque_jusqua > maintenant()) return { ok: false, code: "trop-de-tentatives", statut: 429 };
  if (!egalesTempsConstant(calcule, ligne.mdp_hash)) {
    const echecs = ligne.echecs + 1;
    const bloque = echecs >= ECHECS_AVANT_BLOCAGE;
    await env.DB.prepare("UPDATE comptes_locaux SET echecs = ?, bloque_jusqua = ? WHERE id = ?")
      .bind(bloque ? 0 : echecs, bloque ? maintenant() + DUREE_BLOCAGE_S : ligne.bloque_jusqua, ligne.id).run();
    return { ok: false, code: "identifiants-invalides", statut: 401 };
  }
  if (ligne.echecs) await env.DB.prepare("UPDATE comptes_locaux SET echecs = 0 WHERE id = ?").bind(ligne.id).run();
  return { ok: true, compteId: ligne.id };
}

function identifiants(corps) {
  const id = validerIdentifiant(corps.identifiant);
  if (!id.ok) return { ok: false, code: `identifiant-${id.erreur}` };
  if (typeof corps.motDePasse !== "string") return { ok: false, code: "mot-de-passe-court" };
  return { ok: true, identifiant: id.identifiant, motDePasse: corps.motDePasse };
}

/** Pseudonyme et jeton d'écriture bien formés ; le jeton est comparé à l'empreinte gardée. */
function preuve(corps) {
  return FORMAT_PSEUDONYME.test(corps.pseudonyme) && FORMAT_JETON.test(corps.jeton);
}

async function ligneDonnees(env, corps) {
  const ligne = await env.DB.prepare("SELECT jeton_hash, version, iv, chiffre, maj_le FROM donnees_pseudonymes WHERE pseudonyme = ?")
    .bind(corps.pseudonyme).first();
  if (!ligne) return { ligne: null };
  if (!egalesTempsConstant(await sha256Hex(corps.jeton), ligne.jeton_hash)) return { reponse: erreur("jeton-invalide", 403) };
  return { ligne };
}

/**
 * Traite une route `/api/compte-local/…`.
 * @param {{ autoriser?: (cle: string) => boolean, ip?: string }} options limitation de débit des connexions (en mémoire).
 */
export async function gererApiCompteLocal(requete, env, { autoriser = () => true, ip = "inconnue" } = {}) {
  const { pathname } = new URL(requete.url);
  const route = pathname.slice(PREFIXE.length);
  const methode = requete.method;

  if (route === "etat" && methode === "GET") return json({ disponible: compteLocalDisponible(env) });
  if (!compteLocalDisponible(env)) return erreur("synchro-indisponible", 503);
  if (methode !== "POST" && methode !== "PUT") return erreur("methode-non-autorisee", 405);

  if (route === "inscription" || route === "connexion") {
    if (!autoriser(`compte-local:${ip}`)) return erreur("trop-de-tentatives", 429);
    const { corps, reponse } = await lireCorps(requete);
    if (reponse) return reponse;
    const v = identifiants(corps);
    if (!v.ok) return erreur(v.code, 400);
    if (route === "connexion") {
      const a = await authentifier(env, v.identifiant, v.motDePasse);
      return a.ok ? ouvrirSession(env, a.compteId) : erreur(a.code, a.statut);
    }
    const m = validerMotDePasse(v.motDePasse, { identifiant: v.identifiant });
    if (!m.ok) return erreur(`mot-de-passe-${m.erreur}`, 400);
    const empreinte = await empreinteIdentifiant(env, v.identifiant);
    if (await env.DB.prepare("SELECT 1 FROM comptes_locaux WHERE identifiant_hmac = ?").bind(empreinte).first()) {
      return erreur("identifiant-pris", 409);
    }
    const sel = crypto.getRandomValues(new Uint8Array(16));
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO comptes_locaux (id, identifiant_hmac, mdp_sel, mdp_hash, mdp_iterations) VALUES (?, ?, ?, ?, ?)")
      .bind(id, empreinte, versBase64(sel), await hacherMotDePasse(env, v.motDePasse, sel), ITERATIONS_SERVEUR).run();
    const r = await ouvrirSession(env, id);
    return new Response(r.body, { status: 201, headers: r.headers });
  }

  // Routes suivantes : session porteuse obligatoire (limite l'usage du stockage aux comptes inscrits).
  const session = await compteDeSession(requete, env);
  if (!session) return erreur("non-connecte", 401);

  if (route === "deconnexion") {
    await env.DB.prepare("DELETE FROM sessions_locales WHERE jeton_hash = ?").bind(await sha256Hex(session.jeton)).run();
    return vide();
  }

  const { corps, reponse } = await lireCorps(requete);
  if (reponse) return reponse;

  if (route === "compte/supprimer") {
    // Mot de passe redemandé : une session volée ne suffit pas pour effacer le compte. Les données pseudonymisées
    // ne sont pas reliées au compte : l'interface les efface d'abord avec la phrase secrète.
    const ligne = await env.DB.prepare("SELECT mdp_sel, mdp_hash, mdp_iterations FROM comptes_locaux WHERE id = ?").bind(session.compteId).first();
    if (!ligne || typeof corps.motDePasse !== "string") return erreur("identifiants-invalides", 401);
    const calcule = await hacherMotDePasse(env, corps.motDePasse, depuisBase64(ligne.mdp_sel), ligne.mdp_iterations);
    if (!egalesTempsConstant(calcule, ligne.mdp_hash)) return erreur("identifiants-invalides", 401);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions_locales WHERE compte_id = ?").bind(session.compteId),
      env.DB.prepare("DELETE FROM comptes_locaux WHERE id = ?").bind(session.compteId)
    ]);
    return vide();
  }

  if (!preuve(corps)) return erreur("preuve-invalide", 400);

  if (route === "donnees/lire") {
    const { ligne, reponse: refus } = await ligneDonnees(env, corps);
    if (refus) return refus;
    // Rien sous ce pseudonyme : version 0 (pas un 404, c'est le cas normal d'une première activation).
    if (!ligne) return json({ version: 0 });
    // Lecture = activité : repousse l'effacement des données inactives (date au jour près).
    await env.DB.prepare("UPDATE donnees_pseudonymes SET vu_le = date('now') WHERE pseudonyme = ? AND vu_le <> date('now')").bind(corps.pseudonyme).run();
    return json({ version: ligne.version, iv: ligne.iv, chiffre: ligne.chiffre, maj: ligne.maj_le });
  }

  if (route === "donnees/supprimer") {
    const { ligne, reponse: refus } = await ligneDonnees(env, corps);
    if (refus) return refus;
    if (ligne) await env.DB.prepare("DELETE FROM donnees_pseudonymes WHERE pseudonyme = ?").bind(corps.pseudonyme).run();
    return vide();
  }

  if (route === "donnees" && methode === "PUT") {
    const attendue = corps.versionAttendue;
    if (!Number.isInteger(attendue) || attendue < 0) return erreur("version-invalide", 400);
    if (!FORMAT_IV.test(corps.iv) || typeof corps.chiffre !== "string" || !FORMAT_CHIFFRE.test(corps.chiffre)) return erreur("donnees-invalides", 400);
    if (corps.chiffre.length > TAILLE_MAX_CHIFFRE) return erreur("donnees-trop-grandes", 413);
    const { ligne, reponse: refus } = await ligneDonnees(env, corps);
    if (refus) return refus;
    const actuelle = ligne?.version ?? 0;
    if (actuelle !== attendue) return erreur("version-conflit", 409, { version: actuelle });
    if (!ligne) {
      // INSERT OR IGNORE : une première écriture concurrente ne passe qu'une fois, l'autre reçoit un conflit.
      const { meta } = await env.DB.prepare(
        "INSERT OR IGNORE INTO donnees_pseudonymes (pseudonyme, jeton_hash, version, iv, chiffre) VALUES (?, ?, 1, ?, ?)"
      ).bind(corps.pseudonyme, await sha256Hex(corps.jeton), corps.iv, corps.chiffre).run();
      if (!meta?.changes) return erreur("version-conflit", 409, { version: 1 });
      return json({ version: 1 });
    }
    // Écriture conditionnelle : deux appareils simultanés ne s'écrasent pas.
    const { meta } = await env.DB.prepare(
      "UPDATE donnees_pseudonymes SET version = version + 1, iv = ?, chiffre = ?, maj_le = date('now'), vu_le = date('now') WHERE pseudonyme = ? AND version = ?"
    ).bind(corps.iv, corps.chiffre, corps.pseudonyme, attendue).run();
    if (!meta?.changes) return erreur("version-conflit", 409, { version: actuelle + 1 });
    return json({ version: attendue + 1 });
  }

  return erreur("introuvable", 404);
}

/**
 * Cron quotidien : efface les sessions expirées et les données pseudonymisées ni lues ni écrites depuis
 * CONSERVATION_JOURS jours (données orphelines d'une phrase oubliée ou d'un compte abandonné, ADR 0024).
 * @returns {Promise<{ sessions: number, donnees: number } | null>}
 */
export async function purgerCompteLocal(env, instant = Date.now()) {
  if (!compteLocalDisponible(env)) return null;
  const limite = new Date(instant - CONSERVATION_JOURS * 86400000).toISOString().slice(0, 10);
  const [sessions, donnees] = await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions_locales WHERE expire_a <= ?").bind(Math.floor(instant / 1000)),
    env.DB.prepare("DELETE FROM donnees_pseudonymes WHERE vu_le < ?").bind(limite)
  ]);
  return { sessions: sessions?.meta?.changes ?? 0, donnees: donnees?.meta?.changes ?? 0 };
}
