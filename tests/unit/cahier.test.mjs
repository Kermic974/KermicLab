import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker, { _reinitialiser } from "../../worker/src/index.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import {
  MAX_NOTIONS_CAHIER, lireDemandeCahier, messageCahier, normaliserCahier, planCahier, promptCahier, validerBloc
} from "../../worker/src/cahier-llm.js";
import { lireFluxGateway } from "../../worker/src/llm.js";
import { creerD1Llm } from "../helpers/d1-llm.mjs";

// ---- Constructeur de cahiers enrichi par l'alias AI Gateway `custom/sonnet-5-5` ----

const notions = CATALOGUE.index.maquettes.filter((m) => !m.sujet.startsWith("jeux/") && CATALOGUE.pages[m.id]).map((m) => m.id);
const jeu = CATALOGUE.index.maquettes.find((m) => m.sujet.startsWith("jeux/"))?.id;

/** Bloc conforme à un créneau du plan. */
const blocPour = (c, i) => ({
  creneau: c.creneau, titre: `Titre ${c.creneau}`, texte: `${c.genre} ${i + 1}.`,
  indice: ["exercice", "defi"].includes(c.genre) ? "Pense à la définition." : "",
  reponse: ["exercice", "defi"].includes(c.genre) ? `Solution ${c.creneau}.` : ""
});

/** Flux SSE au format chat completions, découpé en morceaux arbitraires comme sur le réseau. */
function fluxSse(objet, { taille = 37, fin = "stop" } = {}) {
  const texte = JSON.stringify(objet);
  const morceaux = [];
  for (let i = 0; i < texte.length; i += taille) morceaux.push(`data: ${JSON.stringify({ choices: [{ delta: { content: texte.slice(i, i + taille) } }] })}\n\n`);
  morceaux.push(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: fin }], usage: { completion_tokens: 2048 } })}\n\ndata: [DONE]\n\n`);
  const octets = new TextEncoder().encode(morceaux.join(""));
  return new ReadableStream({
    start(controleur) { for (let i = 0; i < octets.length; i += 50) controleur.enqueue(octets.slice(i, i + 50)); controleur.close(); }
  });
}

/** Faux binding AI : relit le plan et les notions du message (données du serveur) et remplit chaque créneau. */
function creerAlias({ alterer = (s) => s, brut = null, erreur = null, fin = "stop" } = {}) {
  const appels = [];
  return {
    appels,
    run: async (modele, parametres, options) => {
      appels.push({ modele, parametres, options });
      if (erreur) throw erreur;
      if (brut !== null) return { choices: [{ message: { content: brut } }] };
      const { notions: liste, plan } = JSON.parse(parametres.messages[1].content);
      const sections = liste.map((n, i) => alterer({ notion: n.notion, blocs: plan.map(blocPour) }, i));
      const sortie = { titre: "L'expédition des nombres", introduction: "Bienvenue à bord.", sections, conclusion: "Bravo !" };
      return parametres.stream ? fluxSse(sortie, { fin })
        : { choices: [{ message: { content: JSON.stringify(sortie) }, finish_reason: fin }], usage: { completion_tokens: 2048 } };
    }
  };
}

function creerCtx() {
  const promesses = [];
  return { waitUntil: (p) => promesses.push(p), attendre: () => Promise.all(promesses) };
}

let env, ctx, cookie;
beforeEach(() => {
  env = {
    DB: creerD1Llm(), ORIGINES_AUTORISEES: "https://kermiclab.pages.dev",
    LLM_ACTIF: "true", LLM_SESSION_SECRET: "secret-factice-de-test-de-plus-de-32-caracteres",
    AI: creerAlias()
  };
  ctx = creerCtx();
  cookie = "";
  _reinitialiser();
});
afterEach(() => env.DB.sqlite.close());

async function cahier(corps, ip = "9.8.7.6") {
  const r = await worker.fetch(new Request("https://api.kermiclab.test/api/cahier", {
    method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip, origin: "https://kermiclab.pages.dev", cookie }, body: JSON.stringify(corps)
  }), env, ctx);
  if (r.headers.has("set-cookie")) cookie = r.headers.get("set-cookie").split(";")[0];
  await ctx.attendre();
  return { statut: r.status, donnees: await r.json() };
}

const demande = (extra = {}) => ({ type: "exercices", longueur: "complet", univers: "espace", objectif: "controle", langue: "fr", notions: notions.slice(0, 2), utiliserLlm: true, ...extra });

test("cahier : alias custom/sonnet-5-5 en streaming via kermiclab-gateway, 100 000 tokens max, plan imposé", async () => {
  const { statut, donnees } = await cahier(demande());
  assert.equal(statut, 200);
  assert.equal(donnees.source, "ia");
  const [appel] = env.AI.appels;
  assert.equal(appel.modele, "custom/sonnet-5-5");
  assert.equal(appel.parametres.max_tokens, 100000);
  assert.equal(appel.parametres.stream, true, "streaming exigé par l'API pour un tel budget");
  assert.equal(appel.parametres.response_format.json_schema.name, "cahier");
  assert.deepEqual(appel.options.gateway, { id: "kermiclab-gateway", skipCache: true, collectLog: false });
  const message = JSON.parse(appel.parametres.messages[1].content);
  assert.match(message.univers, /espace/);
  assert.match(message.objectif, /contrôle/);
  assert.deepEqual(message.plan, planCahier("exercices", "complet"));
  assert.deepEqual(donnees.cahier.sections.map((s) => s.notion), notions.slice(0, 2));
  const blocs = donnees.cahier.sections[0].blocs;
  assert.deepEqual(blocs.map((b) => b.genre), message.plan.map((c) => c.genre));
  assert.equal(blocs[0].genre, "histoire");
  const exercice = blocs.find((b) => b.genre === "exercice");
  assert.deepEqual(exercice, { genre: "exercice", titre: exercice.titre, texte: exercice.texte, niveau: 1, reponse: exercice.reponse, indice: "Pense à la définition." });
  assert.equal(blocs.find((b) => b.genre === "explication").reponse, undefined);
  assert.equal(donnees.cahier.titre, "L'expédition des nombres");
  assert.equal(donnees.cahier.conclusion, "Bravo !");
  assert.equal(donnees.cahier.univers, "espace");
  assert.equal(donnees.llm.modele, "custom/sonnet-5-5");
  assert.equal(donnees.llm.harness.prompt, "constructeur-cahier-v2");
  assert.equal(donnees.llm.tokensSortie, 2048);
  assert.deepEqual(donnees.quota, { limite: 2, utilisees: 1, restantes: 1 });
});

test("cahier : un petit budget reste un appel simple ; erreur du fournisseur réduite à son code", async () => {
  env.MAX_TOKENS_CAHIERS = "8000";
  assert.equal((await cahier(demande())).donnees.source, "ia");
  assert.equal(env.AI.appels[0].parametres.stream, undefined);
  env.AI = creerAlias({ erreur: new Error("AiError: 400 Bad Request: invalid_request_error") });
  env.CAHIERS_GENERATIONS_JOUR = "5";
  const r = await cahier(demande());
  assert.equal(r.donnees.raison, "fournisseur-400");
  assert.ok(env.DB.lignes.some((l) => l[0] === "cahier" && l[5] === "fournisseur-400"));
});

test("cahier : sortie tronquée (budget atteint) signalée sans contenu partiel", async () => {
  env.AI = creerAlias({ fin: "length" });
  assert.equal((await cahier(demande())).donnees.raison, "sortie-tronquee");
});

test("cahier : lecture d'un flux SSE découpé, erreurs du flux remontées", async () => {
  const lu = await lireFluxGateway(fluxSse({ a: "é".repeat(200) }, { taille: 7 }));
  assert.deepEqual(JSON.parse(lu.contenu), { a: "é".repeat(200) });
  assert.equal(lu.fin, "stop");
  assert.equal(lu.tokensSortie, 2048);
  const erreur = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"error":{"code":400,"type":"invalid_request_error"}}\n\n')); c.close(); } });
  await assert.rejects(lireFluxGateway(erreur), /400/);
});

test("cahier : modèle et budget réglables, le message ne contient que des données du catalogue", async () => {
  env.MODELE_CAHIERS = "custom/autre";
  env.MAX_TOKENS_CAHIERS = "500000";
  await cahier(demande({ titre: "Cahier de Léa, 0612345678" }));
  const [appel] = env.AI.appels;
  assert.equal(appel.modele, "custom/autre");
  assert.equal(appel.parametres.max_tokens, 128000, "borné au plafond du registre");
  assert.doesNotMatch(appel.parametres.messages[1].content, /Léa|0612345678/);
  assert.doesNotMatch(appel.parametres.messages[0].content, /Léa/);
});

test("cahier : demande lue côté serveur, notions inconnues, jeux et doublons écartés", () => {
  const lue = lireDemandeCahier(CATALOGUE, { type: "fiches", longueur: "énorme", univers: "<script>", objectif: "tricher", notions: ["inconnue", notions[0], notions[0], jeu, 42, ...notions.slice(1, 10)] });
  assert.equal(lue.type, "fiches");
  assert.equal(lue.longueur, "standard");
  assert.equal(lue.univers, "aucun");
  assert.equal(lue.objectif, "reviser");
  assert.equal(lue.maquettes.length, Math.min(MAX_NOTIONS_CAHIER, notions.length));
  assert.ok(lue.maquettes.every((m) => !m.sujet.startsWith("jeux/")));
  assert.equal(new Set(lue.maquettes.map((m) => m.id)).size, lue.maquettes.length);
  assert.equal(lireDemandeCahier(CATALOGUE, { type: "roman", notions }), null);
  assert.equal(lireDemandeCahier(CATALOGUE, { type: "fiches", notions: ["inconnue"] }), null);
  const message = JSON.parse(messageCahier(CATALOGUE, lue, "fr"));
  assert.deepEqual(Object.keys(message.notions[0]).sort(), ["extrait", "matiere", "niveau", "notion", "rang", "titre"]);
  assert.deepEqual(Object.keys(message).sort(), ["langue", "longueur", "notions", "objectif", "plan", "type", "univers"]);
  assert.match(promptCahier("fr"), /EXACTEMENT le plan/);
  assert.match(message.type, /fiches de notes/);
});

test("plan déterministe : créneaux par type et longueur, difficulté croissante des exercices", () => {
  const plan = planCahier("vacances", "standard");
  assert.deepEqual(plan.map((c) => c.genre), ["histoire", "explication", "exemple", "retenir", "retenir", "exercice", "exercice", "exercice", "defi", "bilan"]);
  assert.deepEqual(plan.filter((c) => c.genre === "exercice").map((c) => c.niveau), [1, 2, 3]);
  assert.deepEqual(plan.map((c) => c.creneau), plan.map((_, i) => `c${i + 1}`));
  assert.deepEqual(planCahier("exercices", "complet").filter((c) => c.genre === "exercice").map((c) => c.niveau), [1, 1, 1, 2, 2, 3, 3]);
  assert.ok(planCahier("fiches", "court").length < planCahier("fiches", "complet").length);
  assert.equal(planCahier("brouillon", "court")[0].genre, "histoire");
});

test("cahier : chaque bloc validé pour son créneau, sections trop incomplètes écartées, sortie illisible rejetée", () => {
  const lue = lireDemandeCahier(CATALOGUE, { type: "fiches", longueur: "court", notions: notions.slice(0, 2) });
  const plan = planCahier("fiches", "court");
  const exo = plan.find((c) => c.genre === "exercice");
  assert.equal(validerBloc({ creneau: exo.creneau, titre: "", texte: "Sans réponse", indice: "", reponse: "" }, exo), null);
  assert.equal(validerBloc({ titre: "", texte: "Voir https://exemple.org", indice: "", reponse: "" }, plan[0]), null);
  assert.equal(validerBloc({ titre: "", texte: "x".repeat(801), indice: "", reponse: "" }, plan[0]), null);
  assert.deepEqual(validerBloc({ titre: "", texte: "Point clé.", indice: "ignoré", reponse: "ignorée" }, plan[2]), { genre: "retenir", texte: "Point clé." });
  const complets = plan.map(blocPour);
  const sortie = normaliserCahier(JSON.stringify({ titre: "T", introduction: "Intro.", conclusion: "Fin.", sections: [
    { notion: "intrus", blocs: complets },
    { notion: notions[0], blocs: [complets[0], { ...complets[0], texte: "doublon" }, { ...complets[1], creneau: "c99" }] },
    { notion: notions[1], blocs: [...complets].reverse().map((b, i) => (i === 0 ? { ...b, texte: "" } : b)) }
  ] }), lue);
  assert.deepEqual(sortie.sections.map((s) => s.notion), [notions[1]], "notion 1 : 1 créneau valide sur 6, écartée");
  assert.deepEqual(sortie.sections[0].blocs.map((b) => b.genre), plan.slice(0, -1).map((c) => c.genre), "remis dans l'ordre du plan");
  assert.throws(() => normaliserCahier("pas du json", lue));
});

test("cahier : sans IA consentie, demande invalide ou sortie inutilisable, l'interface construit le cahier seule", async () => {
  assert.equal((await cahier(demande({ utiliserLlm: false }))).donnees.raison, "ia-inactive");
  const invalide = await cahier({ type: "roman", notions, utiliserLlm: true });
  assert.equal(invalide.statut, 400);
  env.AI = creerAlias({ alterer: (s) => ({ ...s, blocs: [{ creneau: "c1", titre: "", texte: "", indice: "", reponse: "" }] }) });
  const vide = await cahier(demande());
  assert.equal(vide.donnees.source, "aucune");
  assert.equal(vide.donnees.raison, "sortie-invalide");
  assert.equal(vide.donnees.cahier, null);
  env.SKILLS_ACTIFS = "tuteur";
  assert.equal((await cahier(demande())).donnees.raison, "ia-indisponible");
  assert.ok(env.DB.lignes.some((l) => l[0] === "cahier" && l[4] === "catalogue"));
});

test("cahier : quota de générations par session, l'échec du fournisseur compte et libère la réservation", async () => {
  env.AI = creerAlias({ erreur: new Error("panne") });
  assert.equal((await cahier(demande())).donnees.raison, "fournisseur");
  env.AI = creerAlias();
  const deuxieme = await cahier(demande());
  assert.equal(deuxieme.donnees.source, "ia");
  assert.deepEqual(deuxieme.donnees.quota, { limite: 2, utilisees: 2, restantes: 0 });
  const refus = await cahier(demande());
  assert.equal(refus.donnees.raison, "quota");
  assert.equal(env.AI.appels.length, 1, "aucun appel au-delà du quota");
  env.CAHIERS_GENERATIONS_JOUR = "0";
  cookie = "";
  assert.equal((await cahier(demande())).donnees.raison, "quota");
});
