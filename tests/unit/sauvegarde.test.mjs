import { test } from "node:test";
import assert from "node:assert/strict";
import { sauvegarderKpi, jourPrecedent, PREFIXE_KPI } from "../../worker/src/sauvegarde.js";

function creerD1(lignes) {
  const appels = [];
  return {
    appels,
    prepare(sql) { return { bind: (...v) => ({ all: async () => { appels.push({ sql, v }); return { results: lignes }; } }) }; }
  };
}

function creerR2() {
  const objets = new Map();
  return { objets, put: async (cle, valeur, options) => { objets.set(cle, { valeur, options }); } };
}

test("jourPrecedent donne la veille en UTC, y compris au changement de mois", () => {
  assert.equal(jourPrecedent(Date.parse("2026-11-01T02:17:00Z")), "2026-10-31");
  assert.equal(jourPrecedent(Date.parse("2026-03-01T00:00:00Z")), "2026-02-28");
});

test("sauvegarderKpi écrit les événements du jour sous le préfixe dédié", async () => {
  const lignes = [{ id: 1, horodatage: "2026-10-31 08:00:00", type: "demande", langue: "fr" }];
  const env = { DB: creerD1(lignes), DONNEES: creerR2() };
  const r = await sauvegarderKpi(env, "2026-10-31");
  assert.deepEqual(r, { ok: true, cle: `${PREFIXE_KPI}2026-10-31.json`, nombre: 1 });
  assert.deepEqual(env.DB.appels[0].v, ["2026-10-31"]);
  const { valeur, options } = env.DONNEES.objets.get(r.cle);
  assert.deepEqual(JSON.parse(valeur), { jour: "2026-10-31", nombre: 1, evenements: lignes });
  assert.match(options.httpMetadata.contentType, /application\/json/);
});

test("sauvegarderKpi ne fait rien sans binding D1 ou R2", async () => {
  assert.deepEqual(await sauvegarderKpi({ DB: creerD1([]) }, "2026-10-31"), { ok: false, raison: "binding-absent" });
});

test("sauvegarderKpi refuse un jour mal formé", async () => {
  await assert.rejects(sauvegarderKpi({ DB: creerD1([]), DONNEES: creerR2() }, "../secret"), /jour invalide/);
});
