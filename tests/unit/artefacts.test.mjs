import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { lireCsv } from "../../scripts/lib/csv.mjs";
import { verifierArtefacts } from "../../scripts/check-artefacts.mjs";

test("CSV cité, multiligne et fins de ligne Windows", () => {
  assert.deepEqual(lireCsv('a,b\r\n"une, valeur","ligne 1\n""ligne 2"""\r\n'), [
    ["a", "b"], ["une, valeur", 'ligne 1\n"ligne 2"']
  ]);
  for (const texte of ['"inachevé', 'a"b,c', '"a"x,b']) assert.throws(() => lireCsv(texte));
});

test("catalogue du dépôt et rapport déterministe", async () => {
  const a = await verifierArtefacts();
  assert.equal(a.verdict, "PASS", JSON.stringify(a));
  assert.deepEqual(await verifierArtefacts(), a);
});

test("diagnostics pour règles dupliquées, source et références absentes", async t => {
  const root = await mkdtemp(join(tmpdir(), "s5-artefacts-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "referentiel"));
  await writeFile(join(root, "referentiel/sources-normatives.json"), "{}");
  const header = "rule_id,source_section,level,severity,description,fixture_refs,implementation,test_refs\n";
  const ligne = "S4-TEST,S4.1,9,INVALIDE,Exemple,inconnu.json#cas,absent.mjs,absent.test.mjs\n";
  const csv = join(root, "referentiel/RULE_CATALOG.csv");
  await writeFile(csv, header + ligne + ligne);
  const r = await verifierArtefacts(root);
  assert.equal(r.verdict, "FAIL");
  assert.deepEqual(new Set(r.issues.map(i => i.rule)), new Set(["S5-REGLE", "S5-VALEUR", "S5-SOURCE", "S5-REFERENCE"]));
  await writeFile(csv, header + '"inachevé');
  assert.equal((await verifierArtefacts(root)).issues[0].rule, "S5-LECTURE");
});

test("fixture absente, en-tête invalide et codes de sortie", async t => {
  const root = await mkdtemp(join(tmpdir(), "s5-fixtures-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "referentiel"));
  await writeFile(join(root, "referentiel/sources-normatives.json"), JSON.stringify({
    "S4.1": { reference: "https://app.notion.com/p/41a0c40cec2881ffa3c6c1e19aeaf3a0", decision: "decision.md", status: "adopted" }
  }));
  await writeFile(join(root, "decision.md"), "D1 adoptée");
  await writeFile(join(root, "implementation.mjs"), "");
  await writeFile(join(root, "preuve.test.mjs"), "");
  await writeFile(join(root, "cas.json"), JSON.stringify([{ name: "existant", rule: "S4-TEST" }]));
  const header = "rule_id,source_section,level,severity,description,fixture_refs,implementation,test_refs\n";
  const csv = join(root, "referentiel/RULE_CATALOG.csv");
  const ligne = "S4-TEST,S4.1,2,ERROR,Exemple,cas.json#absent,implementation.mjs,preuve.test.mjs\n";
  await writeFile(csv, header + ligne);
  const r = await verifierArtefacts(root);
  assert.deepEqual(r.issues.map(i => i.rule), ["S5-REFERENCE"]);
  const script = fileURLToPath(new URL("../../scripts/check-artefacts.mjs", import.meta.url));
  const lancer = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
  const rejet = lancer("--json");
  assert.equal(rejet.status, 1);
  assert.deepEqual(JSON.parse(rejet.stdout), r);
  assert.equal(lancer("--inconnu").status, 2);
  await writeFile(csv, header + ligne.replace("#absent", "#existant"));
  assert.equal(lancer("--json").status, 0);
  await writeFile(csv, "colonnes\n" + ligne);
  assert.equal((await verifierArtefacts(root)).issues[0].rule, "S5-COLONNES");
});
