// Profil local du visiteur : pseudo et choix de mémorisation sur l'appareil.
// Logique pure (aucun accès au DOM) : testable sous Node.
// Rien n'est envoyé à Kermiclab : le pseudo reste dans le navigateur (ADR 0012).
//
// Mémorisation :
// - par défaut, la session en cours seulement (sessionStorage) : tout s'efface à la fermeture de l'onglet ;
// - si le visiteur coche « Se souvenir de moi », un cookie local `kermiclab_memoire=1` (sans pseudo ni progression)
//   est créé pour un an ; tant qu'il existe, le pseudo et la progression sont gardés dans le stockage local.

export const CLE_PSEUDO = "kermiclab:pseudo";
export const COOKIE_MEMOIRE = "kermiclab_memoire";
export const DUREE_COOKIE = 60 * 60 * 24 * 365;
export const PSEUDO_MIN = 2;
export const PSEUDO_MAX = 20;

/**
 * Valide un pseudo. Lettres (avec accents), chiffres, espaces, tirets, points et soulignés.
 * Refuse les suites de 6 chiffres ou plus (numéro de téléphone) : le public est mineur.
 * @returns {{ ok: true, pseudo: string } | { ok: false, erreur: "court" | "long" | "caracteres" | "chiffres" }}
 */
export function validerPseudo(brut) {
  const pseudo = String(brut ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
  if (pseudo.length < PSEUDO_MIN) return { ok: false, erreur: "court" };
  if (pseudo.length > PSEUDO_MAX) return { ok: false, erreur: "long" };
  if (!/^[\p{L}\p{N} _.-]+$/u.test(pseudo) || !/\p{L}/u.test(pseudo)) return { ok: false, erreur: "caracteres" };
  if (/\d{6,}/.test(pseudo)) return { ok: false, erreur: "chiffres" };
  return { ok: true, pseudo };
}

/** Initiale affichée dans l'avatar. */
export function initiale(pseudo) {
  const premier = [...String(pseudo ?? "").trim()][0];
  return premier ? premier.toLocaleUpperCase() : "?";
}

/** Lit un cookie dans `document.cookie`. */
export function lireCookie(chaine, nom) {
  for (const morceau of String(chaine ?? "").split(";")) {
    const [cle, ...valeur] = morceau.trim().split("=");
    if (cle === nom) return valeur.join("=");
  }
  return null;
}

export function memoireActive(chaineCookies) {
  return lireCookie(chaineCookies, COOKIE_MEMOIRE) === "1";
}

/** Cookie de mémorisation : strictement fonctionnel, sans donnée personnelle. */
export function cookieMemoire({ securise = true } = {}) {
  return `${COOKIE_MEMOIRE}=1; Max-Age=${DUREE_COOKIE}; Path=/; SameSite=Strict${securise ? "; Secure" : ""}`;
}

export function cookieEffacement({ securise = true } = {}) {
  return `${COOKIE_MEMOIRE}=; Max-Age=0; Path=/; SameSite=Strict${securise ? "; Secure" : ""}`;
}
