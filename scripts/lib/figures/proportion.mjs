// Validation des paramètres de la figure « proportion » (gabarit/figures/proportion.js).
export function valider(f, ou, { exiger, texteNonVide }) {
  exiger(texteNonVide(f.libelleX) && texteNonVide(f.libelleY), `${ou} : « libelleX » et « libelleY » requis`);
}
