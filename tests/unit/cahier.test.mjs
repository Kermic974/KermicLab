import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker, { _reinitialiser } from "../../worker/src/index.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import {
  MAX_NOTIONS_CAHIER, lireDemandeCahier, messageCahier, normaliserCahier, promptCahier, validerBloc
} from "../../worker/src/cahier-llm.js";
import { creerD1Llm } from "../helpers/d1-llm.mjs";

// ---- Constructeur de cahiers enrichi par l'alias AI Gateway `custom/sonnet-5-5` ----

const notions = CATALOGUE.index.maquettes.filter((m) => !m.sujet.startsWith("jeux/") && CATALOGUE.pages[m.id]).map((m) => m.id);
const jeu = CATALOGUE.index.maquettes.find((m) => m.sujet.startsWith("jeux/"))?.id;

/** Faux binding AI : relit les notions du message (données du serveur) et rédige un cahier conforme. */
function creerAlias({ alterer = (s) => s, brut = null, erreur = null } = {}) {
  const appels = [];
  return {
    appels,
    run: async (modele, parametres, options) => {
      appels.push({ modele, parametres, options });
      if (erreur) throw erreur;
      if (brut !== null) return { choices: [{ message: { content: brut } }] };
      const { notions: liste } = JSON.parse(parametres.messages[1].content);
      const sections = liste.map((n, i) => alterer({
        notion: n.notion,
        blocs: [
          { genre: "explication", texte: `Rappel ${i + 1}.`, reponse: "" },
          { genre: "retenir", texte: "Point clé.", reponse: "" },
          { genre: "exercice", texte: `Exercice ${i + 1}.`, reponse: `Solution ${i + 1}.` }
        ]
      }, i));
      return { choices: [{ message: { content: JSON.stringify({ introduction: "Bienvenue.", sections }) }, finish_reason: "stop" }], usage: { completion_tokens: 2048 } };
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

const demande = (extra = {}) => ({ type: "exercices", longueur: "complet", langue: "fr", notions: notions.slice(0, 2), utiliserLlm: true, ...extra });

test("cahier : alias custom/sonnet-5-5 via kermiclab-gateway, 100 000 tokens max, sans cache ni journal", async () => {
  const { statut, donnees } = await cahier(demande());
  assert.equal(statut, 200);
  assert.equal(donnees.source, "ia");
  const [appel] = env.AI.appels;
  assert.equal(appel.modele, "custom/sonnet-5-5");
  assert.equal(appel.parametres.max_tokens, 100000);
  assert.equal(appel.parametres.response_format.json_schema.name, "cahier");
  assert.deepEqual(appel.options.gateway, { id: "kermiclab-gateway", skipCache: true, collectLog: false });
  assert.deepEqual(donnees.cahier.sections.map((s) => s.notion), notions.slice(0, 2));
  assert.match(donnees.cahier.sections[0].url, new RegExp(`/maquettes/${notions[0]}\\?lang=fr$`));
  assert.deepEqual(donnees.cahier.sections[0].blocs[2], { genre: "exercice", texte: "Exercice 1.", reponse: "Solution 1." });
  assert.deepEqual(donnees.cahier.sections[0].blocs[0], { genre: "explication", texte: "Rappel 1." });
  assert.equal(donnees.llm.modele, "custom/sonnet-5-5");
  assert.equal(donnees.llm.harness.prompt, "constructeur-cahier-v1");
  assert.equal(donnees.llm.tokensSortie, 2048);
  assert.deepEqual(donnees.quota, { limite: 2, utilisees: 1, restantes: 1 });
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
  const lue = lireDemandeCahier(CATALOGUE, { type: "fiches", longueur: "énorme", notions: ["inconnue", notions[0], notions[0], jeu, 42, ...notions.slice(1, 10)] });
  assert.equal(lue.type, "fiches");
  assert.equal(lue.longueur, "standard");
  assert.equal(lue.maquettes.length, Math.min(MAX_NOTIONS_CAHIER, notions.length));
  assert.ok(lue.maquettes.every((m) => !m.sujet.startsWith("jeux/")));
  assert.equal(new Set(lue.maquettes.map((m) => m.id)).size, lue.maquettes.length);
  assert.equal(lireDemandeCahier(CATALOGUE, { type: "roman", notions }), null);
  assert.equal(lireDemandeCahier(CATALOGUE, { type: "fiches", notions: ["inconnue"] }), null);
  const message = JSON.parse(messageCahier(CATALOGUE, lue, "fr"));
  assert.deepEqual(Object.keys(message.notions[0]).sort(), ["extrait", "matiere", "niveau", "notion", "rang", "titre"]);
  assert.match(promptCahier("fr", "vacances", "court"), /séance de révision/);
});

test("cahier : blocs invalides retirés, sections hors demande ignorées, sortie illisible rejetée", () => {
  const lue = lireDemandeCahier(CATALOGUE, { type: "exercices", notions: notions.slice(0, 2) });
  assert.equal(validerBloc({ genre: "exercice", texte: "Sans réponse", reponse: "" }), null);
  assert.equal(validerBloc({ genre: "retenir", texte: "Voir https://exemple.org", reponse: "" }), null);
  assert.equal(validerBloc({ genre: "poeme", texte: "x", reponse: "" }), null);
  assert.equal(validerBloc({ genre: "retenir", texte: "x".repeat(701), reponse: "" }), null);
  const sortie = normaliserCahier(JSON.stringify({ introduction: "Intro.", sections: [
    { notion: "intrus", blocs: [{ genre: "retenir", texte: "Hors demande.", reponse: "" }] },
    { notion: notions[1], blocs: [{ genre: "retenir", texte: "Garde-moi.", reponse: "" }, { genre: "exercice", texte: "Sans réponse.", reponse: "" }] }
  ] }), lue);
  assert.deepEqual(sortie.sections.map((s) => s.notion), [notions[1]]);
  assert.equal(sortie.sections[0].blocs.length, 1);
  assert.throws(() => normaliserCahier("pas du json", lue));
});

test("cahier : sans IA consentie, demande invalide ou sortie inutilisable, l'interface construit le cahier seule", async () => {
  assert.equal((await cahier(demande({ utiliserLlm: false }))).donnees.raison, "ia-inactive");
  const invalide = await cahier({ type: "roman", notions, utiliserLlm: true });
  assert.equal(invalide.statut, 400);
  env.AI = creerAlias({ alterer: (s) => ({ ...s, blocs: [{ genre: "exercice", texte: "x", reponse: "" }] }) });
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
  assert.equal((await cahier(demande())).donnees.raison, "ia-indisponible");
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
