// Protection des données personnelles (ADR 0026) : registre des traitements (ce que chaque table contient, pourquoi,
// combien de temps) et contrôle de non-conservation, qui relit les tables alimentées par les requêtes avec les mêmes
// détecteurs que la pseudonymisation. Le contrôle ne renvoie que des compteurs, jamais une valeur lue.
import { pseudonymiser } from "./pseudonymisation.js";

/** Longueur au-delà de laquelle une valeur d'une table technique ressemble à du texte libre. */
export const LONGUEUR_SUSPECTE = 160;

/**
 * Registre des tables. `donnees` : aucune (technique ou agrégée), pseudonyme (reliée à une personne seulement par une
 * empreinte ou un identifiant aléatoire), minimale (donnée personnelle strictement nécessaire).
 * `controle` : la table est alimentée par des requêtes d'utilisateurs et ne doit contenir aucun texte libre.
 */
export const REGISTRE = Object.freeze([
  { table: "evenements", finalite: "Mesure d'usage anonyme (KPI)", contenu: "Type d'événement, notion, langue, routage", donnees: "aucune", conservation: "Sans limite (compteurs anonymes), sauvegarde quotidienne chiffrée dans R2", controle: true },
  { table: "telemetrie_llm", finalite: "Coûts et qualité des modèles", contenu: "Appels, tokens entrants et sortants, durée, par heure, module et modèle", donnees: "aucune", conservation: "CONSERVATION_TELEMETRIE_JOURS", controle: true },
  { table: "signaux_securite", finalite: "Sécurité et protection des mineurs", contenu: "Compteurs par profil pseudonyme, jour et catégorie de signal", donnees: "pseudonyme", conservation: "CONSERVATION_SIGNAUX_JOURS", controle: true },
  { table: "profils_securite", finalite: "Garde-fous", contenu: "État d'un profil pseudonyme et comportements retenus", donnees: "pseudonyme", conservation: "Jusqu'à l'expiration de l'état (7 jours par défaut)", controle: true },
  { table: "sessions_llm", finalite: "Quota de tokens par session", contenu: "Identifiant aléatoire, notion ouverte, tokens consommés", donnees: "pseudonyme", conservation: "24 heures", controle: true },
  { table: "defis_llm", finalite: "Quota du défi express", contenu: "Identifiant de session, nombre de générations", donnees: "pseudonyme", conservation: "24 heures", controle: true },
  { table: "cahiers_llm", finalite: "Quota des cahiers", contenu: "Identifiant de session, nombre de générations", donnees: "pseudonyme", conservation: "24 heures", controle: true },
  { table: "journal_admin", finalite: "Traçabilité du back-office", contenu: "Action, cible, date ; jamais le contenu modifié", donnees: "aucune", conservation: "Sans limite pendant la bêta", controle: true },
  { table: "comptes", finalite: "Compte famille", contenu: "Empreinte SHA-256 de l'e-mail, rôle, dates, version du consentement", donnees: "pseudonyme", conservation: "Jusqu'à la suppression du compte" },
  { table: "auth_providers", finalite: "Connexion Google ou Microsoft", contenu: "Identifiant technique du fournisseur", donnees: "pseudonyme", conservation: "Jusqu'à la suppression du compte" },
  { table: "eleves", finalite: "Profils des enfants", contenu: "Prénom ou surnom, tranche d'âge, langue, consentement du parent", donnees: "minimale", conservation: "Jusqu'à la suppression par le parent" },
  { table: "progres", finalite: "Progression des enfants", contenu: "Notion, score, étoiles", donnees: "pseudonyme", conservation: "Jusqu'à la suppression du profil" },
  { table: "sessions", finalite: "Session de connexion", contenu: "Identifiant aléatoire, expiration", donnees: "pseudonyme", conservation: "30 jours" },
  { table: "oauth_states", finalite: "Sécurité de la connexion", contenu: "États temporaires", donnees: "aucune", conservation: "Quelques minutes" },
  { table: "contributions", finalite: "Contributions au contenu", contenu: "Textes pédagogiques proposés, sans donnée personnelle (filtrés)", donnees: "pseudonyme", conservation: "Jusqu'à la suppression du compte" },
  { table: "comptes_locaux", finalite: "Compte facultatif sur l'appareil", contenu: "Empreinte HMAC de l'identifiant, mot de passe haché", donnees: "pseudonyme", conservation: "Jusqu'à la suppression du compte" },
  { table: "sessions_locales", finalite: "Session de synchronisation", contenu: "Empreinte du jeton", donnees: "pseudonyme", conservation: "12 heures" },
  { table: "donnees_pseudonymes", finalite: "Synchronisation chiffrée", contenu: "Données chiffrées dans le navigateur, illisibles par le serveur", donnees: "pseudonyme", conservation: "365 jours sans lecture ni écriture" },
  { table: "familles_liens", finalite: "Espace famille : lien parent → enfant (ADR 0029)", contenu: "Identifiants des deux comptes, prénom ou surnom et tranche d'âge choisis par le parent, consentement parental versionné", donnees: "minimale", conservation: "Jusqu'au détachement ou à la suppression d'un des comptes" },
  { table: "familles_invitations", finalite: "Invitation d'un parent par un compte solo", contenu: "Empreinte SHA-256 du code, compte, expiration", donnees: "pseudonyme", conservation: "48 heures", controle: true },
  { table: "familles_bilans", finalite: "Suivi de la progression par le parent", contenu: "Compteurs, dates au jour près et identifiants du catalogue ; aucun texte libre", donnees: "pseudonyme", conservation: "Jusqu'au détachement ou à la suppression du compte" },
  { table: "familles_cahiers", finalite: "Cahiers assignés par le parent", contenu: "Demande (listes fermées), contenu pédagogique rédigé par l'IA et modéré, calibrage, avancement", donnees: "pseudonyme", conservation: "Jusqu'à la suppression par le parent ou du compte" },
  { table: "familles_consommations", finalite: "Consommations d'IA de la famille", contenu: "Appels et tokens générés par compte, jour et module", donnees: "pseudonyme", conservation: "90 jours", controle: true },
  { table: "professeurs_profils", finalite: "Expérience Professeur : profil affiché aux élèves (ADR 0030)", contenu: "Nom affiché choisi par le professeur, matières et niveaux (listes fermées)", donnees: "minimale", conservation: "Jusqu'à la suppression du compte" },
  { table: "professeurs_classes", finalite: "Classes du professeur", contenu: "Nom court de la classe, matière, niveau", donnees: "pseudonyme", conservation: "Jusqu'à la suppression par le professeur ou du compte" },
  { table: "professeurs_invitations", finalite: "Liens d'invitation des élèves", contenu: "Empreinte SHA-256 du code, classe, expiration, nombre d'utilisations", donnees: "pseudonyme", conservation: "30 jours au plus", controle: true },
  { table: "professeurs_eleves", finalite: "Élèves affiliés à un professeur", contenu: "Identifiants des deux comptes, classe, pseudo choisi par l'élève, accord versionné", donnees: "minimale", conservation: "Jusqu'au départ de l'élève, à son retrait ou à la suppression d'un des comptes" },
  { table: "professeurs_bilans", finalite: "Suivi de la progression par le professeur", contenu: "Compteurs, dates au jour près et identifiants du catalogue ; aucun texte libre", donnees: "pseudonyme", conservation: "Tant que l'élève a au moins un professeur" },
  { table: "professeurs_activites", finalite: "Activités données par un professeur : défis, évaluations, cahiers, objectifs (ADR 0030 §9)", contenu: "Type, cible (classe ou élève), notions du catalogue, réglages, libellé court du professeur, échéance ; cahier rédigé par l'IA et modéré", donnees: "pseudonyme", conservation: "Jusqu'à la suppression par le professeur, de la classe, du lien avec l'élève ou d'un des comptes" },
  { table: "professeurs_resultats", finalite: "Suivi des activités par le professeur", contenu: "Questions réussies, total, meilleur essai, nombre d'essais, durée, fin ; aucune réponse ni texte", donnees: "pseudonyme", conservation: "Jusqu'au départ de l'élève, à la suppression de l'activité ou d'un des comptes", controle: true },
  { table: "professeurs_consommations", finalite: "Quota de cahiers rédigés par l'IA pour un professeur", contenu: "Appels et tokens générés par professeur et par jour", donnees: "pseudonyme", conservation: "90 jours", controle: true },
  { table: "roles", finalite: "Rôles", contenu: "Libellés et permissions", donnees: "aucune", conservation: "Sans limite" },
  { table: "attributions_roles", finalite: "Rôle et niveau d'un compte", contenu: "Identifiant de compte, rôle, niveau", donnees: "pseudonyme", conservation: "Jusqu'à la suppression du compte" },
  { table: "strategies_acces", finalite: "Stratégies d'accès", contenu: "Fonctionnalité, mode, rôles", donnees: "aucune", conservation: "Sans limite" },
  { table: "reglages", finalite: "Réglages du site", contenu: "Paramètres, charte graphique, niveaux", donnees: "aucune", conservation: "Sans limite" },
  { table: "contenus_etats", finalite: "Publication des contenus", contenu: "Contenu masqué ou mis en avant", donnees: "aucune", conservation: "Sans limite" },
  { table: "contenus_brouillons", finalite: "Brouillons éditoriaux", contenu: "Textes destinés à publication, sans donnée personnelle (filtrés)", donnees: "aucune", conservation: "Jusqu'à l'archivage" }
].map((t) => Object.freeze(t)));

/** Tables dont le texte est destiné à publication : contrôlées elles aussi, sans limite de longueur. */
const TABLES_EDITORIALES = ["contributions", "contenus_brouillons"];
const MAX_LIGNES = 2000;
const IDENTIFIANT_TECHNIQUE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[0-9a-f]{16,64}$/;

async function controlerTable(env, table, { longueur }) {
  let lignes;
  try {
    lignes = (await env.DB.prepare(`SELECT * FROM ${table} LIMIT ${MAX_LIGNES}`).bind().all()).results ?? [];
  } catch {
    return { table, absente: true, lignes: 0, valeurs: 0, detections: 0, categories: {}, textesLibres: 0 };
  }
  let valeurs = 0, detections = 0, textesLibres = 0;
  const categories = {};
  for (const ligne of lignes) {
    for (const valeur of Object.values(ligne)) {
      // Identifiants techniques (UUID, empreintes hexadécimales) : jamais du texte saisi, non soumis aux détecteurs.
      if (typeof valeur !== "string" || !valeur || IDENTIFIANT_TECHNIQUE.test(valeur)) continue;
      valeurs += 1;
      const { remplacements, total } = pseudonymiser(valeur);
      detections += total;
      for (const [c, n] of Object.entries(remplacements)) categories[c] = (categories[c] ?? 0) + n;
      if (longueur && valeur.length > LONGUEUR_SUSPECTE) textesLibres += 1;
    }
  }
  return { table, lignes: lignes.length, valeurs, detections, categories, textesLibres };
}

/**
 * Contrôle de non-conservation : aucune donnée personnelle détectable ni texte libre dans les tables alimentées par
 * les requêtes ; aucune donnée personnelle détectable dans les textes éditoriaux.
 * @returns {Promise<{ conforme: boolean, controleLe: string, tables: object[] }>}
 */
export async function controlerNonConservation(env, maintenant = Date.now()) {
  const tables = [];
  for (const { table } of REGISTRE.filter((t) => t.controle)) tables.push(await controlerTable(env, table, { longueur: true }));
  for (const table of TABLES_EDITORIALES) tables.push(await controlerTable(env, table, { longueur: false }));
  return {
    conforme: tables.every((t) => t.detections === 0 && t.textesLibres === 0),
    controleLe: new Date(maintenant).toISOString(),
    tables
  };
}

/** Nombre de lignes de chaque table du registre (`null` si la table n'existe pas encore). */
export async function volumes(env) {
  const resultat = {};
  for (const { table } of REGISTRE) {
    try {
      resultat[table] = (await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).bind().first())?.n ?? 0;
    } catch {
      resultat[table] = null;
    }
  }
  return resultat;
}
