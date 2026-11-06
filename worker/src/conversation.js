import { normaliser } from "./texte.js";

/**
 * Échanges de politesse reconnus sans modèle (zéro token) : bonjour, aide, merci, au revoir.
 * Seul un message composé uniquement de ces formules est reconnu : « bonjour, c'est quoi le sinus ? »
 * reste routé vers la page du sinus (le routage du catalogue passe avant).
 */
const APPEL = "(?: (?:a toi|a vous|a tous|tout le monde|kermiclab|kermic lab|kermic|robot|toi|there|everyone|you))?";
const CA_VA = "(?: (?:ca va|comment ca va|comment vas tu|comment allez vous|tu vas bien|how are you|how s it going))?";
const SALUTATION = "(?:bonjour|bonsoir|salut|coucou|hello|hey|hi|yo|bjr|slt|cc|re|good (?:morning|afternoon|evening))";

const INTENTIONS = [
  ["salutation", new RegExp(`^(?:${SALUTATION}${APPEL}${CA_VA}|ca va|comment ca va|how are you)$`)],
  ["aide", /^(?:(?:de l )?aide(?: moi)?|help(?: me)?|qu est ce que tu sais faire|tu sais faire quoi|que sais tu faire|tu fais quoi|que fais tu|a quoi tu sers|a quoi sers tu|qui es tu|t es qui|tu es qui|comment ca marche|comment tu marches|par ou commencer|je ne sais pas quoi demander|what can you do|who are you|how does (?:it|this) work|where do i start)$/],
  ["remerciement", /^(?:(?:merci|mercii+)(?: beaucoup| bien| infiniment)?(?: kermiclab| kermic)?|super merci|top merci|thanks?(?: a lot)?|thank you(?: very much)?|thx)$/],
  ["au-revoir", /^(?:au revoir|a bientot|a plus|bye|bye bye|ciao|salut a plus|bonne (?:nuit|journee|soiree)|goodbye|good night|see you(?: soon)?)$/]
];

/** Intention de conversation d'un message, ou null s'il contient autre chose qu'une formule de politesse. */
export function intentionConversation(message) {
  const texte = normaliser(message).replace(/\s+/g, " ");
  if (!texte || texte.split(" ").length > 8) return null;
  return INTENTIONS.find(([, motif]) => motif.test(texte))?.[0] ?? null;
}
