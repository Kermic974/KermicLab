// Réglages modifiables à chaud depuis le back-office (ADR 0026) : surcharges des paramètres du registre
// (configuration.js), charte graphique, souscriptions et hypothèses financières (ADR 0031), état des contenus.
// Tout est validé et borné avant écriture ; une valeur stockée devenue invalide est ignorée (le défaut s'applique).
// Les réglages sont lus au plus une fois toutes les 15 secondes par isolat.
import { PARAMETRES, parametreDuRegistre } from "./configuration.js";
import { THEME_PAR_DEFAUT, validerTheme } from "../../web/theme.js";
import {
  FINANCES_PAR_DEFAUT, SOUSCRIPTIONS_PAR_DEFAUT, depuisNiveaux, niveauxDe, validerFinances, validerListe
} from "./souscriptions.js";

const DUREE_CACHE = 15000;
const ALIAS_VALIDE = /^[A-Za-z0-9@][A-Za-z0-9@/._:-]{0,99}$/;
const ID_NIVEAU = /^[a-z][a-z0-9-]{1,20}$/;
export const MAX_NIVEAUX = 6;
export const NIVEAU_PAR_DEFAUT = "gratuit";

/**
 * Plafonds imposés par les contraintes CHECK de la table `sessions_llm` (migration 0001, non modifiable) :
 * au-delà, la réservation de tokens échouerait. À lever avec une nouvelle table quand les niveaux seront appliqués.
 */
export const PLAFONDS_SCHEMA = Object.freeze({ LIMITE_TOKENS_SESSION: 1000, MAX_TOKENS_APPEL: 500 });

/** Limites des anciens niveaux de souscription (clé `niveaux`, ADR 0026), repris en souscriptions (ADR 0031). */
export const LIMITES_NIVEAU = Object.freeze({
  tokensSession: "LIMITE_TOKENS_SESSION", tokensAppel: "MAX_TOKENS_APPEL", defisJour: "DEFI_GENERATIONS_JOUR", cahiersJour: "CAHIERS_GENERATIONS_JOUR"
});

const VIDE = Object.freeze({
  parametres: Object.freeze({}), theme: Object.freeze({ id: THEME_PAR_DEFAUT }),
  souscriptions: SOUSCRIPTIONS_PAR_DEFAUT, souscriptionsParDefaut: true, niveaux: Object.freeze(niveauxDe(SOUSCRIPTIONS_PAR_DEFAUT)),
  finances: FINANCES_PAR_DEFAUT, masques: new Set(), enAvant: new Set()
});

let cache = null;
/** Vide le cache des réglages (après une écriture, et dans les tests). */
export function invaliderReglages() { cache = null; }

const lireJson = (texte) => { try { return JSON.parse(texte); } catch { return null; } };

/**
 * Valide strictement la saisie d'un paramètre du registre : une valeur hors bornes est refusée (jamais ramenée en
 * silence). `null` ou chaîne vide : retour à la valeur du déploiement.
 * @returns {{ ok: true, valeur: string | null } | { ok: false, code: string }}
 */
export function validerParametre(cle, brut) {
  const p = parametreDuRegistre(cle);
  if (!p) return { ok: false, code: "parametre-inconnu" };
  if (brut === null || brut === undefined || (p.type !== "texte" && String(brut).trim() === "")) return { ok: true, valeur: null };
  switch (p.type) {
    case "booleen":
      return brut === true || brut === "true" ? { ok: true, valeur: "true" }
        : brut === false || brut === "false" ? { ok: true, valeur: "false" } : { ok: false, code: "booleen-attendu" };
    case "entier": {
      const n = Number(brut);
      const max = Math.min(p.max, PLAFONDS_SCHEMA[cle] ?? p.max);
      return Number.isInteger(n) && n >= p.min && n <= max ? { ok: true, valeur: String(n) } : { ok: false, code: "hors-bornes" };
    }
    case "alias":
      return ALIAS_VALIDE.test(String(brut).trim()) ? { ok: true, valeur: String(brut).trim() } : { ok: false, code: "alias-invalide" };
    case "liste": {
      const liste = Array.isArray(brut) ? brut : String(brut).split(",").map((v) => v.trim()).filter(Boolean);
      return liste.every((v) => p.valeurs.includes(v)) ? { ok: true, valeur: [...new Set(liste)].join(",") } : { ok: false, code: "valeur-inconnue" };
    }
    case "texte": {
      const texte = String(brut).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
      if (texte.length > p.max) return { ok: false, code: "trop-long" };
      return { ok: true, valeur: texte || null };
    }
    default:
      return { ok: false, code: "type-inconnu" };
  }
}

const borne = (cle) => { const p = parametreDuRegistre(cle); return { min: p.min, max: p.max }; };

/** Valide une liste d'anciens niveaux (clé `niveaux`) : relue seulement pour la reprise en souscriptions. */
export function validerNiveaux(liste) {
  if (!Array.isArray(liste) || liste.length > MAX_NIVEAUX) return { ok: false, code: "liste-invalide" };
  const niveaux = [];
  for (const brut of liste) {
    const id = String(brut?.id ?? "");
    if (!ID_NIVEAU.test(id) || id === NIVEAU_PAR_DEFAUT || niveaux.some((n) => n.id === id)) return { ok: false, code: "identifiant-invalide" };
    const libelle = String(brut?.libelle ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 40);
    if (!libelle) return { ok: false, code: "libelle-requis" };
    const niveau = { id, libelle };
    for (const [champ, cle] of Object.entries(LIMITES_NIVEAU)) {
      const n = Number(brut?.[champ]);
      const { min, max } = borne(cle);
      if (!Number.isInteger(n) || n < min || n > max) return { ok: false, code: `hors-bornes:${champ}` };
      niveau[champ] = n;
    }
    niveaux.push(niveau);
  }
  return { ok: true, niveaux };
}

function interpreterLignes(lignes, etats) {
  const parametres = {};
  let theme = VIDE.theme, finances = VIDE.finances, souscriptions = null, anciensNiveaux = null;
  for (const { cle, valeur } of lignes) {
    if (cle.startsWith("param:")) {
      const v = validerParametre(cle.slice(6), valeur);
      if (v.ok && v.valeur !== null) parametres[cle.slice(6)] = v.valeur;
    } else if (cle === "theme") {
      const v = validerTheme(lireJson(valeur));
      if (v.ok) theme = v.theme;
    } else if (cle === "niveaux") {
      const v = validerNiveaux(lireJson(valeur));
      if (v.ok && v.niveaux.length) anciensNiveaux = v.niveaux;
    } else if (cle === "souscriptions") {
      const v = validerListe(lireJson(valeur));
      if (v.ok) souscriptions = v.souscriptions;
    } else if (cle === "finances") {
      const v = validerFinances(lireJson(valeur));
      if (v.ok) finances = v.finances;
    }
  }
  // Les souscriptions enregistrées priment ; à défaut, reprise des anciens niveaux, puis offres pressenties.
  const parDefaut = !souscriptions && !anciensNiveaux;
  souscriptions ??= anciensNiveaux ? depuisNiveaux(anciensNiveaux) : SOUSCRIPTIONS_PAR_DEFAUT;
  return {
    parametres, theme, souscriptions, souscriptionsParDefaut: parDefaut, niveaux: niveauxDe(souscriptions), finances,
    masques: new Set(etats.filter((e) => !e.en_ligne).map((e) => e.id)),
    enAvant: new Set(etats.filter((e) => e.en_avant).map((e) => e.id))
  };
}

/** Réglages effectifs. Sans base, ou si les tables manquent, rien n'est surchargé. Ne lève jamais. */
export async function chargerReglages(env, maintenant = Date.now()) {
  if (!env?.DB) return VIDE;
  if (cache && cache.db === env.DB && cache.expire > maintenant) return cache.reglages;
  let reglages = VIDE;
  try {
    const lignes = (await env.DB.prepare("SELECT cle, valeur FROM reglages").bind().all()).results ?? [];
    const etats = (await env.DB.prepare("SELECT id, en_ligne, en_avant FROM contenus_etats").bind().all()).results ?? [];
    reglages = interpreterLignes(lignes, etats);
  } catch { /* migration 0002 non appliquée ou D1 indisponible : configuration du déploiement */ }
  cache = { db: env.DB, expire: maintenant + DUREE_CACHE, reglages };
  return reglages;
}

const REGLAGES_DE = new WeakMap();

/**
 * `env` propre à la requête, avec les paramètres surchargés : `lireConfiguration(env)` reste l'unique lecture
 * (ADR 0019). Les liaisons (DB, AI, R2…) et les secrets sont hérités tels quels ; `surcharges` s'applique en dernier
 * (garde-fou d'un profil restreint, par exemple).
 */
export function envAvecReglages(env, reglages, surcharges = {}) {
  const derive = Object.create(env);
  for (const [cle, valeur] of Object.entries(reglages.parametres)) derive[cle] = valeur;
  for (const [cle, valeur] of Object.entries(surcharges)) derive[cle] = valeur;
  REGLAGES_DE.set(derive, reglages);
  return derive;
}

/** Réglages attachés à un `env` de requête (aucune surcharge si l'`env` ne vient pas de `envAvecReglages`). */
export const reglagesDe = (env) => REGLAGES_DE.get(env) ?? VIDE;

async function ecrire(env, cle, valeur) {
  if (valeur === null) await env.DB.prepare("DELETE FROM reglages WHERE cle = ?").bind(cle).run();
  else {
    await env.DB.prepare(`INSERT INTO reglages (cle, valeur, maj_le) VALUES (?, ?, datetime('now'))
      ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur, maj_le = excluded.maj_le`).bind(cle, valeur).run();
  }
  invaliderReglages();
}

/** Enregistre (ou retire, avec `null`) la surcharge d'un paramètre déjà validé par `validerParametre`. */
export const ecrireParametre = (env, cle, valeur) => ecrire(env, `param:${cle}`, valeur);
export const ecrireTheme = (env, theme) => ecrire(env, "theme", theme.id === THEME_PAR_DEFAUT ? null : JSON.stringify(theme));
/** Enregistre la liste complète des souscriptions (déjà validée) ; la clé historique `niveaux` est retirée. */
export async function ecrireSouscriptions(env, souscriptions) {
  await ecrire(env, "souscriptions", JSON.stringify(souscriptions));
  await ecrire(env, "niveaux", null);
}
/** Enregistre les hypothèses financières (déjà validées), ou les retire avec `null`. */
export const ecrireFinances = (env, finances) => ecrire(env, "finances", finances === null ? null : JSON.stringify(finances));

/** Masque ou remet en ligne un contenu du catalogue, et le met en avant ou non. */
export async function ecrireEtatContenu(env, id, { enLigne, enAvant }) {
  await env.DB.prepare(`INSERT INTO contenus_etats (id, en_ligne, en_avant, maj_le) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT (id) DO UPDATE SET en_ligne = excluded.en_ligne, en_avant = excluded.en_avant, maj_le = excluded.maj_le`)
    .bind(id, enLigne ? 1 : 0, enAvant ? 1 : 0).run();
  invaliderReglages();
}

const indexFiltres = new WeakMap();
/** Index du catalogue sans les contenus masqués depuis le back-office (le même objet si rien n'est masqué). */
export function indexVisible(index, reglages) {
  if (!reglages.masques.size) return index;
  let filtre = indexFiltres.get(reglages);
  if (!filtre || filtre.source !== index) {
    filtre = { source: index, index: { ...index, maquettes: index.maquettes.filter((m) => !reglages.masques.has(m.id)) } };
    indexFiltres.set(reglages, filtre);
  }
  return filtre.index;
}

/** Paramètres du registre dont la valeur vient du back-office et non du déploiement. */
export const clesSurchargees = (reglages) => PARAMETRES.filter((p) => Object.hasOwn(reglages.parametres, p.cle)).map((p) => p.cle);
