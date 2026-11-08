// Grille de relecture dans les PR de notion (feuille de route, phase 5 ; issue #202). Une PR qui ajoute une notion ou en
// change le contenu doit avoir la section « Relecture pédagogique » de son modèle entièrement cochée avant validation
// (grille v1, docs/chantiers/validation-maquettes.md, plus l'ouverture de l'aperçu Cloudflare Pages). Une PR qui ne
// touche pas au contenu d'une notion (moteur, documentation, pages seulement régénérées par le build) n'est pas concernée.
//
// Usage (CI) : PR_BODY="…" GRILLE_BASE=origin/main node scripts/verifier-grille-pr.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const TITRE_SECTION = "Relecture pédagogique";
export const CRITERES = ["Exactitude", "Progression", "Adaptation à l'âge", "Exercices", "Neutralité et sources", "Données personnelles", "Aperçu"];
const versionFiche = (texte) => texte?.match(/^version:\s*["']?([^\s"']+)/m)?.[1] ?? null;

/**
 * Retire les commentaires HTML du corps de la PR, comme GitHub à l'affichage : une case cochée dans un commentaire ne
 * compte pas. Le retrait est répété jusqu'à stabilité (commentaires imbriqués), et un commentaire jamais fermé court
 * jusqu'à la fin du texte : il ne reste donc aucun « <!-- » dans le résultat.
 */
export function sansCommentaires(corps) {
  let texte = String(corps ?? ""), avant;
  do { avant = texte; texte = texte.replace(/<!--[\s\S]*?-->/g, ""); } while (texte !== avant);
  const ouvert = texte.indexOf("<!--");
  return ouvert < 0 ? texte : texte.slice(0, ouvert);
}

/** Cases de la section « Relecture pédagogique » du corps de la PR : critère → cochée (true) ou non (false). */
export function lireGrille(corps) {
  const texte = sansCommentaires(corps);
  const debut = texte.search(new RegExp(`^##\\s+${TITRE_SECTION}`, "m"));
  if (debut < 0) return null;
  const suite = texte.slice(debut).split(/\n(?=##\s)/)[0];
  const grille = {};
  for (const [, coche, libelle] of suite.matchAll(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/gm)) {
    const critere = CRITERES.find((c) => libelle.replace(/^\d+\.\s*/, "").startsWith(c));
    if (critere) grille[critere] = coche.toLowerCase() === "x";
  }
  return grille;
}

/**
 * Notions dont le contenu change dans la PR : `contenu.json` modifié, nouvelle notion, ou version de fiche augmentée
 * (une page écrite à la main change de version quand son contenu change, AGENTS.md §6 ter).
 * `lire(ref, chemin)` renvoie le fichier à la base (« base ») ou dans la PR (« tete »), null s'il n'existe pas.
 */
export function notionsModifiees({ modifies, lire }) {
  const ids = [...new Set(modifies.map((f) => f.match(/^catalogue\/([^/]+)\//)?.[1]).filter(Boolean))];
  return ids.filter((id) => {
    const avant = lire("base", `catalogue/${id}/fiche.md`), apres = lire("tete", `catalogue/${id}/fiche.md`);
    if (!apres) return false; // notion supprimée
    if (!avant) return true; // nouvelle notion
    return modifies.includes(`catalogue/${id}/contenu.json`) || versionFiche(avant) !== versionFiche(apres);
  }).sort();
}

/** Verdict : la grille est exigée seulement si une notion change, et alors chaque critère doit être coché. */
export function verifierGrille({ corps, notions }) {
  if (!notions.length) return { ok: true, message: "Aucun contenu de notion modifié : grille de relecture non requise." };
  const grille = lireGrille(corps);
  if (!grille) return { ok: false, message: `Section « ${TITRE_SECTION} » absente du corps de la PR (modèle .github/pull_request_template.md).` };
  const manquants = CRITERES.filter((c) => grille[c] !== true);
  if (manquants.length) return { ok: false, message: `Grille de relecture à cocher (${notions.join(", ")}) : ${manquants.join(", ")}.` };
  return { ok: true, message: `Grille de relecture cochée pour : ${notions.join(", ")}.` };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const racine = new URL("..", import.meta.url).pathname;
  const base = process.env.GRILLE_BASE || "origin/main";
  const git = (...args) => execFileSync("git", args, { cwd: racine, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const modifies = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean);
  const fusion = git("merge-base", base, "HEAD").trim();
  const lire = (ref, chemin) => {
    if (ref === "tete") return existsSync(path.join(racine, chemin)) ? readFileSync(path.join(racine, chemin), "utf8") : null;
    try { return git("show", `${fusion}:${chemin}`); } catch { return null; }
  };
  const verdict = verifierGrille({ corps: process.env.PR_BODY ?? "", notions: notionsModifiees({ modifies, lire }) });
  console.log(verdict.message);
  if (!verdict.ok) process.exit(1);
}
