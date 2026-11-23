// Journal de relecture humaine (ADR 0039). Append-only : une confirmation ajoute une ligne.
// Réservé à un compte authentifié dont le rôle de relecteur a été attribué à la main (prof, admin, ou rôle
// personnalisé portant la permission). La clé du back-office et un jeton machine ne passent pas par ici.
// La version, l'empreinte du contenu et l'horodatage viennent du serveur, jamais du navigateur.
import { rolesManuels } from "./attributions.js";
import { ROLES_SYSTEME, listerRoles } from "./roles.js";
import { donneesPersonnelles } from "./moderation.js";
import {
  codeRelecteur, empreinteContenu, grilleDeSujet, roleRelecteurManuel, statutDe, validerSaisie
} from "../../web/relectures.js";

export const MAX_LISTE = 200;
const TAILLE_MAX_CORPS = 8 * 1024;
const ID_NOTION = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ESSAIS_PAR_MINUTE = 30;
const essais = new Map();

const json = (donnees, statut = 200) => new Response(JSON.stringify(donnees), {
  status: statut,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const erreur = (code, statut, details) => json(details ? { erreur: code, details } : { erreur: code }, statut);

export function estRouteRelecture(chemin) {
  return chemin === "/api/relectures" || chemin === "/api/relectures/statut";
}

/** Remet à zéro le limiteur (tests). */
export function reinitialiserRelectures() {
  essais.clear();
}

function autoriser(cle) {
  const maintenant = Date.now();
  const recents = (essais.get(cle) ?? []).filter((t) => maintenant - t < 60_000);
  if (recents.length >= ESSAIS_PAR_MINUTE) {
    essais.set(cle, recents);
    return false;
  }
  recents.push(maintenant);
  essais.set(cle, recents);
  return true;
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

/**
 * Rôle de relecteur d'un compte, parmi les rôles attribués à la main seulement.
 * La souscription peut ajouter le rôle « prof » : elle ne donne pas le droit de confirmer une relecture.
 * Pour un compte OAuth sans ligne d'attribution, la colonne historique `comptes.role` (posée à la main) compte.
 * @returns {Promise<string | null>}
 */
async function definitionsRoles(env) {
  try { return await listerRoles(env); } catch {
    return Object.entries(ROLES_SYSTEME).map(([id, r]) => ({ id, permissions: [...r.permissions] }));
  }
}

export async function roleRelecteurDuCompte(env, compteId, origine) {
  const type = origine === "local" ? "compte-local" : "compte";
  let ligne = null;
  try {
    ligne = await env.DB.prepare("SELECT role_id, roles FROM attributions_roles WHERE type_compte = ? AND compte_id = ?").bind(type, compteId).first();
  } catch {
    try { ligne = await env.DB.prepare("SELECT role_id FROM attributions_roles WHERE type_compte = ? AND compte_id = ?").bind(type, compteId).first(); }
    catch { ligne = null; }
  }
  const definitions = await definitionsRoles(env);
  // Une ligne d'attribution existe : seuls ses rôles manuels comptent (la souscription n'est pas un rôle à la main).
  if (ligne) return roleRelecteurManuel(rolesManuels(ligne), definitions);
  if (origine === "oauth") {
    // Sans ligne d'attribution, la colonne historique est le rôle posé à la main. La permission est vérifiée :
    // un prof dont on a retiré `relecture.humaine` ne confirme pas.
    const compte = await env.DB.prepare("SELECT role FROM comptes WHERE id = ?").bind(compteId).first();
    return roleRelecteurManuel(compte?.role ? [compte.role] : [], definitions);
  }
  return null;
}

function notionDe(catalogue, id) {
  return catalogue?.index?.maquettes?.find((m) => m.id === id) ?? null;
}

async function empreinteNotion(catalogue, id) {
  const pages = catalogue?.pages?.[id];
  if (!pages) return null;
  return empreinteContenu(pages);
}

function vuePublique(ligne, empreinte, grille) {
  if (!ligne) return { statut: "non-relue", grille, date: null, code: null, decision: null, version: null };
  return {
    statut: statutDe(ligne, empreinte),
    grille: ligne.grille,
    date: ligne.created_at,
    code: ligne.code_relecteur,
    decision: ligne.decision,
    version: ligne.notion_version
  };
}

function lireDerniere(env, notionId) {
  return env.DB.prepare(
    "SELECT * FROM relectures_humaines WHERE notion_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1"
  ).bind(notionId).first();
}

/** Ce qu'un relecteur voit de ses propres lignes : jamais l'identifiant de compte, le statut est recalculé. */
function vueRelecteur(ligne, empreinte) {
  let criteres = [];
  try { criteres = JSON.parse(ligne.criteres); } catch { criteres = []; }
  return {
    id: ligne.id,
    notion_id: ligne.notion_id,
    notion_version: ligne.notion_version,
    empreinte: ligne.empreinte,
    grille: ligne.grille,
    criteres,
    decision: ligne.decision,
    commentaire: ligne.commentaire,
    code: ligne.code_relecteur,
    role: ligne.role,
    created_at: ligne.created_at,
    statut: statutDe(ligne, empreinte)
  };
}

/**
 * Lot d'effacement du lien de relecture (suppression du compte). La décision, le code court et le commentaire restent.
 * Tableau vide si la table n'existe pas encore.
 */
export async function effacementRelectures(env, compteId, origine) {
  let existe = false;
  try {
    existe = !!(await env.DB.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'relectures_humaines'").bind().first());
  } catch { existe = false; }
  if (!existe) return [];
  return [
    env.DB.prepare("UPDATE relectures_humaines SET relecteur_id = NULL WHERE relecteur_id = ? AND origine = ?").bind(compteId, origine)
  ];
}

/**
 * Traite `/api/relectures`. `compte` est null pour le statut public.
 * @param {{ compteId: string, origine: 'oauth' | 'local' } | null} compte
 * @param {{ catalogue?: { index: { maquettes: object[] }, pages: Record<string, Record<string, string>> } }} options
 */
export async function gererApiRelectures(requete, env, compte, { catalogue = { index: { maquettes: [] }, pages: {} } } = {}) {
  const url = new URL(requete.url);
  const { pathname: chemin, searchParams } = url;
  const methode = requete.method;

  if (chemin === "/api/relectures/statut" && methode === "GET") {
    const id = searchParams.get("notion") ?? "";
    if (!ID_NOTION.test(id)) return erreur("notion-inconnue", 404);
    const notion = notionDe(catalogue, id);
    if (!notion) return erreur("notion-inconnue", 404);
    const empreinte = await empreinteNotion(catalogue, id);
    if (!empreinte) return erreur("contenu-indisponible", 503);
    const derniere = await lireDerniere(env, id);
    return json({ notion_id: id, ...vuePublique(derniere, empreinte, grilleDeSujet(notion.sujet)) });
  }

  if (!compte?.compteId) return erreur("non-connecte", 401);
  const role = await roleRelecteurDuCompte(env, compte.compteId, compte.origine);
  if (!role) return erreur("role-requis", 403);

  if (chemin === "/api/relectures" && methode === "GET") {
    if ((searchParams.get("vue") ?? "miennes") !== "miennes") return erreur("vue-inconnue", 400);
    const { results } = await env.DB.prepare(
      `SELECT * FROM relectures_humaines WHERE relecteur_id = ? AND origine = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`
    ).bind(compte.compteId, compte.origine, MAX_LISTE).all();
    const lignes = [];
    const empreintes = new Map();
    for (const ligne of results ?? []) {
      if (!empreintes.has(ligne.notion_id)) empreintes.set(ligne.notion_id, await empreinteNotion(catalogue, ligne.notion_id));
      lignes.push(vueRelecteur(ligne, empreintes.get(ligne.notion_id)));
    }
    return json(lignes);
  }

  if (chemin === "/api/relectures" && methode === "POST") {
    if (!autoriser(`${compte.origine}:${compte.compteId}`)) return erreur("trop-de-tentatives", 429);
    const { corps, erreur: e } = await lireCorps(requete);
    if (e) return e;
    const idNotion = typeof corps.notion_id === "string" ? corps.notion_id : "";
    if (!ID_NOTION.test(idNotion)) return erreur("relecture-invalide", 400, { notion: "inconnue" });
    const notion = notionDe(catalogue, idNotion);
    if (!notion) return erreur("relecture-invalide", 400, { notion: "inconnue" });
    const grille = grilleDeSujet(notion.sujet);
    const v = validerSaisie(corps, grille);
    if (!v.ok) return erreur("relecture-invalide", 400, v.erreurs);
    if (v.saisie.commentaire && donneesPersonnelles(v.saisie.commentaire)) {
      return erreur("donnees-personnelles", 400, { commentaire: "donnees-personnelles" });
    }
    const empreinte = await empreinteNotion(catalogue, idNotion);
    if (!empreinte) return erreur("contenu-indisponible", 503);
    const id = crypto.randomUUID();
    const code = codeRelecteur(compte.compteId);
    await env.DB.prepare(`
      INSERT INTO relectures_humaines
        (id, relecteur_id, origine, role, code_relecteur, notion_id, notion_version, empreinte, grille, criteres, decision, commentaire)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, compte.compteId, compte.origine, role, code, idNotion, String(notion.version), empreinte, grille,
      JSON.stringify(v.saisie.criteres), v.saisie.decision, v.saisie.commentaire
    ).run();
    const ligne = await env.DB.prepare("SELECT * FROM relectures_humaines WHERE id = ?").bind(id).first();
    return json({ id, statut: vuePublique(ligne, empreinte, grille), relecture: vueRelecteur(ligne, empreinte) }, 201);
  }

  if (estRouteRelecture(chemin)) return erreur("methode-non-autorisee", 405);
  return null;
}
