import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { genererPage, compterIndices } from "./gabarit.mjs";
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

/**
 * Relecture pédagogique (feuille de route, phase 0 ; issue #176) : trace d'une relecture humaine selon la grille publiée
 * dans docs/chantiers/validation-maquettes.md. Les trois champs vont ensemble ; aucun nom de relecteur n'est stocké.
 */
export const GRILLES_RELECTURE = ["v1", "jeux-v1"];
const estJeu = (m) => String(m.sujet ?? "").startsWith("jeux/");
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const comparerVersions = (a, b) => {
  const [x, y] = [a, b].map((v) => v.match(SEMVER).slice(1).map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

/** Valide `relue` (date ISO), `relue-version` (version relue, au plus celle de la fiche) et `relue-grille`. */
export function lireRelecture(fiche, { aujourdhui = new Date().toISOString().slice(0, 10) } = {}) {
  const champs = ["relue", "relue-version", "relue-grille"];
  const presents = champs.filter((c) => fiche[c] !== undefined);
  if (!presents.length) return {};
  if (presents.length !== champs.length) throw new Error(`relecture : ${champs.join(", ")} vont ensemble`);
  const date = String(fiche.relue);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error("relue : date AAAA-MM-JJ attendue");
  if (date > aujourdhui) throw new Error("relue : date dans le futur");
  const version = String(fiche["relue-version"]);
  if (!SEMVER.test(version)) throw new Error("relue-version : version X.Y.Z attendue");
  if (SEMVER.test(String(fiche.version)) && comparerVersions(version, String(fiche.version)) > 0) {
    throw new Error("relue-version : supérieure à la version de la fiche");
  }
  const grille = String(fiche["relue-grille"]);
  if (!GRILLES_RELECTURE.includes(grille)) throw new Error(`relue-grille : « ${grille} » inconnue (attendu : ${GRILLES_RELECTURE.join(", ")})`);
  // Un jeu se relit avec la grille des jeux (issue #175), une notion avec la grille pédagogique.
  if (estJeu(fiche) !== grille.startsWith("jeux-")) {
    throw new Error(`relue-grille : « ${grille} » ne convient pas à ${estJeu(fiche) ? "un jeu (grille jeux-v1)" : "une notion (grille v1)"}`);
  }
  return { relecture: { date, version, grille } };
}

/**
 * Indicateur de la feuille de route : notions relues dans leur version actuelle ; « à revoir » si la notion a changé de
 * version depuis sa relecture. Les jeux ne sont pas des notions : ils ont leur propre compte (issue #175).
 */
export function indicateurRelecture(maquettes) {
  const compter = (liste) => {
    const tracees = liste.filter((m) => m.relecture);
    const relues = tracees.filter((m) => m.relecture.version === m.version).length;
    return { relues, aRevoir: tracees.length - relues };
  };
  const notions = maquettes.filter((m) => !estJeu(m)), jeux = maquettes.filter(estJeu);
  const n = compter(notions), j = compter(jeux);
  return { notions: notions.length, relues: n.relues, aRevoir: n.aRevoir, jeux: { total: jeux.length, relus: j.relues, aRevoir: j.aRevoir } };
}

/**
 * Graphe des prérequis (feuille de route, phase 1 ; issue #180), sur tout le catalogue chargé (public et privé) :
 * chaque prérequis existe et est une notion (pas un jeu), aucun cycle, et un prérequis ne commence pas à un niveau
 * plus avancé que la notion qui en dépend (vérifié quand les deux fiches renseignent `niveaux`).
 * Renvoie la liste des erreurs (vide si le graphe est valide).
 */
export function verifierGraphePrerequis(maquettes) {
  const parId = new Map(maquettes.map((m) => [m.id, m]));
  const debut = (m) => (m.niveaux?.length ? NIVEAUX_SCOLAIRES.indexOf(m.niveaux[0]) : null);
  const erreurs = [];
  for (const m of maquettes) {
    for (const p of m.prerequis ?? []) {
      const cible = parId.get(p);
      if (!cible) { erreurs.push(`${m.id} : prérequis « ${p} » inconnu`); continue; }
      if (String(cible.sujet ?? "").startsWith("jeux/")) erreurs.push(`${m.id} : prérequis « ${p} » est un jeu, pas une notion`);
      if (debut(cible) !== null && debut(m) !== null && debut(cible) > debut(m)) {
        erreurs.push(`${m.id} : prérequis « ${p} » commence en ${cible.niveaux[0]}, après ${m.niveaux[0]}`);
      }
    }
  }
  // Cycles : parcours en profondeur (blanc → gris → noir) ; un arc vers un nœud gris ferme un cycle.
  const etat = new Map();
  const visiter = (id, chemin) => {
    etat.set(id, "gris");
    for (const p of parId.get(id)?.prerequis ?? []) {
      if (!parId.has(p)) continue;
      if (etat.get(p) === "gris") erreurs.push(`cycle de prérequis : ${[...chemin.slice(chemin.indexOf(p)), p].join(" → ")}`);
      else if (!etat.has(p)) visiter(p, [...chemin, p]);
    }
    etat.set(id, "noir");
  };
  for (const m of maquettes) if (!etat.has(m.id)) visiter(m.id, [m.id]);
  return erreurs;
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
  // Couverture des indices gradués (issue #190), sur les notions du gabarit (une fois par contenu, langue française).
  const indices = { exercices: 0, avecIndice: 0, complets: 0 };
  const vus = new WeakSet();
  const noterIndices = (contenu) => {
    if (!vus.has(contenu)) { vus.add(contenu); for (const [k, v] of Object.entries(compterIndices(contenu))) indices[k] += v; }
    return contenu;
  };
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
      try { referentiel = { ...lireReferentiel(fiche), ...lireRelecture(fiche) }; } catch (e) { throw new Error(`${rep}: ${e.message}`); }
      if (pages[fiche.id]) throw new Error(`id en double : ${fiche.id}`);
      const langues = liste(fiche.langues);
      if (!langues.includes("fr")) throw new Error(`${rep}: la version française est obligatoire`);
      pages[fiche.id] = {};
      // Notion décrite par un contenu (gabarit commun) : la page française est générée, puis comparée au fichier committé.
      const contenuJson = path.join(rep, "contenu.json");
      const generee = (await existe(contenuJson))
        ? appliquerCsp(await genererPage({ fiche, contenu: noterIndices(JSON.parse(await readFile(contenuJson, "utf8"))) }))
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
  const erreursGraphe = verifierGraphePrerequis(maquettes);
  if (erreursGraphe.length) throw new Error(`graphe des prérequis invalide :\n- ${erreursGraphe.join("\n- ")}`);
  return { index: { maquettes }, pages, sources, indices };
}
