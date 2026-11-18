// Extension applicative proposée (ADR 0033), indépendante du statut normatif de S6–S9.
// Cibles éditoriales explicites : jamais une preuve de maîtrise ni une relation canonique.
const fiche = (famille, intention, interaction, restitution, cibles = [], academie = true, orthographe = false) => ({
  famille, intention, typePrincipal: "manipulation", interaction, restitution,
  statut: "review", cibles,
  typesActivite: { partie: "manipulation", ...(academie ? { lecon: "activite-guidee", revision: "exercice", defi: "exercice" } : {}), ...(orthographe ? { orthographe: "exercice" } : {}) },
  difficulte: "grades-editoriaux-du-jeu",
  activites: ["partie", ...(academie ? ["lecon", "revision", "defi"] : []), ...(orthographe ? ["orthographe"] : [])]
});
export const JEUX = Object.freeze({
  "2048": fiche("nombres", "mobiliser", "fusion", "objectif", [{ id: "notion.mathematiques.puissances", notion: "puissances" }], false),
  belote: fiche("cartes", "pratiquer", "choix", "partie"),
  demineur: fiche("logique", "pratiquer", "grille", "partie"),
  echecs: fiche("strategie", "pratiquer", "deplacement", "partie"),
  "mots-croises": fiche("langage", "consolider", "saisie", "grille", [], false),
  "mots-fleches": fiche("langage", "consolider", "saisie", "grille"),
  pendu: fiche("langage", "consolider", "saisie", "mot", [], true, true),
  "poker-texas-holdem": fiche("cartes", "pratiquer", "choix", "manche"),
  sudoku: fiche("logique", "pratiquer", "saisie", "grille", [], false)
});
export const jeuConnu = (id) => Object.hasOwn(JEUX, id);
export const classificationJeu = (id) => jeuConnu(id) ? structuredClone(JEUX[id]) : null;
// Seules des cibles explicites et présentes dans le catalogue servi ouvrent le partage professeur.
export function jeuPourMatieres(id, matieres, matiereDe) {
  return jeuConnu(id) && JEUX[id].cibles.some((c) => matieres.includes(matiereDe(c.notion)));
}
