// Compte local (ADR 0024) : identifiant + mot de passe, sans email ni réinitialisation en libre-service.
// Logique pure (aucun accès au DOM), testable sous Node et partagée avec le Worker (mêmes règles des deux côtés).
//
// - Le compte est créé sur l'appareil : rien n'est envoyé à Kermiclab tant que la synchronisation n'est pas activée.
// - Synchronisation facultative : les données envoyées sont **pseudonymisées et chiffrées** dans le navigateur.
//   Le pseudonyme, la clé de chiffrement et le jeton d'écriture sont dérivés d'une **phrase secrète** (12 caractères
//   minimum) qui ne quitte jamais l'appareil. Le serveur ne relie pas les données au compte. Phrase oubliée = données
//   en ligne perdues pour l'utilisateur (elles restent stockées, illisibles).

export const CLE_COMPTE = "kermiclab:compte-local";
export const CLE_SESSION = "kermiclab:compte-local:session";

export const IDENTIFIANT_MIN = 3;
export const IDENTIFIANT_MAX = 32;
export const MOT_DE_PASSE_MIN = 12;
export const MOT_DE_PASSE_MAX = 128;
export const PASSPHRASE_MIN = 12;
export const PASSPHRASE_MAX = 256;

/** Itérations PBKDF2-SHA256 dans le navigateur (vérificateur local, phrase secrète). Valeur de protocole : la changer
 * change les pseudonymes, donc rend les données en ligne existantes inaccessibles. */
export const ITERATIONS_NAVIGATEUR = 310000;
/** Préfixe du sel de la phrase secrète : version du protocole de pseudonymisation. */
export const SEL_PSEUDONYMISATION = "kermiclab:pseudonymisation:v1:";
/** Taille maximale d'un instantané chiffré (base64), contrôlée des deux côtés. */
export const TAILLE_MAX_CHIFFRE = 350000;

export const FORMAT_PSEUDONYME = /^[0-9a-f]{64}$/;
export const FORMAT_JETON = /^[A-Za-z0-9_-]{43}$/;
export const FORMAT_IV = /^[A-Za-z0-9+/]{16}$/;
export const FORMAT_CHIFFRE = /^[A-Za-z0-9+/]+={0,2}$/;

const encodeur = new TextEncoder();
const normaliser = (texte) => String(texte ?? "").normalize("NFC");

/**
 * Identifiant de connexion : 3 à 32 caractères, lettres minuscules non accentuées, chiffres, point, tiret, souligné.
 * Pas d'email (le « @ » est refusé) ni de suite de 6 chiffres ou plus (numéro de téléphone) : public mineur.
 * @returns {{ ok: true, identifiant: string } | { ok: false, erreur: "court" | "long" | "caracteres" | "chiffres" }}
 */
export function validerIdentifiant(brut) {
  const identifiant = normaliser(brut).trim().toLowerCase();
  if (identifiant.length < IDENTIFIANT_MIN) return { ok: false, erreur: "court" };
  if (identifiant.length > IDENTIFIANT_MAX) return { ok: false, erreur: "long" };
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(identifiant) || !/[a-z]/.test(identifiant)) return { ok: false, erreur: "caracteres" };
  if (/\d{6,}/.test(identifiant)) return { ok: false, erreur: "chiffres" };
  return { ok: true, identifiant };
}

/** Familles de caractères exigées dans un mot de passe. */
export const FAMILLES = Object.freeze([
  { id: "minuscule", test: (s) => /\p{Ll}/u.test(s) },
  { id: "majuscule", test: (s) => /\p{Lu}/u.test(s) },
  { id: "chiffre", test: (s) => /\p{N}/u.test(s) },
  { id: "special", test: (s) => /[^\p{L}\p{N}\s]/u.test(s) }
]);

/**
 * Mot de passe complexe : 12 à 128 caractères, une minuscule, une majuscule, un chiffre et un caractère spécial,
 * sans contenir l'identifiant.
 * @returns {{ ok: true } | { ok: false, erreur: "court" | "long" | "complexite" | "identifiant", manquants?: string[] }}
 */
export function validerMotDePasse(brut, { identifiant } = {}) {
  const mdp = normaliser(brut);
  const longueur = [...mdp].length;
  if (longueur < MOT_DE_PASSE_MIN) return { ok: false, erreur: "court" };
  if (longueur > MOT_DE_PASSE_MAX) return { ok: false, erreur: "long" };
  const manquants = FAMILLES.filter((f) => !f.test(mdp)).map((f) => f.id);
  if (manquants.length) return { ok: false, erreur: "complexite", manquants };
  if (identifiant && mdp.toLowerCase().includes(String(identifiant).toLowerCase())) return { ok: false, erreur: "identifiant" };
  return { ok: true };
}

/**
 * Phrase secrète de synchronisation : 12 à 256 caractères, différente du mot de passe (le serveur voit le mot de
 * passe à la connexion ; il ne doit jamais pouvoir en déduire le pseudonyme).
 * @returns {{ ok: true } | { ok: false, erreur: "court" | "long" | "identique" }}
 */
export function validerPassphrase(brut, { motDePasse } = {}) {
  const phrase = normaliser(brut);
  const longueur = [...phrase].length;
  if (longueur < PASSPHRASE_MIN) return { ok: false, erreur: "court" };
  if (longueur > PASSPHRASE_MAX) return { ok: false, erreur: "long" };
  if (motDePasse !== undefined && phrase === normaliser(motDePasse)) return { ok: false, erreur: "identique" };
  return { ok: true };
}

/* ---------- Encodages ---------- */

export function versBase64(octets) {
  const tableau = new Uint8Array(octets);
  let binaire = "";
  for (let i = 0; i < tableau.length; i += 0x8000) binaire += String.fromCharCode(...tableau.subarray(i, i + 0x8000));
  return btoa(binaire);
}
export function depuisBase64(texte) {
  const binaire = atob(texte);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}
export const versBase64Url = (octets) => versBase64(octets).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const versHex = (octets) => Array.from(new Uint8Array(octets), (o) => o.toString(16).padStart(2, "0")).join("");

/** Comparaison en temps constant de deux chaînes de même nature (empreintes). */
export function egalesTempsConstant(a, b) {
  const x = String(a ?? "");
  const y = String(b ?? "");
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

/* ---------- Dérivations ---------- */

async function pbkdf2(secret, sel, iterations, bits = 256) {
  const cle = await crypto.subtle.importKey("raw", typeof secret === "string" ? encodeur.encode(secret) : secret, "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: typeof sel === "string" ? encodeur.encode(sel) : sel, iterations }, cle, bits));
}

async function hkdf(maitre, info, bits = 256) {
  const cle = await crypto.subtle.importKey("raw", maitre, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: encodeur.encode(info) }, cle, bits));
}

export async function sha256Hex(texte) {
  return versHex(await crypto.subtle.digest("SHA-256", encodeur.encode(String(texte))));
}

/**
 * Enregistrement du compte sur l'appareil : identifiant et vérificateur du mot de passe (jamais le mot de passe).
 * @returns {Promise<{ v: 1, identifiant: string, sel: string, iterations: number, verificateur: string, synchro: null }>}
 */
export async function creerEnregistrement(identifiant, motDePasse, { iterations = ITERATIONS_NAVIGATEUR } = {}) {
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const verificateur = versBase64(await pbkdf2(normaliser(motDePasse), sel, iterations));
  return { v: 1, identifiant, sel: versBase64(sel), iterations, verificateur, synchro: null };
}

/** Vérifie le mot de passe saisi contre l'enregistrement local. */
export async function verifierMotDePasse(motDePasse, enregistrement) {
  if (!enregistrementValide(enregistrement)) return false;
  const calcule = versBase64(await pbkdf2(normaliser(motDePasse), depuisBase64(enregistrement.sel), enregistrement.iterations));
  return egalesTempsConstant(calcule, enregistrement.verificateur);
}

export function enregistrementValide(e) {
  return !!e && typeof e === "object" && e.v === 1 && validerIdentifiant(e.identifiant).ok
    && typeof e.sel === "string" && typeof e.verificateur === "string"
    && Number.isInteger(e.iterations) && e.iterations >= 100000 && e.iterations <= 10000000;
}

/** Lit l'enregistrement du compte (texte JSON du stockage) ; null s'il est absent ou invalide. */
export function lireEnregistrement(texte) {
  try {
    const e = JSON.parse(texte);
    if (!enregistrementValide(e)) return null;
    const s = e.synchro;
    const synchro = s && typeof s === "object" && typeof s.empreinte === "string" && Number.isInteger(s.version) && s.version >= 0
      ? { empreinte: s.empreinte, version: s.version, maj: typeof s.maj === "string" ? s.maj : null }
      : null;
    return { ...e, synchro };
  } catch {
    return null;
  }
}

/**
 * Secrets de synchronisation dérivés de la phrase secrète, dans le navigateur uniquement :
 * - `pseudonyme` : clé d'enregistrement des données en ligne (aucun lien avec le compte côté serveur) ;
 * - `jeton` : preuve de possession exigée pour lire, écrire ou effacer (le serveur n'en garde que l'empreinte) ;
 * - `cle` : clé AES-GCM 256 bits qui chiffre l'instantané (jamais envoyée) ;
 * - `empreinte` : courte empreinte du pseudonyme, gardée sur l'appareil pour reconnaître une phrase mal saisie.
 * L'identifiant sert de sel : deux comptes avec la même phrase ont des pseudonymes différents.
 */
export async function deriverSecrets(passphrase, identifiant, { iterations = ITERATIONS_NAVIGATEUR } = {}) {
  const maitre = await pbkdf2(normaliser(passphrase), `${SEL_PSEUDONYMISATION}${identifiant}`, iterations);
  const [pseudo, jeton, cle] = await Promise.all([hkdf(maitre, "pseudonyme"), hkdf(maitre, "jeton-ecriture"), hkdf(maitre, "chiffrement")]);
  const pseudonyme = versHex(pseudo);
  return { pseudonyme, jeton: versBase64Url(jeton), cle: versBase64(cle), empreinte: (await sha256Hex(`empreinte:${pseudonyme}`)).slice(0, 16) };
}

async function cleAes(cleBase64, usages) {
  return crypto.subtle.importKey("raw", depuisBase64(cleBase64), "AES-GCM", false, usages);
}

/** Chiffre un objet JSON (AES-GCM, IV aléatoire, pseudonyme en données associées). */
export async function chiffrer(cleBase64, pseudonyme, objet) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chiffre = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encodeur.encode(pseudonyme) },
    await cleAes(cleBase64, ["encrypt"]), encodeur.encode(JSON.stringify(objet)));
  return { iv: versBase64(iv), chiffre: versBase64(chiffre) };
}

/** Déchiffre un instantané ; lève une erreur si la clé ou le pseudonyme ne correspondent pas. */
export async function dechiffrer(cleBase64, pseudonyme, { iv, chiffre }) {
  const clair = await crypto.subtle.decrypt({ name: "AES-GCM", iv: depuisBase64(iv), additionalData: encodeur.encode(pseudonyme) },
    await cleAes(cleBase64, ["decrypt"]), depuisBase64(chiffre));
  return JSON.parse(new TextDecoder().decode(clair));
}

/* ---------- Instantanés des données de l'appareil ---------- */

/** Copie, sous forme de texte, les clés de stockage synchronisées (pseudo, progression, trophées, cahiers). */
export function instantane(lire, cles) {
  const donnees = {};
  for (const cle of cles) {
    const valeur = lire(cle);
    if (typeof valeur === "string") donnees[cle] = valeur;
  }
  return { v: 1, donnees };
}

/** Restaure un instantané : seules les clés attendues sont écrites, les autres sont ignorées. */
export function restaurer(instant, cles, ecrire, effacer) {
  if (!instant || instant.v !== 1 || !instant.donnees || typeof instant.donnees !== "object") return false;
  for (const cle of cles) {
    const valeur = instant.donnees[cle];
    if (typeof valeur === "string") ecrire(cle, valeur);
    else effacer(cle);
  }
  return true;
}

/** Lit la session du compte (onglet) : identifiant déverrouillé et, si la synchronisation est déverrouillée, ses secrets. */
export function lireSession(texte, identifiant) {
  try {
    const s = JSON.parse(texte);
    if (!s || s.identifiant !== identifiant) return null;
    const y = s.synchro;
    const synchro = y && FORMAT_PSEUDONYME.test(y.pseudonyme) && FORMAT_JETON.test(y.jeton) && typeof y.cle === "string"
      && typeof y.jetonServeur === "string" ? y : null;
    return { identifiant, synchro };
  } catch {
    return null;
  }
}
