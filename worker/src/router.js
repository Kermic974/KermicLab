import { normaliser } from "./texte.js";

/**
 * Les questions d'exemple routent directement vers leur maquette ; les autres sont routées par mots-clés.
 * Score d'une maquette = somme des longueurs (en mots) des mots-clés trouvés comme
 * suite de mots entiers dans la question. Égalité départagée par ordre alphabétique d'ID.
 * Renvoie l'ID de la maquette ou null.
 */
export function routerLocal(message, index) {
  const maquettes = [...index.maquettes].sort((a, b) => a.id.localeCompare(b.id));
  const question = normaliser(message);
  const exemple = maquettes.find((maquette) => (maquette.questions ?? []).some((q) => normaliser(q) === question));
  if (exemple) return exemple.id;
  const texte = ` ${question} `;
  let meilleur = null;
  for (const maquette of maquettes) {
    let score = 0;
    for (const motCle of maquette.motsCles) {
      const n = normaliser(motCle);
      if (n && texte.includes(` ${n} `)) score += n.split(" ").length;
    }
    if (score > 0 && (!meilleur || score > meilleur.score)) meilleur = { id: maquette.id, score };
  }
  return meilleur ? meilleur.id : null;
}
