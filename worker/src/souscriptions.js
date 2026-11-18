// Souscriptions (ADR 0031) : une offre se compose d'un rôle, des fonctionnalités incluses et de limites de
// consommation, avec une hypothèse d'usage et une position de prix pour le sous-module financier.
// Préparé, non appliqué : tant que CONTROLE_ACCES_ACTIF vaut false, aucune souscription ne limite le site.
// Les offres et les hypothèses financières sont des réglages (table `reglages`, clés `souscriptions` et `finances`).
import { lireConfiguration, parametreDuRegistre } from "./configuration.js";
import { FONCTIONNALITES } from "./roles.js";
import { BORNES_FINANCES, FINANCES_PAR_DEFAUT, estimerSouscription, validerFinances } from "../../web/admin/financier.js";

export { FINANCES_PAR_DEFAUT, validerFinances };
export const SOUSCRIPTION_GRATUITE = "gratuit";
export const MAX_SOUSCRIPTIONS = 8;
export const STATUTS_SOUSCRIPTION = Object.freeze(["projet", "active"]);
export const MODES_PRIX = Object.freeze(["prix", "marge"]);

/** Limites de consommation : bornées par le paramètre du registre correspondant (ADR 0019). */
export const LIMITES_CONSOMMATION = Object.freeze({
  tokensSession: "LIMITE_TOKENS_SESSION", tokensAppel: "MAX_TOKENS_APPEL", defisJour: "DEFI_GENERATIONS_JOUR", cahiersJour: "CAHIERS_GENERATIONS_JOUR"
});
/**
 * Limites de structure (comptes rattachés) : déclarées par l'offre, pas encore appliquées par l'Espace famille ni par
 * l'expérience Professeur. 0 = non inclus.
 */
export const LIMITES_STRUCTURE = Object.freeze({ enfantsMax: [0, 10], classesMax: [0, 30], elevesMax: [0, 1000] });
/**
 * Plafonds mensuels, en plus des limites par jour : `cahiersMois` borne le nombre de cahiers IA sur un mois
 * (« 1 par jour, 5 par mois »). 0 = sans plafond mensuel. Déclarés par l'offre et comptés par l'estimation financière ;
 * pas encore appliqués (nouvelle table de quota, ADR 0031).
 */
export const LIMITES_MENSUELLES = Object.freeze({ cahiersMois: [0, 155] });

const ID_SOUSCRIPTION = /^[a-z][a-z0-9-]{1,20}$/;
const texteCourt = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const bornesConsommation = (champ) => { const p = parametreDuRegistre(LIMITES_CONSOMMATION[champ]); return [p.min, p.max]; };

/** Bornes de toutes les limites, pour l'interface. */
export function bornesLimites() {
  return {
    ...Object.fromEntries(Object.keys(LIMITES_CONSOMMATION).map((c) => [c, bornesConsommation(c)])),
    ...LIMITES_MENSUELLES,
    ...LIMITES_STRUCTURE
  };
}

const BASE = ["chat", "ia.tuteur", "jeux", "cahiers", "defi", "synchronisation"];
const IA = ["ia.defi", "ia.cahiers", "ia.idees"];

/** Offres pressenties, proposées tant qu'aucune n'a été enregistrée. Toutes au statut « projet ». */
export const SOUSCRIPTIONS_PAR_DEFAUT = Object.freeze([
  {
    id: SOUSCRIPTION_GRATUITE, libelle: "Gratuit", description: "Découverte : catalogue, jeux et tuteur IA dans la limite du quota gratuit.",
    statut: "projet", role: "visiteur", fonctionnalites: BASE,
    limites: { cahiersMois: 0, enfantsMax: 0, classesMax: 0, elevesMax: 0 },
    usage: { joursActifsMois: 6, tauxUtilisation: 40 },
    prix: { mode: "prix", prixMensuelHT: 0, margeCible: 0, remiseAnnuelle: 0 }
  },
  {
    id: "solo", libelle: "Solo", description: "Un apprenant : tuteur IA étendu, défis et cahiers générés.",
    statut: "projet", role: "visiteur", fonctionnalites: [...BASE, ...IA],
    limites: { tokensSession: 2000, tokensAppel: 500, defisJour: 5, cahiersJour: 1, cahiersMois: 0, enfantsMax: 0, classesMax: 0, elevesMax: 0 },
    usage: { joursActifsMois: 12, tauxUtilisation: 30 },
    prix: { mode: "prix", prixMensuelHT: 4.99, margeCible: 60, remiseAnnuelle: 17 }
  },
  {
    id: "parent", libelle: "Parent", description: "Une famille : Espace famille, profils des enfants, suivi et cahiers assignés.",
    statut: "projet", role: "parent", fonctionnalites: [...BASE, ...IA, "famille"],
    limites: { tokensSession: 2000, tokensAppel: 500, defisJour: 8, cahiersJour: 1, cahiersMois: 5, enfantsMax: 4, classesMax: 0, elevesMax: 0 },
    usage: { joursActifsMois: 15, tauxUtilisation: 30 },
    prix: { mode: "prix", prixMensuelHT: 7.99, margeCible: 60, remiseAnnuelle: 17 }
  },
  {
    id: "professeur", libelle: "Professeur", description: "Un enseignant : classes, liens d'invitation, suivi des élèves et relecture des contributions.",
    statut: "projet", role: "prof", fonctionnalites: [...BASE, ...IA, "professeur", "contributions.proposer", "contributions.relire"],
    limites: { tokensSession: 4000, tokensAppel: 1000, defisJour: 10, cahiersJour: 3, cahiersMois: 0, enfantsMax: 0, classesMax: 8, elevesMax: 240 },
    usage: { joursActifsMois: 18, tauxUtilisation: 30 },
    prix: { mode: "marge", prixMensuelHT: 0, margeCible: 60, remiseAnnuelle: 17 }
  }
].map((s) => Object.freeze(s)));

const nombre = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));
const entierDans = (v, [min, max]) => Number.isInteger(v) && v >= min && v <= max;
const decimalDans = (v, [min, max]) => Number.isFinite(v) && v >= min && v <= max;

/**
 * Valide une souscription. `roles` : identifiants de rôles existants. Tous les champs sont modifiables (ADR 0034),
 * « gratuit » compris : ses limites de consommation, facultatives à la relecture, sont celles du registre (Harness) ;
 * saisies dans « Souscriptions », elles y sont écrites (une seule source). Son prix reste normalement 0.
 * @returns {{ ok: true, souscription } | { ok: false, code: string }}
 */
export function validerSouscription(id, brut, { roles = [] } = {}) {
  if (!ID_SOUSCRIPTION.test(String(id))) return { ok: false, code: "identifiant-invalide" };
  const gratuite = id === SOUSCRIPTION_GRATUITE;
  const libelle = texteCourt(brut?.libelle, 40);
  if (!libelle) return { ok: false, code: "libelle-requis" };
  const statut = STATUTS_SOUSCRIPTION.includes(brut?.statut) ? brut.statut : null;
  if (!statut) return { ok: false, code: "statut-invalide" };
  const role = String(brut?.role ?? "");
  // `roles` à null (relecture des réglages) : seul le format est vérifié ; l'existence l'est à l'enregistrement.
  if (roles === null ? !/^[a-z][a-z0-9-]{1,30}$/.test(role) : !roles.includes(role)) return { ok: false, code: "role-inconnu" };
  const fonctionnalites = [...new Set((Array.isArray(brut?.fonctionnalites) ? brut.fonctionnalites : []).filter((f) => FONCTIONNALITES.includes(f)))];

  const limites = {};
  for (const champ of Object.keys(LIMITES_CONSOMMATION)) {
    // « gratuit » : limite facultative (à défaut, celle du registre).
    if (gratuite && (brut?.limites?.[champ] === undefined || brut?.limites?.[champ] === null)) continue;
    const v = nombre(brut?.limites?.[champ]);
    if (!entierDans(v, bornesConsommation(champ))) return { ok: false, code: `hors-bornes:${champ}` };
    limites[champ] = v;
  }
  for (const [champ, bornes] of Object.entries({ ...LIMITES_MENSUELLES, ...LIMITES_STRUCTURE })) {
    const v = nombre(brut?.limites?.[champ] ?? 0);
    if (!entierDans(v, bornes)) return { ok: false, code: `hors-bornes:${champ}` };
    limites[champ] = v;
  }

  const usage = {};
  for (const champ of ["joursActifsMois", "tauxUtilisation"]) {
    const v = nombre(brut?.usage?.[champ]);
    if (!entierDans(v, BORNES_FINANCES[champ])) return { ok: false, code: `hors-bornes:${champ}` };
    usage[champ] = v;
  }

  const mode = MODES_PRIX.includes(brut?.prix?.mode) ? brut.prix.mode : null;
  if (!mode) return { ok: false, code: "mode-prix-invalide" };
  const prix = { mode };
  // `prixAnnuelHT` : prix annuel saisi directement ; 0 = douze mois moins la remise annuelle.
  for (const champ of ["prixMensuelHT", "margeCible", "remiseAnnuelle", "prixAnnuelHT"]) {
    const v = nombre(brut?.prix?.[champ] ?? 0);
    if (!decimalDans(v, BORNES_FINANCES[champ])) return { ok: false, code: `hors-bornes:${champ}` };
    prix[champ] = Math.round(v * 100) / 100;
  }

  return { ok: true, souscription: { id, libelle, description: texteCourt(brut?.description, 200), statut, role, fonctionnalites, limites, usage, prix } };
}

/** Valide une liste enregistrée (relecture des réglages) : une entrée invalide invalide la liste. */
export function validerListe(liste, { roles = null } = {}) {
  if (!Array.isArray(liste) || !liste.length || liste.length > MAX_SOUSCRIPTIONS) return { ok: false };
  const souscriptions = [];
  for (const brut of liste) {
    const v = validerSouscription(String(brut?.id ?? ""), brut, { roles });
    if (!v.ok || souscriptions.some((s) => s.id === v.souscription.id)) return { ok: false };
    souscriptions.push(v.souscription);
  }
  if (!souscriptions.some((s) => s.id === SOUSCRIPTION_GRATUITE)) return { ok: false };
  return { ok: true, souscriptions };
}

/**
 * Reprise des anciens « niveaux de souscription » du Harness (ADR 0026, clé `niveaux`) : chaque niveau devient une
 * souscription « projet » au rôle visiteur, avec toutes les fonctionnalités et ses limites de consommation.
 */
export function depuisNiveaux(niveaux) {
  const gratuite = SOUSCRIPTIONS_PAR_DEFAUT[0];
  return [gratuite, ...niveaux.map((n) => ({
    id: n.id, libelle: n.libelle, description: "", statut: "projet", role: "visiteur", fonctionnalites: [...FONCTIONNALITES],
    limites: { tokensSession: n.tokensSession, tokensAppel: n.tokensAppel, defisJour: n.defisJour, cahiersJour: n.cahiersJour, cahiersMois: 0, enfantsMax: 0, classesMax: 0, elevesMax: 0 },
    usage: { joursActifsMois: 12, tauxUtilisation: 50 },
    prix: { mode: "prix", prixMensuelHT: 0, margeCible: 60, remiseAnnuelle: 0 }
  }))];
}

/**
 * Limites effectives : pour « gratuit », les limites de consommation viennent du registre (configuration en vigueur),
 * où « Souscriptions » les écrit.
 */
export function limitesEffectives(souscription, config) {
  if (souscription.id !== SOUSCRIPTION_GRATUITE) return souscription.limites;
  return { ...souscription.limites, ...Object.fromEntries(Object.entries(LIMITES_CONSOMMATION).map(([champ, cle]) => [champ, config[cle]])) };
}

/** Souscription prête à afficher : limites effectives et estimation financière. */
export function decrireSouscription(souscription, env, finances) {
  const config = lireConfiguration(env);
  const limites = limitesEffectives(souscription, config);
  const tokensParGeneration = { defi: config.MAX_TOKENS_DEFI, cahiers: config.MAX_TOKENS_CAHIERS };
  return { ...souscription, limites, estimation: estimerSouscription({ ...souscription, limites }, finances, tokensParGeneration) };
}

/** Anciens niveaux, dérivés des souscriptions : identifiants attribuables aux comptes et cibles des stratégies. */
export const niveauxDe = (souscriptions) => souscriptions.filter((s) => s.id !== SOUSCRIPTION_GRATUITE).map((s) => ({ id: s.id, libelle: s.libelle }));
