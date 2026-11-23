// Espace famille des comptes locaux (ADR 0029) : logique pure, sans accès au DOM ni au réseau, partagée avec le Worker.
// Un compte local qui a le rôle parent rattache des comptes enfants (invitation envoyée par un compte solo ou création
// par le parent), suit leur progression (bilan clair et borné : compteurs et identifiants du catalogue, jamais de texte
// libre), leur assigne des cahiers précédés d'un questionnaire de calibrage et suit les consommations d'IA de la famille.
// Ce module n'importe rien : les règles du pseudo et la liste des tranches d'âge sont passées en paramètre.

export const VERSION_BILAN = 1;
/** Alphabet des codes d'invitation : sans I, L, O, U ni 0, 1 (aucune confusion à la lecture ou à la saisie). */
export const ALPHABET_CODE = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
export const LONGUEUR_CODE = 8;
/** Durée de validité d'une invitation (48 h) : le temps de transmettre le code au parent. */
export const DUREE_INVITATION_S = 48 * 3600;
export const MAX_ENFANTS_FAMILLE = 6;
export const MAX_NOTIONS_BILAN = 200;
export const JOURS_BILAN = 14;
/** Un enfant sans activité depuis ce nombre de jours est signalé dans la synthèse. */
export const JOURS_INACTIVITE = 7;
export const STATUTS_CAHIER = Object.freeze(["assigne", "en-cours", "termine", "archive"]);
export const ETATS_NOTION = Object.freeze(["decouverte", "en-cours", "maitrisee", "a-revoir"]);
/** Modules dont la consommation d'IA est comptée pour la famille (compteurs seulement). */
export const MODULES_CONSOMMATION = Object.freeze(["chat", "defi", "cahier", "cahier-famille", "cadrage-idee"]);

const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const entier = (v, max) => (Number.isInteger(v) && v >= 0 ? Math.min(v, max) : 0);

/**
 * Code d'invitation saisi : majuscules, espaces et tirets retirés, alphabet et longueur contrôlés.
 * @returns {string | null} le code normalisé, ou null s'il est mal formé.
 */
export function normaliserCode(brut) {
  const code = String(brut ?? "").toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== LONGUEUR_CODE) return null;
  return [...code].every((c) => ALPHABET_CODE.includes(c)) ? code : null;
}

/** Code lisible : deux groupes de quatre caractères (ABCD-EFGH). */
export const afficherCode = (code) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** Tire un code d'invitation avec un générateur d'octets aléatoires (crypto.getRandomValues), sans biais de modulo. */
export function tirerCode(octetsAleatoires) {
  let code = "";
  while (code.length < LONGUEUR_CODE) {
    for (const o of octetsAleatoires(16)) {
      if (o < 240 && code.length < LONGUEUR_CODE) code += ALPHABET_CODE[o % ALPHABET_CODE.length];
    }
  }
  return code;
}

/**
 * Valide le profil d'un enfant saisi par le parent : prénom ou surnom (règles du pseudo), tranche d'âge connue et
 * consentement parental explicite dans la version attendue.
 * @returns {{ ok: true, prenom: string, tranche: string } | { ok: false, code: string }}
 */
export function validerProfilEnfant(corps, { validerPrenom, tranches, versionConsentement, consentementRequis = true }) {
  const p = validerPrenom(corps?.prenom);
  if (!p.ok) return { ok: false, code: `prenom-${p.erreur}` };
  if (!tranches.includes(corps?.trancheAge)) return { ok: false, code: "tranche-invalide" };
  if (consentementRequis && corps?.consentement !== versionConsentement) return { ok: false, code: "consentement-requis" };
  return { ok: true, prenom: p.pseudo, tranche: corps.trancheAge };
}

/**
 * Construit le bilan envoyé au parent à partir des données de l'appareil de l'enfant. Seuls des compteurs, des dates
 * au jour près et des identifiants du catalogue en sortent : ni pseudo, ni titre de cahier, ni note, ni question posée.
 * @param {object} p progression normalisée (web/progression.js)
 * @param {object} options `notions` : { id: { etat, tentes, reussis } } ; `semaine` : activité par jour ; `niveau`.
 */
export function construireBilan(p, { jour, niveau = 1, serie = 0, semaine = [], notions = {}, cahiers = [] } = {}) {
  return validerBilan({
    v: VERSION_BILAN, jour,
    xp: p?.xp, niveau, serie, serieMax: p?.serieMax, questions: p?.questions,
    tempsMin: Math.round((p?.tempsActif?.total ?? 0) / 60000),
    dernierJour: p?.dernierJour ?? null,
    badges: p?.badges ?? [],
    jours: semaine.map((j) => ({ jour: j.jour, xp: j.xp, min: Math.round((j.s ?? 0) / 60000), q: j.q })),
    notions, cahiers
  });
}

/**
 * Relit un bilan (envoyé par le navigateur, ou relu en base) : seuls les champs connus, bornés, sont gardés.
 * @returns {object | null}
 */
export function validerBilan(brut) {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  if (!JOUR.test(brut.jour ?? "")) return null;
  const notions = {};
  for (const [id, n] of Object.entries(brut.notions && typeof brut.notions === "object" ? brut.notions : {})) {
    if (Object.keys(notions).length >= MAX_NOTIONS_BILAN) break;
    if (!ID.test(id) || !n || typeof n !== "object" || !ETATS_NOTION.includes(n.etat)) continue;
    notions[id] = { etat: n.etat, tentes: entier(n.tentes, 999), reussis: Math.min(entier(n.reussis, 999), entier(n.tentes, 999)) };
  }
  const jours = (Array.isArray(brut.jours) ? brut.jours : [])
    .filter((j) => j && JOUR.test(j.jour ?? ""))
    .slice(-JOURS_BILAN)
    .map((j) => ({ jour: j.jour, xp: entier(j.xp, 100000), min: entier(j.min, 1440), q: entier(j.q, 10000) }));
  const cahiers = (Array.isArray(brut.cahiers) ? brut.cahiers : [])
    .filter((c) => c && typeof c.famille === "string" && /^[0-9a-f-]{36}$/.test(c.famille))
    .slice(0, 50)
    .map((c) => ({ famille: c.famille, reussis: entier(c.reussis, 999), total: entier(c.total, 999) }));
  return {
    v: VERSION_BILAN, jour: brut.jour,
    xp: entier(brut.xp, 10_000_000), niveau: Math.max(1, entier(brut.niveau, 100000)),
    serie: entier(brut.serie, 10000), serieMax: entier(brut.serieMax, 10000), questions: entier(brut.questions, 10_000_000),
    tempsMin: entier(brut.tempsMin, 10_000_000),
    dernierJour: JOUR.test(brut.dernierJour ?? "") ? brut.dernierJour : null,
    badges: [...new Set((Array.isArray(brut.badges) ? brut.badges : []).filter((b) => typeof b === "string" && ID.test(b)))].slice(0, 30),
    jours, notions, cahiers
  };
}

/** Écart en jours entre deux dates AAAA-MM-JJ (b − a). */
export function ecartJours(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** Répartition des notions d'un bilan par état de maîtrise. */
export function repartitionNotions(bilan) {
  const r = Object.fromEntries(ETATS_NOTION.map((e) => [e, 0]));
  for (const n of Object.values(bilan?.notions ?? {})) r[n.etat] += 1;
  return r;
}

/** Totaux des 7 derniers jours d'un bilan (XP, minutes actives, jours actifs). */
export function semaineBilan(bilan, aujourdhui) {
  const recents = (bilan?.jours ?? []).filter((j) => { const e = ecartJours(j.jour, aujourdhui); return e >= 0 && e < 7; });
  return {
    xp: recents.reduce((s, j) => s + j.xp, 0),
    minutes: recents.reduce((s, j) => s + j.min, 0),
    joursActifs: recents.filter((j) => j.xp > 0 || j.min > 0 || j.q > 0).length
  };
}

/**
 * Synthèse de la famille, calculée dans le navigateur du parent : totaux de la semaine et points d'attention.
 * Alertes : `jamais` (aucun bilan reçu), `aucune-activite` (bilan sans activité), `inactif` (rien depuis JOURS_INACTIVITE jours), `a-revoir` (notions à revoir),
 * `cahier-attente` (cahier assigné non commencé depuis plus de 3 jours).
 */
export function syntheseFamille(enfants, aujourdhui) {
  const synthese = { enfants: 0, xp: 0, minutes: 0, cahiersEnCours: 0, cahiersTermines: 0, alertes: [] };
  for (const e of Array.isArray(enfants) ? enfants : []) {
    synthese.enfants += 1;
    const s = semaineBilan(e.bilan, aujourdhui);
    synthese.xp += s.xp;
    synthese.minutes += s.minutes;
    const derniere = e.bilan?.dernierJour ?? null;
    if (!e.bilan) synthese.alertes.push({ enfant: e.id, type: "jamais" });
    else if (!derniere) synthese.alertes.push({ enfant: e.id, type: "aucune-activite" });
    else if (ecartJours(derniere, aujourdhui) >= JOURS_INACTIVITE) {
      synthese.alertes.push({ enfant: e.id, type: "inactif", jours: ecartJours(derniere, aujourdhui) });
    }
    const aRevoir = repartitionNotions(e.bilan)["a-revoir"];
    if (aRevoir) synthese.alertes.push({ enfant: e.id, type: "a-revoir", n: aRevoir });
    for (const c of e.cahiers ?? []) {
      if (c.statut === "en-cours") synthese.cahiersEnCours += 1;
      if (c.statut === "termine") synthese.cahiersTermines += 1;
      if (c.statut === "assigne" && c.creeLe && ecartJours(c.creeLe.slice(0, 10), aujourdhui) > 3) {
        synthese.alertes.push({ enfant: e.id, type: "cahier-attente", cahier: c.id });
      }
    }
  }
  return synthese;
}

/**
 * Résultats du questionnaire de calibrage : { notion: true (acquise) | false (à travailler) }. Seules les notions du
 * cahier sont gardées ; une notion sans question reste « à travailler ».
 */
export function lireCalibrage(brut, notionsDuCahier) {
  const resultats = {};
  for (const id of notionsDuCahier) resultats[id] = brut && typeof brut === "object" && brut[id] === true;
  return resultats;
}

/**
 * Applique le calibrage à un cahier : les notions à travailler passent en premier, avec tous leurs blocs ; une notion
 * déjà acquise passe à la fin en approfondissement (exercices de niveau 1 retirés, s'il en reste d'autres).
 * Fonction pure : le cahier d'origine n'est pas modifié.
 */
export function appliquerCalibrage(cahier, resultats) {
  const sections = (cahier?.sections ?? []).map((s) => {
    if (!resultats?.[s.notion]) return { ...s, acquise: false };
    const blocs = s.blocs ?? [];
    const sansFaciles = blocs.filter((b) => !(b.genre === "exercice" && b.niveau === 1));
    const reste = sansFaciles.some((b) => b.genre === "exercice" || b.genre === "defi");
    return { ...s, acquise: true, blocs: reste ? sansFaciles : blocs };
  });
  return { ...cahier, sections: [...sections.filter((s) => !s.acquise), ...sections.filter((s) => s.acquise)] };
}

/**
 * Consommations de la famille : lignes { compte, jour, module, appels, tokens } regroupées par membre et par module,
 * avec le total. `membres` : liste ordonnée des identifiants (parent puis enfants).
 */
export function resumerConsommations(lignes, membres) {
  const vide = () => ({ appels: 0, tokens: 0, modules: {} });
  const parMembre = Object.fromEntries(membres.map((id) => [id, vide()]));
  const total = vide();
  for (const l of Array.isArray(lignes) ? lignes : []) {
    const m = parMembre[l?.compte];
    if (!m || !MODULES_CONSOMMATION.includes(l.module)) continue;
    for (const cible of [m, total]) {
      cible.appels += entier(l.appels, 1e9);
      cible.tokens += entier(l.tokens, 1e12);
      const mod = (cible.modules[l.module] ??= { appels: 0, tokens: 0 });
      mod.appels += entier(l.appels, 1e9);
      mod.tokens += entier(l.tokens, 1e12);
    }
  }
  return { parMembre, total };
}

/**
 * Comptes dont la progression peut être consultée depuis l'écran Progression (ADR 0039, lot 3) : soi-même, puis les
 * enfants d'un parent et les élèves d'un professeur, groupés par famille et par classe. Rien de nouveau n'est lu : ce
 * sont les bilans bornés déjà reçus par l'Espace famille (§4) et le suivi du professeur (ADR 0030 §6).
 * @param {{ enfants?: object[], eleves?: { classes: object[], eleves: object[] } | null, libelles: { famille: string, particuliers: string } }} source
 * @returns {{ groupe: string, comptes: { cle: string, nom: string, origine: "famille" | "eleve", bilan: object | null }[] }[]}
 */
export function comptesSuivis({ enfants = [], eleves = null, libelles } = {}) {
  const groupes = [];
  const famille = (Array.isArray(enfants) ? enfants : []).filter((e) => e && typeof e.id === "string")
    .map((e) => ({ cle: `famille:${e.id}`, nom: String(e.prenom ?? ""), origine: "famille", bilan: e.bilan ?? null }));
  if (famille.length) groupes.push({ groupe: libelles.famille, comptes: famille });
  const liste = Array.isArray(eleves?.eleves) ? eleves.eleves.filter((e) => e && typeof e.id === "string") : [];
  const versCompte = (e) => ({ cle: `eleve:${e.id}`, nom: String(e.pseudo ?? ""), origine: "eleve", bilan: e.bilan ?? null });
  const parNom = (a, b) => a.nom.localeCompare(b.nom);
  for (const c of Array.isArray(eleves?.classes) ? eleves.classes : []) {
    const comptes = liste.filter((e) => e.classeId === c.id).map(versCompte).sort(parNom);
    if (comptes.length) groupes.push({ groupe: String(c.nom ?? ""), comptes });
  }
  const connues = new Set((eleves?.classes ?? []).map((c) => c.id));
  const particuliers = liste.filter((e) => !connues.has(e.classeId)).map(versCompte).sort(parNom);
  if (particuliers.length) groupes.push({ groupe: libelles.particuliers, comptes: particuliers });
  return groupes;
}
