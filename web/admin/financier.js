// Sous-module financier des souscriptions (ADR 0031) : estimation du coût de revient d'un abonné et position de la
// marge, à partir d'un prix de vente fourni ou d'une marge visée. Fonctions pures, sans dépendance : partagées par le
// Worker (validation, réponse de l'API) et par l'interface du back-office (recalcul immédiat pendant la saisie).
// Ce sont des estimations sur hypothèses : elles ne facturent rien et ne remplacent pas un avis comptable.

/**
 * Modules consommateurs de tokens, limite de souscription qui fixe leur volume quotidien et fonctionnalité qui les
 * ouvre : une offre qui n'inclut pas la fonctionnalité ne consomme rien sur ce module (ADR 0036).
 */
export const MODULES_COUT = Object.freeze({
  tuteur: Object.freeze({ libelle: "Tuteur IA", limite: "tokensSession", fonctionnalite: "ia.tuteur" }),
  defi: Object.freeze({ libelle: "Défi express généré", limite: "defisJour", fonctionnalite: "ia.defi" }),
  cahiers: Object.freeze({ libelle: "Cahiers enrichis", limite: "cahiersJour", fonctionnalite: "ia.cahiers" })
});

/**
 * Hypothèses financières par défaut, toutes modifiables dans le back-office (ADR 0031, affinées par l'ADR 0034). Prix
 * par million de tokens relevés le 2026-11-18 (tarifs publics), rechargeables depuis le catalogue de modèles de
 * Cloudflare (AI Gateway et Workers AI) : à revérifier avant toute décision tarifaire.
 * Par module :
 * - `modele` : identifiant du modèle dans le catalogue Cloudflare (sert au chargement des tarifs) ;
 * - `entree`, `sortie`, `cache` : prix par million de tokens (entrée, sortie, entrée lue en cache) ;
 * - `ratio` : tokens d'entrée envoyés par token généré (consignes, extraits du catalogue, historique) ;
 * - `partCache` : part des tokens d'entrée servie par le cache du fournisseur (%) ;
 * - `fraisPlateforme` : majoration sur le coût du modèle (%), par ex. 5 % de frais sur les crédits Unified Billing ;
 * - `tokensParAppel` : taille moyenne d'une génération (défi, cahier) ; 0 = taille maximale du registre (MAX_TOKENS_*).
 * Coûts fixes : postes mensuels détaillés ; `coutsFixesMensuels` en est la somme. Ils sont répartis entre les
 * souscriptions au prorata de leurs abonnés visés (`usage.utilisateursCibles`, voir `repartitionFixes`) ;
 * `utilisateursEstimes` ne sert plus que si aucune offre n'a d'abonnés visés (hypothèses antérieures).
 */
export const FINANCES_PAR_DEFAUT = Object.freeze({
  devise: "USD",
  tauxTva: 20,
  modeles: Object.freeze({
    tuteur: Object.freeze({ modele: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", entree: 0.29, sortie: 2.25, cache: 0.29, ratio: 4, partCache: 0, fraisPlateforme: 0, tokensParAppel: 0 }),
    defi: Object.freeze({ modele: "anthropic/claude-haiku-5.5", entree: 0.10, sortie: 0.50, cache: 0.01, ratio: 1, partCache: 0, fraisPlateforme: 0, tokensParAppel: 0 }),
    cahiers: Object.freeze({ modele: "anthropic/claude-sonnet-5.5", entree: 2, sortie: 10, cache: 0.2, ratio: 0.2, partCache: 0, fraisPlateforme: 0, tokensParAppel: 0 })
  }),
  coutsFixes: Object.freeze([
    Object.freeze({ libelle: "Cloudflare Workers Paid", montant: 5 }),
    Object.freeze({ libelle: "Domaine et messagerie", montant: 2 }),
    Object.freeze({ libelle: "Outils et services", montant: 23 })
  ]),
  coutsFixesMensuels: 30,
  utilisateursEstimes: 200,
  fraisPaiementPourcent: 2.9,
  fraisPaiementFixe: 0.3,
  tarifs: null
});

/** Bornes des hypothèses et des paramètres commerciaux : une saisie hors bornes est refusée. */
export const BORNES_FINANCES = Object.freeze({
  tauxTva: [0, 30], prixMillion: [0, 200], ratio: [0, 50], coutsFixesMensuels: [0, 100000], utilisateursEstimes: [1, 10000000],
  fraisPaiementPourcent: [0, 15], fraisPaiementFixe: [0, 5], prixMensuelHT: [0, 1000], margeCible: [-100, 95], remiseAnnuelle: [0, 90],
  prixAnnuelHT: [0, 12000], joursActifsMois: [0, 31], tauxUtilisation: [0, 100], utilisateursCibles: [0, 10000000], partCache: [0, 100], fraisPlateforme: [0, 30],
  tokensParAppel: [0, 200000], posteFixe: [0, 100000]
});
export const DEVISES = Object.freeze(["USD", "EUR"]);
export const MAX_POSTES_FIXES = 12;
export const FORMAT_MODELE = /^[@A-Za-z0-9][A-Za-z0-9@/._:-]{0,99}$/;

const arrondi = (n, decimales = 2) => { const f = 10 ** decimales; return Math.round((n + Number.EPSILON) * f) / f; };
const auCentimeSuperieur = (n) => Math.ceil(arrondi(n * 100, 6)) / 100;
const dansBornes = (n, [min, max]) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const texteCourt = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

/**
 * Valide les hypothèses financières globales. Les hypothèses enregistrées avant l'ADR 0034 (sans modèle, cache, frais
 * de plateforme ni postes fixes) sont complétées par les valeurs par défaut : rien n'est perdu.
 * @returns {{ ok: true, finances } | { ok: false, code }}
 */
export function validerFinances(brut) {
  const n = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));
  const devise = String(brut?.devise ?? "");
  if (!DEVISES.includes(devise)) return { ok: false, code: "devise-invalide" };
  const finances = { devise, modeles: {} };
  for (const cle of ["tauxTva", "utilisateursEstimes", "fraisPaiementPourcent", "fraisPaiementFixe"]) {
    const v = n(brut?.[cle]);
    if (!dansBornes(v, BORNES_FINANCES[cle])) return { ok: false, code: `hors-bornes:${cle}` };
    finances[cle] = cle === "utilisateursEstimes" ? Math.round(v) : v;
  }
  // Coûts fixes : postes détaillés ; à défaut (hypothèses anciennes), un seul poste reprenant le total.
  let postes = brut?.coutsFixes;
  if (!Array.isArray(postes)) {
    const total = n(brut?.coutsFixesMensuels);
    if (!dansBornes(total, BORNES_FINANCES.coutsFixesMensuels)) return { ok: false, code: "hors-bornes:coutsFixesMensuels" };
    postes = [{ libelle: "Coûts fixes", montant: total }];
  }
  if (postes.length > MAX_POSTES_FIXES) return { ok: false, code: "hors-bornes:coutsFixes" };
  finances.coutsFixes = [];
  for (const p of postes) {
    const libelle = texteCourt(p?.libelle, 40);
    const montant = n(p?.montant);
    if (!libelle) return { ok: false, code: "libelle-requis:coutsFixes" };
    if (!dansBornes(montant, BORNES_FINANCES.posteFixe)) return { ok: false, code: "hors-bornes:coutsFixes" };
    finances.coutsFixes.push({ libelle, montant });
  }
  finances.coutsFixesMensuels = arrondi(finances.coutsFixes.reduce((t, p) => t + p.montant, 0));
  if (!dansBornes(finances.coutsFixesMensuels, BORNES_FINANCES.coutsFixesMensuels)) return { ok: false, code: "hors-bornes:coutsFixesMensuels" };
  for (const module of Object.keys(MODULES_COUT)) {
    const m = brut?.modeles?.[module] ?? {};
    const defaut = FINANCES_PAR_DEFAUT.modeles[module];
    const valeur = (cle) => n(m[cle] ?? defaut[cle]);
    const prix = {
      modele: String(m.modele ?? defaut.modele).trim(),
      entree: n(m.entree), sortie: n(m.sortie), cache: valeur("cache"), ratio: n(m.ratio),
      partCache: valeur("partCache"), fraisPlateforme: valeur("fraisPlateforme"), tokensParAppel: valeur("tokensParAppel")
    };
    if (!FORMAT_MODELE.test(prix.modele)) return { ok: false, code: `modele-invalide:${module}` };
    if (!["entree", "sortie", "cache"].every((c) => dansBornes(prix[c], BORNES_FINANCES.prixMillion))) return { ok: false, code: `hors-bornes:prix-${module}` };
    if (!dansBornes(prix.ratio, BORNES_FINANCES.ratio)) return { ok: false, code: `hors-bornes:ratio-${module}` };
    for (const cle of ["partCache", "fraisPlateforme", "tokensParAppel"]) {
      if (!dansBornes(prix[cle], BORNES_FINANCES[cle])) return { ok: false, code: `hors-bornes:${cle}-${module}` };
    }
    prix.tokensParAppel = Math.round(prix.tokensParAppel);
    finances.modeles[module] = prix;
  }
  // Origine des tarifs (chargement depuis Cloudflare) : date et identifiants, pour l'affichage seulement.
  const t = brut?.tarifs;
  finances.tarifs = t && typeof t === "object" && /^\d{4}-\d{2}-\d{2}/.test(String(t.chargeLe ?? ""))
    ? { source: "cloudflare", chargeLe: String(t.chargeLe).slice(0, 10) } : null;
  return { ok: true, finances };
}

/**
 * Coût d'un token généré, entrée comprise, pour un module (devise des hypothèses) : les tokens d'entrée servis par le
 * cache sont comptés au prix du cache, puis la majoration de la plateforme s'applique.
 */
export function coutParToken({ entree, sortie, ratio, cache = entree, partCache = 0, fraisPlateforme = 0 }) {
  const part = partCache / 100;
  const entreeMoyenne = (1 - part) * entree + part * cache;
  return (sortie + ratio * entreeMoyenne) * (1 + fraisPlateforme / 100) / 1e6;
}

/**
 * Taille d'une génération par module : la taille moyenne saisie (`tokensParAppel`), sinon la taille maximale du
 * registre (`tokensParGeneration`, paramètres MAX_TOKENS_*).
 */
export function taillesGeneration(finances, tokensParGeneration = {}) {
  const taille = (module) => finances.modeles[module]?.tokensParAppel > 0 ? finances.modeles[module].tokensParAppel : (tokensParGeneration[module] ?? 0);
  return { defi: taille("defi"), cahiers: taille("cahiers") };
}

/**
 * Coût variable mensuel d'un abonné (les cahiers tiennent compte du plafond mensuel `cahiersMois`). Les plafonds viennent des limites de la souscription ; `tokensParGeneration`
 * donne la taille maximale d'une génération de défi et de cahier (paramètres MAX_TOKENS_* du registre).
 * - « au plafond » : chaque jour actif consomme tout le quota ;
 * - « estimé » : le plafond multiplié par le taux d'utilisation.
 */
export function coutVariable({ limites, usage, fonctionnalites }, finances, tokensParGenerationRegistre) {
  // Sans liste de fonctionnalités (estimation isolée), tous les modules sont comptés.
  const inclus = (module) => !Array.isArray(fonctionnalites) || fonctionnalites.includes(MODULES_COUT[module].fonctionnalite);
  const tokensParGeneration = taillesGeneration(finances, tokensParGenerationRegistre);
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
    const tokensMois = inclus(module) ? tokensParMois[module] : 0;
    const cout = tokensMois * coutParToken(finances.modeles[module]);
    plafond += cout;
    parModule[module] = { inclus: inclus(module), tokensMoisPlafond: tokensMois, coutMillion: arrondi(coutParToken(finances.modeles[module]) * 1e6, 4), plafond: arrondi(cout, 4), estime: arrondi(cout * usage.tauxUtilisation / 100, 4) };
  }
  return { parModule, plafond: arrondi(plafond, 4), estime: arrondi(plafond * usage.tauxUtilisation / 100, 4) };
}

/**
 * Répartition des coûts fixes entre les souscriptions, pondérée par leurs abonnés visés : une offre porte
 * coûts fixes × abonnés visés / total des abonnés visés, soit la même part par abonné quelle que soit l'offre.
 * Sans abonné visé nulle part (hypothèses antérieures), le nombre global `utilisateursEstimes` sert de diviseur.
 * @returns {{ abonnesTotal: number, partParAbonne: number }}
 */
export function repartitionFixes(souscriptions, finances) {
  const abonnesTotal = (souscriptions ?? []).reduce((t, s) => t + (Number(s?.usage?.utilisateursCibles) || 0), 0);
  const diviseur = abonnesTotal > 0 ? abonnesTotal : Math.max(1, Number(finances.utilisateursEstimes) || 1);
  return { abonnesTotal, partParAbonne: finances.coutsFixesMensuels / diviseur };
}

const fraisPaiement = (prix, finances) => (prix > 0 ? prix * finances.fraisPaiementPourcent / 100 + finances.fraisPaiementFixe : 0);

/**
 * Estimation complète d'une souscription : coût de revient, prix, marge et seuil de rentabilité.
 * `prix.mode` : « prix » (prix de vente fourni → marge calculée) ou « marge » (marge visée → prix calculé).
 * Marge = prix HT − coût de revient − frais de paiement ; taux de marge = marge / prix HT.
 * `repartition` : résultat de `repartitionFixes` sur toutes les souscriptions (part des coûts fixes par abonné) ; à
 * défaut, la souscription est seule et porte les coûts fixes au prorata de ses propres abonnés visés.
 */
export function estimerSouscription(souscription, finances, tokensParGeneration, repartition = repartitionFixes([souscription], finances)) {
  const variable = coutVariable(souscription, finances, tokensParGeneration);
  const partFixe = repartition.partParAbonne;
  const abonnes = Number(souscription.usage?.utilisateursCibles) || 0;
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
  // Prix annuel : saisi directement (`prixAnnuelHT` > 0), sinon douze mois moins la remise annuelle.
  const prixAnnuelSaisi = souscription.prix.prixAnnuelHT > 0 ? souscription.prix.prixAnnuelHT : 0;
  const prixAnnuelHT = prixAnnuelSaisi || arrondi(prixHT * 12 * (1 - remiseAnnuelle / 100));
  const remiseEffective = prixHT > 0 ? arrondi((1 - prixAnnuelHT / (12 * prixHT)) * 100, 1) : 0;
  const margeAnnuelle = prixAnnuelHT - 12 * coutRevient - fraisPaiement(prixAnnuelHT, finances);
  return {
    devise: finances.devise,
    coutVariable: variable,
    partFixe: arrondi(partFixe, 4),
    abonnesVises: abonnes,
    // Coûts fixes portés par l'offre : part par abonné × abonnés visés.
    fixesAlloues: arrondi(partFixe * abonnes, 2),
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
    prixAnnuelSaisi: prixAnnuelSaisi > 0,
    remiseEffective,
    prixAnnuelTTC: arrondi(prixAnnuelHT * (1 + finances.tauxTva / 100)),
    margeAnnuelle: arrondi(margeAnnuelle, 4),
    // Abonnés nécessaires pour couvrir les coûts fixes avec la contribution d'un abonné (prix − variable − frais).
    seuilRentabilite: contribution > 0 ? Math.ceil(finances.coutsFixesMensuels / contribution) : null,
    atteignable
  };
}

/**
 * Finance simplifiée (ADR 0036) : compte de résultat mensuel du portefeuille d'offres, chaque offre comptée avec ses
 * abonnés visés. Par offre : chiffre d'affaires HT, coûts variables, coûts fixes alloués, frais de paiement, résultat.
 * Totaux, point mort (abonnés nécessaires, à la même répartition entre offres, pour couvrir les coûts fixes) et
 * projection du résultat quand le nombre d'abonnés varie, à répartition constante.
 */
export function bilanPortefeuille(souscriptions, finances, tokensParGeneration) {
  const repartition = repartitionFixes(souscriptions, finances);
  const offres = souscriptions.map((s) => {
    const e = estimerSouscription(s, finances, tokensParGeneration, repartition);
    const n = e.abonnesVises;
    const revenus = n * e.prixMensuelHT;
    const variables = n * e.coutVariable.estime;
    const frais = n * e.fraisPaiement;
    const fixes = n * e.partFixe;
    return {
      id: s.id, libelle: s.libelle, abonnes: n, prixMensuelHT: e.prixMensuelHT,
      revenus: arrondi(revenus), variables: arrondi(variables), fixes: arrondi(fixes), frais: arrondi(frais),
      resultat: arrondi(revenus - variables - fixes - frais),
      // Contribution : ce qu'il reste pour couvrir les coûts fixes (avant leur répartition).
      contribution: arrondi(revenus - variables - frais)
    };
  });
  const somme = (cle) => arrondi(offres.reduce((t, o) => t + o[cle], 0));
  const total = { abonnes: offres.reduce((t, o) => t + o.abonnes, 0), revenus: somme("revenus"), variables: somme("variables"), fixes: finances.coutsFixesMensuels, frais: somme("frais"), contribution: somme("contribution") };
  total.couts = arrondi(total.variables + total.fixes + total.frais);
  total.resultat = arrondi(total.contribution - total.fixes);
  total.tauxMarge = total.revenus > 0 ? arrondi(total.resultat / total.revenus * 100, 1) : null;
  // Le résultat est linéaire en nombre d'abonnés (répartition constante) : résultat(k) = k × contribution − fixes.
  const pointMort = total.abonnes > 0 && total.contribution > 0
    ? { facteur: arrondi(total.fixes / total.contribution, 4), abonnes: Math.ceil(total.abonnes * total.fixes / total.contribution) } : null;
  const maxFacteur = Math.max(2, pointMort ? Math.min(10, pointMort.facteur * 1.25) : 2);
  const projection = Array.from({ length: 21 }, (_, i) => {
    const facteur = maxFacteur * i / 20;
    return { abonnes: Math.round(total.abonnes * facteur), resultat: arrondi(facteur * total.contribution - total.fixes) };
  });
  return { devise: finances.devise, repartition, offres, total, pointMort, projection };
}
