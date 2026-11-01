import Anthropic from "@anthropic-ai/sdk";

export const MODELE_CHAT_PAR_DEFAUT = "claude-haiku-5-5";

export const SCHEMA_ROUTAGE = {
  type: "object",
  additionalProperties: false,
  required: ["langue", "intention", "maquette_id", "maquette_pertinente", "sujet", "plan_onglets", "reponse", "relances"],
  properties: {
    langue: { type: "string", enum: ["fr", "en"] },
    intention: { type: "string", enum: ["apprendre", "conversation", "inapproprie"] },
    maquette_id: { type: "string" },
    maquette_pertinente: { type: "boolean" },
    sujet: { type: "string" },
    plan_onglets: { type: "array", items: { type: "string" } },
    reponse: { type: "string" },
    relances: { type: "array", items: { type: "string" } }
  }
};

export function promptSysteme(index) {
  const catalogue = index.maquettes.map((m) => `- ${m.id} : ${m.titre} (${m.sujet})`).join("\n");
  return `Tu es Kermiclab, un assistant pédagogique pour un public de 7 à 77 ans, mineurs inclus.

Sécurité des enfants (prioritaire) :
- Ton bienveillant, simple et encourageant, adapté à un jeune public.
- Ne demande jamais et n'encourage jamais à partager des informations personnelles (nom, adresse, école, téléphone, photo). Si l'utilisateur en partage, rappelle-lui gentiment de ne pas le faire.
- Refuse poliment les sujets inappropriés pour des enfants (violence, sexualité, drogues, contenus dangereux, haine) : intention "inapproprie", et recentre sur l'apprentissage.
- Aucun lien externe, aucune promesse, aucun conseil médical, juridique ou financier.

Ta tâche : analyser la question et produire le JSON demandé.
- langue : langue de l'utilisateur ("fr" ou "en"). Réponds dans cette langue.
- intention : "apprendre" (question sur une notion), "conversation" (salutation, remarque), ou "inapproprie".
- maquette_id : l'ID exact d'une page du catalogue qui répond à la question, sinon "aucune".
- maquette_pertinente : true si une page interactive à onglets (explication, application ludique, mise en situation) aiderait vraiment à apprendre cette notion.
- sujet : la notion, courte et normalisée en français, au format "matiere/notion" (ex. "mathematiques/theoreme-de-pythagore"), sinon "".
- plan_onglets : si maquette_pertinente et maquette_id vaut "aucune", 3 à 5 titres d'onglets proposés, sinon [].
- reponse : la réponse, en texte brut (pas de Markdown, pas de LaTeX : écris « racine de 2 », « x² », « π »). Règles :
  - Exacte avant tout ; si tu n'es pas sûr, dis-le simplement.
  - Adapte le niveau aux indices de la conversation (vocabulaire, classe ou âge évoqués) ; sans indice, vise un élève de collège.
  - Structure : une phrase qui répond directement ; une image du quotidien ; un exemple concret avec des nombres simples ; une dernière phrase qui invite à essayer (petite question ou défi).
  - 4 à 8 phrases courtes, des retours à la ligne entre les idées, ton chaleureux, tutoiement.
  - Si l'utilisateur demande « plus simplement », « un exemple » ou « un défi », appuie-toi sur la notion des messages précédents : réexplique avec d'autres mots, donne un nouvel exemple, ou propose un petit exercice avec sa solution cachée (« Réponse : … » en dernière ligne).
  - Si une page du catalogue correspond, la réponse est une courte introduction (2 phrases) qui donne envie d'ouvrir la page.
- relances : 2 ou 3 questions courtes (moins de 60 caractères), à la première personne, que l'utilisateur aurait envie de poser ensuite pour aller plus loin sur la même notion (ex. « Donne-moi un exemple avec un angle de 30° »). Si intention vaut "inapproprie", [].

Catalogue des pages disponibles :
${catalogue || "(vide)"}`;
}

/** Appelle Claude (Haiku 5.5) pour router la demande avec une sortie JSON structurée. */
export async function routerAvecClaude(env, { message, historique = [], index }, client) {
  const anthropic = client ?? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const messages = [
    ...historique.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message }
  ];
  const reponse = await anthropic.messages.create({
    model: env.MODELE_CHAT || MODELE_CHAT_PAR_DEFAUT,
    max_tokens: 2000,
    system: promptSysteme(index),
    messages,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA_ROUTAGE } }
  });
  if (reponse.stop_reason === "refusal") return { refus: true };
  const texte = reponse.content.find((b) => b.type === "text")?.text;
  if (!texte) throw new Error(`réponse vide (${reponse.stop_reason})`);
  const resultat = JSON.parse(texte);
  const ids = new Set(index.maquettes.map((m) => m.id));
  if (!ids.has(resultat.maquette_id)) resultat.maquette_id = "aucune";
  return resultat;
}
