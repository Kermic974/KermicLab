// Rôles, permissions et stratégies d'accès (ADR 0026). Le modèle est prêt et administrable ; il n'est PAS appliqué
// aux fonctionnalités pendant la bêta : tant que CONTROLE_ACCES_ACTIF vaut false, `accesAutorise` répond toujours oui.
import { lireConfiguration } from "./configuration.js";

/** Fonctionnalités du site soumises à une stratégie d'accès. */
export const FONCTIONNALITES = Object.freeze([
  "chat", "ia.tuteur", "ia.defi", "ia.cahiers", "ia.idees", "jeux", "cahiers", "defi",
  "contributions.proposer", "contributions.relire", "famille", "synchronisation", "professeur"
]);

/** Permissions d'administration : une par écran du back-office. */
export const PERMISSIONS_ADMIN = Object.freeze([
  "admin.utilisateurs", "admin.roles", "admin.securite", "admin.donnees", "admin.telemetrie",
  "admin.theme", "admin.contenus", "admin.harness"
]);
export const PERMISSIONS = Object.freeze([...FONCTIONNALITES, ...PERMISSIONS_ADMIN]);

const BASE = ["chat", "ia.tuteur", "ia.defi", "ia.cahiers", "ia.idees", "jeux", "cahiers", "defi", "synchronisation"];

/** Rôles système : toujours présents, non supprimables. Une ligne de la table `roles` peut surcharger leurs permissions. */
export const ROLES_SYSTEME = Object.freeze({
  visiteur: { libelle: "Visiteur", description: "Sans compte : pseudo gardé dans le navigateur.", permissions: BASE },
  "beta-testeur": { libelle: "Bêta-testeur", description: "Compte invité pendant la phase de test.", permissions: [...BASE, "famille", "contributions.proposer"] },
  parent: { libelle: "Parent", description: "Compte famille : profils des enfants et progression.", permissions: [...BASE, "famille"] },
  contributeur: { libelle: "Contributeur", description: "Propose des corrections et des ajouts de contenu.", permissions: [...BASE, "famille", "contributions.proposer"] },
  prof: { libelle: "Professeur", description: "Relit et valide les contributions, gère ses classes et suit ses élèves.", permissions: [...BASE, "famille", "contributions.proposer", "contributions.relire", "professeur"] },
  admin: { libelle: "Administrateur", description: "Accès complet, back-office compris.", permissions: [...PERMISSIONS] }
});
export const ROLE_PAR_DEFAUT = "visiteur";
/** Rôles acceptés par la colonne historique `comptes.role` (contrainte CHECK du schéma des comptes). */
export const ROLES_HISTORIQUES = Object.freeze(["parent", "contributeur", "prof", "admin"]);

const ID_ROLE = /^[a-z][a-z0-9-]{1,30}$/;
const texteCourt = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const permissionsValides = (liste) => [...new Set((Array.isArray(liste) ? liste : []).filter((p) => PERMISSIONS.includes(p)))];
const lireListe = (json) => { try { const l = JSON.parse(json); return Array.isArray(l) ? l : []; } catch { return []; } };

/** Valide la saisie d'un rôle (création ou modification). */
export function validerRole(id, corps) {
  if (!ID_ROLE.test(String(id))) return { ok: false, code: "identifiant-invalide" };
  const libelle = texteCourt(corps?.libelle, 40);
  if (!libelle) return { ok: false, code: "libelle-requis" };
  return { ok: true, role: { id, libelle, description: texteCourt(corps?.description, 200), permissions: permissionsValides(corps?.permissions) } };
}

/** Rôles effectifs : rôles système (éventuellement surchargés) puis rôles personnalisés. */
export async function listerRoles(env) {
  const { results } = await env.DB.prepare("SELECT id, libelle, description, permissions FROM roles ORDER BY id").bind().all();
  const lignes = new Map((results ?? []).map((r) => [r.id, r]));
  const roles = Object.entries(ROLES_SYSTEME).map(([id, r]) => {
    const surcharge = lignes.get(id);
    lignes.delete(id);
    return { id, systeme: true, libelle: r.libelle, description: r.description, permissions: surcharge ? permissionsValides(lireListe(surcharge.permissions)) : [...r.permissions], modifie: !!surcharge };
  });
  for (const r of lignes.values()) {
    roles.push({ id: r.id, systeme: false, libelle: r.libelle, description: r.description, permissions: permissionsValides(lireListe(r.permissions)), modifie: true });
  }
  return roles;
}

/**
 * Le rôle donne-t-il accès à au moins un écran du back-office ? Sert seulement à afficher un lien dans le profil :
 * le back-office reste fermé sans sa clé (ADR 0026). Si la table `roles` est absente, les rôles système s'appliquent.
 */
export async function roleAccedeAuBackOffice(env, role) {
  if (typeof role !== "string") return false;
  let permissions;
  try { permissions = (await listerRoles(env)).find((r) => r.id === role)?.permissions; }
  catch { permissions = ROLES_SYSTEME[role]?.permissions; }
  return (permissions ?? []).some((p) => PERMISSIONS_ADMIN.includes(p));
}

/** Stratégies effectives : une par fonctionnalité, « tous » par défaut. */
export async function listerStrategies(env) {
  const { results } = await env.DB.prepare("SELECT fonctionnalite, mode, roles, niveaux FROM strategies_acces").bind().all();
  const lignes = new Map((results ?? []).map((r) => [r.fonctionnalite, r]));
  return FONCTIONNALITES.map((fonctionnalite) => {
    const l = lignes.get(fonctionnalite);
    return { fonctionnalite, mode: l?.mode ?? "tous", roles: l ? lireListe(l.roles) : [], niveaux: l ? lireListe(l.niveaux) : [] };
  });
}

/** Valide la saisie d'une stratégie d'accès. */
export function validerStrategie(fonctionnalite, corps, { roles = [], niveaux = [] } = {}) {
  if (!FONCTIONNALITES.includes(fonctionnalite)) return { ok: false, code: "fonctionnalite-inconnue" };
  if (!["tous", "roles", "personne"].includes(corps?.mode)) return { ok: false, code: "mode-invalide" };
  const garder = (liste, connus) => [...new Set((Array.isArray(liste) ? liste : []).filter((v) => connus.includes(v)))];
  return { ok: true, strategie: { fonctionnalite, mode: corps.mode, roles: garder(corps.roles, roles), niveaux: garder(corps.niveaux, niveaux) } };
}

/**
 * Décision d'accès à une fonctionnalité. Fonction pure.
 * Pendant la bêta (`CONTROLE_ACCES_ACTIF` à false), l'accès est toujours accordé : « réglage = tous les utilisateurs ».
 * Contrôle activé : permission du rôle, puis fonctionnalités de la souscription du compte, puis stratégie.
 * @returns {{ autorise: boolean, raison: string }}
 */
export function accesAutorise(env, { fonctionnalite, role = ROLE_PAR_DEFAUT, niveau = "gratuit" }, { strategies = [], roles = [], souscriptions = [] } = {}) {
  if (!lireConfiguration(env).CONTROLE_ACCES_ACTIF) return { autorise: true, raison: "controle-inactif" };
  const strategie = strategies.find((s) => s.fonctionnalite === fonctionnalite) ?? { mode: "tous", roles: [], niveaux: [] };
  if (strategie.mode === "personne") return { autorise: false, raison: "fonctionnalite-fermee" };
  const definition = roles.find((r) => r.id === role);
  if (!definition) return { autorise: false, raison: "role-inconnu" };
  if (!definition.permissions.includes(fonctionnalite)) return { autorise: false, raison: "permission-absente" };
  // Souscription (ADR 0031) : le rôle dit ce qu'un utilisateur peut faire, l'offre ce qu'elle inclut. Les deux comptent.
  const offre = souscriptions.find((s) => s.id === niveau);
  if (offre && !offre.fonctionnalites.includes(fonctionnalite)) return { autorise: false, raison: "hors-souscription" };
  if (strategie.mode === "tous") return { autorise: true, raison: "ouverte-a-tous" };
  const parRole = strategie.roles.includes(role);
  const parNiveau = strategie.niveaux.includes(niveau);
  return parRole || parNiveau ? { autorise: true, raison: parRole ? "role-autorise" : "niveau-autorise" } : { autorise: false, raison: "strategie" };
}
