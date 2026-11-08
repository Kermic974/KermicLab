// Export et import de la progression dans un fichier (feuille de route, phase 2 ; issue #189) : changer d'appareil sans
// compte. Le fichier reste chez l'utilisateur : rien n'est envoyé au serveur. Module pur, sans DOM ni stockage : la
// lecture, l'écriture et la normalisation de chaque champ sont fournies par l'appelant (mêmes fonctions de chargement
// que le tableau de bord, qui écartent déjà les entrées invalides).
export const FORMAT = "kermiclab-progression";
export const VERSION_FICHIER = 1;
export const TAILLE_MAX = 2_000_000;
/** Champs du fichier, dans l'ordre : pseudo (texte), puis des données JSON. */
export const CHAMPS = Object.freeze(["pseudo", "progression", "trophees", "evenements", "cahiers"]);
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const objet = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Construit le contenu du fichier à partir du stockage.
 * @param {object} p
 * @param {(champ: string) => string|null} p.lire  valeur brute stockée pour un champ (texte), null si absente
 * @param {string} p.jour  AAAA-MM-JJ
 */
export function exporter({ lire, jour }) {
  const donnees = {};
  for (const champ of CHAMPS) {
    const brut = lire(champ);
    if (typeof brut !== "string") continue;
    if (champ === "pseudo") { donnees.pseudo = brut; continue; }
    try { donnees[champ] = JSON.parse(brut); } catch { /* valeur stockée illisible : non exportée */ }
  }
  return { format: FORMAT, v: VERSION_FICHIER, cree: jour, donnees };
}

/** Texte du fichier : JSON lisible, indenté. */
export const texteFichier = (contenu) => `${JSON.stringify(contenu, null, 2)}\n`;
export const nomFichier = (jour) => `kermiclab-progression-${jour}.json`;

/**
 * Lit et valide un fichier. Chaque champ présent passe par son normaliseur (`normaliser[champ](valeur)` → valeur
 * normalisée, ou null si elle est refusée) ; un champ refusé fait refuser tout le fichier, pour ne jamais restaurer
 * une progression à moitié.
 * @returns {{ ok: true, cree: string, valeurs: object } | { ok: false, erreur: string, champ?: string }}
 */
export function lireFichier(texte, { normaliser }) {
  if (typeof texte !== "string" || texte.length > TAILLE_MAX) return { ok: false, erreur: "taille" };
  let brut;
  try { brut = JSON.parse(texte); } catch { return { ok: false, erreur: "illisible" }; }
  if (!objet(brut) || brut.format !== FORMAT) return { ok: false, erreur: "format" };
  if (!Number.isInteger(brut.v) || brut.v < 1) return { ok: false, erreur: "format" };
  if (brut.v > VERSION_FICHIER) return { ok: false, erreur: "version" };
  if (!JOUR.test(String(brut.cree)) || !objet(brut.donnees)) return { ok: false, erreur: "format" };
  const inconnu = Object.keys(brut.donnees).find((champ) => !CHAMPS.includes(champ));
  if (inconnu) return { ok: false, erreur: "champ", champ: inconnu };
  const valeurs = {};
  for (const champ of CHAMPS) {
    if (!(champ in brut.donnees)) continue;
    const valeur = normaliser[champ](brut.donnees[champ]);
    if (valeur === null || valeur === undefined) return { ok: false, erreur: "champ", champ };
    valeurs[champ] = valeur;
  }
  return { ok: true, cree: brut.cree, valeurs };
}

/**
 * Remplace la progression de l'appareil par celle du fichier : chaque champ présent est écrit, chaque champ absent
 * est effacé (comme une restauration complète, sans mélange avec l'ancienne progression).
 */
export function appliquer(valeurs, { ecrire, effacer }) {
  for (const champ of CHAMPS) {
    if (!(champ in valeurs)) { effacer(champ); continue; }
    ecrire(champ, champ === "pseudo" ? valeurs.pseudo : JSON.stringify(valeurs[champ]));
  }
}
