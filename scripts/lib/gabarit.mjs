// Génération des pages du catalogue à partir du gabarit commun (gabarit/) et d'un contenu de notion (contenu.json).
// La page produite respecte le contrat d'une page autonome (AGENTS.md §5) ; ses hashes CSP sont posés par appliquerCsp.
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";

export const VERSION_GABARIT = "1.2.0";
const racine = new URL("../..", import.meta.url).pathname;
// Une figure = un fichier gabarit/figures/<type>.js (code inséré dans le moteur des seules pages qui l'utilisent)
// et, si ses paramètres ont des contraintes, scripts/lib/figures/<type>.mjs qui exporte valider(conf, ou, outils).
export const TYPES_FIGURE = (await readdir(`${racine}gabarit/figures`)).filter((f) => /^[a-z][a-z0-9-]*\.js$/.test(f)).map((f) => f.slice(0, -3)).sort();
const VALIDATEURS_FIGURE = Object.fromEntries(await Promise.all(TYPES_FIGURE
  .filter((type) => existsSync(`${racine}scripts/lib/figures/${type}.mjs`))
  .map(async (type) => [type, (await import(`./figures/${type}.mjs`)).valider])));
const MARQUEUR_FIGURE = /^ *\/\/ @figure\b.*$/m;
const TYPES_EXERCICE = ["qcm", "nombre"];

const echapperHtml = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Dans un <script type="application/json">, seul « </script » est dangereux : on neutralise tout « < ».
const jsonDansScript = (v) => JSON.stringify(v, null, 2).replace(/</g, "\\u003c");

function exiger(condition, message) {
  if (!condition) throw new Error(message);
}
const texteNonVide = (v) => typeof v === "string" && v.trim().length > 0;

/**
 * Indices gradués sans IA (feuille de route, phase 3 ; issue #190) : 1 à 3 indices par exercice, du plus léger au plus
 * précis, affichés un par un (à la demande ou après une erreur). Ils sont la réponse par défaut, et le repli quand l'IA
 * est indisponible. Un QCM peut encore n'avoir qu'un « indice » (ancien format), compté comme un seul indice gradué.
 */
export const MAX_INDICES = 3;
export const indicesDe = (ex) => (Array.isArray(ex?.indices) ? ex.indices : ex?.indice ? [ex.indice] : []);

function validerIndices(ex, ou, { obligatoire }) {
  if (ex.indices === undefined) { exiger(!obligatoire, `${ou} : au moins un « indices » requis`); return; }
  exiger(!obligatoire || (Array.isArray(ex.indices) && ex.indices.length > 0), `${ou} : au moins un « indices » requis`);
  exiger(Array.isArray(ex.indices) && ex.indices.length >= 1 && ex.indices.every(texteNonVide),
    `${ou} : « indices » doit être une liste de 1 à ${MAX_INDICES} textes`);
  exiger(ex.indices.length <= MAX_INDICES, `${ou} : ${MAX_INDICES} « indices » au plus (du plus léger au plus précis)`);
  exiger(new Set(ex.indices.map((i) => i.trim())).size === ex.indices.length, `${ou} : deux « indices » identiques`);
}

/** Couverture des indices gradués d'un contenu : exercices, exercices avec au moins un indice, avec 3 indices. */
export function compterIndices(contenu) {
  const exercices = [...(contenu?.application?.exercices ?? []), ...(contenu?.situation?.etapes ?? [])];
  return {
    exercices: exercices.length,
    avecIndice: exercices.filter((ex) => indicesDe(ex).length > 0).length,
    complets: exercices.filter((ex) => indicesDe(ex).length === MAX_INDICES).length
  };
}

function validerExercice(ex, ou) {
  exiger(ex && typeof ex === "object", `${ou} : exercice invalide`);
  exiger(TYPES_EXERCICE.includes(ex.type), `${ou} : type « ${ex.type} » inconnu (attendu : ${TYPES_EXERCICE.join(", ")})`);
  exiger(texteNonVide(ex.question), `${ou} : « question » manquante`);
  if (ex.type === "qcm") {
    exiger(Array.isArray(ex.choix) && ex.choix.length >= 2 && ex.choix.every(texteNonVide), `${ou} : au moins 2 « choix » requis`);
    exiger(Number.isInteger(ex.bonne) && ex.bonne >= 0 && ex.bonne < ex.choix.length, `${ou} : « bonne » doit être l'indice d'un choix (0 à ${ex.choix.length - 1})`);
    exiger(texteNonVide(ex.explication), `${ou} : « explication » requise (elle s'affiche après la bonne réponse)`);
    exiger(ex.indice === undefined || texteNonVide(ex.indice), `${ou} : « indice » vide`);
    exiger(ex.indice === undefined || ex.indices === undefined, `${ou} : « indice » et « indices » ensemble (garder « indices »)`);
    validerIndices(ex, ou, { obligatoire: false });
    if (ex.erreurs !== undefined) {
      exiger(Array.isArray(ex.erreurs) && ex.erreurs.length >= 1, `${ou} : « erreurs » doit être une liste non vide`);
      const vus = new Set();
      ex.erreurs.forEach((e, j) => {
        exiger(Number.isInteger(e?.choix) && e.choix >= 0 && e.choix < ex.choix.length && e.choix !== ex.bonne,
          `${ou} erreurs[${j}] : « choix » doit être l'indice d'une mauvaise réponse`);
        exiger(!vus.has(e.choix), `${ou} erreurs[${j}] : choix ${e.choix} déjà décrit`);
        exiger(texteNonVide(e.message), `${ou} erreurs[${j}] : « message » requis`);
        vus.add(e.choix);
      });
    }
  } else {
    exiger(typeof ex.reponse === "number" && Number.isFinite(ex.reponse), `${ou} : « reponse » doit être un nombre`);
    exiger(ex.tolerance === undefined || (typeof ex.tolerance === "number" && ex.tolerance >= 0), `${ou} : « tolerance » invalide`);
    validerIndices(ex, ou, { obligatoire: true });
    exiger(texteNonVide(ex.solution), `${ou} : « solution » requise`);
    if (ex.erreurs !== undefined) {
      exiger(Array.isArray(ex.erreurs) && ex.erreurs.length >= 1, `${ou} : « erreurs » doit être une liste non vide`);
      const ecart = (e) => e.tolerance ?? 1e-9;
      ex.erreurs.forEach((e, j) => {
        exiger(typeof e?.reponse === "number" && Number.isFinite(e.reponse), `${ou} erreurs[${j}] : « reponse » doit être un nombre`);
        exiger(e.tolerance === undefined || (typeof e.tolerance === "number" && e.tolerance >= 0), `${ou} erreurs[${j}] : « tolerance » invalide`);
        exiger(texteNonVide(e.message), `${ou} erreurs[${j}] : « message » requis`);
        // Une erreur fréquente ne doit jamais recouvrir la bonne réponse, ni une autre erreur décrite.
        exiger(Math.abs(e.reponse - ex.reponse) > ecart(e) + (ex.tolerance ?? 1e-9), `${ou} erreurs[${j}] : recouvre la bonne réponse`);
        ex.erreurs.slice(0, j).forEach((autre, k) => exiger(Math.abs(e.reponse - autre.reponse) > ecart(e) + ecart(autre),
          `${ou} erreurs[${j}] : recouvre erreurs[${k}]`));
      });
    }
  }
}

function validerFigure(f, ou) {
  exiger(TYPES_FIGURE.includes(f?.type), `${ou} : figure « ${f?.type} » inconnue (attendu : ${TYPES_FIGURE.join(", ")})`);
  VALIDATEURS_FIGURE[f.type]?.(f, ou, { exiger, texteNonVide });
}

/** Vérifie la structure d'un contenu de notion ; lève une erreur explicite au premier problème. */
export function validerContenu(c, ou = "contenu.json") {
  exiger(c && typeof c === "object", `${ou} : objet attendu`);
  exiger(Array.isArray(c.niveaux) && c.niveaux.length >= 2, `${ou} : au moins 2 « niveaux » (du plus intuitif au plus formel)`);
  c.niveaux.forEach((n, i) => {
    const o = `${ou} niveaux[${i}]`;
    exiger(texteNonVide(n.titre) && texteNonVide(n.niveau), `${o} : « titre » et « niveau » requis`);
    exiger(Array.isArray(n.paragraphes) && n.paragraphes.length >= 1 && n.paragraphes.every(texteNonVide), `${o} : au moins un paragraphe`);
    if (n.exemple) exiger(Array.isArray(n.exemple.etapes) && n.exemple.etapes.every(texteNonVide), `${o} : « exemple.etapes » invalide`);
  });
  if (c.memo !== undefined) {
    const m = c.memo, o = `${ou} memo`;
    exiger(m && typeof m === "object" && !Array.isArray(m), `${o} : objet attendu`);
    const formules = m.formules ?? [], points = m.pointsCles ?? [];
    exiger(Array.isArray(formules) && Array.isArray(points) && formules.length + points.length >= 1, `${o} : au moins une formule ou un point clé`);
    exiger(m.intro === undefined || texteNonVide(m.intro), `${o} : « intro » invalide`);
    formules.forEach((f, i) => exiger(texteNonVide(f?.titre) && texteNonVide(f?.formule) && (f.explication === undefined || texteNonVide(f.explication)), `${o} formules[${i}] : « titre » et « formule » requis`));
    points.forEach((p, i) => exiger(texteNonVide(p), `${o} pointsCles[${i}] : texte requis`));
  }
  exiger(c.application && Array.isArray(c.application.exercices) && c.application.exercices.length >= 3, `${ou} : « application.exercices » (au moins 3)`);
  if (c.application.figure) validerFigure(c.application.figure, `${ou} application.figure`);
  c.application.exercices.forEach((ex, i) => validerExercice(ex, `${ou} application.exercices[${i}]`));
  const s = c.situation;
  exiger(s && texteNonVide(s.titre) && Array.isArray(s.histoire) && s.histoire.length >= 1 && texteNonVide(s.conclusion), `${ou} : « situation » (titre, histoire, conclusion) requise`);
  exiger(Array.isArray(s.etapes) && s.etapes.length >= 2, `${ou} : « situation.etapes » (au moins 2)`);
  s.etapes.forEach((ex, i) => validerExercice(ex, `${ou} situation.etapes[${i}]`));
  // Les mots qui déclencheraient le contrôle « appel réseau / eval » de check-pages n'ont rien à faire dans un contenu.
  exiger(!/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|eval)\s*\(|new Function\s*\(/.test(JSON.stringify(c)), `${ou} : contenu interdit (appel de fonction)`);
  return c;
}

let fichiersGabarit = null;
async function lireGabarit() {
  fichiersGabarit ??= {
    page: await readFile(`${racine}gabarit/page.html`, "utf8"),
    style: (await readFile(`${racine}gabarit/style.css`, "utf8")).trimEnd(),
    moteur: (await readFile(`${racine}gabarit/moteur.js`, "utf8")).trimEnd(),
    trophees: (await readFile(`${racine}gabarit/jeux/trophees.js`, "utf8")).trimEnd(),
    evenements: (await readFile(`${racine}gabarit/jeux/evenements.js`, "utf8")).trimEnd(),
    figures: new Map()
  };
  return fichiersGabarit;
}

/** Moteur d'une page : le marqueur « // @figure » est remplacé par le code de sa figure (sans l'en-tête de commentaires), ou supprimé. */
async function moteurAvecFigure(gabarit, type) {
  exiger((gabarit.moteur.match(new RegExp(MARQUEUR_FIGURE.source, "gm")) ?? []).length === 1, "gabarit/moteur.js : marqueur « // @figure » absent ou en double");
  let code = "";
  if (type) {
    if (!gabarit.figures.has(type)) {
      const source = await readFile(`${racine}gabarit/figures/${type}.js`, "utf8");
      gabarit.figures.set(type, source.replace(/^(\/\/.*\n)+\n*/, "").trimEnd());
    }
    code = gabarit.figures.get(type);
  }
  return gabarit.moteur.replace(MARQUEUR_FIGURE, () => code);
}

/** Produit le HTML (avant pose des hashes CSP) d'une notion à partir de sa fiche et de son contenu. */
export async function genererPage({ fiche, contenu, langue = "fr" }) {
  exiger(/^\d{4}-\d{2}-\d{2}$/.test(fiche.date ?? ""), `${fiche.id}/fiche.md : « date » (AAAA-MM-JJ) requise pour une page générée`);
  validerContenu(contenu, `${fiche.id}/contenu.json`);
  const gabarit = await lireGabarit();
  const { page, style, trophees, evenements } = gabarit;
  const moteur = await moteurAvecFigure(gabarit, contenu.application.figure?.type);
  const meta = {
    id: fiche.id, titre: fiche.titre, sujet: fiche.sujet, version: fiche.version, date: fiche.date, langue,
    onglets: ["explication", ...(contenu.memo ? ["memo"] : []), "application", "mise-en-situation", "self-test"], gabarit: VERSION_GABARIT
  };
  const valeurs = {
    ID: echapperHtml(fiche.id), TITRE: echapperHtml(fiche.titre), VERSION: echapperHtml(fiche.version), LANGUE: echapperHtml(langue),
    META: JSON.stringify(meta, null, 2).replace(/</g, "\\u003c"), CONTENU: jsonDansScript(contenu), STYLE: style, MOTEUR: moteur, TROPHEES: trophees, EVENEMENTS: evenements
  };
  return page.replace(/\{\{([A-Z]+)\}\}/g, (tout, cle) => {
    if (!(cle in valeurs)) throw new Error(`gabarit : emplacement inconnu {{${cle}}}`);
    return valeurs[cle];
  });
}
