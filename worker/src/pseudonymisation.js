/**
 * Pseudonymisation imposée de tout texte d'origine utilisateur envoyé à un modèle (ADR 0016, AGENTS.md §4).
 * Appliquée par llm.js à l'intérieur des seules fonctions qui appellent un fournisseur : aucun appelant ne peut
 * la contourner. Les données personnelles détectées sont remplacées par des jetons cohérents ([EMAIL_1],
 * [PRENOM_1]…) : une même valeur reçoit le même jeton dans un échange, sans table de correspondance conservée
 * (aucune réidentification, rien n'est stocké).
 *
 * Complète la modération (moderation.js), qui refuse déjà la plupart de ces messages : la pseudonymisation est la
 * dernière barrière, y compris pour du texte que la modération laisse passer.
 */

const FIN = String.raw`[^\n,.;:!?()]{1,60}`;

/** Formules d'identité : seul ce qui suit la formule est remplacé (la phrase reste lisible pour le modèle). */
const IDENTITES = [
  // Formules explicites seulement : « je suis fan des échecs » n'est pas une identité.
  ["PRENOM", new RegExp(String.raw`\b(je m['’]appelle|mon nom est|mon nom c['’]est|mon prénom est|mon prenom est|my name is|call me)\s+(${FIN})`, "gi")],
  ["LIEU", new RegExp(String.raw`\b(j['’]habite|je vis|i live)\s+((?:à|a|au|aux|en|dans|at|in)\s+${FIN})`, "gi")],
  ["ECOLE", new RegExp(String.raw`\b(mon école est|mon ecole est|mon collège est|mon college est|mon lycée est|mon lycee est|je suis au collège|je suis au college|je suis au lycée|je suis au lycee|my school is|i go to)\s+(${FIN})`, "gi")]
];

/** Motifs autonomes, dans cet ordre (l'e-mail avant l'URL, l'adresse avant les numéros). */
const MOTIFS = [
  ["EMAIL", /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g],
  ["URL", /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi],
  ["IP", /\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  ["ADRESSE", new RegExp(String.raw`\b\d{1,4}\s*(?:bis|ter)?\s*,?\s*(?:rue|avenue|av\.|boulevard|bd|chemin|impasse|allée|allee|place|route|quai|street|road|avenue)\s+${FIN}`, "gi")],
  ["TELEPHONE", /(?:\+|00)\d[\d\s.-]{7,}\d|\b0[1-9](?:[\s.-]?\d{2}){4}\b/g],
  // Identifiants (numéro de sécurité sociale, d'élève, de carte…) : 9 chiffres ou plus. « 2048 », « 1000 points »
  // ou une année restent intacts.
  ["IDENTIFIANT", /\b\d{9,}\b/g]
];

/**
 * @param {unknown} texte
 * @returns {{ texte: string, remplacements: Record<string, number>, total: number }}
 */
export function pseudonymiser(texte) {
  let resultat = String(texte ?? "");
  const jetons = new Map();
  const remplacements = {};
  const jeton = (categorie, valeur) => {
    const cle = `${categorie}:${valeur.trim().toLowerCase()}`;
    if (!jetons.has(cle)) {
      remplacements[categorie] = (remplacements[categorie] ?? 0) + 1;
      jetons.set(cle, `[${categorie}_${remplacements[categorie]}]`);
    }
    return jetons.get(cle);
  };
  for (const [categorie, motif] of IDENTITES) {
    resultat = resultat.replace(motif, (_, formule, valeur) => `${formule} ${jeton(categorie, valeur)}`);
  }
  for (const [categorie, motif] of MOTIFS) {
    resultat = resultat.replace(motif, (valeur) => jeton(categorie, valeur));
  }
  return { texte: resultat, remplacements, total: Object.values(remplacements).reduce((a, b) => a + b, 0) };
}
