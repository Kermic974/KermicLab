import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker from "../../worker/src/index.js";
import { gererApiCompte, validerCreationEnfant, lignesProgres, estRouteCompte, MAX_NOTIONS_PROGRES } from "../../worker/src/comptes.js";
import { MAX_ENFANTS, VERSION_CONSENTEMENT } from "../../web/comptes.js";
import { creerD1Comptes } from "../helpers/d1-comptes.mjs";

// Garde-fous des comptes famille côté Worker (ADR 0017) : l'interface n'est jamais la seule protection.
const ORIGINE = "https://www.kermiclab.online";
let env;
beforeEach(() => {
  env = { DB: creerD1Comptes(), ORIGINES_AUTORISEES: ORIGINE };
  for (const [id, hash] of [["parent-1", "h1"], ["parent-2", "h2"]]) {
    env.DB.sqlite.prepare("INSERT INTO comptes (id, email_hash) VALUES (?, ?)").run(id, hash);
  }
  env.DB.sqlite.prepare("INSERT INTO sessions (id, compte_id, expires_at) VALUES ('s1', 'parent-1', '2999-01-01T00:00:00Z')").run();
});
afterEach(() => env.DB.sqlite.close());

const enfantValide = { prenom_affiche: "Léa", age_tranche: "6-10", consentement_version: VERSION_CONSENTEMENT };
const appel = (chemin, { methode = "GET", corps, parent = "parent-1" } = {}) => gererApiCompte(new Request(`https://api.test${chemin}`, {
  method: methode, headers: { "content-type": "application/json" }, body: corps === undefined ? undefined : JSON.stringify(corps)
}), env, parent);
const creer = async (corps = enfantValide, parent) => (await appel("/api/eleves", { methode: "POST", corps, parent }));

test("création : consentement versionné obligatoire, enregistré sur le profil et le compte", async () => {
  const sans = await creer({ ...enfantValide, consentement_version: undefined });
  assert.equal(sans.status, 400);
  assert.deepEqual(await sans.json(), { erreur: "consentement-requis" });
  assert.equal((await creer({ ...enfantValide, consentement_version: "consentement-v0" })).status, 400, "ancienne version refusée");

  const r = await creer();
  assert.equal(r.status, 201);
  const { id } = await r.json();
  const ligne = env.DB.sqlite.prepare("SELECT parent_id, prenom_affiche, age_tranche, consentement_version, consentement_at FROM eleves WHERE id = ?").get(id);
  assert.equal(ligne.parent_id, "parent-1");
  assert.equal(ligne.consentement_version, VERSION_CONSENTEMENT);
  assert.ok(ligne.consentement_at);
  assert.equal(env.DB.sqlite.prepare("SELECT consent_version FROM comptes WHERE id = 'parent-1'").get().consent_version, VERSION_CONSENTEMENT);
});

test("création : prénom selon les règles du pseudo, tranche d'âge connue, JSON valide", async () => {
  assert.deepEqual(validerCreationEnfant({ ...enfantValide, prenom_affiche: "Léa 0612345678" }), { ok: false, code: "prenom-chiffres" });
  assert.deepEqual(validerCreationEnfant({ ...enfantValide, prenom_affiche: "<script>" }), { ok: false, code: "prenom-caracteres" });
  assert.deepEqual(validerCreationEnfant({ ...enfantValide, age_tranche: "11-13" }), { ok: false, code: "tranche-invalide" });
  assert.deepEqual(validerCreationEnfant(null), { ok: false, code: "corps-invalide" });
  assert.deepEqual(validerCreationEnfant({ ...enfantValide, prenom_affiche: "  Léa  " }), { ok: true, prenom: "Léa", tranche: "6-10" });
  const r = await gererApiCompte(new Request("https://api.test/api/eleves", { method: "POST", body: "{pas du json" }), env, "parent-1");
  assert.equal(r.status, 400);
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM eleves").get().n, 0);
});

test("création : plafond de profils enfants par parent", async () => {
  for (let i = 0; i < MAX_ENFANTS; i++) assert.equal((await creer({ ...enfantValide, prenom_affiche: `Enfant ${i}` })).status, 201);
  const r = await creer();
  assert.equal(r.status, 409);
  assert.deepEqual(await r.json(), { erreur: "quota-atteint" });
  assert.equal((await creer(enfantValide, "parent-2")).status, 201, "le plafond est propre à chaque parent");
});

test("liste et suppression : un parent ne voit et ne supprime que ses propres profils, progression comprise", async () => {
  const { id } = await (await creer()).json();
  const { id: autre } = await (await creer({ ...enfantValide, prenom_affiche: "Tom" }, "parent-2")).json();
  assert.equal((await appel("/api/progres", { methode: "POST", corps: { eleveId: id, progres: { notions: { pythagore: { etoiles: 3 } } } } })).status, 204);

  const liste = await (await appel("/api/eleves")).json();
  assert.deepEqual(liste.map((e) => e.prenom_affiche), ["Léa"]);
  assert.ok(liste.every((e) => !("parent_id" in e)), "aucun identifiant de compte renvoyé");

  assert.equal((await appel(`/api/eleves/${autre}`, { methode: "DELETE" })).status, 404, "profil d'un autre parent");
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM eleves WHERE id = ?").get(autre).n, 1);

  assert.equal((await appel(`/api/eleves/${id}`, { methode: "DELETE" })).status, 204);
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM eleves WHERE id = ?").get(id).n, 0);
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM progres WHERE eleve_id = ?").get(id).n, 0, "progression effacée avec le profil");
  assert.equal((await appel(`/api/eleves/${id}`, { methode: "PUT" })).status, 405);
});

test("progression : propriétaire vérifié, lignes filtrées et bornées, écriture groupée", async () => {
  const { id } = await (await creer()).json();
  assert.equal((await appel("/api/progres", { methode: "POST", corps: { eleveId: id, progres: { notions: {} } }, parent: "parent-2" })).status, 403);
  assert.equal((await appel(`/api/progres?eleveId=${id}`, { parent: "parent-2" })).status, 403);

  const notions = { pythagore: { etoiles: 2, score: 80 }, "Mauvais id!": { etoiles: 3 }, fractions: { etoiles: 9, score: -1 } };
  assert.equal((await appel("/api/progres", { methode: "POST", corps: { eleveId: id, progres: { notions } } })).status, 204);
  const lignes = await (await appel(`/api/progres?eleveId=${id}`)).json();
  assert.deepEqual(lignes.map(({ notion_id, etoiles, score }) => ({ notion_id, etoiles, score })).sort((a, b) => a.notion_id.localeCompare(b.notion_id)), [
    { notion_id: "fractions", etoiles: null, score: null },
    { notion_id: "pythagore", etoiles: 2, score: 80 }
  ]);
  const beaucoup = Object.fromEntries(Array.from({ length: MAX_NOTIONS_PROGRES + 50 }, (_, i) => [`notion-${i}`, { etoiles: 1 }]));
  assert.equal(lignesProgres(beaucoup).length, MAX_NOTIONS_PROGRES);
  assert.deepEqual(lignesProgres([1, 2]), []);
});

test("Worker : routes de compte sans session → 401 ; tables absentes → 503 sans détail ; CORS autorise DELETE", async () => {
  assert.ok(estRouteCompte("/api/eleves") && estRouteCompte("/api/progres") && !estRouteCompte("/api/chat"));
  const requete = (cookie) => new Request("https://api.test/api/eleves", { headers: { origin: ORIGINE, ...(cookie ? { cookie } : {}) } });

  const sans = await worker.fetch(requete(), env, { waitUntil() {} });
  assert.equal(sans.status, 401);
  assert.equal(sans.headers.get("access-control-allow-origin"), ORIGINE);

  // Un cookie dont le nom finit par « session » n'est pas pris pour la session du parent.
  assert.equal((await worker.fetch(requete("llm_session=s1"), env, { waitUntil() {} })).status, 401);
  const avec = await worker.fetch(requete("autre=1; session=s1"), env, { waitUntil() {} });
  assert.equal(avec.status, 200);
  assert.deepEqual(await avec.json(), []);

  const sansTables = { ...env, DB: { prepare: () => { throw new Error("no such table: sessions"); } } };
  const indispo = await worker.fetch(requete("session=s1"), sansTables, { waitUntil() {} });
  assert.equal(indispo.status, 503);
  assert.deepEqual(await indispo.json(), { erreur: "comptes-indisponibles" });

  const preflight = await worker.fetch(new Request("https://api.test/api/eleves/x", { method: "OPTIONS", headers: { origin: ORIGINE } }), env, { waitUntil() {} });
  assert.match(preflight.headers.get("access-control-allow-methods"), /DELETE/);
});
