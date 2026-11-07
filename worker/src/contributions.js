// API des contributions au contenu des notions (ADR 0023), scénario sans IA.
// Réservée aux comptes connectés de rôle contributeur, prof ou admin ; la relecture aux rôles prof et admin.
// Mêmes règles que l'interface (web/contributions.js). Une contribution validée ouvre une issue GitHub
// `contribution-validee` : rien n'est publié dans le catalogue sans PR validée par le CODEOWNER.
import * as regles from "../../web/contributions.js";
import { donneesPersonnelles } from "./moderation.js";
import { creerOuCommenterIssue } from "./github.js";

export const LABEL_ISSUE = "contribution-validee";
export const MAX_LISTE = 200;
const TAILLE_MAX_CORPS = 16 * 1024;
const ROUTE_UNE = /^\/api\/contributions\/([0-9a-f-]{36})$/;
const COLONNES = `id, auteur_id, notion_id, notion_version, chemin, nature, type, texte_actuel, texte_propose, motif, statut,
  commentaire, issue_numero, created_at, updated_at, decided_at`;

const json = (donnees, statut = 200) => new Response(JSON.stringify(donnees), {
  status: statut,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const erreur = (code, statut, details) => json(details ? { erreur: code, details } : { erreur: code }, statut);

export function estRouteContribution(chemin) {
  return chemin === "/api/contributions" || ROUTE_UNE.test(chemin);
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

/** Refuse tout texte contenant une donnée personnelle (e-mail, téléphone, adresse, identité). */
function filtrerDonneesPersonnelles(champs) {
  for (const [nom, texte] of Object.entries(champs)) {
    if (texte && donneesPersonnelles(texte)) return erreur("donnees-personnelles", 400, { [nom]: "donnees-personnelles" });
  }
  return null;
}

/** Texte cité dans une issue : en citation, sans mention (@) ni balise active. */
const citer = (texte) => String(texte ?? "").replace(/@/g, "@​").split("\n").map((l) => `> ${l}`).join("\n");

export function corpsIssueContribution(c) {
  return [
    "Contribution validée par un relecteur (prof) dans Kermiclab — scénario sans IA (ADR 0023).",
    "",
    `**Notion** : \`${c.notion_id}\` (version ${c.notion_version || "?"})`,
    `**Champ** : \`${c.chemin}\` — **nature** : ${c.nature} — **type** : ${c.type}`,
    `**Contribution** : \`${c.id}\``,
    "",
    "**Texte actuel**",
    citer(c.texte_actuel),
    "",
    c.nature === "ajout" ? "**Texte à insérer après**" : "**Texte proposé**",
    citer(c.texte_propose),
    "",
    "**Motif du contributeur**",
    citer(c.motif),
    ...(c.commentaire ? ["", "**Commentaire du relecteur**", citer(c.commentaire)] : []),
    "",
    "Intégration : modifier `contenu.json`, monter la version de la fiche, `npm run ci`, PR → validation du CODEOWNER.",
    "Puis marquer la contribution « intégrée » dans le tableau de bord."
  ].join("\n");
}

async function lireRole(env, compteId) {
  const ligne = await env.DB.prepare("SELECT role FROM comptes WHERE id = ?").bind(compteId).first();
  return ligne?.role ?? null;
}

const lireUne = (env, id) => env.DB.prepare(`SELECT ${COLONNES} FROM contributions WHERE id = ?`).bind(id).first();

/**
 * Traite une route de contribution pour le compte `compteId` (déjà authentifié).
 * @param {{ catalogue?: { maquettes: { id: string, version: string }[] }, fetchImpl?: typeof fetch }} options
 */
export async function gererApiContributions(requete, env, compteId, { catalogue = { maquettes: [] }, fetchImpl = fetch } = {}) {
  const { pathname: chemin, searchParams } = new URL(requete.url);
  const methode = requete.method;
  const role = await lireRole(env, compteId);
  if (!regles.peutContribuer(role)) return erreur("role-requis", 403);

  if (chemin === "/api/contributions" && methode === "GET") {
    const vue = searchParams.get("vue") ?? "miennes";
    if (vue === "relecture") {
      if (!regles.peutRelire(role)) return erreur("role-requis", 403);
      const { results } = await env.DB.prepare(
        `SELECT ${COLONNES} FROM contributions WHERE statut != 'retiree' ORDER BY created_at DESC, id LIMIT ?`
      ).bind(MAX_LISTE).all();
      return json(results ?? []);
    }
    if (vue !== "miennes") return erreur("vue-inconnue", 400);
    const { results } = await env.DB.prepare(
      `SELECT ${COLONNES} FROM contributions WHERE auteur_id = ? ORDER BY created_at DESC, id LIMIT ?`
    ).bind(compteId, MAX_LISTE).all();
    return json(results ?? []);
  }

  if (chemin === "/api/contributions" && methode === "POST") {
    const { corps, erreur: e } = await lireCorps(requete);
    if (e) return e;
    const v = regles.validerContribution(corps);
    if (!v.ok) return erreur("contribution-invalide", 400, v.erreurs);
    const notion = catalogue.maquettes.find((m) => m.id === v.contribution.notion_id);
    if (!notion) return erreur("contribution-invalide", 400, { notion: "inconnue" });
    const refus = filtrerDonneesPersonnelles({ texte: v.contribution.texte_propose, motif: v.contribution.motif });
    if (refus) return refus;
    const { n } = await env.DB.prepare(
      "SELECT count(*) AS n FROM contributions WHERE auteur_id = ? AND statut IN ('proposee', 'a_reviser')"
    ).bind(compteId).first();
    if (n >= regles.MAX_OUVERTES_PAR_AUTEUR) return erreur("quota-atteint", 409);
    const id = crypto.randomUUID();
    const c = v.contribution;
    await env.DB.prepare(`
      INSERT INTO contributions (id, auteur_id, notion_id, notion_version, chemin, nature, type, texte_actuel, texte_propose, motif, charte_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, compteId, c.notion_id, String(notion.version), c.chemin, c.nature, c.type, c.texte_actuel, c.texte_propose, c.motif, c.charte_version).run();
    return json({ id }, 201);
  }

  const route = chemin.match(ROUTE_UNE);
  if (route && methode === "PATCH") {
    const { corps, erreur: e } = await lireCorps(requete);
    if (e) return e;
    const actuelle = await lireUne(env, route[1]);
    // Une contribution d'un autre auteur reste invisible pour un simple contributeur.
    if (!actuelle || (actuelle.auteur_id !== compteId && !regles.peutRelire(role))) return erreur("introuvable", 404);
    const tr = regles.transition(actuelle, corps.action, { compteId, role });
    if (!tr.ok) return erreur(tr.code, tr.code === "action-inconnue" ? 400 : 409);

    if (corps.action === "modifier") {
      const v = regles.validerContribution({
        ...corps, notion_id: actuelle.notion_id, chemin: actuelle.chemin, texte_actuel: actuelle.texte_actuel
      });
      if (!v.ok) return erreur("contribution-invalide", 400, v.erreurs);
      const refus = filtrerDonneesPersonnelles({ texte: v.contribution.texte_propose, motif: v.contribution.motif });
      if (refus) return refus;
      await env.DB.prepare(`
        UPDATE contributions SET statut = ?, nature = ?, type = ?, texte_propose = ?, motif = ?, charte_version = ?,
          updated_at = datetime('now') WHERE id = ? AND statut = ?
      `).bind(tr.vers, v.contribution.nature, v.contribution.type, v.contribution.texte_propose, v.contribution.motif,
        v.contribution.charte_version, actuelle.id, actuelle.statut).run();
      return json(await lireUne(env, actuelle.id));
    }

    if (corps.action === "retirer") {
      await env.DB.prepare("UPDATE contributions SET statut = ?, updated_at = datetime('now') WHERE id = ? AND statut = ?")
        .bind(tr.vers, actuelle.id, actuelle.statut).run();
      return json(await lireUne(env, actuelle.id));
    }

    const com = regles.validerCommentaire(corps.commentaire, corps.action);
    if (!com.ok) return erreur("commentaire-invalide", 400, { commentaire: com.erreur });
    const refus = filtrerDonneesPersonnelles({ commentaire: com.commentaire });
    if (refus) return refus;
    const garde = corps.action === "integrer" ? "" : ", commentaire = ?, relecteur_id = ?, decided_at = datetime('now')";
    const valeurs = corps.action === "integrer" ? [] : [com.commentaire || null, compteId];
    const { meta } = await env.DB.prepare(
      `UPDATE contributions SET statut = ?, updated_at = datetime('now')${garde} WHERE id = ? AND statut = ?`
    ).bind(tr.vers, ...valeurs, actuelle.id, actuelle.statut).run();
    if (!meta?.changes) return erreur("statut-incompatible", 409);

    let issue = null;
    if (corps.action === "valider") {
      // L'issue est le point d'entrée de l'intégration ; son échec n'annule pas la validation (relance possible à la main).
      try {
        const r = await creerOuCommenterIssue(env, {
          label: LABEL_ISSUE,
          sujet: `${actuelle.notion_id} · ${actuelle.chemin}`,
          corps: corpsIssueContribution({ ...actuelle, commentaire: com.commentaire })
        }, fetchImpl);
        issue = r.action;
        if (r.numero) await env.DB.prepare("UPDATE contributions SET issue_numero = ? WHERE id = ?").bind(r.numero, actuelle.id).run();
      } catch {
        console.error("github issue contribution indisponible");
        issue = "indisponible";
      }
    }
    const maj = await lireUne(env, actuelle.id);
    return json(issue ? { ...maj, issue } : maj);
  }

  if (estRouteContribution(chemin)) return erreur("methode-non-autorisee", 405);
  return null;
}
