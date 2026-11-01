import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import worker, { _reinitialiser, cleDeTri } from "../../worker/src/index.js";

// ---- Doubles de test : D1, GitHub, Claude ----
function creerD1() {
  const lignes = [];
  return {
    lignes,
    prepare() { return { bind: (...v) => ({ run: async () => { lignes.push(v); } }) }; }
  };
}

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

function creerClaude(resultat) {
  const appels = [];
  return {
    appels,
    messages: {
      create: async (params) => {
        appels.push(params);
        return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(resultat) }] };
      }
    }
  };
}

function creerCtx() {
  const promesses = [];
  return { promesses, waitUntil: (p) => promesses.push(p), attendre: () => Promise.all(promesses) };
}

let env, github, ctx;
beforeEach(() => {
  github = creerGitHub();
  globalThis.fetch = github.fetchFactice;
  env = { DB: creerD1(), GITHUB_TOKEN: "jeton-test", GITHUB_REPO: "kermic974/trigoLab", ANTHROPIC_API_KEY: "cle-test", ORIGINES_AUTORISEES: "https://kermiclab.pages.dev" };
  ctx = creerCtx();
  _reinitialiser();
});

async function chat(corps, ip = "1.2.3.4") {
  const r = await worker.fetch(new Request("https://api.kermiclab.test/api/chat", {
    method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip, origin: "https://kermiclab.pages.dev" }, body: JSON.stringify(corps)
  }), env, ctx);
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

test("question non couverte → réponse + issue maquette-manquante, puis commentaire", async () => {
  const claude = creerClaude({
    langue: "fr", intention: "apprendre", maquette_id: "aucune", maquette_pertinente: true,
    sujet: "francais/passe-compose", plan_onglets: ["explication", "les auxiliaires", "mise en situation"],
    reponse: "Le passé composé se forme avec un auxiliaire et un participe passé."
  });
  _reinitialiser({ client: claude });
  const a = await chat({ message: "comment conjuguer au passé composé ?", langue: "fr" });
  await chat({ message: "explique-moi le passé composé", langue: "fr" });
  assert.equal(a.donnees.type, "reponse");
  assert.equal(a.donnees.exception, true);
  const issues = github.issues.filter((i) => i.labels.includes("maquette-manquante"));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].title, "[maquette-manquante] francais/passe-compose");
  assert.match(issues[0].body, /les auxiliaires/);
  assert.equal(issues[0].comments.length, 1);
  assert.equal(claude.appels[0].model, "claude-haiku-5-5");
  assert.equal(claude.appels[0].output_config.format.type, "json_schema");
  assert.ok(typesKpi().includes("exception"));
});

test("le modèle peut router vers une maquette existante", async () => {
  _reinitialiser({ client: creerClaude({ langue: "fr", intention: "apprendre", maquette_id: "trigo-cercle", maquette_pertinente: true, sujet: "mathematiques/trigonometrie", plan_onglets: [], reponse: "…" }) });
  const r = await chat({ message: "comment trouver la hauteur d'un arbre avec son ombre ?", langue: "fr" });
  assert.equal(r.donnees.type, "maquette");
  assert.equal(r.donnees.maquette.id, "trigo-cercle");
});

test("un ID inventé par le modèle est ignoré", async () => {
  _reinitialiser({ client: creerClaude({ langue: "fr", intention: "conversation", maquette_id: "n-existe-pas", maquette_pertinente: false, sujet: "", plan_onglets: [], reponse: "Bonjour !" }) });
  const r = await chat({ message: "bonjour", langue: "fr" });
  assert.equal(r.donnees.type, "reponse");
  assert.equal(r.donnees.texte, "Bonjour !");
  assert.equal(github.issues.length, 0);
});

test("données personnelles → refus, journalisé sans le texte", async () => {
  const r = await chat({ message: "je m'appelle Léa et j'habite 3 rue des Lilas", langue: "fr" });
  assert.equal(r.donnees.type, "refus");
  assert.ok(env.DB.lignes.every((l) => !JSON.stringify(l).includes("Léa")));
  assert.ok(env.DB.lignes.some((l) => l[0] === "refus" && String(l[5]).startsWith("donnees-personnelles")));
});

test("refus du modèle ou intention inappropriée → message de recentrage", async () => {
  _reinitialiser({ client: { messages: { create: async () => ({ stop_reason: "refusal", content: [] }) } } });
  const r = await chat({ message: "une question bizarre", langue: "fr" });
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
  const r = await chat({ message: "comment conjuguer au passé composé ?", langue: "fr" });
  assert.equal(r.donnees.type, "hors-catalogue");
  assert.match(r.donnees.texte, /\d+ notions, par exemple/);
  assert.ok(r.donnees.suggestions.length > 0);
  for (const q of r.donnees.suggestions) {
    const suite = await chat({ message: q, langue: "fr" });
    assert.equal(suite.donnees.type, "maquette", `« ${q} » doit ouvrir une page`);
  }
});

test("GET /api/suggestions : questions d'exemple du catalogue dans la langue demandée", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  const lire = async (lang) => (await (await worker.fetch(new Request(`https://api.kermiclab.test/api/suggestions?lang=${lang}`), env, ctx)).json()).suggestions;
  const fr = await lire("fr");
  const en = await lire("en");
  assert.ok(fr.length >= 1 && fr.length <= 4);
  assert.ok(fr.every((q) => !/\b(what|how|explain)\b/i.test(q)));
  assert.ok(en.length >= 1 && en.every((q) => /\b(what|how|explain)\b/i.test(q)));
});

test("relances du modèle : bornées, modérées et sans doublon", async () => {
  _reinitialiser({ client: creerClaude({
    langue: "fr", intention: "apprendre", maquette_id: "aucune", maquette_pertinente: false, sujet: "francais/passe-simple", plan_onglets: [],
    reponse: "Le passé simple raconte des actions terminées.",
    relances: ["Donne-moi un exemple", "Donne-moi un exemple", "x".repeat(200), "Mon adresse est 12 rue des Lilas", "Lance-moi un défi", "Et les verbes du 3e groupe ?", 4]
  }) });
  const r = await chat({ message: "c'est quoi le passé simple ?", langue: "fr" });
  assert.equal(r.donnees.type, "reponse");
  assert.deepEqual(r.donnees.suggestions, ["Donne-moi un exemple", "Lance-moi un défi", "Et les verbes du 3e groupe ?"]);
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
