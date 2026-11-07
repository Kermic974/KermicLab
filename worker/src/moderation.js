import { normaliser } from "./texte.js";

/**
 * Modération légère (niveau 0) des entrées et des sorties.
 * Public de 7 à 77 ans : on refuse toute donnée personnelle et les sujets inappropriés.
 * Le prompt système du modèle complète ce filtre.
 */
const MOTIFS_DONNEES_PERSONNELLES = [
  { motif: /[\w.+-]+@[\w-]+\.[\w.-]+/, raison: "email" },
  { motif: /(?:\+|00)\d[\d\s.-]{7,}\d|\b0[1-9](?:[\s.-]?\d{2}){4}\b/, raison: "telephone" },
  { motif: /\b\d{1,4}\s*(?:bis|ter)?\s*,?\s*(?:rue|avenue|boulevard|bd|chemin|impasse|allee|place|route|street|road|avenue)\b/i, raison: "adresse" },
  { motif: /\b(?:je m appelle|mon nom est|mon nom c est|my name is|j habite|i live at|i live in|mon ecole est|je suis au college|je suis au lycee|my school is)\b/, raison: "identite" }
];

const SUJETS_INAPPROPRIES = [
  "porno", "pornographie", "sexe", "sexuel", "nude", "nudes", "drogue", "cocaine", "heroine", "suicide",
  "me tuer", "fabriquer une bombe", "arme a feu", "acheter une arme", "kill myself", "make a bomb", "buy a gun", "porn", "sex"
];

export function analyser(texte) {
  const brut = String(texte ?? "");
  const n = normaliser(brut);
  for (const { motif, raison } of MOTIFS_DONNEES_PERSONNELLES) {
    if (motif.test(raison === "identite" ? n : brut)) return { ok: false, raison: `donnees-personnelles:${raison}` };
  }
  const entoure = ` ${n} `;
  for (const sujet of SUJETS_INAPPROPRIES) {
    if (entoure.includes(` ${sujet} `)) return { ok: false, raison: "sujet-inapproprie" };
  }
  return { ok: true };
}

/**
 * Données personnelles seulement (e-mail, téléphone, adresse, identité) : filtre des contributions au contenu (ADR 0023).
 * Les sujets sensibles ne sont pas filtrés ici : une notion de SVT ou d'EMC peut légitimement les traiter, et chaque
 * contribution est relue par un prof avant toute publication.
 */
export function donneesPersonnelles(texte) {
  const brut = String(texte ?? "");
  const n = normaliser(brut);
  const trouve = MOTIFS_DONNEES_PERSONNELLES.find(({ motif, raison }) => motif.test(raison === "identite" ? n : brut));
  return trouve ? trouve.raison : null;
}
