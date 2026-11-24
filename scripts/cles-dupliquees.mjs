// Détection des clés en double dans un texte JSON.
// JSON.parse garde silencieusement la dernière valeur d'une clé répétée : on relit donc le texte brut.
// Le texte est supposé être du JSON valide (le lint le vérifie avant).

/**
 * Renvoie les clés répétées dans un même objet, avec leurs numéros de ligne.
 * @param {string} texte
 * @returns {{ chemin: string, cle: string, lignes: number[] }[]}
 */
export function clesDupliquees(texte) {
  const resultats = [];
  // Pile des conteneurs ouverts : objet { cles: Map<clé, lignes[]>, chemin, cleCourante } ou tableau { tableau: true, chemin, index }.
  const pile = [];
  let ligne = 1;
  let attendCle = false;

  const cheminEnfant = () => {
    const parent = pile.at(-1);
    if (!parent) return "";
    if (parent.tableau) return `${parent.chemin}[${parent.index}]`;
    return parent.chemin ? `${parent.chemin}.${parent.cleCourante}` : parent.cleCourante;
  };

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (c === "\n") { ligne++; continue; }
    if (c === "{") { pile.push({ cles: new Map(), chemin: cheminEnfant(), cleCourante: null }); attendCle = true; continue; }
    if (c === "[") { pile.push({ tableau: true, chemin: cheminEnfant(), index: 0 }); attendCle = false; continue; }
    if (c === "}" || c === "]") {
      const ferme = pile.pop();
      if (ferme && !ferme.tableau) {
        for (const [cle, lignes] of ferme.cles) {
          if (lignes.length > 1) resultats.push({ chemin: ferme.chemin, cle, lignes });
        }
      }
      continue;
    }
    if (c === ",") {
      const haut = pile.at(-1);
      if (haut?.tableau) haut.index++; else attendCle = true;
      continue;
    }
    if (c === "\"") {
      const debut = i;
      for (i++; i < texte.length && texte[i] !== "\""; i++) if (texte[i] === "\\") i++;
      if (attendCle) {
        const cle = JSON.parse(texte.slice(debut, i + 1));
        const haut = pile.at(-1);
        haut.cleCourante = cle;
        if (!haut.cles.has(cle)) haut.cles.set(cle, []);
        haut.cles.get(cle).push(ligne);
        attendCle = false;
      }
    }
  }
  return resultats.sort((a, b) => a.lignes[0] - b.lignes[0]);
}
