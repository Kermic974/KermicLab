import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerTarifsCloudflare, mesuresTelemetrie, prixDansCatalogue, tarifsCloudflareDisponibles } from "../../worker/src/tarifs-cloudflare.js";
import { creerD1Complet } from "../helpers/d1-complet.mjs";

// Tarifs du catalogue de modèles Cloudflare (AI Gateway et Workers AI), ADR 0034.
const COMPTE = "0123456789abcdef0123456789abcdef";
const env = { CLOUDFLARE_ACCOUNT_ID: COMPTE, CLOUDFLARE_TARIFS_TOKEN: "jeton-de-lecture-workers-ai" };

test("disponibilité : identifiant de compte et jeton de lecture exigés", () => {
  assert.equal(tarifsCloudflareDisponibles(env), true);
  assert.equal(tarifsCloudflareDisponibles({ ...env, CLOUDFLARE_ACCOUNT_ID: "abc" }), false);
  assert.equal(tarifsCloudflareDisponibles({ CLOUDFLARE_ACCOUNT_ID: COMPTE }), false);
});

test("lecture des prix : format openrouter (par token) et format natif (par million)", () => {
  const ouvert = { data: [{ id: "anthropic/claude-haiku-5.5", pricing: { prompt: "0.0000001", completion: "0.0000005", input_cache_read: "0.00000001" } }] };
  assert.deepEqual(prixDansCatalogue(ouvert, "anthropic/claude-haiku-5.5"), { entree: 0.1, sortie: 0.5, cache: 0.01 });
  const natif = { result: [{ name: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", properties: [{ property_id: "price", value: [{ unit: "per M input tokens", price: 0.29 }, { unit: "per M output tokens", price: 2.25 }] }] }] };
  assert.deepEqual(prixDansCatalogue(natif, "@cf/meta/llama-3.3-70b-instruct-fp8-fast"), { entree: 0.29, sortie: 2.25, cache: null });
  assert.equal(prixDansCatalogue(ouvert, "anthropic/claude-sonnet-5.5"), null, "modèle absent");
});

test("chargement : un appel par modèle, jeton porteur, erreurs par module sans exception", async () => {
  const appels = [];
  const fetchImpl = async (url, options) => {
    appels.push({ url, auth: options.headers.authorization });
    if (url.includes("sonnet")) return new Response("{}", { status: 403 });
    return Response.json({ data: [
      { id: "anthropic/claude-haiku-5.5", pricing: { prompt: "0.0000001", completion: "0.0000005" } },
      { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", pricing: { prompt: "0.00000029", completion: "0.00000225" } }
    ] });
  };
  const r = await chargerTarifsCloudflare(env, { tuteur: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", defi: "anthropic/claude-haiku-5.5", cahiers: "anthropic/claude-sonnet-5.5" }, { fetchImpl });
  assert.match(r.chargeLe, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(r.modeles.tuteur, { modele: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", entree: 0.29, sortie: 2.25, cache: null });
  assert.deepEqual(r.modeles.defi, { modele: "anthropic/claude-haiku-5.5", entree: 0.1, sortie: 0.5, cache: null });
  assert.deepEqual(r.modeles.cahiers, { modele: "anthropic/claude-sonnet-5.5", erreur: "http-403" });
  assert.equal(appels.length, 3);
  assert.ok(appels.every((a) => a.url.startsWith(`https://api.cloudflare.com/client/v4/accounts/${COMPTE}/ai/models/search?format=openrouter`) && a.auth === `Bearer ${env.CLOUDFLARE_TARIFS_TOKEN}`));
  const invalide = await chargerTarifsCloudflare(env, { tuteur: "x y" }, { fetchImpl: async () => { throw new Error("injoignable"); } });
  assert.equal(invalide.modeles.tuteur.erreur, "modele-invalide");
  assert.equal(invalide.modeles.defi.erreur, "modele-invalide", "identifiant manquant");
  const panne = await chargerTarifsCloudflare(env, { tuteur: "a/b", defi: "a/b", cahiers: "a/b" }, { fetchImpl: async () => { throw new Error("injoignable"); } });
  assert.equal(panne.modeles.tuteur.erreur, "cloudflare-injoignable");
});

test("télémétrie : taille moyenne d'une génération et ratio entrée / sortie mesurés par module", async () => {
  const DB = creerD1Complet();
  const heure = new Date().toISOString().slice(0, 13);
  DB.sqlite.prepare("INSERT INTO telemetrie_llm (heure, module, fournisseur, modele, statut, appels, tokens_entree, tokens_sortie) VALUES (?, 'cahiers', 'gw', 'm', 'ok', 4, 8000, 40000)").run(heure);
  DB.sqlite.prepare("INSERT INTO telemetrie_llm (heure, module, fournisseur, modele, statut, appels, tokens_entree, tokens_sortie) VALUES (?, 'cahiers', 'gw', 'm', 'erreur', 9, 0, 0)").run(heure);
  const { mesures } = await mesuresTelemetrie({ DB }, 30);
  assert.deepEqual(mesures.cahiers, { appels: 4, tokensParAppel: 10000, ratio: 0.2 });
  assert.deepEqual(mesures.defi, { appels: 0, tokensParAppel: null, ratio: null });
  DB.sqlite.close();
});
