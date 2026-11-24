export function lireCsv(texte, { separateur = "," } = {}) {
  const lignes = [];
  let ligne = [], champ = "", cite = false, ferme = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (cite) {
      if (c !== '"') champ += c;
      else if (texte[i + 1] === '"') { champ += '"'; i++; }
      else { cite = false; ferme = true; }
    } else if (c === separateur || c === "\n" || c === "\r") {
      ligne.push(champ);
      champ = ""; ferme = false;
      if (c !== separateur) {
        if (c === "\r" && texte[i + 1] === "\n") i++;
        lignes.push(ligne); ligne = [];
      }
    } else if (c === '"' && !champ && !ferme) cite = true;
    else {
      if (ferme || c === '"') throw new Error("Champ CSV mal formé");
      champ += c;
    }
  }
  if (cite) throw new Error("Champ CSV non terminé");
  if (ligne.length || champ || ferme) lignes.push([...ligne, champ]);
  return lignes;
}
