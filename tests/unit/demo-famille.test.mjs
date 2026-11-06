import { test } from "node:test";
import assert from "node:assert/strict";
import * as demo from "../../web/demo-famille.js";
import { fournisseursConfigures } from "../../worker/src/auth/routes.js";
import worker from "../../worker/src/index.js";

// Environnement factice : seul Google a des identifiants OAuth complets.
const comptesDemo = { DB: {}, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret", MICROSOFT_CLIENT_ID: "id" };

test("démonstration famille : connexion simulée, profils, progression et déconnexion sans serveur", () => {
  let e = demo.etatInitial();
  assert.deepEqual(demo.moi(e), { connecte: false });
  assert.throws(() => demo.eleves(e), /non-connecte/);
  e = demo.connecter(e, "microsoft");
  assert.equal(demo.moi(e).compte.demo, true);
  assert.equal(demo.moi(e).compte.fournisseur, "microsoft");
  const a = demo.creerEleve(e, { prenom_affiche: "Lou", age_tranche: "6-10", consentement_version: "x" });
  const b = demo.creerEleve(a.etat, { prenom_affiche: "Sam", age_tranche: "11-14" });
  e = b.etat;
  assert.match(a.id, /^demo-/);
  assert.deepEqual(demo.eleves(e).map((x) => x.prenom_affiche), ["Lou", "Sam"]);
  assert.equal(Object.hasOwn(demo.eleves(e)[0], "consentement_version"), false);
  e = demo.sauverProgres(e, a.id, { notions: { fractions: { score: 3, etoiles: 2 } } });
  assert.deepEqual(demo.lireProgres(e, a.id), [{ notion_id: "fractions", score: 3, etoiles: 2 }]);
  assert.equal(demo.sauverProgres(e, "inconnu", { notions: { x: {} } }), e);
  e = demo.supprimerEleve(e, a.id);
  assert.deepEqual(demo.lireProgres(e, a.id), []);
  assert.deepEqual(demo.lireEtat(JSON.stringify(e)), e);
  assert.deepEqual(demo.lireEtat("{cassé"), demo.etatInitial());
  assert.deepEqual(demo.moi(demo.deconnecter(e)), { connecte: false });
});

test("auth : fournisseurs non configurés signalés, connexion refusée en 503 au lieu d'une erreur 500", async () => {
  assert.deepEqual(fournisseursConfigures({}), { google: false, microsoft: false });
  assert.deepEqual(fournisseursConfigures(comptesDemo), { google: true, microsoft: false });
  const ctx = { waitUntil() {} };
  const env = { DB: {}, ORIGINES_AUTORISEES: "https://www.kermiclab.online" };
  const liste = await worker.fetch(new Request("https://api.test/auth/fournisseurs", { headers: { origin: "https://www.kermiclab.online" } }), env, ctx);
  assert.deepEqual(await liste.json(), { google: false, microsoft: false });
  assert.equal(liste.headers.get("access-control-allow-origin"), "https://www.kermiclab.online");
  const login = await worker.fetch(new Request("https://api.test/auth/login?provider=google"), env, ctx);
  assert.equal(login.status, 503);
});
