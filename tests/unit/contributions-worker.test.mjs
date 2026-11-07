import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker from "../../worker/src/index.js";
import { gererApiContributions, estRouteContribution, corpsIssueContribution, LABEL_ISSUE } from "../../worker/src/contributions.js";
import { supprimerCompte } from "../../worker/src/comptes.js";
import { VERSION_CHARTE, MAX_OUVERTES_PAR_AUTEUR } from "../../web/contributions.js";
import { creerD1Comptes } from "../helpers/d1-comptes.mjs";

// Garde-fous des contributions côté Worker (ADR 0023) : rôles, quatre yeux, données personnelles, issue GitHub.
const ORIGINE = "https://www.kermiclab.online";
const catalogue = { maquettes: [{ id: "pythagore", version: "1.4.0" }] };
let env, issues;
beforeEach(() => {
  env = { DB: creerD1Comptes(), ORIGINES_AUTORISEES: ORIGINE, GITHUB_TOKEN: "jeton-test", GITHUB_REPO: "proprio/depot" };
  for (const [id, role] of [["parent-1", "parent"], ["contrib-1", "contributeur"], ["contrib-2", "contributeur"], ["prof-1", "prof"], ["prof-2", "prof"], ["admin-1", "admin"]]) {
    env.DB.sqlite.prepare("INSERT INTO comptes (id, email_hash, role) VALUES (?, ?, ?)").run(id, `h-${id}`, role);
  }
  env.DB.sqlite.prepare("INSERT INTO sessions (id, compte_id, expires_at) VALUES ('s-contrib', 'contrib-1', '2999-01-01T00:00:00Z')").run();
  issues = [];
});
afterEach(() => env.DB.sqlite.close());

/** Double de l'API GitHub : liste vide, puis création d'issue numérotée. */
const fetchGithub = async (url, init = {}) => {
  if (!init.method) return Response.json([]);
  issues.push({ url, ...JSON.parse(init.body) });
  return Response.json({ number: 40 + issues.length }, { status: 201 });
};

const appel = (chemin, { methode = "GET", corps, compte = "contrib-1", fetchImpl = fetchGithub } = {}) => gererApiContributions(
  new Request(`https://api.test${chemin}`, { method: methode, headers: { "content-type": "application/json" }, body: corps === undefined ? undefined : JSON.stringify(corps) }),
  env, compte, { catalogue, fetchImpl }
);
const proposition = (extra = {}) => ({
  notion_id: "pythagore", chemin: "niveaux.1.paragraphes.0", nature: "modification", type: "orthographe",
  texte_actuel: "Texte actuel du paragraphe.", texte_propose: "Texte corrigé du paragraphe.", motif: "Coquille.", charte_version: VERSION_CHARTE, ...extra
});
const proposer = async (compte = "contrib-1", extra) => (await (await appel("/api/contributions", { methode: "POST", corps: proposition(extra), compte })).json()).id;
const agir = (id, corps, compte) => appel(`/api/contributions/${id}`, { methode: "PATCH", corps, compte });

test("routes reconnues", () => {
  assert.equal(estRouteContribution("/api/contributions"), true);
  assert.equal(estRouteContribution("/api/contributions/123e4567-e89b-12d3-a456-426614174000"), true);
  assert.equal(estRouteContribution("/api/contributions/../eleves"), false);
});

test("rôle requis : un parent ne contribue pas, un contributeur ne relit pas", async () => {
  const r = await appel("/api/contributions", { compte: "parent-1" });
  assert.equal(r.status, 403);
  assert.deepEqual(await r.json(), { erreur: "role-requis" });
  assert.equal((await appel("/api/contributions?vue=relecture")).status, 403);
  assert.equal((await appel("/api/contributions?vue=relecture", { compte: "prof-1" })).status, 200);
});

test("création : validée, version de la notion prise au catalogue, charte enregistrée", async () => {
  const r = await appel("/api/contributions", { methode: "POST", corps: proposition({ notion_version: "9.9.9" }) });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  const ligne = env.DB.sqlite.prepare("SELECT * FROM contributions WHERE id = ?").get(id);
  assert.equal(ligne.auteur_id, "contrib-1");
  assert.equal(ligne.notion_version, "1.4.0", "la version vient du catalogue, pas du navigateur");
  assert.equal(ligne.statut, "proposee");
  assert.equal(ligne.charte_version, VERSION_CHARTE);
  const miennes = await (await appel("/api/contributions")).json();
  assert.equal(miennes.length, 1);
  assert.equal((await (await appel("/api/contributions", { compte: "contrib-2" })).json()).length, 0, "chacun ne voit que les siennes");
});

test("création refusée : notion inconnue, champ non textuel, charte absente, donnée personnelle, JSON invalide", async () => {
  const refus = async (extra) => { const r = await appel("/api/contributions", { methode: "POST", corps: proposition(extra) }); return { s: r.status, j: await r.json() }; };
  assert.deepEqual((await refus({ notion_id: "inconnue" })).j.details, { notion: "inconnue" });
  assert.equal((await refus({ chemin: "application.exercices.0.reponse" })).j.details.chemin, "invalide");
  assert.equal((await refus({ charte_version: undefined })).j.details.charte, "requise");
  const perso = await refus({ texte_propose: "Écrivez-moi : prof@exemple.fr" });
  assert.equal(perso.s, 400);
  assert.equal(perso.j.erreur, "donnees-personnelles");
  assert.equal((await refus({ motif: "Appelez le 06 12 34 56 78" })).j.erreur, "donnees-personnelles");
  const r = await gererApiContributions(new Request("https://api.test/api/contributions", { method: "POST", body: "{x" }), env, "contrib-1", { catalogue });
  assert.equal(r.status, 400);
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM contributions").get().n, 0);
});

test("plafond de contributions en cours par auteur", async () => {
  for (let i = 0; i < MAX_OUVERTES_PAR_AUTEUR; i++) assert.ok(await proposer("contrib-1", { texte_propose: `Version ${i}.` }));
  const r = await appel("/api/contributions", { methode: "POST", corps: proposition() });
  assert.equal(r.status, 409);
  assert.ok(await proposer("contrib-2"), "le plafond est propre à chaque auteur");
});

test("relecture : demande de révision, correction par l'auteur, validation et issue GitHub", async () => {
  const id = await proposer();
  assert.equal((await agir(id, { action: "reviser", commentaire: "" }, "prof-1")).status, 400, "commentaire requis");
  const revision = await (await agir(id, { action: "reviser", commentaire: "Garde le gras sur hypoténuse." }, "prof-1")).json();
  assert.equal(revision.statut, "a_reviser");
  assert.equal(revision.commentaire, "Garde le gras sur hypoténuse.");

  assert.equal((await agir(id, { action: "modifier", ...proposition({ texte_propose: "Texte **corrigé**." }) }, "contrib-2")).status, 404, "pas un autre contributeur");
  const corrigee = await (await agir(id, { action: "modifier", ...proposition({ texte_propose: "Texte **corrigé**.", chemin: "intro" }) })).json();
  assert.equal(corrigee.statut, "proposee");
  assert.equal(corrigee.texte_propose, "Texte **corrigé**.");
  assert.equal(corrigee.chemin, "niveaux.1.paragraphes.0", "le champ visé ne change pas");

  const validee = await (await agir(id, { action: "valider", commentaire: "Merci @tous" }, "prof-1")).json();
  assert.equal(validee.statut, "validee");
  assert.equal(validee.issue, "creee");
  assert.equal(validee.issue_numero, 41);
  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].labels, [LABEL_ISSUE]);
  assert.match(issues[0].title, /pythagore · niveaux\.1\.paragraphes\.0/);
  assert.match(issues[0].body, /> Texte \*\*corrigé\*\*\./);
  assert.doesNotMatch(issues[0].body, /contrib-1|prof-1|@tous/, "ni identifiant de compte ni mention");
  assert.equal(env.DB.sqlite.prepare("SELECT relecteur_id FROM contributions WHERE id = ?").get(id).relecteur_id, "prof-1");

  assert.equal((await agir(id, { action: "refuser", commentaire: "Trop tard." }, "prof-2")).status, 409, "déjà validée");
  assert.equal((await (await agir(id, { action: "integrer" }, "prof-2")).json()).statut, "integree");
});

test("quatre yeux : un prof ne valide pas sa propre contribution, l'admin le peut", async () => {
  const id = await proposer("prof-1");
  const r = await agir(id, { action: "valider" }, "prof-1");
  assert.equal(r.status, 409);
  assert.deepEqual(await r.json(), { erreur: "relecture-quatre-yeux" });
  assert.equal((await (await agir(id, { action: "valider" }, "prof-2")).json()).statut, "validee");
  const autre = await proposer("admin-1");
  assert.equal((await (await agir(autre, { action: "refuser", commentaire: "Doublon d'une autre." }, "admin-1")).json()).statut, "refusee");
});

test("un contributeur ne décide pas ; l'auteur retire sa contribution ; GitHub indisponible n'annule pas la validation", async () => {
  const id = await proposer();
  assert.equal((await agir(id, { action: "valider" }, "contrib-1")).status, 409);
  assert.equal((await agir(id, { action: "retirer" }, "prof-1")).status, 409, "seul l'auteur retire");
  const retiree = await (await agir(id, { action: "retirer" })).json();
  assert.equal(retiree.statut, "retiree");
  const liste = await (await appel("/api/contributions?vue=relecture", { compte: "prof-1" })).json();
  assert.equal(liste.length, 0, "les contributions retirées sortent du tableau de bord");

  const id2 = await proposer();
  const r = await appel(`/api/contributions/${id2}`, { methode: "PATCH", corps: { action: "valider" }, compte: "prof-1", fetchImpl: async () => new Response("", { status: 500 }) });
  const j = await r.json();
  assert.equal(j.statut, "validee");
  assert.equal(j.issue, "indisponible");
  assert.equal((await agir(id2, { action: "publier" }, "prof-1")).status, 400);
});

test("suppression du compte : ses contributions effacées, ses décisions conservées sans relecteur", async () => {
  const id = await proposer("contrib-1");
  const autre = await proposer("contrib-2");
  await agir(autre, { action: "refuser", commentaire: "Hors programme." }, "prof-1");
  await supprimerCompte(env, "contrib-1");
  await supprimerCompte(env, "prof-1");
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM contributions WHERE id = ?").get(id).n, 0);
  const restante = env.DB.sqlite.prepare("SELECT statut, relecteur_id FROM contributions WHERE id = ?").get(autre);
  assert.deepEqual({ ...restante }, { statut: "refusee", relecteur_id: null });
});

test("corps d'issue : citation, nature ajout", () => {
  const corps = corpsIssueContribution({ id: "c", notion_id: "n", notion_version: "1", chemin: "intro", nature: "ajout", type: "exemple", texte_actuel: "a\nb", texte_propose: "@x", motif: "m" });
  assert.match(corps, /Texte à insérer après/);
  assert.match(corps, /> a\n> b/);
  assert.doesNotMatch(corps, /@x/);
});

test("Worker : 401 sans session, CORS avec PATCH, 403 pour un parent connecté", async () => {
  const sans = await worker.fetch(new Request("https://api.test/api/contributions", { headers: { origin: ORIGINE } }), env, {});
  assert.equal(sans.status, 401);
  const options = await worker.fetch(new Request("https://api.test/api/contributions", { method: "OPTIONS", headers: { origin: ORIGINE } }), env, {});
  assert.match(options.headers.get("access-control-allow-methods"), /PATCH/);
  const avec = await worker.fetch(new Request("https://api.test/api/contributions", { headers: { origin: ORIGINE, cookie: "session=s-contrib" } }), env, {});
  assert.equal(avec.status, 200);
  assert.equal(avec.headers.get("access-control-allow-origin"), ORIGINE);
  env.DB.sqlite.prepare("UPDATE comptes SET role = 'parent' WHERE id = 'contrib-1'").run();
  assert.equal((await worker.fetch(new Request("https://api.test/api/contributions", { headers: { cookie: "session=s-contrib" } }), env, {})).status, 403);
});
