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

export const liste = (v) => (Array.isArray(v) ? v : String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean));

/**
 * Référentiel des notions (feuille de route, phase 1 ; issue #179) : champs facultatifs de fiche.md, validés quand ils sont
 * présents. `niveaux` suit les cycles et classes du programme, plus fin que `niveau` (barre de navigation).
 */
export const NIVEAUX_SCOLAIRES = ["cycle-3", "cycle-4", "seconde", "premiere", "terminale"];
/**
 * Classes du collège (champ facultatif `classes`), du plus jeune au plus avancé : elles découpent « Collège » dans
 * l'écran Éducation. La 6e appartient au cycle 3, les 5e, 4e et 3e au cycle 4 : une classe exige son cycle dans `niveaux`.
 */
export const CLASSES_COLLEGE = ["6e", "5e", "4e", "3e"];
const CYCLE_DE_CLASSE = { "6e": "cycle-3", "5e": "cycle-4", "4e": "cycle-4", "3e": "cycle-4" };
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
  // Jeux : notions que le jeu fait travailler (facultatif) ; vérifié par verifierGraphePrerequis (notions connues).
  if (fiche["notions-liees"] !== undefined) {
    const valeurs = liste(fiche["notions-liees"]);
    if (!valeurs.length) throw new Error("champ « notions-liees » vide");
    for (const v of valeurs) if (!IDENTIFIANT.test(v)) throw new Error(`notions-liees : « ${v} » n'est pas un identifiant (minuscules, chiffres, tirets)`);
    if (new Set(valeurs).size !== valeurs.length) throw new Error("notions-liees : doublon");
    if (valeurs.length > 6) throw new Error("notions-liees : 6 notions au plus");
    ref.notionsLiees = valeurs;
  }
  if (fiche.niveaux !== undefined) {
    const niveaux = liste(fiche.niveaux);
    if (!niveaux.length) throw new Error("champ « niveaux » vide");
    for (const n of niveaux) if (!NIVEAUX_SCOLAIRES.includes(n)) throw new Error(`niveaux : « ${n} » inconnu (attendu : ${NIVEAUX_SCOLAIRES.join(", ")})`);
    const rangs = niveaux.map((n) => NIVEAUX_SCOLAIRES.indexOf(n));
    if (rangs.some((r, i) => i && r <= rangs[i - 1])) throw new Error("niveaux : sans doublon, du plus jeune au plus avancé");
    ref.niveaux = niveaux;
  }
  if (fiche.classes !== undefined) {
    const classes = liste(fiche.classes);
    if (!classes.length) throw new Error("champ « classes » vide");
    if (fiche.niveau !== "college") throw new Error("classes : réservé aux notions de niveau « college »");
    for (const c of classes) if (!CLASSES_COLLEGE.includes(c)) throw new Error(`classes : « ${c} » inconnue (attendu : ${CLASSES_COLLEGE.join(", ")})`);
    const rangs = classes.map((c) => CLASSES_COLLEGE.indexOf(c));
    if (rangs.some((r, i) => i && r <= rangs[i - 1])) throw new Error("classes : sans doublon, de la 6e à la 3e");
    for (const c of classes) {
      if (ref.niveaux && !ref.niveaux.includes(CYCLE_DE_CLASSE[c])) throw new Error(`classes : « ${c} » demande « ${CYCLE_DE_CLASSE[c]} » dans niveaux`);
    }
    ref.classes = classes;
  }
  if (fiche.duree !== undefined) {
    const duree = Number(fiche.duree);
    if (!/^\d+$/.test(String(fiche.duree)) || duree < 1 || duree > DUREE_MAX) throw new Error(`duree : nombre entier de minutes entre 1 et ${DUREE_MAX}`);
    ref.duree = duree;
  }
  return ref;
}
