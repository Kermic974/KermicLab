import { test } from "node:test";
import assert from "node:assert/strict";
import { routerAvecClaude, routerAvecWorkersAI } from "../../worker/src/llm.js";

const baseURL = `https://gateway.ai.cloudflare.com/v1/${"a".repeat(32)}/kermiclab-gateway/anthropic`;
const contexte = {
  message: "Donne-moi un exemple", maxTokens: 123,
  source: { id: "fractions", titre: "Les fractions", langue: "fr", version: "1.0.0", contenu: "Une moitié." }
};
const envClaude = () => ({
  ANTHROPIC_API_KEY: "cle-factice", AI_GATEWAY_TOKEN: "jeton-factice",
  AI: { gateway: (id) => {
    assert.equal(id, "kermiclab-gateway");
    return { getUrl: async (fournisseur) => {
      assert.equal(fournisseur, "anthropic");
      return baseURL;
    } };
  } }
});

test("Workers AI : gateway obligatoire, pas de cache ni de journal, un seul essai", async () => {
  let appels = 0;
  const resultat = await routerAvecWorkersAI({ AI: { run: async (modele, entrees, options) => {
    appels++;
    assert.equal(modele, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    assert.equal(entrees.max_tokens, 123);
    assert.deepEqual(options, {
      gateway: { id: "kermiclab-gateway", skipCache: true, collectLog: false },
      extraHeaders: { "cf-aig-skip-cache": "true", "cf-aig-collect-log": "false", "cf-aig-max-attempts": "1" }
    });
    return { response: "réponse", usage: { completion_tokens: 42 } };
  } } }, contexte);
  assert.equal(appels, 1);
  assert.deepEqual(resultat, { contenu: "réponse", tokensSortie: 42, pseudonymisations: 0 });
});

test("Workers AI : une erreur gateway ne déclenche jamais d'appel direct", async () => {
  let appels = 0;
  await assert.rejects(routerAvecWorkersAI({ AI: { run: async () => {
    appels++;
    throw new Error("gateway indisponible");
  } } }, contexte), /gateway indisponible/);
  assert.equal(appels, 1);
});

test("SDK Anthropic : la vraie requête HTTP cible uniquement la gateway authentifiée", async (t) => {
  const ancienFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = ancienFetch; });
  let appels = 0;
  globalThis.fetch = async (entree, options) => {
    appels++;
    const requete = new Request(entree, options);
    assert.equal(requete.url, `${baseURL}/v1/messages`);
    assert.equal(requete.headers.get("x-api-key"), "cle-factice");
    assert.equal(requete.headers.get("cf-aig-authorization"), "Bearer jeton-factice");
    assert.equal(requete.headers.get("authorization"), null);
    assert.equal(requete.headers.get("cf-aig-collect-log"), "false");
    assert.equal(requete.headers.get("cf-aig-skip-cache"), "true");
    assert.equal(requete.headers.get("cf-aig-max-attempts"), "1");
    assert.equal((await requete.json()).max_tokens, 123);
    return Response.json({
      id: "message-test", type: "message", role: "assistant", model: "claude-haiku-5-5",
      content: [{ type: "text", text: "réponse" }], stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 42 }
    });
  };
  assert.deepEqual(await routerAvecClaude(envClaude(), contexte), { contenu: "réponse", refus: false, tokensSortie: 42, pseudonymisations: 0 });
  assert.equal(appels, 1);
});

test("Anthropic : aucun contournement si le binding, le jeton ou l'URL gateway est absent ou invalide", async () => {
  let appels = 0;
  const client = { messages: { create: async () => { appels++; } } };
  const sansBinding = envClaude();
  delete sansBinding.AI;
  await assert.rejects(routerAvecClaude(sansBinding, contexte, client), /binding AI Gateway absent/);
  const sansJeton = envClaude();
  delete sansJeton.AI_GATEWAY_TOKEN;
  await assert.rejects(routerAvecClaude(sansJeton, contexte, client), /AI_GATEWAY_TOKEN absent/);
  for (const url of ["https://api.anthropic.com", baseURL.replace("kermiclab-gateway", "autre-gateway")]) {
    const env = envClaude();
    env.AI.gateway = () => ({ getUrl: async () => url });
    await assert.rejects(routerAvecClaude(env, contexte, client), /URL AI Gateway invalide/);
  }
  assert.equal(appels, 0);
});

test("SDK Anthropic : une erreur gateway n'est pas réessayée ni envoyée au fournisseur en direct", async (t) => {
  const ancienFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = ancienFetch; });
  const urls = [];
  globalThis.fetch = async (entree, options) => {
    urls.push(new Request(entree, options).url);
    return Response.json({ error: { type: "api_error", message: "gateway indisponible" } }, { status: 503 });
  };
  await assert.rejects(routerAvecClaude(envClaude(), contexte), /503/);
  assert.deepEqual(urls, [`${baseURL}/v1/messages`]);
});

test("pseudonymisation imposée : Workers AI et Claude ne reçoivent jamais le message en clair", async () => {
  const { appelerWorkersAI, appelerClaude } = await import("../../worker/src/llm.js");
  const brut = "Je m'appelle Léa Martin, écris à lea@example.org ou au 06 12 34 56 78";
  let recuWorkers;
  const w = await appelerWorkersAI({ AI: { run: async (modele, entrees) => {
    recuWorkers = entrees.messages;
    return { response: "{}", usage: { completion_tokens: 1 } };
  } } }, { system: "Consignes fixes", message: brut, schema: {}, maxTokens: 10 });
  assert.equal(recuWorkers[0].content, "Consignes fixes", "le système (texte du serveur) n'est pas modifié");
  assert.equal(recuWorkers[1].content, "Je m'appelle [PRENOM_1], écris à [EMAIL_1] ou au [TELEPHONE_1]");
  assert.equal(w.pseudonymisations, 3);
  let recuClaude;
  const client = { messages: { create: async (params) => {
    recuClaude = params.messages;
    return { stop_reason: "end_turn", content: [{ type: "text", text: "{}" }], usage: { output_tokens: 1 } };
  } } };
  const c = await appelerClaude(envClaude(), { system: "Consignes fixes", message: brut, schema: {}, maxTokens: 10 }, client);
  assert.doesNotMatch(JSON.stringify(recuClaude), /Léa|lea@example|06 12/);
  assert.equal(c.pseudonymisations, 3);
});
