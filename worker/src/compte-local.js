// Compte local : identifiant + mot de passe, et synchronisation pseudonymisée (ADR 0024).
// Mêmes règles que l'interface (web/compte-local.js). Le serveur :
// - authentifie un compte par identifiant et mot de passe (jeton porteur, pas de cookie : aucun souci de cookie tiers
//   ni de CSRF) ; l'identifiant n'est gardé que sous forme d'empreinte HMAC ;
// - stocke des instantanés chiffrés sous un pseudonyme dérivé, dans le navigateur, d'une phrase secrète qu'il ne voit
//   jamais. Aucune table ne relie un pseudonyme à un compte et rien n'est journalisé (ni pseudonyme ni identifiant).
import { effacementFamille } from "./famille-donnees.js";
import { effacementProfesseur } from "./professeur-donnees.js";
import { effacementContributionsLocales } from "./contributions.js";
import { donneesCompteLocal } from "./compte-local-acces.js";
import { changerSouscriptionCompte, etatSouscriptionCompte } from "./souscription-compte.js";
import {
  DUREE_APPAIRAGE_S, FAMILLES, FORMAT_BOITE, FORMAT_CHIFFRE, FORMAT_IV, FORMAT_JETON, FORMAT_PSEUDONYME, TAILLE_MAX_APPAIRAGE, TAILLE_MAX_CHIFFRE,
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

async function ouvrirSession(env, compteId, { provisoire = false } = {}) {
  const jeton = versBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expire = maintenant() + DUREE_SESSION_S;
  await env.DB.prepare("INSERT INTO sessions_locales (jeton_hash, compte_id, expire_a) VALUES (?, ?, ?)")
    .bind(await sha256Hex(jeton), compteId, expire).run();
  // `provisoire` : mot de passe donné par le back-office, à remplacer (route `mot-de-passe`) avant tout autre usage.
  return json(provisoire ? { jeton, expire, provisoire: true } : { jeton, expire });
}

/**
 * Compte de la session porteuse (`Authorization: Bearer …`), ou null. Un compte au mot de passe provisoire (donné par le
 * back-office) n'a pas de session utilisable tant qu'il ne l'a pas remplacé, sauf pour les routes qui le permettent
 * (`provisoireAccepte` : changer le mot de passe, se déconnecter, consulter ses données).
 */
export async function compteDeSession(requete, env, { provisoireAccepte = false } = {}) {
  const jeton = (requete.headers.get("authorization") || "").match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!jeton) return null;
  const ligne = await env.DB.prepare(`SELECT s.compte_id, c.mdp_provisoire FROM sessions_locales s JOIN comptes_locaux c ON c.id = s.compte_id
    WHERE s.jeton_hash = ? AND s.expire_a > ?`).bind(await sha256Hex(jeton), maintenant()).first();
  if (!ligne || (ligne.mdp_provisoire === 1 && !provisoireAccepte)) return null;
  return { compteId: ligne.compte_id, jeton, provisoire: ligne.mdp_provisoire === 1 };
}

/** Vérifie identifiant et mot de passe ; compte les échecs et bloque temporairement après trop d'essais. */
async function authentifier(env, identifiant, motDePasse) {
  const ligne = await env.DB.prepare(
    "SELECT id, mdp_sel, mdp_hash, mdp_iterations, echecs, bloque_jusqua, mdp_provisoire FROM comptes_locaux WHERE identifiant_hmac = ?"
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
  return { ok: true, compteId: ligne.id, provisoire: ligne.mdp_provisoire === 1 };
}

/**
 * Inscrit un compte (identifiant et mot de passe déjà lus) : sert à l'inscription et à la création d'un compte enfant
 * par son parent (ADR 0029).
 * @returns {Promise<{ ok: true, id: string } | { ok: false, code: string, statut: number }>}
 */
export async function inscrireCompte(env, identifiant, motDePasse) {
  const m = validerMotDePasse(motDePasse, { identifiant });
  if (!m.ok) return { ok: false, code: `mot-de-passe-${m.erreur}`, statut: 400 };
  const empreinte = await empreinteIdentifiant(env, identifiant);
  if (await env.DB.prepare("SELECT 1 FROM comptes_locaux WHERE identifiant_hmac = ?").bind(empreinte).first()) {
    return { ok: false, code: "identifiant-pris", statut: 409 };
  }
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO comptes_locaux (id, identifiant_hmac, mdp_sel, mdp_hash, mdp_iterations) VALUES (?, ?, ?, ?, ?)")
    .bind(id, empreinte, versBase64(sel), await hacherMotDePasse(env, motDePasse, sel), ITERATIONS_SERVEUR).run();
  return { ok: true, id };
}

/** Le mot de passe donné est-il celui du compte ? (réauthentification avant une action sensible) */
export async function motDePasseDuCompte(env, compteId, motDePasse) {
  if (typeof motDePasse !== "string" || !motDePasse) return false;
  const ligne = await env.DB.prepare("SELECT mdp_sel, mdp_hash, mdp_iterations FROM comptes_locaux WHERE id = ?").bind(compteId).first();
  if (!ligne) return false;
  return egalesTempsConstant(await hacherMotDePasse(env, motDePasse, depuisBase64(ligne.mdp_sel), ligne.mdp_iterations), ligne.mdp_hash);
}

/**
 * Remplace le mot de passe d'un compte (choisi par le parent pour son enfant, ADR 0029 ; provisoire, donné par le
 * back-office ; ou changé par l'utilisateur) et ferme ses sessions. L'identifiant n'étant connu que par son
 * empreinte, le sel et le hachage sont recalculés sans lui.
 */
export async function remplacerMotDePasse(env, compteId, motDePasse, { provisoire = false } = {}) {
  const sel = crypto.getRandomValues(new Uint8Array(16));
  await env.DB.batch([
    env.DB.prepare("UPDATE comptes_locaux SET mdp_sel = ?, mdp_hash = ?, mdp_iterations = ?, echecs = 0, bloque_jusqua = 0, mdp_provisoire = ? WHERE id = ?")
      .bind(versBase64(sel), await hacherMotDePasse(env, motDePasse, sel), ITERATIONS_SERVEUR, provisoire ? 1 : 0, compteId),
    env.DB.prepare("DELETE FROM sessions_locales WHERE compte_id = ?").bind(compteId)
  ]);
}

/** Caractères du mot de passe provisoire : sans caractères ambigus (0/O, 1/l/I) pour une dictée au téléphone. */
const JEUX_PROVISOIRE = ["abcdefghjkmnpqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "-_.!?@#%+="];
export const LONGUEUR_PROVISOIRE = 16;

/**
 * Entier aléatoire uniforme dans [0, n[ (n ≤ 256) : échantillonnage par rejet sur un octet masqué à la puissance de deux
 * supérieure, sans modulo (un modulo sur un tirage cryptographique introduit un biais).
 */
function entierAleatoire(n) {
  let masque = 1;
  while (masque < n) masque <<= 1;
  masque -= 1;
  for (;;) {
    const v = crypto.getRandomValues(new Uint8Array(1))[0] & masque;
    if (v < n) return v;
  }
}

/** Mot de passe provisoire aléatoire (tirage sans biais), conforme aux règles du compte local (ADR 0024). */
export function genererMotDePasseProvisoire() {
  const tirer = (jeu) => jeu[entierAleatoire(jeu.length)];
  const tous = JEUX_PROVISOIRE.join("");
  for (;;) {
    const mdp = Array.from({ length: LONGUEUR_PROVISOIRE }, (_, i) => tirer(i < JEUX_PROVISOIRE.length ? JEUX_PROVISOIRE[i] : tous));
    // Mélange de Fisher-Yates, pour que les familles imposées ne soient pas toujours en tête.
    for (let i = mdp.length - 1; i > 0; i--) {
      const j = entierAleatoire(i + 1);
      [mdp[i], mdp[j]] = [mdp[j], mdp[i]];
    }
    const texte = mdp.join("");
    if (FAMILLES.every((f) => f.test(texte))) return texte;
  }
}

/** Efface un compte local, ses sessions, ses contributions (ADR 0023) et ce qui le rattache à une famille (ADR 0029) ou à des classes (ADR 0030). */
export async function effacerCompteLocal(env, compteId) {
  await env.DB.batch([
    ...(await effacementFamille(env, compteId)),
    ...(await effacementProfesseur(env, compteId)),
    ...(await effacementContributionsLocales(env, compteId)),
    env.DB.prepare("DELETE FROM sessions_locales WHERE compte_id = ?").bind(compteId),
    env.DB.prepare("DELETE FROM appairages WHERE compte_id = ?").bind(compteId),
    env.DB.prepare("DELETE FROM comptes_locaux WHERE id = ?").bind(compteId)
  ]);
  // Rôles, souscription et historique des changements (ADR 0034) : tables du back-office, peut-être absentes.
  for (const table of ["attributions_roles", "souscriptions_changements"]) {
    await env.DB.prepare(`DELETE FROM ${table} WHERE type_compte = 'compte-local' AND compte_id = ?`).bind(compteId).run().catch(() => {});
  }
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
 * Changement de mot de passe par l'utilisateur, obligatoire après une réinitialisation par le back-office. L'ancien
 * mot de passe (ou le provisoire) est redemandé ; l'identifiant, envoyé pour appliquer la règle « sans l'identifiant »,
 * doit correspondre à l'empreinte du compte. Toutes les sessions sont fermées, une nouvelle est ouverte.
 */
async function changerMotDePasse(env, session, corps) {
  const id = validerIdentifiant(corps.identifiant);
  const ligne = await env.DB.prepare("SELECT identifiant_hmac FROM comptes_locaux WHERE id = ?").bind(session.compteId).first();
  if (!id.ok || !ligne || !egalesTempsConstant(await empreinteIdentifiant(env, id.identifiant), ligne.identifiant_hmac)) return erreur("identifiants-invalides", 401);
  if (!(await motDePasseDuCompte(env, session.compteId, corps.motDePasse))) return erreur("identifiants-invalides", 401);
  if (typeof corps.nouveau !== "string") return erreur("mot-de-passe-court", 400);
  const v = validerMotDePasse(corps.nouveau, { identifiant: id.identifiant });
  if (!v.ok) return erreur(`mot-de-passe-${v.erreur}`, 400);
  if (corps.nouveau.normalize("NFC") === String(corps.motDePasse).normalize("NFC")) return erreur("mot-de-passe-identique", 400);
  await remplacerMotDePasse(env, session.compteId, corps.nouveau);
  return ouvrirSession(env, session.compteId);
}

/**
 * Dépose la clé de synchronisation, chiffrée de bout en bout par le code d'appairage (dans le navigateur), pour un autre
 * appareil du même compte. Une seule boîte par compte (la précédente est remplacée), DUREE_APPAIRAGE_S secondes au plus.
 */
async function deposerAppairage(env, session, corps) {
  if (!FORMAT_BOITE.test(corps.boite) || !FORMAT_JETON.test(corps.jeton)) return erreur("preuve-invalide", 400);
  if (!FORMAT_IV.test(corps.iv) || typeof corps.chiffre !== "string" || !FORMAT_CHIFFRE.test(corps.chiffre)) return erreur("donnees-invalides", 400);
  if (corps.chiffre.length > TAILLE_MAX_APPAIRAGE) return erreur("donnees-trop-grandes", 413);
  const expire = maintenant() + DUREE_APPAIRAGE_S;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM appairages WHERE compte_id = ? OR boite = ?").bind(session.compteId, corps.boite),
    env.DB.prepare("INSERT INTO appairages (boite, compte_id, jeton_hash, iv, chiffre, expire_a) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(corps.boite, session.compteId, await sha256Hex(corps.jeton), corps.iv, corps.chiffre, expire)
  ]);
  return json({ expire });
}

/** Retire la boîte d'appairage : même compte, code valable, une seule lecture (la boîte est effacée). */
async function lireAppairage(env, session, corps) {
  if (!FORMAT_BOITE.test(corps.boite) || !FORMAT_JETON.test(corps.jeton)) return erreur("preuve-invalide", 400);
  const ligne = await env.DB.prepare("SELECT jeton_hash, iv, chiffre FROM appairages WHERE boite = ? AND compte_id = ? AND expire_a > ?")
    .bind(corps.boite, session.compteId, maintenant()).first();
  if (!ligne || !egalesTempsConstant(await sha256Hex(corps.jeton), ligne.jeton_hash)) return erreur("appairage-introuvable", 404);
  const { meta } = await env.DB.prepare("DELETE FROM appairages WHERE boite = ?").bind(corps.boite).run();
  // Deux lectures simultanées : une seule obtient la boîte.
  if (!meta?.changes) return erreur("appairage-introuvable", 404);
  return json({ iv: ligne.iv, chiffre: ligne.chiffre });
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

  // Droit d'accès en libre-service (ADR 0024 §3 ter) : ce que la base contient sur le compte de la session, dont son
  // identifiant unique, à communiquer au support pour toute demande (réinitialisation, export, suppression).
  if (route === "moi" && methode === "GET") {
    const session = await compteDeSession(requete, env, { provisoireAccepte: true });
    if (!session) return erreur("non-connecte", 401);
    return json(await donneesCompteLocal(env, session.compteId));
  }
  // Souscription du compte (ADR 0034) : niveau, offres proposées ; changement à la demande (paiement acquis en dev).
  if (route === "souscription" && methode === "GET") {
    const session = await compteDeSession(requete, env);
    if (!session) return erreur("non-connecte", 401);
    return json(await etatSouscriptionCompte(env, session.compteId));
  }
  if (methode !== "POST" && methode !== "PUT") return erreur("methode-non-autorisee", 405);

  if (route === "inscription" || route === "connexion") {
    if (!autoriser(`compte-local:${ip}`)) return erreur("trop-de-tentatives", 429);
    const { corps, reponse } = await lireCorps(requete);
    if (reponse) return reponse;
    const v = identifiants(corps);
    if (!v.ok) return erreur(v.code, 400);
    if (route === "connexion") {
      const a = await authentifier(env, v.identifiant, v.motDePasse);
      return a.ok ? ouvrirSession(env, a.compteId, { provisoire: a.provisoire }) : erreur(a.code, a.statut);
    }
    const inscrit = await inscrireCompte(env, v.identifiant, v.motDePasse);
    if (!inscrit.ok) return erreur(inscrit.code, inscrit.statut);
    const r = await ouvrirSession(env, inscrit.id);
    return new Response(r.body, { status: 201, headers: r.headers });
  }

  // Routes suivantes : session porteuse obligatoire (limite l'usage du stockage aux comptes inscrits).
  const ouverte = await compteDeSession(requete, env, { provisoireAccepte: true });
  if (!ouverte) return erreur("non-connecte", 401);

  if (route === "deconnexion") {
    await env.DB.prepare("DELETE FROM sessions_locales WHERE jeton_hash = ?").bind(await sha256Hex(ouverte.jeton)).run();
    return vide();
  }

  const { corps, reponse } = await lireCorps(requete);
  if (reponse) return reponse;

  if (route === "mot-de-passe") return changerMotDePasse(env, ouverte, corps);
  // Mot de passe provisoire (back-office) : rien d'autre tant qu'il n'est pas remplacé.
  if (ouverte.provisoire) return erreur("mot-de-passe-provisoire", 403);
  const session = ouverte;

  if (route === "appairage" && methode === "PUT") return deposerAppairage(env, session, corps);
  if (route === "souscription" && methode === "POST") {
    const r = await changerSouscriptionCompte(env, session.compteId, corps);
    return json(r.corps, r.statut);
  }
  if (route === "appairage/lire") {
    // Même limite que les connexions : un code d'appairage ne se devine pas par essais répétés.
    if (!autoriser(`compte-local:${ip}`)) return erreur("trop-de-tentatives", 429);
    return lireAppairage(env, session, corps);
  }

  if (route === "compte/supprimer") {
    // Mot de passe redemandé : une session volée ne suffit pas pour effacer le compte. Les données pseudonymisées
    // ne sont pas reliées au compte : l'interface les efface d'abord avec la phrase secrète.
    const ligne = await env.DB.prepare("SELECT mdp_sel, mdp_hash, mdp_iterations FROM comptes_locaux WHERE id = ?").bind(session.compteId).first();
    if (!ligne || typeof corps.motDePasse !== "string") return erreur("identifiants-invalides", 401);
    const calcule = await hacherMotDePasse(env, corps.motDePasse, depuisBase64(ligne.mdp_sel), ligne.mdp_iterations);
    if (!egalesTempsConstant(calcule, ligne.mdp_hash)) return erreur("identifiants-invalides", 401);
    await effacerCompteLocal(env, session.compteId);
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
 * Efface aussi les boîtes d'appairage expirées.
 * @returns {Promise<{ sessions: number, donnees: number, appairages: number } | null>}
 */
export async function purgerCompteLocal(env, instant = Date.now()) {
  if (!compteLocalDisponible(env)) return null;
  const limite = new Date(instant - CONSERVATION_JOURS * 86400000).toISOString().slice(0, 10);
  const [sessions, donnees, appairages] = await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions_locales WHERE expire_a <= ?").bind(Math.floor(instant / 1000)),
    env.DB.prepare("DELETE FROM donnees_pseudonymes WHERE vu_le < ?").bind(limite),
    env.DB.prepare("DELETE FROM appairages WHERE expire_a <= ?").bind(Math.floor(instant / 1000))
  ]);
  return { sessions: sessions?.meta?.changes ?? 0, donnees: donnees?.meta?.changes ?? 0, appairages: appairages?.meta?.changes ?? 0 };
}
