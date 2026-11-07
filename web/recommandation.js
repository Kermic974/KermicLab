// Recommandation déterministe (feuille de route, phase 2 ; issue #186) : à partir du catalogue (prérequis, niveaux) et
// de la maîtrise locale par notion (issue #185), propose UNE prochaine notion et sa raison. Fonction pure : mêmes
// données, même proposition. Aucune IA, aucun appel réseau, rien n'est envoyé. La maîtrise est fournie par l'appelant
// (`evenements.maitriseNotion`) : ce module n'importe rien, pour garder une seule copie versionnée de chaque module.

const NIVEAUX_SCOLAIRES = ["cycle-3", "cycle-4", "seconde", "premiere", "terminale"];
const acquise = (etat) => etat === "maitrisee" || etat === "a-revoir";
const rangNiveau = (n) => {
  const i = NIVEAUX_SCOLAIRES.indexOf(n.niveaux?.[0]);
  return i < 0 ? NIVEAUX_SCOLAIRES.length : i;
};

/**
 * Règles, dans cet ordre :
 *   1. Révision due : la notion « à revoir » dont la révision est la plus ancienne (puis par identifiant).
 *      Raison : `recoRevision` { titre, date }.
 *   2. Prochaine notion : une notion pas encore acquise dont TOUS les prérequis (au moins un) sont acquis
 *      (maîtrisés ou à revoir). Départage : même matière que la dernière notion ouverte, puis niveau de début le plus
 *      jeune, puis ordre du catalogue. Raison : `recoPrerequis` { prerequis } (titres des prérequis).
 *   3. Sinon : null (l'accueil garde sa suggestion habituelle).
 *
 * @param {object} donnees
 * @param {Array}  donnees.notions     catalogue : { id, titre, matiere, niveaux?, prerequis? } (ordre du catalogue)
 * @param {Function} donnees.maitrise (id) → { etat, revision } : maîtrise locale de la notion (issue #185)
 * @param {string} [donnees.matiere]   matière de la dernière notion ouverte
 * @returns {{ notion: object, raison: { cle: string, variables: object } } | null}
 */
export function recommander({ notions, maitrise: maitriseDe, matiere }) {
  const liste = (notions ?? []).filter((n) => n && typeof n.id === "string" && n.matiere !== "jeux");
  const parId = new Map(liste.map((n) => [n.id, n]));
  const maitrise = new Map(liste.map((n) => [n.id, maitriseDe(n.id)]));

  const aRevoir = liste.filter((n) => maitrise.get(n.id).etat === "a-revoir")
    .sort((a, b) => maitrise.get(a.id).revision.localeCompare(maitrise.get(b.id).revision) || a.id.localeCompare(b.id));
  if (aRevoir.length) {
    const n = aRevoir[0];
    return { notion: n, raison: { cle: "recoRevision", variables: { titre: n.titre, date: maitrise.get(n.id).revision } } };
  }

  const ordre = new Map(liste.map((n, i) => [n.id, i]));
  const candidates = liste.filter((n) => {
    const prerequis = Array.isArray(n.prerequis) ? n.prerequis : [];
    return !acquise(maitrise.get(n.id).etat) && prerequis.length > 0
      && prerequis.every((p) => parId.has(p) && acquise(maitrise.get(p).etat));
  }).sort((a, b) => Number(b.matiere === matiere) - Number(a.matiere === matiere)
    || rangNiveau(a) - rangNiveau(b) || ordre.get(a.id) - ordre.get(b.id));
  if (candidates.length) {
    const n = candidates[0];
    return { notion: n, raison: { cle: "recoPrerequis", variables: { prerequis: n.prerequis.map((p) => parId.get(p).titre) } } };
  }
  return null;
}
