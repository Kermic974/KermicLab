// Mesure d'audience Google Analytics 4, soumise au consentement (ADR 0027).
// - Rien n'est chargé et aucun cookie n'est déposé tant que le visiteur n'a pas accepté ; le refus est le choix par défaut.
// - Le choix (« accepte » ou « refuse ») est gardé sur l'appareil, sans identifiant ; il se modifie depuis le pied de
//   page du site et depuis la page Confidentialité. Un refus après accord efface les cookies de Google Analytics.
// - Les signaux publicitaires sont désactivés et l'adresse envoyée est réduite au chemin (jamais le fragment `#…`).
// - Présent seulement sur le tableau de bord et la page Confidentialité : jamais dans les pages du catalogue, ni
//   dans /cercle/, ni dans le back-office.
// Aucun texte ici : le bandeau est dans le HTML (clés i18n du tableau de bord).

export const CLE_CHOIX = "kermiclab_audience";
export const CHOIX = ["accepte", "refuse"];
const ORIGINE_GOOGLE = "https://www.googletagmanager.com";

/** Identifiant de mesure GA4 bien formé (`G-XXXXXXXXXX`) ; tout le reste désactive la mesure. */
export function idValide(id) {
  return typeof id === "string" && /^G-[A-Z0-9]{6,12}$/.test(id);
}

/** Choix enregistré, ou `null` (jamais demandé, valeur inconnue, stockage indisponible). */
export function lireChoix(stockage) {
  try {
    const valeur = stockage.getItem(CLE_CHOIX);
    return CHOIX.includes(valeur) ? valeur : null;
  } catch { return null; }
}

export function ecrireChoix(stockage, choix) {
  if (!CHOIX.includes(choix)) return false;
  try { stockage.setItem(CLE_CHOIX, choix); return true; } catch { return false; }
}

/** Domaines sur lesquels Google Analytics a pu déposer ses cookies : l'hôte et chacun de ses domaines parents. */
export function domainesCookies(hote) {
  const parties = String(hote ?? "").split(".").filter(Boolean);
  if (parties.length < 2 || /^[\d.]+$/.test(hote)) return [];
  return parties.slice(0, -1).map((_, i) => parties.slice(i).join("."));
}

/** Instructions d'effacement des cookies `_ga` et `_ga_<flux>` pour l'hôte donné. */
export function cookiesAEffacer(chaineCookies, hote) {
  const noms = String(chaineCookies ?? "").split(";").map((c) => c.split("=")[0].trim()).filter((n) => /^_ga(_|$)/.test(n));
  const fin = "Max-Age=0; Path=/; SameSite=Lax";
  return noms.flatMap((nom) => [`${nom}=; ${fin}`, ...domainesCookies(hote).map((d) => `${nom}=; ${fin}; Domain=.${d}`)]);
}

/** Réglages envoyés à GA4 : pas de signaux publicitaires, adresse sans fragment ni paramètres. */
export function reglagesMesure(emplacement) {
  return {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: `${emplacement.origin}${emplacement.pathname}`
  };
}

let charge = false;

function chargerMesure(id) {
  window[`ga-disable-${id}`] = false;
  if (charge) return;
  charge = true;
  window.dataLayer = window.dataLayer || [];
  // gtag.js attend l'objet `arguments` lui-même, pas un tableau.
  function gtag() { window.dataLayer.push(arguments); }
  gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
  gtag("js", new Date());
  gtag("config", id, reglagesMesure(location));
  const script = document.createElement("script");
  script.async = true;
  script.src = `${ORIGINE_GOOGLE}/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.append(script);
}

function arreterMesure(id) {
  window[`ga-disable-${id}`] = true;
  for (const cookie of cookiesAEffacer(document.cookie, location.hostname)) document.cookie = cookie;
}

async function demarrer() {
  let id;
  try { id = (await (await fetch("config.json")).json()).mesureGoogle; } catch { return; }
  if (!idValide(id)) return;
  const bandeau = document.getElementById("bandeau-audience");
  if (!bandeau) return;

  const afficherEtat = () => {
    const choix = lireChoix(localStorage) ?? "aucun";
    document.querySelectorAll("[data-audience-etat]").forEach((n) => { n.hidden = n.dataset.audienceEtat !== choix; });
  };
  const appliquer = (choix) => {
    ecrireChoix(localStorage, choix);
    if (choix === "accepte") chargerMesure(id); else arreterMesure(id);
    bandeau.hidden = true;
    afficherEtat();
  };

  bandeau.querySelectorAll("[data-audience-choix]").forEach((bouton) => {
    bouton.addEventListener("click", () => appliquer(bouton.dataset.audienceChoix));
  });
  document.querySelectorAll("[data-audience-gerer]").forEach((bouton) => {
    bouton.hidden = false;
    bouton.addEventListener("click", () => {
      bandeau.hidden = false;
      bandeau.querySelector("[data-audience-choix]")?.focus();
    });
  });

  const choix = lireChoix(localStorage);
  if (choix === "accepte") chargerMesure(id);
  else if (!choix) bandeau.hidden = false;
  afficherEtat();
}

if (typeof document !== "undefined") demarrer();
