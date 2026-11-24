// Règles partagées de la relecture humaine d'une notion (ADR 0039).
// L'interface et le Worker importent ce module : une seule définition de la grille, de la décision et du statut.
import { codeAuteur } from "./contributions.js";

/** Grille v1 des notions et grille jeux-v1 (docs/chantiers/validation-maquettes.md). */
export const GRILLES = Object.freeze({
  v1: Object.freeze(["exactitude", "progression", "age", "exercices", "neutralite", "donnees"]),
  "jeux-v1": Object.freeze(["regles", "academie", "commandes", "lisibilite", "age", "donnees"])
});
export const DECISIONS = Object.freeze(["conforme", "a_corriger"]);
export const STATUTS = Object.freeze(["non-relue", "relue", "a-revoir", "a-corriger"]);
export const COMMENTAIRE_MAX = 1000;
/** Permission d'un rôle attribué à la main. Jamais accordée par une souscription seule. */
export const PERMISSION_RELECTURE = "relecture.humaine";

/** Code court affiché à la place de l'identité (mêmes 6 caractères que les contributions). */
export const codeRelecteur = codeAuteur;

/** Grille imposée par la fiche : un jeu n'est pas relu avec la grille des notions, et inversement. */
export function grilleDeSujet(sujet) {
  return String(sujet ?? "").startsWith("jeux/") ? "jeux-v1" : "v1";
}

/**
 * Texte canonique dont l'empreinte est calculée. Pour une notion du gabarit, seul le JSON pédagogique
 * (`#kermiclab-contenu`) compte : une régénération du moteur ou des hashes CSP ne change pas l'empreinte.
 * Une page écrite à la main est son propre contenu.
 * @param {Record<string, string> | string | null | undefined} pages
 */
export function texteEmpreinte(pages) {
  const entrees = typeof pages === "string"
    ? [["fr", pages]]
    : Object.entries(pages ?? {}).filter(([, html]) => typeof html === "string");
  entrees.sort((a, b) => a[0].localeCompare(b[0]));
  return entrees.map(([langue, html]) => {
    const contenu = html.match(/<script type="application\/json" id="kermiclab-contenu">([\s\S]*?)<\/script>/);
    return `${langue}\n${contenu ? contenu[1].trim() : html}`;
  }).join("\n---\n");
}

/** Empreinte SHA-256 hexadécimale du contenu pédagogique, calculée par le serveur (jamais lue dans la requête). */
export async function empreinteContenu(pages) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texteEmpreinte(pages)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Rôle de relecteur parmi des rôles attribués à la main (pas le rôle apporté par une souscription).
 * Seule la permission compte : elle est sur les rôles système prof et admin, et sur un rôle personnalisé
 * seulement si quelqu'un l'y a ajoutée.
 * @returns {string | null} identifiant du rôle qui autorise, ou null
 */
export function roleRelecteurManuel(manuels, definitions = []) {
  const ids = [...new Set((manuels ?? []).filter((r) => typeof r === "string" && r && r !== "visiteur"))];
  const permissionsDe = (id) => definitions.find((d) => d.id === id)?.permissions ?? [];
  const autorises = ids.filter((id) => permissionsDe(id).includes(PERMISSION_RELECTURE));
  if (autorises.includes("admin")) return "admin";
  return autorises[0] ?? null;
}

/** Décision reçue du navigateur : critères de la grille imposée, décision cohérente, commentaire borné. */
export function validerSaisie(corps, grille) {
  const ids = GRILLES[grille];
  if (!ids || !corps || typeof corps !== "object") return { ok: false, erreurs: { corps: "invalide" } };
  const decision = corps.decision;
  if (!DECISIONS.includes(decision)) return { ok: false, erreurs: { decision: "invalide" } };
  const recus = corps.criteres;
  if (!recus || typeof recus !== "object" || Array.isArray(recus)) return { ok: false, erreurs: { criteres: "invalides" } };
  if (Object.keys(recus).length !== ids.length || ids.some((id) => typeof recus[id] !== "boolean")) {
    return { ok: false, erreurs: { criteres: "incomplets" } };
  }
  const coches = ids.filter((id) => recus[id]);
  if (decision === "conforme" && coches.length !== ids.length) return { ok: false, erreurs: { decision: "criteres-manquants" } };
  if (decision === "a_corriger" && coches.length === ids.length) return { ok: false, erreurs: { decision: "deja-conforme" } };
  let commentaire = null;
  if (corps.commentaire != null && corps.commentaire !== "") {
    if (typeof corps.commentaire !== "string") return { ok: false, erreurs: { commentaire: "invalide" } };
    commentaire = corps.commentaire.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim();
    if (commentaire.length > COMMENTAIRE_MAX) return { ok: false, erreurs: { commentaire: "trop-long" } };
    if (!commentaire) commentaire = null;
  }
  return { ok: true, saisie: { decision, criteres: coches, commentaire } };
}

/**
 * Statut d'une ligne du journal face au contenu servi maintenant.
 * L'empreinte différente l'emporte : la décision portait sur un autre contenu.
 */
export function statutDe(ligne, empreinteActuelle) {
  if (!ligne) return "non-relue";
  if (ligne.empreinte !== empreinteActuelle) return "a-revoir";
  return ligne.decision === "conforme" ? "relue" : "a-corriger";
}

/** Synthèse du suivi du relecteur, calculée sur les lignes déjà munies de leur statut. */
export function syntheseRelectures(lignes) {
  const n = (statut) => lignes.filter((l) => l.statut === statut).length;
  return { total: lignes.length, relues: n("relue"), aRevoir: n("a-revoir"), aCorriger: n("a-corriger") };
}

/** À revoir et à corriger d'abord, puis les plus récentes. */
export function ordreSuivi(lignes) {
  const rang = { "a-revoir": 0, "a-corriger": 1, relue: 2, "non-relue": 3 };
  return [...lignes].sort((a, b) => (rang[a.statut] ?? 9) - (rang[b.statut] ?? 9) || String(b.created_at).localeCompare(String(a.created_at)));
}
