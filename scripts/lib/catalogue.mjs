import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { genererPage } from "./gabarit.mjs";
import { preparerPageServie } from "./idees.mjs";

/** Analyse le front matter d'une fiche (sous-ensemble YAML : `cle: valeur`, `cle:` + `  - item`). */
export function lireFrontMatter(texte) {
  const m = texte.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error("front matter absent");
  const donnees = {};
  let cleListe = null;
  for (const ligne of m[1].split(/\r?\n/)) {
    if (!ligne.trim() || ligne.trim().startsWith("#")) continue;
    const item = ligne.match(/^\s+-\s+(.*)$/);
    if (item && cleListe) { donnees[cleListe].push(item[1].trim()); continue; }
    const kv = ligne.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) throw new Error(`ligne invalide : ${ligne}`);
    if (kv[2] === "") { cleListe = kv[1]; donnees[cleListe] = []; } else { cleListe = null; donnees[kv[1]] = kv[2].trim(); }
  }
  return donnees;
}

/** Niveaux scolaires connus, dans l'ordre du parcours (barre de navigation du chat). Champ facultatif d'une fiche. */
export const NIVEAUX = ["college", "seconde", "premiere", "terminale"];

const liste = (v) => (Array.isArray(v) ? v : String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean));

/**
 * Référentiel des notions (feuille de route, phase 1 ; issue #179) : champs facultatifs de fiche.md, validés quand ils sont
 * présents. `niveaux` suit les cycles et classes du programme, plus fin que `niveau` (barre de navigation).
 */
export const NIVEAUX_SCOLAIRES = ["cycle-3", "cycle-4", "seconde", "premiere", "terminale"];
const IDENTIFIANT = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const DUREE_MAX = 240;

/** Valide et normalise prerequis, competences, niveaux et duree ; renvoie seulement les champs présents. */
export function lireReferentiel(fiche) {
  const ref = {};
  for (const champ of ["prerequis", "competences"]) {
    if (fiche[champ] === undefined) continue;
    const valeurs = liste(fiche[champ]);
    // Une liste vide (`prerequis:` sans élément) est permise : elle signifie « renseigné, aucun ».
    if (champ === "competences" && !valeurs.length) throw new Error("champ « competences » vide");
    for (const v of valeurs) if (!IDENTIFIANT.test(v)) throw new Error(`${champ} : « ${v} » n'est pas un identifiant (minuscules, chiffres, tirets)`);
    if (new Set(valeurs).size !== valeurs.length) throw new Error(`${champ} : doublon`);
    if (champ === "prerequis" && valeurs.includes(fiche.id)) throw new Error("prerequis : une notion ne peut pas être son propre prérequis");
    ref[champ] = valeurs;
  }
  if (fiche.niveaux !== undefined) {
    const niveaux = liste(fiche.niveaux);
    if (!niveaux.length) throw new Error("champ « niveaux » vide");
    for (const n of niveaux) if (!NIVEAUX_SCOLAIRES.includes(n)) throw new Error(`niveaux : « ${n} » inconnu (attendu : ${NIVEAUX_SCOLAIRES.join(", ")})`);
    const rangs = niveaux.map((n) => NIVEAUX_SCOLAIRES.indexOf(n));
    if (rangs.some((r, i) => i && r <= rangs[i - 1])) throw new Error("niveaux : sans doublon, du plus jeune au plus avancé");
    ref.niveaux = niveaux;
  }
  if (fiche.duree !== undefined) {
    const duree = Number(fiche.duree);
    if (!/^\d+$/.test(String(fiche.duree)) || duree < 1 || duree > DUREE_MAX) throw new Error(`duree : nombre entier de minutes entre 1 et ${DUREE_MAX}`);
    ref.duree = duree;
  }
  return ref;
}

/** Indicateur de la feuille de route : notions dont les prérequis sont renseignés (une liste vide compte). */
export function indicateurReferentiel(maquettes) {
  const notions = maquettes.filter((m) => !String(m.sujet ?? "").startsWith("jeux/"));
  return { notions: notions.length, avecPrerequis: notions.filter((m) => Array.isArray(m.prerequis)).length };
}

export function lireMetaHtml(html) {
  const m = html.match(/<script type="application\/json" id="kermiclab-meta">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("métadonnées kermiclab-meta absentes");
  return JSON.parse(m[1]);
}

/** Scripts exécutables en ligne (hors JSON de métadonnées). */
export function scriptsEnLigne(html) {
  // Insensible à la casse et tolérant aux variantes de balise fermante (`</SCRIPT >`).
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)]
    .filter((s) => !/type\s*=\s*["']?application\/json/i.test(s[1] ?? ""))
    .map((s) => ({ attributs: s[1] ?? "", contenu: s[2] }));
}

function hashContenu(contenu) {
  return `'sha256-${createHash("sha256").update(contenu, "utf8").digest("base64")}'`;
}

export function hashScript(contenu) {
  return hashContenu(contenu);
}

/** Recalcule les hashes CSP des scripts et, sur demande, des styles en ligne. */
export function appliquerCsp(html, { styles = false } = {}) {
  const hashes = scriptsEnLigne(html).map((s) => hashContenu(s.contenu)).join(" ");
  let page = html.replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*script-src )[^;"]*/, `$1${hashes}`);
  if (styles) {
    const hashesStyles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\b[^>]*>/gi)]
      .map((s) => hashContenu(s[1])).join(" ");
    page = page.replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*style-src )[^;"]*/, `$1${hashesStyles}`);
  }
  return page;
}

async function existe(p) { try { await stat(p); return true; } catch { return false; } }

const racineDepot = path.resolve(new URL("../..", import.meta.url).pathname);
/** Seuls les modules partagés des jeux peuvent être inclus (pas de chemin arbitraire). */
const INCLUSION_AUTORISEE = /^gabarit\/jeux\/[a-z0-9-]+\.(js|css)$/;

/**
 * Pages écrites à la main : recopie dans chaque `<script data-inclure="…">` ou `<style data-inclure="…">` le module
 * partagé qu'il désigne (ADR 0015). La page reste un fichier unique et autonome ; une copie périmée est détectée
 * comme une page obsolète par `check:pages`, comme un hash CSP périmé.
 */
export async function inclureModules(html, racine = racineDepot) {
  const motif = /(<(script|style)\b[^>]*\sdata-inclure="([^"]*)"[^>]*>)([\s\S]*?)(<\/\2>)/g;
  const morceaux = [];
  let dernier = 0;
  for (const m of html.matchAll(motif)) {
    const [, ouverture, balise, chemin, , fermeture] = m;
    if (!INCLUSION_AUTORISEE.test(chemin)) throw new Error(`inclusion refusée : « ${chemin} » (attendu : gabarit/jeux/<nom>.js ou .css)`);
    if ((balise === "script") !== chemin.endsWith(".js")) throw new Error(`inclusion « ${chemin} » : mauvaise balise <${balise}>`);
    const contenu = (await readFile(path.join(racine, chemin), "utf8")).trimEnd();
    morceaux.push(html.slice(dernier, m.index), ouverture, "\n", contenu, "\n", fermeture);
    dernier = m.index + m[0].length;
  }
  morceaux.push(html.slice(dernier));
  return morceaux.join("");
}

/** Charge toutes les maquettes des dossiers donnés (dépôt public + éventuel dépôt privé). */
export async function chargerCatalogue(dossiers) {
  const maquettes = [];
  const pages = {};
  const sources = [];
  for (const dossier of dossiers) {
    if (!(await existe(dossier))) continue;
    for (const nom of (await readdir(dossier)).sort()) {
      const rep = path.join(dossier, nom);
      if (!(await stat(rep)).isDirectory() || !(await existe(path.join(rep, "fiche.md")))) continue;
      const fiche = lireFrontMatter(await readFile(path.join(rep, "fiche.md"), "utf8"));
      for (const champ of ["id", "titre", "sujet", "version", "langues", "onglets", "mots-cles", "questions"]) {
        if (!fiche[champ] || (Array.isArray(fiche[champ]) && !fiche[champ].length)) throw new Error(`${rep}: champ « ${champ} » manquant`);
      }
      if (fiche.id !== nom) throw new Error(`${rep}: l'id « ${fiche.id} » doit être égal au nom du dossier`);
      // Résumé facultatif (une phrase, texte brut) : présenté sur la carte d'un jeu (écran Jeux).
      if (fiche.resume !== undefined && (typeof fiche.resume !== "string" || !fiche.resume || fiche.resume.length > 160 || /[<>]/.test(fiche.resume))) {
        throw new Error(`${rep}: champ « resume » invalide (une phrase de 160 caractères au plus, sans balise)`);
      }
      if (fiche.niveau && !NIVEAUX.includes(fiche.niveau)) throw new Error(`${rep}: niveau « ${fiche.niveau} » inconnu (attendu : ${NIVEAUX.join(", ")})`);
      let referentiel;
      try { referentiel = lireReferentiel(fiche); } catch (e) { throw new Error(`${rep}: ${e.message}`); }
      if (pages[fiche.id]) throw new Error(`id en double : ${fiche.id}`);
      const langues = liste(fiche.langues);
      if (!langues.includes("fr")) throw new Error(`${rep}: la version française est obligatoire`);
      pages[fiche.id] = {};
      // Notion décrite par un contenu (gabarit commun) : la page française est générée, puis comparée au fichier committé.
      const contenuJson = path.join(rep, "contenu.json");
      const generee = (await existe(contenuJson))
        ? appliquerCsp(await genererPage({ fiche, contenu: JSON.parse(await readFile(contenuJson, "utf8")) }))
        : null;
      for (const langue of langues) {
        const fichier = path.join(rep, langue === "fr" ? "page.html" : `page.${langue}.html`);
        const source = (await existe(fichier)) ? await readFile(fichier, "utf8") : "";
        let page = langue === "fr" && generee ? generee : await inclureModules(source);
        const pont = `<script id="trophees" data-inclure="gabarit/jeux/trophees.js"></script>`;
        if (!page.includes('id="trophees"')) page = page.replace("</head>", `${pont}\n</head>`);
        const html = appliquerCsp(await inclureModules(page));
        sources.push({ fichier, aJour: source === html, html });
        const meta = lireMetaHtml(html);
        if (meta.id !== fiche.id || meta.version !== fiche.version) throw new Error(`${fichier}: id/version différents de la fiche`);
        const servie = preparerPageServie(html, { page: fiche.id, version: fiche.version });
        pages[fiche.id][langue] = appliquerCsp(servie, {
          styles: !/style-src[^;]*'unsafe-inline'/.test(html)
        });
      }
      maquettes.push({
        id: fiche.id, titre: fiche.titre, sujet: fiche.sujet, version: fiche.version, langues,
        onglets: liste(fiche.onglets), motsCles: liste(fiche["mots-cles"]), questions: liste(fiche.questions),
        niveau: fiche.niveau ?? "autres",
        ...referentiel,
        ...(fiche.resume ? { resume: fiche.resume } : {})
      });
    }
  }
  return { index: { maquettes }, pages, sources };
}
