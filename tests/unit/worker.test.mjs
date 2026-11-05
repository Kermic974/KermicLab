import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker, { _reinitialiser, cleDeTri, suggestionsCatalogue } from "../../worker/src/index.js";
import { creerD1Llm } from "../helpers/d1-llm.mjs";

// ---- Doubles de test : D1, GitHub, Claude ----
function creerGitHub() {
  const issues = [];
  const appels = [];
  const fetchFactice = async (url, options = {}) => {
    const u = new URL(url);
    appels.push({ methode: options.method ?? "GET", chemin: u.pathname });
    if (!options.method || options.method === "GET") {
      const label = u.searchParams.get("labels");
      return Response.json(issues.filter((i) => i.labels.includes(label)));
    }
    const corps = JSON.parse(options.body);
    if (u.pathname.endsWith("/comments")) {
      const n = Number(u.pathname.split("/").at(-2));
      issues.find((i) => i.number === n).comments.push(corps.body);
      return Response.json({ id: 1 }, { status: 201 });
    }
    const issue = { number: issues.length + 1, title: corps.title, body: corps.body, labels: corps.labels, comments: [] };
    issues.push(issue);
    return Response.json(issue, { status: 201 });
  };
  return { issues, appels, fetchFactice };
}

function creerClaude(resultat, tokens = 100) {
  const appels = [];
  return {
    appels,
    messages: {
      create: async (params) => {
        appels.push(params);
        return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(resultat) }], usage: { output_tokens: tokens } };
      }
    }
  };
}

function creerWorkersAI(resultat, tokens = 100) {
  const appels = [];
  return {
    appels,
    run: async (modele, parametres) => {
      appels.push({ modele, parametres });
      return { response: JSON.stringify(resultat), usage: { completion_tokens: tokens } };
    }
  };
}

function creerCtx() {
  const promesses = [];
  return { promesses, waitUntil: (p) => promesses.push(p), attendre: () => Promise.all(promesses) };
}

let env, github, ctx, cookie;
beforeEach(() => {
  github = creerGitHub();
  globalThis.fetch = github.fetchFactice;
  env = {
    DB: creerD1Llm(), GITHUB_TOKEN: "jeton-test", GITHUB_REPO: "kermic974/trigoLab",
    ANTHROPIC_API_KEY: "cle-test", ORIGINES_AUTORISEES: "https://kermiclab.pages.dev",
    LLM_ACTIF: "true", LLM_SESSION_SECRET: "secret-factice-de-test-de-plus-de-32-caracteres",
    AI: { run: async () => { throw new Error("Workers AI indisponible dans ce test"); } }
  };
  ctx = creerCtx();
  cookie = "";
  _reinitialiser();
});
afterEach(() => env.DB.sqlite.close());

async function chat(corps, ip = "1.2.3.4") {
  const r = await worker.fetch(new Request("https://api.kermiclab.test/api/chat", {
    method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip, origin: "https://kermiclab.pages.dev", cookie }, body: JSON.stringify(corps)
  }), env, ctx);
  if (r.headers.has("set-cookie")) cookie = r.headers.get("set-cookie").split(";")[0];
  await ctx.attendre();
  return { statut: r.status, entetes: r.headers, donnees: await r.json() };
}

const typesKpi = () => env.DB.lignes.map((l) => l[0]);

test("sinus → maquette du catalogue, identique à chaque fois, sans appel au modèle", async () => {
  const claude = creerClaude({});
  _reinitialiser({ client: claude });
  const a = await chat({ message: "c'est quoi le sinus ?", langue: "fr" });
  const b = await chat({ message: "c'est quoi le sinus ?", langue: "fr" });
  assert.equal(a.statut, 200);
  assert.equal(a.donnees.type, "maquette");
  assert.equal(a.donnees.maquette.id, "trigo-cercle");
  assert.deepEqual(a.donnees, b.donnees);
  assert.equal(claude.appels.length, 0);
  assert.equal(a.entetes.get("access-control-allow-origin"), "https://kermiclab.pages.dev");
  assert.ok(typesKpi().includes("maquette_servie"));
});

test("cosinus en anglais → version française + issue traduction-manquante dédoublonnée", async () => {
  const a = await chat({ message: "what is the cosine?", langue: "en" });
  await chat({ message: "explain the unit circle", langue: "en" });
  assert.equal(a.donnees.maquette.langue, "fr");
  const traductions = github.issues.filter((i) => i.labels.includes("traduction-manquante"));
  assert.equal(traductions.length, 1);
  assert.equal(traductions[0].comments.length, 1);
});

test("question hors périmètre : aucun appel LLM ni issue automatique", async () => {
  const claude = creerClaude({});
  _reinitialiser({ client: claude });
  const a = await chat({ message: "réserve un voyage pour demain", langue: "fr" });
  assert.equal(a.donnees.type, "hors-catalogue");
  assert.match(a.donnees.texte, /pages KermicLab/);
  assert.equal(claude.appels.length, 0);
  assert.equal(github.issues.length, 0);
});

test("Workers AI est le moteur principal et demande une sortie JSON structurée", async () => {
  const ai = creerWorkersAI({
    langue: "fr", intention: "apprendre", reponse: "Le sinus donne la hauteur du point.",
    source_ids: ["trigo-cercle"]
  });
  const claude = creerClaude({});
  env.AI = ai;
  _reinitialiser({ client: claude });
  await chat({ message: "sinus", langue: "fr", utiliserLlm: true });
  const r = await chat({ message: "Explique plus simplement", langue: "fr", utiliserLlm: true });
  assert.equal(r.donnees.texte, "Le sinus donne la hauteur du point.");
  assert.equal(ai.appels[0].modele, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  assert.equal(ai.appels[0].parametres.response_format.type, "json_schema");
  assert.equal(ai.appels[0].parametres.messages.at(-1).content, "Explique plus simplement (fr)");
  assert.equal(ai.appels[0].parametres.max_tokens, 500);
  assert.match(ai.appels[0].parametres.messages[0].content, /Document de référence/);
  assert.equal(r.donnees.sources[0].url, "https://api.kermiclab.test/maquettes/trigo-cercle?lang=fr");
  assert.equal(r.donnees.llm.modele, ai.appels[0].modele);
  assert.equal(r.donnees.llm.quota.consommes, 100);
  assert.equal(claude.appels.length, 0);
});

test("échec Workers AI : repli Anthropic avec quota partagé et métadonnées exactes", async () => {
  const claude = creerClaude({ langue: "fr", intention: "apprendre", source_ids: ["trigo-cercle"], reponse: "Le sinus est une hauteur." });
  _reinitialiser({ client: claude });
  await chat({ message: "sinus", langue: "fr", utiliserLlm: true });
  const r = await chat({ message: "Donne-moi un exemple", langue: "fr", utiliserLlm: true });
  assert.equal(r.donnees.type, "reponse");
  assert.equal(r.donnees.llm.fournisseur, "anthropic");
  assert.equal(r.donnees.llm.repli, true);
  assert.equal(r.donnees.llm.quota.consommes, 600);
  assert.equal(r.donnees.llm.appels[0].comptage, "reservation-prudente");
  assert.equal(claude.appels[0].max_tokens, 500);
  assert.equal(claude.appels[0].model, "claude-haiku-5-5");
});

test("une source inventée n'est jamais publiée", async () => {
  delete env.ANTHROPIC_API_KEY;
  env.AI = creerWorkersAI({ langue: "fr", intention: "apprendre", source_ids: ["invente"], reponse: "Fausse réponse." });
  await chat({ message: "sinus", langue: "fr", utiliserLlm: true });
  const r = await chat({ message: "Donne-moi un exemple", langue: "fr", utiliserLlm: true });
  assert.equal(r.statut, 503);
  assert.equal(r.donnees.sources, undefined);
  assert.doesNotMatch(JSON.stringify(r.donnees), /Fausse réponse/);
});

test("données personnelles → refus, journalisé sans le texte", async () => {
  const r = await chat({ message: "je m'appelle Léa et j'habite 3 rue des Lilas", langue: "fr" });
  assert.equal(r.donnees.type, "refus");
  assert.ok(env.DB.lignes.every((l) => !JSON.stringify(l).includes("Léa")));
  assert.ok(env.DB.lignes.some((l) => l[0] === "refus" && String(l[5]).startsWith("donnees-personnelles")));
});

test("refus du modèle ou intention inappropriée → message de recentrage", async () => {
  _reinitialiser({ client: { messages: { create: async () => ({ stop_reason: "refusal", content: [] }) } } });
  await chat({ message: "sinus", langue: "fr", utiliserLlm: true });
  const r = await chat({ message: "un exemple", langue: "fr", utiliserLlm: true });
  assert.equal(r.donnees.type, "refus");
});

test("message trop long → 413", async () => {
  const r = await chat({ message: "a".repeat(600), langue: "fr" });
  assert.equal(r.statut, 413);
});

test("limitation de débit par IP", async () => {
  env.LIMITE_PAR_MINUTE = "3";
  const statuts = [];
  for (let i = 0; i < 5; i++) statuts.push((await chat({ message: "sinus", langue: "fr" }, "9.9.9.9")).statut);
  assert.deepEqual(statuts, [200, 200, 200, 429, 429]);
  assert.equal((await chat({ message: "sinus", langue: "fr" }, "8.8.8.8")).statut, 200);
});

test("sans clé API : réponse hors catalogue qui propose des questions routées vers une page", async () => {
  delete env.ANTHROPIC_API_KEY;
  const r = await chat({ message: "parle-moi du passé simple", langue: "fr" });
  assert.equal(r.donnees.type, "hors-catalogue");
  assert.match(r.donnees.texte, /pages KermicLab/);
  assert.ok(r.donnees.suggestions.length > 0);
  for (const q of r.donnees.suggestions) {
    const suite = await chat({ message: q, langue: "fr" });
    assert.equal(suite.donnees.type, "maquette", `« ${q} » doit ouvrir une page`);
  }
});

test("GET /api/suggestions : questions d'exemple du catalogue dans la langue demandée", async () => {
  const lire = async (lang) => (await (await worker.fetch(new Request(`https://api.kermiclab.test/api/suggestions?lang=${lang}`), env, ctx)).json()).suggestions;
  const anglais = (q) => /\b(what|how|why|which|explain|is|are|the|does|do|can)\b/i.test(q);
  const fr = await lire("fr");
  const en = await lire("en");
  assert.ok(fr.length >= 1 && fr.length <= 4);
  assert.ok(fr.every((q) => !anglais(q)));
  assert.ok(en.length >= 1 && en.every(anglais));
  // La rotation quotidienne change les notions tirées : on vérifie toutes les rotations, sans dépendre de la date.
  const { CATALOGUE } = await import("../../worker/src/generated/catalogue.js");
  for (let decalage = 0; decalage < CATALOGUE.index.maquettes.length; decalage++) {
    for (const q of suggestionsCatalogue(CATALOGUE.index, "fr", { decalage })) assert.ok(!anglais(q), `suggestion anglaise en français : ${q}`);
    for (const q of suggestionsCatalogue(CATALOGUE.index, "en", { decalage })) assert.ok(anglais(q), `suggestion non anglaise : ${q}`);
  }
});

test("suggestionsCatalogue : le repli vers une autre langue est global", () => {
  const questionsMixtes = { maquettes: [
    { id: "francais", questions: ["c'est quoi les fractions ?"] },
    { id: "anglais", questions: ["what are fractions?"] }
  ] };
  assert.deepEqual(suggestionsCatalogue(questionsMixtes, "en"), ["What are fractions?"]);

  const sansAnglais = { maquettes: [
    { id: "a", questions: ["c'est quoi les fractions ?"] },
    { id: "b", questions: ["comment calculer une fraction ?"] }
  ] };
  assert.deepEqual(suggestionsCatalogue(sansAnglais, "en"), [
    "C'est quoi les fractions ?",
    "Comment calculer une fraction ?"
  ]);
});

test("historique et contexte fournis par le client n'autorisent pas une question hors périmètre", async () => {
  const ai = creerWorkersAI({});
  env.AI = ai;
  await chat({ message: "sinus", langue: "fr" });
  const r = await chat({
    message: "écris une publicité pour une voiture", langue: "fr", maquette_id: "trigo-cercle",
    historique: [{ role: "user", content: "sinus" }]
  });
  assert.equal(r.donnees.type, "hors-catalogue");
  assert.equal(ai.appels.length, 0);
});

test("quota 1 000 tokens persistant malgré un rechargement et une réinitialisation d'isolat", async () => {
  const ai = creerWorkersAI({ langue: "fr", intention: "apprendre", source_ids: ["trigo-cercle"], reponse: "Le sinus donne la hauteur du point." }, 500);
  env.AI = ai;
  await chat({ message: "sinus", langue: "fr", utiliserLlm: true });
  assert.equal((await chat({ message: "un exemple", langue: "fr", utiliserLlm: true })).donnees.llm.quota.consommes, 500);
  _reinitialiser();
  await chat({ message: "sinus", langue: "fr", utiliserLlm: true });
  assert.equal((await chat({ message: "un exemple", langue: "fr", utiliserLlm: true })).donnees.llm.quota.consommes, 1000);
  const r = await chat({ message: "un exemple", langue: "fr", utiliserLlm: true });
  assert.equal(r.statut, 429);
  assert.equal(ai.appels.length, 2);
  assert.equal((await chat({ message: "sinus", langue: "fr", utiliserLlm: true })).donnees.type, "maquette");
});

test("sans cookie valide, le client ne peut pas appeler le LLM avec un quota inventé", async () => {
  const ai = creerWorkersAI({});
  env.AI = ai;
  const r = await chat({ message: "un exemple", langue: "fr", utiliserLlm: true, tokensRestants: 1000, maquette_id: "trigo-cercle" });
  assert.equal(r.statut, 428);
  assert.equal(ai.appels.length, 0);
});

test("sans opt-in utilisateur, le Worker ne crée pas de session et n'appelle aucun modèle", async () => {
  const ai = creerWorkersAI({});
  env.AI = ai;
  const page = await chat({ message: "sinus", langue: "fr", utiliserLlm: false });
  const suite = await chat({ message: "Donne-moi un exemple", langue: "fr", utiliserLlm: false });
  assert.equal(page.entetes.has("set-cookie"), false);
  assert.equal(suite.donnees.type, "hors-catalogue");
  assert.equal(ai.appels.length, 0);
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM sessions_llm").get().n, 0);
});

test("arrêt d'urgence LLM_ACTIF : les clés seules ne permettent pas d'appel", async () => {
  env.LLM_ACTIF = "false";
  const ai = creerWorkersAI({});
  env.AI = ai;
  const page = await chat({ message: "sinus", langue: "fr" });
  assert.equal(page.entetes.has("set-cookie"), false);
  const r = await chat({ message: "un exemple", langue: "fr" });
  assert.equal(r.donnees.type, "hors-catalogue");
  assert.equal(ai.appels.length, 0);
});

test("GET /api/llm/status expose uniquement la disponibilité effective et sans cache", async () => {
  const lire = async () => worker.fetch(new Request("https://api.kermiclab.test/api/llm/status", {
    headers: { origin: "https://kermiclab.pages.dev" }
  }), env, ctx);
  const actif = await lire();
  assert.equal((await actif.json()).actif, true);
  assert.equal(actif.headers.get("cache-control"), "no-store");
  env.LLM_ACTIF = "false";
  const inactif = await lire();
  assert.deepEqual(await inactif.json(), { actif: false });
  assert.equal(inactif.headers.get("cache-control"), "no-store");
  env.LLM_ACTIF = "true";
  delete env.LLM_SESSION_SECRET;
  const sansSecret = await lire();
  assert.deepEqual(await sansSecret.json(), { actif: false });
});

test("origine non autorisée : refus avant toute session ou dépense LLM", async () => {
  const r = await worker.fetch(new Request("https://api.kermiclab.test/api/chat", {
    method: "POST", headers: { origin: "https://inconnu.invalid", "content-type": "application/json" },
    body: JSON.stringify({ message: "sinus", langue: "fr" })
  }), env, ctx);
  assert.equal(r.status, 403);
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM sessions_llm").get().n, 0);
});

test("GET /maquettes/:id sert le fichier du catalogue tel quel", async () => {
  const r = await worker.fetch(new Request("https://api.kermiclab.test/maquettes/trigo-cercle?lang=fr"), env, ctx);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("x-kermiclab-maquette"), "trigo-cercle@1.0.0");
  assert.match(r.headers.get("content-security-policy"), /frame-ancestors 'self' https:\/\/kermiclab\.pages\.dev/);
  assert.match(await r.text(), /"id": "trigo-cercle"/);
  const absent = await worker.fetch(new Request("https://api.kermiclab.test/maquettes/inconnue"), env, ctx);
  assert.equal(absent.status, 404);
});

test("POST /api/support crée une issue support", async () => {
  const r = await worker.fetch(new Request("https://api.kermiclab.test/api/support", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "Le bouton Défi ne marche pas", langue: "fr" })
  }), env, ctx);
  assert.equal((await r.json()).ok, true);
  assert.equal(github.issues.filter((i) => i.labels.includes("support")).length, 1);
});

test("HEAD /maquettes/:id répond 200", async () => {
  const r = await worker.fetch(new Request("https://api.kermiclab.test/maquettes/trigo-cercle", { method: "HEAD" }), env, ctx);
  assert.equal(r.status, 200);
});

test("hors API : les fichiers statiques sont servis par le binding ASSETS", async () => {
  env.ASSETS = { fetch: async (req) => new Response(`statique ${new URL(req.url).pathname}`) };
  const r = await worker.fetch(new Request("https://trigolab.test/index.html"), env, ctx);
  assert.equal(await r.text(), "statique /index.html");
  const api = await worker.fetch(new Request("https://trigolab.test/api/inconnue"), env, ctx);
  assert.equal(api.status, 404);
});

test("GET /api/catalogue : toutes les notions, rangées par niveau scolaire puis par titre", async () => {
  const r = await worker.fetch(new Request("https://api.kermiclab.test/api/catalogue"), env, ctx);
  assert.equal(r.status, 200);
  const { notions } = await r.json();
  const { CATALOGUE } = await import("../../worker/src/generated/catalogue.js");
  assert.equal(notions.length, CATALOGUE.index.maquettes.length);
  const ordre = ["college", "seconde", "premiere", "terminale", "autres"];
  const matieres = [...new Set(notions.map((n) => n.matiere))];
  assert.equal(matieres[0], "mathematiques");
  assert.ok(matieres.includes("physique-chimie"));
  assert.ok(matieres.includes("svt"));
  assert.ok(matieres.includes("emc"));
  assert.ok(matieres.includes("philosophie"));
  for (const id of ["art", "bonheur", "conscience", "inconscient", "nature", "religion", "temps", "travail"]) {
    assert.ok(notions.some((n) => n.id === id && n.matiere === "philosophie" && n.niveau === "terminale"), id);
  }
  for (let i = 1; i < notions.length; i++) {
    const [a, b] = [notions[i - 1], notions[i]];
    if (a.matiere !== b.matiere) { assert.ok(matieres.indexOf(a.matiere) < matieres.indexOf(b.matiere)); continue; }
    assert.ok(ordre.indexOf(a.niveau) < ordre.indexOf(b.niveau) || (a.niveau === b.niveau && cleDeTri(a.titre).localeCompare(cleDeTri(b.titre), "fr", { sensitivity: "base" }) <= 0), `${a.id} puis ${b.id}`);
  }
  assert.deepEqual(Object.keys(notions[0]).sort(), ["id", "matiere", "niveau", "titre", "version"]);
  assert.equal(cleDeTri("Le théorème de Pythagore"), "théorème de Pythagore");
  assert.equal(cleDeTri("L'exponentielle"), "exponentielle");
  assert.equal(cleDeTri("Les angles et les triangles"), "angles et les triangles");
  assert.equal(cleDeTri("Lecture"), "Lecture");
});
