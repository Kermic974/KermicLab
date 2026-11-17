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
