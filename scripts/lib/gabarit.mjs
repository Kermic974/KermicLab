// Génération des pages du catalogue à partir du gabarit commun (gabarit/) et d'un contenu de notion (contenu.json).
// La page produite respecte le contrat d'une page autonome (AGENTS.md §5) ; ses hashes CSP sont posés par appliquerCsp.
import { readFile } from "node:fs/promises";

export const VERSION_GABARIT = "1.0.0";
const racine = new URL("../..", import.meta.url).pathname;
export const TYPES_FIGURE = ["pythagore", "fraction", "proportion", "affine", "des", "parabole"];
const TYPES_EXERCICE = ["qcm", "nombre"];

const echapperHtml = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Dans un <script type="application/json">, seul « </script » est dangereux : on neutralise tout « < ».
const jsonDansScript = (v) => JSON.stringify(v, null, 2).replace(/</g, "\\u003c");

function exiger(condition, message) {
  if (!condition) throw new Error(message);
}
const texteNonVide = (v) => typeof v === "string" && v.trim().length > 0;

function validerExercice(ex, ou) {
  exiger(ex && typeof ex === "object", `${ou} : exercice invalide`);
  exiger(TYPES_EXERCICE.includes(ex.type), `${ou} : type « ${ex.type} » inconnu (attendu : ${TYPES_EXERCICE.join(", ")})`);
  exiger(texteNonVide(ex.question), `${ou} : « question » manquante`);
  if (ex.type === "qcm") {
    exiger(Array.isArray(ex.choix) && ex.choix.length >= 2 && ex.choix.every(texteNonVide), `${ou} : au moins 2 « choix » requis`);
    exiger(Number.isInteger(ex.bonne) && ex.bonne >= 0 && ex.bonne < ex.choix.length, `${ou} : « bonne » doit être l'indice d'un choix (0 à ${ex.choix.length - 1})`);
    exiger(texteNonVide(ex.explication), `${ou} : « explication » requise (elle s'affiche après la bonne réponse)`);
  } else {
    exiger(typeof ex.reponse === "number" && Number.isFinite(ex.reponse), `${ou} : « reponse » doit être un nombre`);
    exiger(ex.tolerance === undefined || (typeof ex.tolerance === "number" && ex.tolerance >= 0), `${ou} : « tolerance » invalide`);
    exiger(Array.isArray(ex.indices) && ex.indices.length >= 1 && ex.indices.every(texteNonVide), `${ou} : au moins un « indices » requis`);
    exiger(texteNonVide(ex.solution), `${ou} : « solution » requise`);
  }
}

function validerFigure(f, ou) {
  exiger(TYPES_FIGURE.includes(f?.type), `${ou} : figure « ${f?.type} » inconnue (attendu : ${TYPES_FIGURE.join(", ")})`);
  if (f.type === "proportion") exiger(texteNonVide(f.libelleX) && texteNonVide(f.libelleY), `${ou} : « libelleX » et « libelleY » requis`);
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
    moteur: (await readFile(`${racine}gabarit/moteur.js`, "utf8")).trimEnd()
  };
  return fichiersGabarit;
}

/** Produit le HTML (avant pose des hashes CSP) d'une notion à partir de sa fiche et de son contenu. */
export async function genererPage({ fiche, contenu, langue = "fr" }) {
  exiger(/^\d{4}-\d{2}-\d{2}$/.test(fiche.date ?? ""), `${fiche.id}/fiche.md : « date » (AAAA-MM-JJ) requise pour une page générée`);
  validerContenu(contenu, `${fiche.id}/contenu.json`);
  const { page, style, moteur } = await lireGabarit();
  const meta = {
    id: fiche.id, titre: fiche.titre, sujet: fiche.sujet, version: fiche.version, date: fiche.date, langue,
    onglets: ["explication", ...(contenu.memo ? ["memo"] : []), "application", "mise-en-situation", "self-test"], gabarit: VERSION_GABARIT
  };
  const valeurs = {
    ID: echapperHtml(fiche.id), TITRE: echapperHtml(fiche.titre), VERSION: echapperHtml(fiche.version), LANGUE: echapperHtml(langue),
    META: JSON.stringify(meta, null, 2).replace(/</g, "\\u003c"), CONTENU: jsonDansScript(contenu), STYLE: style, MOTEUR: moteur
  };
  return page.replace(/\{\{([A-Z]+)\}\}/g, (tout, cle) => {
    if (!(cle in valeurs)) throw new Error(`gabarit : emplacement inconnu {{${cle}}}`);
    return valeurs[cle];
  });
}
