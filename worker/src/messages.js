/** Textes renvoyés par le Worker (le reste de l'interface est dans web/i18n). */
export const MESSAGES = {
  fr: {
    maquette: (titre) => `Voici la page « ${titre} ». Explore les onglets dans l'ordre que tu veux !`,
    donneesPersonnelles: "Attention : ne partage jamais ton nom, ton adresse, ton école, ton numéro ou ta photo. Pose-moi plutôt ta question sur ce que tu veux apprendre.",
    inapproprie: "Je ne peux pas parler de ce sujet ici. Je suis là pour t'aider à apprendre : maths, sciences, langues… Quelle notion veux-tu découvrir ?",
    tropLong: "Ton message est trop long. Essaie de poser ta question en quelques phrases.",
    vide: "Pose-moi une question, par exemple : « c'est quoi le sinus ? »",
    tropDeDemandes: "Tu poses beaucoup de questions d'un coup ! Attends une minute avant de réessayer.",
    indisponible: "Je ne peux pas répondre à cette question pour le moment. Essaie une question sur une notion de maths, par exemple le sinus ou le cosinus.",
    maquetteBientot: "Je n'ai pas encore de page interactive sur ce sujet : je l'ai ajouté à la liste des pages à créer.",
    traductionManquante: "Cette page n'existe pas encore dans ta langue : voici la version française.",
    supportMerci: "Merci, ton signalement a bien été transmis.",
    erreur: "Oups, une erreur est survenue. Réessaie dans un instant."
  },
  en: {
    maquette: (titre) => `Here is the page "${titre}". Explore the tabs in any order you like!`,
    donneesPersonnelles: "Careful: never share your name, address, school, phone number or photo. Ask me about what you want to learn instead.",
    inapproprie: "I can't talk about that here. I'm here to help you learn: maths, science, languages… What would you like to discover?",
    tropLong: "Your message is too long. Try asking your question in a few sentences.",
    vide: "Ask me a question, for example: \"what is the sine?\"",
    tropDeDemandes: "That's a lot of questions at once! Wait a minute before trying again.",
    indisponible: "I can't answer that right now. Try a maths question, for example about sine or cosine.",
    maquetteBientot: "I don't have an interactive page on this topic yet: I've added it to the list of pages to create.",
    traductionManquante: "This page isn't available in your language yet: here is the French version.",
    supportMerci: "Thank you, your report has been sent.",
    erreur: "Oops, something went wrong. Please try again in a moment."
  }
};

export const LANGUES = Object.keys(MESSAGES);

export function messages(langue) {
  return MESSAGES[langue] ?? MESSAGES.fr;
}
