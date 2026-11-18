// API du back-office (ADR 0026), sous `/api/admin/`. Accès par clé partagée (`BACKOFFICE_JETON`, secret Cloudflare)
// pendant la bêta : sans clé configurée, l'API répond 503 (fermée par défaut). Le contrôle par rôle des
// fonctionnalités du site n'est pas appliqué (CONTROLE_ACCES_ACTIF à false) ; il est seulement préparé ici.
// Chaque écriture est notée dans `journal_admin` (action et cible, jamais le contenu).
import { analyserRequete, CATEGORIES } from "./analyse-requete.js";
import { pseudonymiser } from "./pseudonymisation.js";
import { SKILLS, configurationAdmin, lireConfiguration, parametreDuRegistre } from "./configuration.js";
import {
  ETATS, FENETRE_JOURS, LISTE_COMPORTEMENTS, PROFIL_ANONYME, evaluerProfil, profilDuCompte, purgerSignaux
} from "./comportement.js";
import {
  FONCTIONNALITES, PERMISSIONS_ADMIN, ROLES_HISTORIQUES, ROLES_SYSTEME, ROLE_PAR_DEFAUT, accesAutorise, listerRoles,
  listerStrategies, validerRole, validerStrategie
} from "./roles.js";
import {
  NIVEAU_PAR_DEFAUT, PLAFONDS_SCHEMA, chargerReglages, clesSurchargees, ecrireEtatContenu, ecrireFinances, ecrireParametre,
  ecrireSouscriptions, ecrireTheme, envAvecReglages, validerParametre
} from "./reglages.js";
import {
  FINANCES_PAR_DEFAUT, LIMITES_CONSOMMATION, MAX_SOUSCRIPTIONS, SOUSCRIPTION_GRATUITE, bornesLimites, decrireSouscription, validerFinances, validerSouscription
} from "./souscriptions.js";
import { BORNES_FINANCES, DEVISES, MODULES_COUT } from "../../web/admin/financier.js";
import { REGISTRE, controlerNonConservation, volumes } from "./donnees.js";
import { purgerTelemetrie, syntheseTelemetrie } from "./telemetrie.js";
import {
  LABEL_PROPOSITION, STATUTS_BROUILLON, TYPES_BROUILLON, corpsIssueBrouillon, inventaireCatalogue, validerBrouillon, versBrouillon
} from "./contenus.js";
import { supprimerCompte } from "./comptes.js";
import { effacerCompteLocal, genererMotDePasseProvisoire, remplacerMotDePasse } from "./compte-local.js";
import { donneesCompteLocal } from "./compte-local-acces.js";
import { cumulerRoles, ecrireAttribution, rolesManuels } from "./attributions.js";
import { chargerTarifsCloudflare, mesuresTelemetrie, tarifsCloudflareDisponibles } from "./tarifs-cloudflare.js";
import { creerOuCommenterIssue } from "./github.js";
import { THEMES, THEME_PERSONNALISE, contraste, couleursTheme, deriverVariables, validerTheme } from "../../web/theme.js";

export const PREFIXE_ADMIN = "/api/admin";
const TAILLE_MAX_CORPS = 64 * 1024;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** Règles d'injection qui interdisent un texte d'instructions : elles viseraient à lever le socle de sécurité. */
const MOTIFS_INTERDITS_INSTRUCTIONS = ["annulation-consignes", "nouvelles-consignes", "debridage", "changement-identite",
  "balise-role", "caracteres-invisibles", "charge-encodee", "balisage-actif", "exfiltration-lien"];

const json = (donnees, statut = 200) => new Response(JSON.stringify(donnees), {
  status: statut, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const erreur = (code, statut, details) => json(details ? { erreur: code, details } : { erreur: code }, statut);
const tenter = async (lire, defaut) => { try { return await lire(); } catch { return defaut; } };
const toutes = async (env, sql, ...valeurs) => (await env.DB.prepare(sql).bind(...valeurs).all()).results ?? [];
const jourDe = (instant) => new Date(instant).toISOString().slice(0, 10);
const entierBorne = (v, defaut, min, max) => { const n = Number(v); return Number.isInteger(n) ? Math.max(min, Math.min(max, n)) : defaut; };

export const estRouteAdmin = (chemin) => chemin === PREFIXE_ADMIN || chemin.startsWith(`${PREFIXE_ADMIN}/`);
/** Le back-office n'existe que si une clé d'au moins 32 caractères est configurée. */
export const backofficeDisponible = (env) => typeof env?.BACKOFFICE_JETON === "string" && env.BACKOFFICE_JETON.length >= 32 && !!env.DB;

async function empreinte(texte) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte)));
}

/** Compare la clé présentée à la clé configurée, en temps constant (comparaison de deux empreintes). */
export async function cleValide(env, requete) {
  const entete = requete.headers.get("authorization") || "";
  if (!entete.startsWith("Bearer ")) return false;
  const [a, b] = await Promise.all([empreinte(entete.slice(7)), empreinte(env.BACKOFFICE_JETON)]);
  let ecart = 0;
  for (let i = 0; i < a.length; i += 1) ecart |= a[i] ^ b[i];
  return ecart === 0;
}

async function lireCorps(requete) {
  const texte = await requete.text();
  if (texte.length > TAILLE_MAX_CORPS) return { erreur: erreur("corps-trop-grand", 413) };
  try {
    const corps = JSON.parse(texte);
    return corps && typeof corps === "object" ? { corps } : { erreur: erreur("json-invalide", 400) };
  } catch {
    return { erreur: erreur("json-invalide", 400) };
  }
}

async function noter(env, action, cible = "") {
  await tenter(() => env.DB.prepare("INSERT INTO journal_admin (acteur, action, cible) VALUES ('cle-partagee', ?, ?)").bind(action, String(cible).slice(0, 120)).run());
}

// ---------- Utilisateurs ----------

/** Comptes (200 plus récents de chaque type), ou le seul compte dont l'identifiant unique est `id` (recherche du support). */
async function listerUtilisateurs(env, { id = null } = {}) {
  const filtre = id ? "WHERE c.id = ?" : "";
  const valeurs = id ? [id] : [];
  const [comptes, locaux, attributions, etats, liens] = await Promise.all([
    tenter(() => toutes(env, `SELECT c.id, c.role, c.created_at, c.last_login_at, c.consent_version,
      (SELECT count(*) FROM eleves e WHERE e.parent_id = c.id) AS enfants FROM comptes c ${filtre} ORDER BY c.created_at DESC, c.rowid DESC LIMIT 200`, ...valeurs), []),
    tenter(() => toutes(env, `SELECT c.id, c.cree_le, c.bloque_jusqua, c.mdp_provisoire FROM comptes_locaux c ${filtre} ORDER BY c.cree_le DESC, c.rowid DESC LIMIT 200`, ...valeurs), []),
    tenter(() => toutes(env, "SELECT type_compte, compte_id, role_id, roles, niveau FROM attributions_roles"), null)
      .then((l) => l ?? tenter(() => toutes(env, "SELECT type_compte, compte_id, role_id, niveau FROM attributions_roles"), [])),
    tenter(() => toutes(env, "SELECT profil, etat, expire_le FROM profils_securite"), []),
    tenter(() => toutes(env, "SELECT enfant_id, parent_id FROM familles_liens"), [])
  ]);
  // Espace famille (ADR 0029) : rôle de chaque compte local dans sa famille, sans le prénom de l'enfant.
  const parentDe = new Map(liens.map((l) => [l.enfant_id, l.parent_id]));
  const enfantsDe = new Map();
  for (const l of liens) enfantsDe.set(l.parent_id, (enfantsDe.get(l.parent_id) ?? 0) + 1);
  const attribution = new Map(attributions.map((a) => [`${a.type_compte}:${a.compte_id}`, a]));
  const aujourdhui = jourDe(Date.now());
  const etat = new Map(etats.filter((e) => !e.expire_le || e.expire_le >= aujourdhui).map((e) => [e.profil, e.etat]));
  const reglages = await chargerReglages(env);
  const decrire = async (type, id, roleInitial) => {
    const a = attribution.get(`${type}:${id}`);
    const profil = await profilDuCompte(env, type, id);
    // Rôles cumulatifs (ADR 0034) : rôles attribués à la main, plus le rôle apporté par la souscription.
    const roles = rolesManuels(a ?? { role_id: roleInitial });
    const niveau = a?.niveau ?? NIVEAU_PAR_DEFAUT;
    const roleOffre = reglages.souscriptions.find((s) => s.id === niveau)?.role ?? null;
    return { type, id, role: roles[0], roles, roleOffre, rolesEffectifs: cumulerRoles(roles, roleOffre), niveau, profil, etat: etat.get(profil) ?? "normal" };
  };
  const utilisateurs = [];
  for (const c of comptes) {
    utilisateurs.push({ ...(await decrire("compte", c.id, c.role)), creeLe: c.created_at, derniereConnexion: c.last_login_at, enfants: c.enfants, consentement: c.consent_version });
  }
  const maintenant = Math.floor(Date.now() / 1000);
  for (const c of locaux) {
    utilisateurs.push({ ...(await decrire("compte-local", c.id, ROLE_PAR_DEFAUT)), creeLe: c.cree_le, bloque: c.bloque_jusqua > maintenant, provisoire: c.mdp_provisoire === 1,
      famille: parentDe.has(c.id) ? { role: "enfant", parent: parentDe.get(c.id) } : enfantsDe.has(c.id) ? { role: "parent", enfants: enfantsDe.get(c.id) } : null });
  }
  return utilisateurs;
}

const TABLE_COMPTE = { compte: "comptes", "compte-local": "comptes_locaux" };
const compteExiste = async (env, type, id) => !!(await tenter(() => env.DB.prepare(`SELECT 1 FROM ${TABLE_COMPTE[type]} WHERE id = ?`).bind(id).first(), null));

/**
 * Rôles (cumulatifs, ADR 0034) et souscription d'un compte. `roles` : liste de rôles (au moins un) ; `role` (un seul
 * rôle) reste accepté pour les clients précédents.
 */
async function modifierUtilisateur(env, type, id, corps, reglages) {
  if (!(await compteExiste(env, type, id))) return erreur("introuvable", 404);
  const connus = (await listerRoles(env)).map((r) => r.id);
  const demandes = Array.isArray(corps?.roles) ? corps.roles.map(String) : [String(corps?.role ?? "")];
  const roles = [...new Set(demandes)];
  if (!roles.length || roles.length > 8 || !roles.every((r) => connus.includes(r))) return erreur("role-inconnu", 400);
  const niveau = String(corps?.niveau ?? NIVEAU_PAR_DEFAUT);
  if (niveau !== NIVEAU_PAR_DEFAUT && !reglages.niveaux.some((n) => n.id === niveau)) return erreur("niveau-inconnu", 400);
  await ecrireAttribution(env, type, id, { roles, niveau });
  // La colonne historique `comptes.role` reste alignée sur le premier rôle permis par sa contrainte (ADR 0023).
  const historique = roles.find((r) => ROLES_HISTORIQUES.includes(r));
  if (type === "compte" && historique) await env.DB.prepare("UPDATE comptes SET role = ? WHERE id = ?").bind(historique, id).run();
  await noter(env, "utilisateur.role", `${type}:${id}:${roles.join("+")}:${niveau}`);
  return json({ ok: true });
}

async function supprimerUtilisateur(env, type, id) {
  if (!(await compteExiste(env, type, id))) return erreur("introuvable", 404);
  const profil = await profilDuCompte(env, type, id);
  if (type === "compte") await supprimerCompte(env, id);
  else {
    // Les données synchronisées ne sont reliées à aucun compte (ADR 0024) : elles expirent seules, illisibles.
    // Famille (ADR 0029) : liens, bilans, cahiers et consommations effacés avec le compte.
    await effacerCompteLocal(env, id);
  }
  await env.DB.prepare("DELETE FROM attributions_roles WHERE type_compte = ? AND compte_id = ?").bind(type, id).run();
  await tenter(() => env.DB.prepare("DELETE FROM souscriptions_changements WHERE type_compte = ? AND compte_id = ?").bind(type, id).run());
  if (profil) {
    await env.DB.prepare("DELETE FROM signaux_securite WHERE profil = ?").bind(profil).run();
    await env.DB.prepare("DELETE FROM profils_securite WHERE profil = ?").bind(profil).run();
  }
  await noter(env, "utilisateur.suppression", `${type}:${id}`);
  return json({ ok: true });
}

/**
 * Réinitialisation du mot de passe d'un compte local (ADR 0024 §3 bis) : le serveur tire un mot de passe provisoire,
 * le renvoie une seule fois (jamais journalisé ni stocké en clair), ferme les sessions du compte et lève son blocage.
 * Le compte doit le remplacer avant tout autre usage. La clé de synchronisation n'est pas touchée : l'administrateur
 * n'obtient aucun accès aux données synchronisées, qui restent chiffrées par un secret qu'il ne connaît pas.
 */
async function reinitialiserMotDePasse(env, id) {
  if (!(await compteExiste(env, "compte-local", id))) return erreur("introuvable", 404);
  const motDePasse = genererMotDePasseProvisoire();
  await remplacerMotDePasse(env, id, motDePasse, { provisoire: true });
  await noter(env, "utilisateur.mot-de-passe", `compte-local:${id}`);
  return json({ ok: true, motDePasse });
}

/** Droit d'accès : tout ce que la base contient sur un compte, tel quel. */
async function exporterUtilisateur(env, type, id) {
  if (!(await compteExiste(env, type, id))) return erreur("introuvable", 404);
  if (type === "compte-local") {
    // Même contenu que le libre-service « Ce que Kermiclab sait de moi » (ADR 0024 §3 ter).
    await noter(env, "utilisateur.export", `${type}:${id}`);
    return json(await donneesCompteLocal(env, id));
  }
  const profil = await profilDuCompte(env, type, id);
  const donnees = { type, id, exporteLe: new Date().toISOString() };
  donnees.compte = await env.DB.prepare("SELECT id, role, created_at, last_login_at, consent_at, consent_version FROM comptes WHERE id = ?").bind(id).first();
  donnees.fournisseurs = (await toutes(env, "SELECT provider FROM auth_providers WHERE compte_id = ?", id)).map((f) => f.provider);
  donnees.enfants = await toutes(env, "SELECT id, prenom_affiche, age_tranche, langue, consentement_version, consentement_at, created_at FROM eleves WHERE parent_id = ?", id);
  donnees.progression = await toutes(env, "SELECT eleve_id, notion_id, score, etoiles, completed_at, updated_at FROM progres WHERE eleve_id IN (SELECT id FROM eleves WHERE parent_id = ?)", id);
  donnees.contributions = await tenter(() => toutes(env, "SELECT id, notion_id, chemin, nature, type, texte_propose, motif, statut, created_at FROM contributions WHERE auteur_id = ?", id), []);
  donnees.attribution = await tenter(() => env.DB.prepare("SELECT role_id, roles, niveau, maj_le FROM attributions_roles WHERE type_compte = ? AND compte_id = ?").bind(type, id).first(), null);
  donnees.souscriptions = await tenter(() => toutes(env, "SELECT de, vers, paiement, change_le FROM souscriptions_changements WHERE type_compte = ? AND compte_id = ? ORDER BY id", type, id), []);
  donnees.securite = profil ? {
    etat: await tenter(() => env.DB.prepare("SELECT etat, motifs, decide_par, maj_le, expire_le FROM profils_securite WHERE profil = ?").bind(profil).first(), null),
    compteurs: await tenter(() => toutes(env, "SELECT jour, categorie, module, n FROM signaux_securite WHERE profil = ? ORDER BY jour", profil), [])
  } : null;
  await noter(env, "utilisateur.export", `${type}:${id}`);
  return json(donnees);
}

// ---------- Sécurité ----------

async function syntheseSecurite(env, jours) {
  const config = lireConfiguration(env);
  const depuis = jourDe(Date.now() - (jours - 1) * 86400000);
  const fenetre = jourDe(Date.now() - (FENETRE_JOURS - 1) * 86400000);
  const [parJour, parModule, lignes, etats] = await Promise.all([
    toutes(env, "SELECT jour, categorie, sum(n) AS n FROM signaux_securite WHERE jour >= ? GROUP BY jour, categorie ORDER BY jour", depuis),
    toutes(env, "SELECT module, categorie, sum(n) AS n FROM signaux_securite WHERE jour >= ? GROUP BY module, categorie ORDER BY module", depuis),
    toutes(env, "SELECT profil, jour, categorie, sum(n) AS n FROM signaux_securite WHERE jour >= ? AND profil != ? GROUP BY profil, jour, categorie", fenetre, PROFIL_ANONYME),
    toutes(env, "SELECT profil, etat, motifs, decide_par, maj_le, expire_le FROM profils_securite")
  ]);
  const compteurs = new Map();
  for (const { profil, categorie, n } of lignes) {
    const c = compteurs.get(profil) ?? { signaux: {}, requetesJourMax: 0, requetes: 0 };
    if (categorie === "requete") { c.requetesJourMax = Math.max(c.requetesJourMax, n); c.requetes += n; } else c.signaux[categorie] = (c.signaux[categorie] ?? 0) + n;
    compteurs.set(profil, c);
  }
  const aujourdhui = jourDe(Date.now());
  const decisions = new Map(etats.filter((e) => !e.expire_le || e.expire_le >= aujourdhui).map((e) => [e.profil, e]));
  const profils = [...new Set([...compteurs.keys(), ...decisions.keys()])].map((profil) => {
    const c = compteurs.get(profil) ?? { signaux: {}, requetesJourMax: 0, requetes: 0 };
    const evaluation = evaluerProfil(c, config);
    const decision = decisions.get(profil);
    return {
      profil, etat: decision?.etat ?? "normal", decidePar: decision?.decide_par ?? null, expireLe: decision?.expire_le ?? null,
      etatCalcule: evaluation.etat, score: evaluation.score, comportements: evaluation.comportements, requetes: c.requetes, signaux: c.signaux
    };
  }).filter((p) => p.etat !== "normal" || p.score > 0 || p.comportements.length)
    .sort((a, b) => ETATS.indexOf(b.etat) - ETATS.indexOf(a.etat) || b.score - a.score).slice(0, 100);
  return {
    jours, fenetreJours: FENETRE_JOURS, gardeFousActifs: config.GARDE_FOUS_ACTIFS, categories: CATEGORIES, comportements: LISTE_COMPORTEMENTS, etats: ETATS,
    seuils: { surveillance: config.SEUIL_SURVEILLANCE, restriction: config.SEUIL_RESTRICTION, consoElevee: config.SEUIL_CONSO_ELEVEE, surconsommation: config.SEUIL_SURCONSOMMATION },
    parJour, parModule, profils
  };
}

async function deciderProfil(env, profil, corps) {
  if (!ETATS.includes(corps?.etat)) return erreur("etat-invalide", 400);
  const jours = entierBorne(corps?.jours, 7, 1, 90);
  await env.DB.prepare(`INSERT INTO profils_securite (profil, etat, motifs, decide_par, maj_le, expire_le) VALUES (?, ?, '[]', 'admin', ?, ?)
    ON CONFLICT (profil) DO UPDATE SET etat = excluded.etat, decide_par = 'admin', maj_le = excluded.maj_le, expire_le = excluded.expire_le`)
    .bind(profil, corps.etat, jourDe(Date.now()), jourDe(Date.now() + jours * 86400000)).run();
  await noter(env, "securite.profil", `${profil}:${corps.etat}:${jours}j`);
  return json({ ok: true });
}

/** Banc d'essai : montre ce que l'analyse détecte et ce qui partirait vers un modèle. Rien n'est enregistré. */
function analyserEssai(corps) {
  const texte = String(corps?.texte ?? "").slice(0, 2000);
  const origine = corps?.origine === "contenu" ? "contenu" : "utilisateur";
  const analyse = analyserRequete(texte, { origine });
  return json({
    ...analyse, origine, apercuPseudonymise: pseudonymiser(texte).texte,
    conserve: analyse.categories.length ? analyse.categories.map((c) => `compteur « ${c} » + 1`) : ["compteur « requete » + 1"]
  });
}

// ---------- Données personnelles ----------

async function etatDonnees(env) {
  const config = lireConfiguration(env);
  return {
    registre: REGISTRE.map((t) => ({ ...t, conservation: Object.hasOwn(config, t.conservation) ? `${config[t.conservation]} jours` : t.conservation })),
    volumes: await volumes(env),
    controle: await controlerNonConservation(env),
    conservation: { signauxJours: config.CONSERVATION_SIGNAUX_JOURS, telemetrieJours: config.CONSERVATION_TELEMETRIE_JOURS }
  };
}

/** Purge de conservation (aussi lancée chaque jour par le cron) : signaux, états expirés et télémétrie anciens. */
export async function purgerBackoffice(env, maintenant = Date.now()) {
  if (!env?.DB) return null;
  const config = lireConfiguration(env);
  const signaux = await tenter(() => purgerSignaux(env, config.CONSERVATION_SIGNAUX_JOURS, maintenant), { signaux: 0, profils: 0 });
  const telemetrie = await tenter(() => purgerTelemetrie(env, config.CONSERVATION_TELEMETRIE_JOURS, maintenant), 0);
  return { ...signaux, telemetrie };
}

// ---------- Télémétrie ----------

async function etatTelemetrie(env, jours) {
  const depuis = new Date(Date.now() - jours * 86400000).toISOString().slice(0, 19).replace("T", " ");
  const [llm, parJour, refus, routages] = await Promise.all([
    syntheseTelemetrie(env, jours),
    tenter(() => toutes(env, "SELECT substr(horodatage, 1, 10) AS jour, type, count(*) AS n FROM evenements WHERE horodatage >= ? GROUP BY 1, 2 ORDER BY 1", depuis), []),
    tenter(() => toutes(env, "SELECT coalesce(detail, 'autre') AS motif, count(*) AS n FROM evenements WHERE type = 'refus' AND horodatage >= ? GROUP BY 1 ORDER BY 2 DESC", depuis), []),
    tenter(() => toutes(env, "SELECT coalesce(routage, 'sans') AS routage, count(*) AS n FROM evenements WHERE type IN ('maquette_servie', 'reponse') AND horodatage >= ? GROUP BY 1 ORDER BY 2 DESC", depuis), [])
  ]);
  return { jours, llm, requetes: { parJour, refus, routages } };
}

// ---------- Charte graphique ----------

function decrireTheme(theme) {
  const couleurs = couleursTheme(theme);
  const variables = deriverVariables(couleurs);
  return {
    theme, couleurs, variables,
    contrastes: {
      clair: { accentSurBlanc: contraste(variables.clair.accent, "#ffffff"), texteDoux: contraste(variables.clair["accent-doux-texte"], variables.clair["accent-doux"]) },
      sombre: { accentSurSurface: contraste(variables.sombre.accent, "#161a30"), texteDoux: contraste(variables.sombre["accent-doux-texte"], variables.sombre["accent-doux"]) }
    }
  };
}

// ---------- Contenus ----------

async function etatContenus(env, index, reglages) {
  const lignes = await toutes(env, "SELECT * FROM contenus_brouillons WHERE statut != 'archive' ORDER BY maj_le DESC LIMIT 200");
  return { catalogue: inventaireCatalogue(index, reglages), brouillons: lignes.map(versBrouillon), types: TYPES_BROUILLON, statuts: STATUTS_BROUILLON };
}

async function enregistrerBrouillon(env, id, corps, index) {
  const v = validerBrouillon(corps, { index });
  if (!v.ok) return erreur(v.code, 400, v.motifs ? { motifs: v.motifs } : undefined);
  if (id) {
    const existant = await env.DB.prepare("SELECT type, statut FROM contenus_brouillons WHERE id = ?").bind(id).first();
    if (!existant || existant.statut === "archive") return erreur("introuvable", 404);
    if (existant.type !== v.brouillon.type) return erreur("type-non-modifiable", 400);
    // Un texte modifié après proposition ou publication redevient un brouillon : il doit repasser en revue.
    await env.DB.prepare("UPDATE contenus_brouillons SET titre = ?, corps = ?, statut = 'brouillon', maj_le = datetime('now') WHERE id = ?")
      .bind(v.brouillon.titre, v.brouillon.corps, id).run();
    await noter(env, "contenu.brouillon.modification", `${v.brouillon.type}:${id}`);
    return json({ id });
  }
  const nouveau = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO contenus_brouillons (id, type, titre, corps) VALUES (?, ?, ?, ?)")
    .bind(nouveau, v.brouillon.type, v.brouillon.titre, v.brouillon.corps).run();
  await noter(env, "contenu.brouillon.creation", `${v.brouillon.type}:${nouveau}`);
  return json({ id: nouveau }, 201);
}

async function actionBrouillon(env, id, action, { fetchImpl } = {}) {
  const b = await env.DB.prepare("SELECT * FROM contenus_brouillons WHERE id = ?").bind(id).first();
  if (!b || b.statut === "archive") return erreur("introuvable", 404);
  const passer = async (statut, issue = b.issue_numero) => {
    await env.DB.prepare("UPDATE contenus_brouillons SET statut = ?, issue_numero = ?, maj_le = datetime('now') WHERE id = ?").bind(statut, issue ?? null, id).run();
    await noter(env, `contenu.${action}`, `${b.type}:${id}`);
    return json({ ok: true, statut, issue: issue ?? null });
  };
  if (action === "archiver") return passer("archive");
  // Un parcours ne contient que des contenus déjà publiés : il se publie directement.
  if (action === "publier") return b.type === "parcours" ? passer("publie") : erreur("publication-par-pr", 409);
  if (action === "depublier") return b.statut === "publie" ? passer("brouillon") : erreur("non-publie", 409);
  if (action === "proposer") {
    if (b.type === "parcours") return erreur("parcours-sans-revue", 409);
    let issue;
    try {
      issue = await creerOuCommenterIssue(env, { label: LABEL_PROPOSITION, sujet: `${b.type} · ${b.titre}`, corps: corpsIssueBrouillon(b) }, fetchImpl);
    } catch {
      return erreur("github-indisponible", 502);
    }
    if (issue.action === "desactive") return erreur("github-non-configure", 503);
    return passer("propose", issue.numero);
  }
  return erreur("action-inconnue", 400);
}

// ---------- Harness ----------

function etatHarness(envEffectif, reglages) {
  const config = lireConfiguration(envEffectif);
  return {
    configuration: configurationAdmin(envEffectif),
    surcharges: clesSurchargees(reglages),
    plafondsSchema: PLAFONDS_SCHEMA,
    skills: Object.entries(SKILLS).map(([id, s]) => ({ id, module: s.module, version: s.version, prompt: s.prompt, perimetre: s.perimetre, actif: config.LLM_ACTIF && config.SKILLS_ACTIFS.includes(id) }))
  };
}

// ---------- Souscriptions et financier (ADR 0031) ----------

async function etatSouscriptions(env, envEffectif, reglages) {
  const config = lireConfiguration(envEffectif);
  const attributions = await tenter(() => toutes(env, "SELECT niveau, count(*) AS n FROM attributions_roles GROUP BY niveau"), []);
  const comptes = new Map(attributions.map((a) => [a.niveau, a.n]));
  return {
    controleActif: config.CONTROLE_ACCES_ACTIF,
    parDefaut: reglages.souscriptionsParDefaut,
    souscriptions: reglages.souscriptions.map((s) => ({ ...decrireSouscription(s, envEffectif, reglages.finances), comptes: comptes.get(s.id) ?? 0 })),
    finances: reglages.finances,
    financesParDefaut: FINANCES_PAR_DEFAUT,
    roles: (await listerRoles(env)).map(({ id, libelle, permissions }) => ({ id, libelle, permissions: permissions.filter((p) => FONCTIONNALITES.includes(p)) })),
    fonctionnalites: FONCTIONNALITES,
    bornes: { limites: bornesLimites(), finances: BORNES_FINANCES },
    plafondsSchema: PLAFONDS_SCHEMA,
    tokensParGeneration: { defi: config.MAX_TOKENS_DEFI, cahiers: config.MAX_TOKENS_CAHIERS },
    modulesCout: MODULES_COUT,
    devises: DEVISES,
    max: MAX_SOUSCRIPTIONS,
    // ADR 0034 : chargement des tarifs du catalogue Cloudflare possible ? Consommation mesurée sur 30 jours.
    tarifsCloudflare: tarifsCloudflareDisponibles(env),
    telemetrie: await mesuresTelemetrie(env, 30)
  };
}

async function enregistrerSouscription(env, id, corps, reglages) {
  const roles = (await listerRoles(env)).map((r) => r.id);
  const v = validerSouscription(id, corps, { roles });
  if (!v.ok) return erreur(v.code, 400);
  if (id === SOUSCRIPTION_GRATUITE) {
    // « Gratuit » (ADR 0034) : ses limites de consommation sont les paramètres du registre, appliqués à tous ; elles y
    // sont écrites, avec les mêmes bornes que dans Harness (plafonds de la table de quota compris).
    const ecritures = [];
    for (const [champ, cle] of Object.entries(LIMITES_CONSOMMATION)) {
      if (v.souscription.limites[champ] === undefined) continue;
      const p = validerParametre(cle, v.souscription.limites[champ]);
      if (!p.ok) return erreur(`hors-bornes:${champ}`, 400);
      ecritures.push([cle, p.valeur]);
      delete v.souscription.limites[champ];
    }
    for (const [cle, valeur] of ecritures) await ecrireParametre(env, cle, valeur);
  }
  const liste = reglages.souscriptions.filter((s) => s.id !== id);
  const position = reglages.souscriptions.findIndex((s) => s.id === id);
  if (position < 0 && liste.length >= MAX_SOUSCRIPTIONS) return erreur("trop-de-souscriptions", 409);
  liste.splice(position < 0 ? liste.length : position, 0, v.souscription);
  await ecrireSouscriptions(env, liste);
  await noter(env, position < 0 ? "souscription.creation" : "souscription.modification", id);
  return json({ ok: true }, position < 0 ? 201 : 200);
}

async function supprimerSouscription(env, id, reglages) {
  if (id === SOUSCRIPTION_GRATUITE) return erreur("souscription-gratuite", 409);
  if (!reglages.souscriptions.some((s) => s.id === id)) return erreur("introuvable", 404);
  const utilise = await env.DB.prepare("SELECT count(*) AS n FROM attributions_roles WHERE niveau = ?").bind(id).first();
  if (utilise?.n) return erreur("niveau-attribue", 409);
  await ecrireSouscriptions(env, reglages.souscriptions.filter((s) => s.id !== id));
  await noter(env, "souscription.suppression", id);
  return json({ ok: true });
}

async function modifierParametres(env, corps) {
  const saisies = corps?.valeurs && typeof corps.valeurs === "object" ? Object.entries(corps.valeurs) : [];
  if (!saisies.length || saisies.length > 40) return erreur("valeurs-requises", 400);
  const valides = [];
  const refus = {};
  for (const [cle, brut] of saisies) {
    const v = validerParametre(cle, brut);
    if (!v.ok) { refus[cle] = v.code; continue; }
    if (parametreDuRegistre(cle).type === "texte" && v.valeur) {
      // Instructions d'un harness : jamais de donnée personnelle, ni de consigne qui lèverait le socle de sécurité.
      const analyse = analyserRequete(v.valeur, { origine: "contenu" });
      if (analyse.categories.includes("donnees-personnelles")) { refus[cle] = "donnees-personnelles"; continue; }
      if (analyse.motifs.some((m) => MOTIFS_INTERDITS_INSTRUCTIONS.includes(m))) { refus[cle] = "contraire-au-socle"; continue; }
    }
    valides.push([cle, v.valeur]);
  }
  // Tout ou rien : une saisie refusée n'enregistre rien.
  if (Object.keys(refus).length) return erreur("valeurs-refusees", 400, refus);
  for (const [cle, valeur] of valides) {
    await ecrireParametre(env, cle, valeur);
    await noter(env, valeur === null ? "parametre.retour-defaut" : "parametre.modification", cle);
  }
  return json({ ok: true, modifies: valides.map(([cle]) => cle) });
}

// ---------- Routage ----------

/**
 * Traite une route du back-office. `contexte` : `{ index, autoriser, ip, fetchImpl }`.
 * @returns {Promise<Response>}
 */
export async function gererApiAdmin(requete, env, { index, autoriser = () => true, ip = "inconnue", fetchImpl } = {}) {
  if (!backofficeDisponible(env)) return erreur("back-office-non-configure", 503);
  // Anti force brute sur la clé : les essais sont limités par IP, en mémoire, sans IP stockée.
  if (!(await cleValide(env, requete))) return autoriser(ip) ? erreur("cle-invalide", 401) : erreur("trop-de-tentatives", 429);

  const url = new URL(requete.url);
  const chemin = url.pathname.slice(PREFIXE_ADMIN.length) || "/";
  const methode = requete.method;
  const est = (m, c) => methode === m && chemin === c;
  const reglages = await chargerReglages(env);
  const envEffectif = envAvecReglages(env, reglages);
  const corps = async () => lireCorps(requete);
  let m;

  if (est("GET", "/etat")) {
    const config = lireConfiguration(envEffectif);
    const migration = !!(await tenter(() => env.DB.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'reglages'").bind().first(), null));
    return json({ ok: true, migration, llmActif: config.LLM_ACTIF, controleAcces: config.CONTROLE_ACCES_ACTIF, gardeFous: config.GARDE_FOUS_ACTIFS, contenus: index.maquettes.length });
  }

  if (est("GET", "/utilisateurs")) {
    const id = url.searchParams.get("id");
    if (id !== null && !new RegExp(`^${UUID}$`).test(id)) return erreur("identifiant-invalide", 400);
    return json({ utilisateurs: await listerUtilisateurs(env, { id }), roles: await listerRoles(env), niveaux: [NIVEAU_PAR_DEFAUT, ...reglages.niveaux.map((n) => n.id)] });
  }
  if ((m = chemin.match(new RegExp(`^/utilisateurs/compte-local/(${UUID})/mot-de-passe$`)))) {
    return methode === "POST" ? reinitialiserMotDePasse(env, m[1]) : erreur("methode-non-autorisee", 405);
  }
  if ((m = chemin.match(new RegExp(`^/utilisateurs/(compte|compte-local)/(${UUID})(/export)?$`)))) {
    const [, type, id, exporter] = m;
    if (exporter) return methode === "GET" ? exporterUtilisateur(env, type, id) : erreur("methode-non-autorisee", 405);
    if (methode === "DELETE") return supprimerUtilisateur(env, type, id);
    if (methode === "PATCH") { const c = await corps(); return c.erreur ?? modifierUtilisateur(env, type, id, c.corps, reglages); }
    return erreur("methode-non-autorisee", 405);
  }

  if (est("GET", "/roles")) {
    return json({ roles: await listerRoles(env), permissions: { fonctionnalites: FONCTIONNALITES, administration: PERMISSIONS_ADMIN }, controleActif: lireConfiguration(envEffectif).CONTROLE_ACCES_ACTIF });
  }
  if ((m = chemin.match(/^\/roles\/([a-z0-9-]{1,31})$/))) {
    if (methode === "PUT") {
      const c = await corps();
      if (c.erreur) return c.erreur;
      const v = validerRole(m[1], c.corps);
      if (!v.ok) return erreur(v.code, 400);
      await env.DB.prepare(`INSERT INTO roles (id, libelle, description, permissions, maj_le) VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT (id) DO UPDATE SET libelle = excluded.libelle, description = excluded.description, permissions = excluded.permissions, maj_le = excluded.maj_le`)
        .bind(v.role.id, v.role.libelle, v.role.description, JSON.stringify(v.role.permissions)).run();
      await noter(env, "role.enregistrement", v.role.id);
      return json({ ok: true });
    }
    if (methode === "DELETE") {
      // Rôle système : seule sa surcharge est retirée. Rôle personnalisé encore attribué : refus.
      if (!Object.hasOwn(ROLES_SYSTEME, m[1])) {
        // Rôle attribué, seul ou cumulé (ADR 0034).
        const utilise = await env.DB.prepare("SELECT count(*) AS n FROM attributions_roles WHERE role_id = ? OR roles LIKE ?").bind(m[1], `%"${m[1]}"%`).first();
        if (utilise?.n) return erreur("role-attribue", 409);
        if (reglages.souscriptions.some((s) => s.role === m[1])) return erreur("role-dans-souscription", 409);
      }
      await env.DB.prepare("DELETE FROM roles WHERE id = ?").bind(m[1]).run();
      await noter(env, "role.suppression", m[1]);
      return json({ ok: true });
    }
    return erreur("methode-non-autorisee", 405);
  }

  if (est("GET", "/strategies")) {
    return json({ strategies: await listerStrategies(env), controleActif: lireConfiguration(envEffectif).CONTROLE_ACCES_ACTIF });
  }
  if (est("POST", "/strategies/simuler")) {
    const c = await corps();
    if (c.erreur) return c.erreur;
    const [strategies, roles] = await Promise.all([listerStrategies(env), listerRoles(env)]);
    // Un ou plusieurs rôles cumulés (ADR 0034) ; le rôle de la souscription s'y ajoute dans la décision.
    const rolesSimules = (Array.isArray(c.corps.roles) && c.corps.roles.length ? c.corps.roles : [c.corps.role ?? ROLE_PAR_DEFAUT]).map(String).slice(0, 8);
    const sujet = { role: rolesSimules[0], roles: rolesSimules, niveau: String(c.corps.niveau ?? NIVEAU_PAR_DEFAUT) };
    // Simulation : la décision telle qu'elle serait rendue contrôle activé, à côté de la décision en vigueur.
    const actif = Object.create(envEffectif);
    actif.CONTROLE_ACCES_ACTIF = "true";
    return json({
      ...sujet,
      decisions: FONCTIONNALITES.map((fonctionnalite) => ({
        fonctionnalite,
        enVigueur: accesAutorise(envEffectif, { fonctionnalite, ...sujet }, { strategies, roles, souscriptions: reglages.souscriptions }),
        siControleActif: accesAutorise(actif, { fonctionnalite, ...sujet }, { strategies, roles, souscriptions: reglages.souscriptions })
      }))
    });
  }
  if ((m = chemin.match(/^\/strategies\/([a-z.]{1,40})$/)) && methode === "PUT") {
    const c = await corps();
    if (c.erreur) return c.erreur;
    const v = validerStrategie(m[1], c.corps, { roles: (await listerRoles(env)).map((r) => r.id), niveaux: [NIVEAU_PAR_DEFAUT, ...reglages.niveaux.map((n) => n.id)] });
    if (!v.ok) return erreur(v.code, 400);
    const s = v.strategie;
    await env.DB.prepare(`INSERT INTO strategies_acces (fonctionnalite, mode, roles, niveaux, maj_le) VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT (fonctionnalite) DO UPDATE SET mode = excluded.mode, roles = excluded.roles, niveaux = excluded.niveaux, maj_le = excluded.maj_le`)
      .bind(s.fonctionnalite, s.mode, JSON.stringify(s.roles), JSON.stringify(s.niveaux)).run();
    await noter(env, "strategie.enregistrement", `${s.fonctionnalite}:${s.mode}`);
    return json({ ok: true });
  }

  if (est("GET", "/securite")) return json(await syntheseSecurite(envEffectif, entierBorne(url.searchParams.get("jours"), 7, 1, 90)));
  if (est("POST", "/securite/analyser")) { const c = await corps(); return c.erreur ?? analyserEssai(c.corps); }
  if ((m = chemin.match(/^\/securite\/profils\/([0-9a-f]{20})$/)) && methode === "PUT") {
    const c = await corps();
    return c.erreur ?? deciderProfil(env, m[1], c.corps);
  }

  if (est("GET", "/donnees")) return json(await etatDonnees(envEffectif));
  if (est("POST", "/donnees/purger")) {
    const resultat = await purgerBackoffice(envEffectif);
    await noter(env, "donnees.purge");
    return json({ ok: true, efface: resultat });
  }

  if (est("GET", "/telemetrie")) return json(await etatTelemetrie(env, entierBorne(url.searchParams.get("jours"), 7, 1, 90)));

  if (est("GET", "/theme")) {
    return json({
      ...decrireTheme(reglages.theme),
      themes: Object.entries(THEMES).map(([id, t]) => ({ id, libelle: t.libelle, accent: t.accent, secondaire: t.secondaire })),
      personnalise: THEME_PERSONNALISE
    });
  }
  if (est("POST", "/theme/apercu") || est("PUT", "/theme")) {
    const c = await corps();
    if (c.erreur) return c.erreur;
    const v = validerTheme(c.corps);
    if (!v.ok) return erreur(v.code, 400);
    if (methode === "PUT") {
      await ecrireTheme(env, v.theme);
      await noter(env, "theme.enregistrement", v.theme.id);
    }
    return json(decrireTheme(v.theme));
  }

  if (est("GET", "/contenus")) return json(await etatContenus(env, index, reglages));
  if ((m = chemin.match(/^\/contenus\/etats\/([a-z0-9][a-z0-9-]{0,79})$/)) && methode === "PUT") {
    if (!index.maquettes.some((x) => x.id === m[1])) return erreur("introuvable", 404);
    const c = await corps();
    if (c.erreur) return c.erreur;
    if (typeof c.corps.enLigne !== "boolean" || typeof c.corps.enAvant !== "boolean") return erreur("etat-invalide", 400);
    await ecrireEtatContenu(env, m[1], c.corps);
    await noter(env, "contenu.etat", `${m[1]}:${c.corps.enLigne ? "en-ligne" : "masque"}${c.corps.enAvant ? ":en-avant" : ""}`);
    return json({ ok: true });
  }
  if (est("POST", "/contenus/brouillons")) { const c = await corps(); return c.erreur ?? enregistrerBrouillon(env, null, c.corps, index); }
  if ((m = chemin.match(new RegExp(`^/contenus/brouillons/(${UUID})(?:/(proposer|publier|depublier|archiver))?$`)))) {
    if (m[2]) return methode === "POST" ? actionBrouillon(env, m[1], m[2], { fetchImpl }) : erreur("methode-non-autorisee", 405);
    if (methode === "PUT") { const c = await corps(); return c.erreur ?? enregistrerBrouillon(env, m[1], c.corps, index); }
    return erreur("methode-non-autorisee", 405);
  }

  if (est("GET", "/harness")) return json(etatHarness(envEffectif, reglages));
  if (est("PUT", "/harness/parametres")) { const c = await corps(); return c.erreur ?? modifierParametres(env, c.corps); }

  if (est("GET", "/souscriptions")) return json(await etatSouscriptions(env, envEffectif, reglages));
  if ((m = chemin.match(/^\/souscriptions\/([a-z][a-z0-9-]{1,20})$/))) {
    if (methode === "PUT") { const c = await corps(); return c.erreur ?? enregistrerSouscription(env, m[1], c.corps, reglages); }
    if (methode === "DELETE") return supprimerSouscription(env, m[1], reglages);
    return erreur("methode-non-autorisee", 405);
  }
  if (est("POST", "/finances/tarifs-cloudflare")) {
    // Aperçu seulement : les tarifs chargés remplissent le formulaire ; « Enregistrer les hypothèses » les garde.
    if (!tarifsCloudflareDisponibles(env)) return erreur("tarifs-cloudflare-non-configures", 503);
    const c = await corps();
    if (c.erreur) return c.erreur;
    const resultat = await chargerTarifsCloudflare(env, c.corps?.modeles ?? {}, { fetchImpl: fetchImpl ?? fetch });
    await noter(env, "finances.tarifs-cloudflare");
    return json(resultat);
  }
  if (est("PUT", "/finances")) {
    const c = await corps();
    if (c.erreur) return c.erreur;
    if (c.corps.reinitialiser === true) {
      await ecrireFinances(env, null);
      await noter(env, "finances.reinitialisation");
      return json({ ok: true });
    }
    const v = validerFinances(c.corps.finances);
    if (!v.ok) return erreur(v.code, 400);
    await ecrireFinances(env, v.finances);
    await noter(env, "finances.enregistrement");
    return json({ ok: true });
  }

  if (est("GET", "/journal")) {
    return json({ entrees: await toutes(env, "SELECT horodatage, acteur, action, cible FROM journal_admin ORDER BY id DESC LIMIT ?", entierBorne(url.searchParams.get("limite"), 100, 1, 500)) });
  }
  return erreur("introuvable", 404);
}
