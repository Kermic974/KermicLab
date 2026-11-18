// Rôles cumulatifs et souscription d'un compte (ADR 0034). Un compte peut cumuler plusieurs rôles attribués à la main
// (back-office) ; sa souscription y ajoute son propre rôle. Les permissions effectives sont l'union des permissions de
// ces rôles. Une seule lecture pour tous les modules (Espace famille, Professeur, contributions, back-office).
import { ROLES_SYSTEME, ROLE_PAR_DEFAUT, listerRoles } from "./roles.js";
import { NIVEAU_PAR_DEFAUT, chargerReglages } from "./reglages.js";

const FORMAT_ROLE = /^[a-z][a-z0-9-]{1,30}$/;
const lireListe = (json) => { try { const l = JSON.parse(json); return Array.isArray(l) ? l : []; } catch { return []; } };

/**
 * Rôles attribués à la main d'une ligne `attributions_roles` : la liste `roles` (migration 0009), à défaut `role_id`.
 * Jamais vide : sans attribution, le rôle par défaut.
 */
export function rolesManuels(ligne) {
  const liste = [...new Set(lireListe(ligne?.roles).filter((r) => typeof r === "string" && FORMAT_ROLE.test(r)))];
  if (liste.length) return liste;
  return [typeof ligne?.role_id === "string" && FORMAT_ROLE.test(ligne.role_id) ? ligne.role_id : ROLE_PAR_DEFAUT];
}

/**
 * Rôles effectifs : rôles manuels, puis rôle de la souscription s'il n'y est pas déjà. Le rôle par défaut (« visiteur »)
 * s'efface dès qu'un autre rôle est présent : il ne retire rien, il n'apporte que le socle déjà inclus partout.
 */
export function cumulerRoles(manuels, roleOffre) {
  const roles = [...new Set([...manuels, ...(roleOffre ? [roleOffre] : [])])];
  const utiles = roles.filter((r) => r !== ROLE_PAR_DEFAUT);
  return utiles.length ? utiles : [ROLE_PAR_DEFAUT];
}

/** Union des permissions de plusieurs rôles (définitions effectives du back-office, ou rôles système à défaut). */
export function permissionsCumulees(roles, definitions) {
  const parId = new Map((definitions ?? []).map((d) => [d.id, d.permissions]));
  return [...new Set(roles.flatMap((r) => parId.get(r) ?? ROLES_SYSTEME[r]?.permissions ?? []))];
}

/**
 * Rôles, souscription et permissions d'un compte. Tolérant : sans table ni ligne, le compte est un visiteur gratuit.
 * @returns {Promise<{ manuels: string[], niveau: string, roleOffre: string | null, roles: string[], permissions: string[] }>}
 */
export async function attributionDuCompte(env, type, compteId, { reglages } = {}) {
  let ligne = null;
  try {
    ligne = await env.DB.prepare("SELECT role_id, roles, niveau FROM attributions_roles WHERE type_compte = ? AND compte_id = ?").bind(type, compteId).first();
  } catch {
    // Colonne `roles` absente (migration 0009 non appliquée) : lecture historique.
    try { ligne = await env.DB.prepare("SELECT role_id, niveau FROM attributions_roles WHERE type_compte = ? AND compte_id = ?").bind(type, compteId).first(); }
    catch { ligne = null; }
  }
  const manuels = rolesManuels(ligne);
  const niveau = typeof ligne?.niveau === "string" ? ligne.niveau : NIVEAU_PAR_DEFAUT;
  let souscriptions = [];
  try { souscriptions = (reglages ?? await chargerReglages(env)).souscriptions; } catch { souscriptions = []; }
  const roleOffre = souscriptions.find((s) => s.id === niveau)?.role ?? null;
  const roles = cumulerRoles(manuels, roleOffre);
  let definitions = null;
  try { definitions = await listerRoles(env); } catch { definitions = null; }
  return { manuels, niveau, roleOffre, roles, permissions: permissionsCumulees(roles, definitions) };
}

/** Le compte local a-t-il la permission demandée, par l'un de ses rôles cumulés ? */
export async function compteLocalPermet(env, compteId, permission) {
  return (await attributionDuCompte(env, "compte-local", compteId)).permissions.includes(permission);
}

/**
 * Écrit les rôles manuels et (facultatif) le niveau d'un compte. `role_id` reçoit le premier rôle, pour la version
 * précédente du Worker et la colonne historique `comptes.role`.
 */
export async function ecrireAttribution(env, type, compteId, { roles, niveau }) {
  const premier = roles[0] ?? ROLE_PAR_DEFAUT;
  await env.DB.prepare(`INSERT INTO attributions_roles (type_compte, compte_id, role_id, roles, niveau, maj_le) VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT (type_compte, compte_id) DO UPDATE SET role_id = excluded.role_id, roles = excluded.roles, niveau = excluded.niveau, maj_le = excluded.maj_le`)
    .bind(type, compteId, premier, JSON.stringify(roles), niveau ?? NIVEAU_PAR_DEFAUT).run();
}
