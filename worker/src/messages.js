/** Textes renvoyés par le Worker (le reste de l'interface est dans web/i18n). */
export const MESSAGES = {
  fr: {
    maquette: (titre) => `Voici la page « ${titre} ». Explore les onglets dans l'ordre que tu veux !`,
    donneesPersonnelles: "Attention : ne partage jamais ton nom, ton adresse, ton école, ton numéro ou ta photo. Pose-moi plutôt ta question sur ce que tu veux apprendre.",
    inapproprie: "Je ne peux pas parler de ce sujet ici. Je suis là pour t'aider à apprendre : maths, sciences, langues… Quelle notion veux-tu découvrir ?",
    tropLong: "Ton message est trop long. Essaie de poser ta question en quelques phrases.",
    vide: "Pose-moi une question, par exemple : « c'est quoi le sinus ? »",
    tropDeDemandes: "Tu poses beaucoup de questions d'un coup ! Attends une minute avant de réessayer.",
    perimetreLlm: "Je réponds uniquement à partir des pages KermicLab. Ouvre une notion du catalogue, puis choisis « Explique plus simplement », « Donne-moi un exemple » ou « Propose un petit défi ».",
    sessionLlmRequise: "Ouvre d'abord une notion depuis le chat. Le cookie technique de session doit être autorisé pour appliquer le quota IA.",
    quotaLlm: "La limite de tokens générés pour cette session est atteinte, ou une réponse est encore en cours. Les pages du catalogue restent accessibles.",
    indisponible: "Je ne peux pas répondre à cette question pour le moment. Essaie une question sur une notion de maths, par exemple le sinus ou le cosinus.",
    horsCatalogue: (titres, total = titres.length) => titres.length
      ? `Je n'ai pas encore de page sur ce sujet. Je sais déjà t'expliquer ${total > 1 ? `${total} notions, par exemple ` : ""}: ${titres.join(", ")}. Choisis une question ci-dessous pour commencer !`
      : "Je n'ai pas encore de page sur ce sujet. Reviens bientôt, de nouvelles notions arrivent !",
    maquetteBientot: "Je n'ai pas encore de page interactive sur ce sujet : je l'ai ajouté à la liste des pages à créer.",
    traductionManquante: "Cette page n'existe pas encore dans ta langue : voici la version française.",
    conversation: {
      salutation: "Bonjour ! Je suis Kermiclab, ton assistant pour apprendre. Écris ce que tu veux comprendre (maths, sciences, histoire, jeux…) et je t'ouvre une page interactive à explorer. Choisis une idée ci-dessous ou pose ta propre question !",
      aide: (total) => `Je connais ${total} notion${total > 1 ? "s" : ""}. Écris simplement ce que tu veux comprendre, par exemple « c'est quoi le sinus ? » : je t'ouvre une page avec une explication, un jeu et une mise en situation. Si l'IA est activée dans ton profil, tu peux ensuite me demander « Explique plus simplement », « Donne-moi un exemple » ou « Propose un petit défi ». Je peux aussi te parler des jeux, des labs et de ta progression.`,
      remerciement: "Avec plaisir ! On continue avec une autre notion ?",
      "au-revoir": "À bientôt ! Reviens quand tu veux pour garder ta série.",
      jeux: (titres, total) => `J'ai ${total} jeu${total > 1 ? "x" : ""} pour t'entraîner en t'amusant : ${titres.join(", ")}. Chacun a son Académie avec des leçons, de l'XP, des étoiles et des trophées. Choisis-en un ci-dessous ou ouvre l'écran Jeux !`,
      labs: "Les Labs sont des applications à manipuler : dans le cercle trigonométrique, tu fais tourner le point, tu observes le sinus et le cosinus, puis tu t'entraînes. Chaque notion a aussi un onglet « Application » pour jouer avec. Ouvre l'écran Labs ou pose-moi une question pour commencer !",
      progression: "Voici où tu en es. Ces chiffres sont calculés sur ton appareil : rien n'est envoyé à KermicLab. Chaque question rapporte de l'XP, chaque nouvelle notion encore plus, et revenir chaque jour fait grandir ta série !"
    },
    suggestionAide: "Que sais-tu faire ?",
    suggestionJeux: "Quels jeux as-tu ?",
    suggestionLabs: "C'est quoi les labs ?",
    suggestionProgression: "Où j'en suis ?",
    supportMerci: "Merci, ton signalement a bien été transmis.",
    ideeMerci: "Merci pour ton idée ! Elle a bien été transmise à l'équipe KermicLab.",
    ideeHorsSujet: "L'IA n'a pas reconnu une idée pour améliorer KermicLab. Tu peux reformuler, ou l'envoyer telle quelle.",
    erreur: "Oups, une erreur est survenue. Réessaie dans un instant."
  },
  en: {
    maquette: (titre) => `Here is the page "${titre}". Explore the tabs in any order you like!`,
    donneesPersonnelles: "Careful: never share your name, address, school, phone number or photo. Ask me about what you want to learn instead.",
    inapproprie: "I can't talk about that here. I'm here to help you learn: maths, science, languages… What would you like to discover?",
    tropLong: "Your message is too long. Try asking your question in a few sentences.",
    vide: "Ask me a question, for example: \"what is the sine?\"",
    tropDeDemandes: "That's a lot of questions at once! Wait a minute before trying again.",
    perimetreLlm: "I only answer using KermicLab pages. Open a concept from the catalogue, then choose “Explain more simply”, “Give me an example” or “Suggest a small challenge”.",
    sessionLlmRequise: "First open a concept through the chat. The technical session cookie must be allowed to enforce the AI quota.",
    quotaLlm: "This session's limit of generated tokens has been reached, or a reply is still in progress. Catalogue pages remain available.",
    indisponible: "I can't answer that right now. Try a maths question, for example about sine or cosine.",
    horsCatalogue: (titres, total = titres.length) => titres.length
      ? `I don't have a page on this topic yet. I can already explain ${total > 1 ? `${total} ideas, for example` : ""}: ${titres.join(", ")}. Pick a question below to get started!`
      : "I don't have a page on this topic yet. Come back soon, new ideas are on the way!",
    maquetteBientot: "I don't have an interactive page on this topic yet: I've added it to the list of pages to create.",
    traductionManquante: "This page isn't available in your language yet: here is the French version.",
    conversation: {
      salutation: "Hello! I'm Kermiclab, your learning assistant. Tell me what you want to understand (maths, science, history, games…) and I'll open an interactive page for you to explore. Pick an idea below or ask your own question!",
      aide: (total) => `I know ${total} concept${total > 1 ? "s" : ""}. Just write what you want to understand, for example "what is the sine?": I'll open a page with an explanation, a game and a real-life situation. If AI is enabled in your profile, you can then ask me to "Explain more simply", "Give me an example" or "Suggest a small challenge". I can also tell you about games, labs and your progress.`,
      remerciement: "You're welcome! Shall we carry on with another concept?",
      "au-revoir": "See you soon! Come back whenever you like to keep your streak going.",
      jeux: (titres, total) => `I have ${total} game${total > 1 ? "s" : ""} to practise while having fun: ${titres.join(", ")}. Each one has its Academy with lessons, XP, stars and trophies. Pick one below or open the Games screen!`,
      labs: "Labs are apps you can play with: in the unit circle, you turn the point, watch the sine and cosine, then practise. Every concept also has an “Application” tab to play with. Open the Labs screen or ask me a question to get started!",
      progression: "Here is where you stand. These numbers are computed on your device: nothing is sent to KermicLab. Every question earns XP, every new concept even more, and coming back each day grows your streak!"
    },
    suggestionAide: "What can you do?",
    suggestionJeux: "What games do you have?",
    suggestionLabs: "What are the labs?",
    suggestionProgression: "How am I doing?",
    supportMerci: "Thank you, your report has been sent.",
    ideeMerci: "Thanks for your idea! It has been sent to the KermicLab team.",
    ideeHorsSujet: "The AI didn't recognise an idea to improve KermicLab. You can rephrase it, or send it as is.",
    erreur: "Oops, something went wrong. Please try again in a moment."
  }
};

export const LANGUES = Object.keys(MESSAGES);

export function messages(langue) {
  return MESSAGES[langue] ?? MESSAGES.fr;
}
