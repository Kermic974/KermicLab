import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import { lireCorpusRevision, lireFichiersRevision, lireHistorique } from "../../scripts/lib/referentiel-historique.mjs";
import { canonique } from "../../scripts/lib/experiences-integrite.mjs";
import { lireFrontMatter } from "../../scripts/lib/fiche-catalogue.mjs";

const racine = fileURLToPath(new URL("../../", import.meta.url));
const lire = async chemin => JSON.parse(await readFile(join(racine, chemin), "utf8"));
const perimetre = await lire("experiences/perimetre-migration-v1.json");
const journal = await lire("docs/experiences/promotions-cibles-s6.json");
const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(await lire("referentiel/schemas/primitives.schema.json"));
const valider = ajv.compile(await lire("experiences/schemas/perimetre-migration.schema.json"));
const sha = texte => createHash("sha256").update(texte).digest("hex");
const empreinte = corpus => sha(JSON.stringify([...corpus.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(canonique)));
const original = await lireCorpusRevision(racine, journal.sourceRevision);
const attendu = new Map([...original].map(([id, o]) => [id, structuredClone(o)]));
for (const p of journal.promotions) {
  const o = attendu.get(p.id);
  assert.ok(o, p.id);
  assert.equal(o.type, p.type);
  assert.equal(o.status, "draft");
  assert.equal(o.version, p.previousVersion);
  assert.equal(p.version, p.previousVersion + 1);
  o.status = "review";
  o.version = p.version;
}
for (const a of journal.additions) {
  assert.equal(attendu.has(a.id), false);
  attendu.set(a.id, { id: a.id, type: "notion", label: a.label, status: "review", version: 1,
    provenance: { type: "editorial", ref: "docs/experiences/cibles-et-extension-s6.md#cibles-des-jeux" } });
}

test("l’annexe fermée atteste 486 fiches et le lab, sans état d’apprenant ni option de publication", () => {
  assert.equal(valider(perimetre), true, JSON.stringify(valider.errors));
  assert.equal(perimetre.sourceRevision, journal.sourceRevision);
  assert.equal(perimetre.entries.length, 487);
  assert.equal(perimetre.entries.filter(e => e.kind === "fiche").length, 486);
  assert.equal(perimetre.entries.filter(e => e.kind === "lab").length, 1);
  assert.equal(new Set(perimetre.entries.map(e => e.kind + ":" + e.id)).size, 487);
  const ids = perimetre.entries.flatMap(e => e.allowedTargets);
  assert.equal(new Set(ids).size, 2962);
  for (const id of ids) {
    assert.ok(["notion", "microskill", "skill"].includes(attendu.get(id)?.type), id);
    assert.equal(attendu.get(id).status, "review", id);
  }
});

test("l’annexe refuse chemins privés, traversées, cibles non pédagogiques et dérogations implicites", () => {
  const mutations = [
    o => { o.sourceRevision = "main"; },
    o => { o.entries[0].sources[0].path = "catalogue/../worker/secret.json"; },
    o => { o.entries[0].sources[0].path = "catalogue-prive/test/contenu.json"; },
    o => { o.entries[0].sources[0].sha256LF = "abc"; },
    o => { o.entries[0].allowedTargets = ["stage.maths.cycle-4"]; },
    o => { o.entries[0].allowedTargets.push(o.entries[0].allowedTargets[0]); },
    o => { o.allowDraftTargets = true; },
    o => { o.entries[0].learnerState = { score: 1 }; }
  ];
  for (const changer of mutations) {
    const o = { ...perimetre, entries: [structuredClone(perimetre.entries[0])] };
    changer(o);
    assert.equal(valider(o), false);
  }
});

test("les empreintes et versions proviennent des sources Git figées, pas du catalogue courant", async () => {
  const chemins = [...new Set(perimetre.entries.flatMap(e => e.sources.map(s => s.path)))];
  const sources = await lireFichiersRevision(racine, perimetre.sourceRevision, chemins);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (const e of perimetre.entries) {
    for (const s of e.sources) assert.equal(sha(decoder.decode(sources.get(s.path)).replace(/\r\n/g, "\n")), s.sha256LF, s.path);
    if (e.kind === "fiche") {
      const fiche = lireFrontMatter(decoder.decode(sources.get(`catalogue/${e.id}/fiche.md`)));
      assert.equal(fiche.id, e.id);
      assert.equal(fiche.version, e.version);
      assert.equal(fiche.sujet.split("/")[0], e.discipline);
    }
  }
});

test("la proposition ne change que 2473 cycles de vie et ajoute treize Notions, sans inventer de lien", async () => {
  assert.equal(original.size, 8250);
  assert.equal(attendu.size, 8263);
  assert.equal(new Set(journal.promotions.map(p => p.id)).size, 2473);
  const comptes = {};
  for (const p of journal.promotions) comptes[p.type] = (comptes[p.type] || 0) + 1;
  assert.deepEqual(comptes, { microskill: 1849, notion: 312, skill: 312 });
  assert.equal(journal.additions.length, 13);
  assert.equal(empreinte(attendu), journal.proposedCorpusSha256);
  // L’état adopté reste vérifiable dans l’historique après de futures révisions légitimes.
  const courant = new Map();
  async function parcourir(rep) {
    for (const e of await readdir(rep, { withFileTypes: true })) {
      const path = join(rep, e.name);
      if (e.isDirectory()) await parcourir(path);
      else if (e.name.endsWith(".json")) {
        const o = JSON.parse(await readFile(path, "utf8"));
        assert.equal(courant.has(o.id), false);
        courant.set(o.id, o);
      }
    }
  }
  await parcourir(join(racine, "referentiel/objets"));
  let trouve = empreinte(courant) === journal.proposedCorpusSha256;
  if (!trouve) trouve = (await lireHistorique(racine)).some(etat => empreinte(etat) === journal.proposedCorpusSha256);
  assert.equal(trouve, true, "État de préparation introuvable ou modification canonique hors journal.");
});

test("les fiches pédagogiques réutilisent leurs cibles S4 et les jeux ne créent aucun placement", () => {
  const projection = JSON.parse(execFileSync("git", ["show", perimetre.sourceRevision + ":referentiel/projection-v0.json"],
    { cwd: racine, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
  const teaches = new Map(), contributes = new Map();
  for (const o of original.values()) {
    if (o.status === "deprecated") continue;
    if (o.type === "teaches") { if (!teaches.has(o.source)) teaches.set(o.source, []); teaches.get(o.source).push(o.target); }
    if (o.type === "contributesTo") { if (!contributes.has(o.source)) contributes.set(o.source, []); contributes.get(o.source).push(o.target); }
  }
  for (const e of perimetre.entries.filter(e => e.kind === "fiche" && e.discipline !== "jeux")) {
    const cible = projection.notions[e.id];
    const ids = new Set([cible]);
    for (const micro of teaches.get(cible) || []) { ids.add(micro); for (const skill of contributes.get(micro) || []) ids.add(skill); }
    assert.deepEqual(e.allowedTargets, [...ids].sort(), e.id);
  }
  for (const a of journal.additions) {
    assert.ok(perimetre.entries.some(e => e.discipline === "jeux" && e.allowedTargets.includes(a.id)));
    assert.equal([...attendu.values()].some(o => o.type === "curriculum-mapping" && o.object === a.id), false);
  }
});
