// Sous-module financier des souscriptions (ADR 0031) : estimation du coût de revient d'un abonné et position de la
// marge, à partir d'un prix de vente fourni ou d'une marge visée. Fonctions pures, sans dépendance : partagées par le
// Worker (validation, réponse de l'API) et par l'interface du back-office (recalcul immédiat pendant la saisie).
// Ce sont des estimations sur hypothèses : elles ne facturent rien et ne remplacent pas un avis comptable.

/** Modules consommateurs de tokens, et limite de souscription qui fixe leur volume quotidien. */
export const MODULES_COUT = Object.freeze({
  tuteur: Object.freeze({ libelle: "Tuteur IA", limite: "tokensSession" }),
  defi: Object.freeze({ libelle: "Défi express généré", limite: "defisJour" }),
  cahiers: Object.freeze({ libelle: "Cahiers enrichis", limite: "cahiersJour" })
});

/**
 * Hypothèses financières par défaut, toutes modifiables dans le back-office. Prix par million de tokens relevés le
 * 2026-11-18 (tarifs publics des fournisseurs) : à revérifier avant toute décision tarifaire.
 * - tuteur : Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (repli Claude Haiku 5.5 : 0,10 / 0,50) ;
 * - defi : Claude Haiku 5.5 (0,10 / 0,50) ; cahiers : Claude Sonnet 5.5 (2 / 10).
 * `ratio` : tokens d'entrée envoyés par token généré (consignes, extraits du catalogue, historique).
 */
export const FINANCES_PAR_DEFAUT = Object.freeze({
  devise: "USD",
  tauxTva: 20,
  modeles: Object.freeze({
    tuteur: Object.freeze({ entree: 0.29, sortie: 2.25, ratio: 4 }),
    defi: Object.freeze({ entree: 0.10, sortie: 0.50, ratio: 1 }),
    cahiers: Object.freeze({ entree: 2, sortie: 10, ratio: 0.2 })
  }),
  coutsFixesMensuels: 30,
  utilisateursEstimes: 200,
  fraisPaiementPourcent: 2.9,
  fraisPaiementFixe: 0.3
});

/** Bornes des hypothèses et des paramètres commerciaux : une saisie hors bornes est refusée. */
export const BORNES_FINANCES = Object.freeze({
  tauxTva: [0, 30], prixMillion: [0, 200], ratio: [0, 50], coutsFixesMensuels: [0, 100000], utilisateursEstimes: [1, 10000000],
  fraisPaiementPourcent: [0, 15], fraisPaiementFixe: [0, 5], prixMensuelHT: [0, 1000], margeCible: [-100, 95], remiseAnnuelle: [0, 90],
  joursActifsMois: [0, 31], tauxUtilisation: [0, 100]
});
export const DEVISES = Object.freeze(["USD", "EUR"]);

const arrondi = (n, decimales = 2) => { const f = 10 ** decimales; return Math.round((n + Number.EPSILON) * f) / f; };
const auCentimeSuperieur = (n) => Math.ceil(arrondi(n * 100, 6)) / 100;
const dansBornes = (n, [min, max]) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;

/** Valide les hypothèses financières globales. @returns {{ ok: true, finances } | { ok: false, code }} */
export function validerFinances(brut) {
  const n = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));
  const devise = String(brut?.devise ?? "");
  if (!DEVISES.includes(devise)) return { ok: false, code: "devise-invalide" };
  const finances = { devise, modeles: {} };
  for (const cle of ["tauxTva", "coutsFixesMensuels", "utilisateursEstimes", "fraisPaiementPourcent", "fraisPaiementFixe"]) {
    const v = n(brut?.[cle]);
    if (!dansBornes(v, BORNES_FINANCES[cle])) return { ok: false, code: `hors-bornes:${cle}` };
    finances[cle] = cle === "utilisateursEstimes" ? Math.round(v) : v;
  }
  for (const module of Object.keys(MODULES_COUT)) {
    const m = brut?.modeles?.[module] ?? {};
    const prix = { entree: n(m.entree), sortie: n(m.sortie), ratio: n(m.ratio) };
    if (!dansBornes(prix.entree, BORNES_FINANCES.prixMillion) || !dansBornes(prix.sortie, BORNES_FINANCES.prixMillion)) return { ok: false, code: `hors-bornes:prix-${module}` };
    if (!dansBornes(prix.ratio, BORNES_FINANCES.ratio)) return { ok: false, code: `hors-bornes:ratio-${module}` };
    finances.modeles[module] = prix;
  }
  return { ok: true, finances };
}

/** Coût d'un token généré, entrée comprise, pour un module (devise des hypothèses). */
const coutParToken = ({ entree, sortie, ratio }) => (sortie + ratio * entree) / 1e6;

/**
 * Coût variable mensuel d'un abonné (les cahiers tiennent compte du plafond mensuel `cahiersMois`). Les plafonds viennent des limites de la souscription ; `tokensParGeneration`
 * donne la taille maximale d'une génération de défi et de cahier (paramètres MAX_TOKENS_* du registre).
 * - « au plafond » : chaque jour actif consomme tout le quota ;
 * - « estimé » : le plafond multiplié par le taux d'utilisation.
 */
export function coutVariable({ limites, usage }, finances, tokensParGeneration) {
  const jours = usage.joursActifsMois;
  // Cahiers : limite par jour, bornée par le plafond mensuel s'il existe (`cahiersMois`, 0 = sans plafond).
  const cahiersMois = limites.cahiersMois > 0 ? Math.min(jours * limites.cahiersJour, limites.cahiersMois) : jours * limites.cahiersJour;
  const tokensParMois = {
    tuteur: jours * limites.tokensSession,
    defi: jours * limites.defisJour * tokensParGeneration.defi,
    cahiers: cahiersMois * tokensParGeneration.cahiers
  };
  const parModule = {};
  let plafond = 0;
  for (const module of Object.keys(MODULES_COUT)) {
    const tokensMois = tokensParMois[module];
    const cout = tokensMois * coutParToken(finances.modeles[module]);
    plafond += cout;
    parModule[module] = { tokensMoisPlafond: tokensMois, plafond: arrondi(cout, 4), estime: arrondi(cout * usage.tauxUtilisation / 100, 4) };
  }
  return { parModule, plafond: arrondi(plafond, 4), estime: arrondi(plafond * usage.tauxUtilisation / 100, 4) };
}

const fraisPaiement = (prix, finances) => (prix > 0 ? prix * finances.fraisPaiementPourcent / 100 + finances.fraisPaiementFixe : 0);

/**
 * Estimation complète d'une souscription : coût de revient, prix, marge et seuil de rentabilité.
 * `prix.mode` : « prix » (prix de vente fourni → marge calculée) ou « marge » (marge visée → prix calculé).
 * Marge = prix HT − coût de revient − frais de paiement ; taux de marge = marge / prix HT.
 */
export function estimerSouscription(souscription, finances, tokensParGeneration) {
  const variable = coutVariable(souscription, finances, tokensParGeneration);
  const partFixe = finances.coutsFixesMensuels / finances.utilisateursEstimes;
  const coutRevient = variable.estime + partFixe;
  const { mode, margeCible, remiseAnnuelle } = souscription.prix;
  const pourcent = finances.fraisPaiementPourcent / 100;
  let prixHT = souscription.prix.prixMensuelHT;
  let atteignable = true;
  if (mode === "marge") {
    // P − coût − (P × f + frais fixe) = m × P  ⇒  P = (coût + frais fixe) / (1 − m − f)
    const diviseur = 1 - margeCible / 100 - pourcent;
    atteignable = diviseur > 0;
    prixHT = atteignable ? Math.min(BORNES_FINANCES.prixMensuelHT[1], auCentimeSuperieur((coutRevient + finances.fraisPaiementFixe) / diviseur)) : 0;
    if (coutRevient <= 0 && margeCible <= 0) prixHT = 0;
  }
  const frais = fraisPaiement(prixHT, finances);
  const marge = prixHT - coutRevient - frais;
  const contribution = prixHT - variable.estime - frais;
  const prixAnnuelHT = arrondi(prixHT * 12 * (1 - remiseAnnuelle / 100));
  const margeAnnuelle = prixAnnuelHT - 12 * coutRevient - fraisPaiement(prixAnnuelHT, finances);
  return {
    devise: finances.devise,
    coutVariable: variable,
    partFixe: arrondi(partFixe, 4),
    coutRevient: arrondi(coutRevient, 4),
    coutRevientPlafond: arrondi(variable.plafond + partFixe, 4),
    prixMensuelHT: arrondi(prixHT),
    prixMensuelTTC: arrondi(prixHT * (1 + finances.tauxTva / 100)),
    fraisPaiement: arrondi(frais, 4),
    marge: arrondi(marge, 4),
    tauxMarge: prixHT > 0 ? arrondi(marge / prixHT * 100, 1) : null,
    coefficient: coutRevient > 0 ? arrondi(prixHT / coutRevient, 2) : null,
    margeAuPlafond: arrondi(prixHT - variable.plafond - partFixe - frais, 4),
    prixAnnuelHT,
    prixAnnuelTTC: arrondi(prixAnnuelHT * (1 + finances.tauxTva / 100)),
    margeAnnuelle: arrondi(margeAnnuelle, 4),
    // Abonnés nécessaires pour couvrir les coûts fixes avec la contribution d'un abonné (prix − variable − frais).
    seuilRentabilite: contribution > 0 ? Math.ceil(finances.coutsFixesMensuels / contribution) : null,
    atteignable
  };
}
