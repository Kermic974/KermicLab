import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const script = new URL("../../scripts/verifier-sarif.mjs", import.meta.url).pathname;

function verifier(sarif) {
  const dossier = mkdtempSync(path.join(tmpdir(), "sarif-"));
  writeFileSync(path.join(dossier, "javascript.sarif"), JSON.stringify(sarif));
  try {
    return { code: 0, sortie: execFileSync(process.execPath, [script, dossier], { stdio: "pipe" }).toString() };
  } catch (e) {
    return { code: e.status, sortie: e.stderr.toString() };
  }
}

const outil = {
  driver: { name: "CodeQL", rules: [] },
  extensions: [{ name: "codeql/javascript-queries", rules: [
    { id: "js/xss", defaultConfiguration: { level: "error" } },
    { id: "js/note", defaultConfiguration: { level: "note" } }
  ] }]
};
const resultat = (id, index) => ({
  ruleId: id, rule: { id, index, toolComponent: { index: 0 } }, message: { text: "msg" },
  locations: [{ physicalLocation: { artifactLocation: { uri: "web/app.js" }, region: { startLine: 3 } } }]
});

test("aucun résultat → succès", () => {
  assert.equal(verifier({ runs: [{ tool: outil, results: [] }] }).code, 0);
});

test("alerte de niveau error (via la règle de l'extension) → échec", () => {
  const r = verifier({ runs: [{ tool: outil, results: [resultat("js/xss", 0)] }] });
  assert.equal(r.code, 1);
  assert.match(r.sortie, /error js\/xss web\/app\.js:3/);
});

test("simple note → succès", () => {
  assert.equal(verifier({ runs: [{ tool: outil, results: [resultat("js/note", 1)] }] }).code, 0);
});

test("règle introuvable → traitée comme warning (prudent)", () => {
  assert.equal(verifier({ runs: [{ tool: { driver: { rules: [] } }, results: [{ ruleId: "js/x", message: { text: "?" } }] }] }).code, 1);
});
