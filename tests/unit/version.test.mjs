import { test } from "node:test";
import assert from "node:assert/strict";
import { notesVersion, commitCible } from "../../scripts/version.mjs";

const changelog = `# Journal

## [Non publié]

### Corrigé
- pas encore publié

## [0.0.2] — 2026-11-01

### Ajouté
- deux

## [0.0.1] — 2026-10-31

Première version.

### Ajouté
- un
`;

test("notesVersion : section de la version seule, sans « Non publié » ni la version voisine", () => {
  assert.equal(notesVersion(changelog, "0.0.1"), "Première version.\n\n### Ajouté\n- un");
  assert.equal(notesVersion(changelog, "0.0.2"), "### Ajouté\n- deux");
  assert.equal(notesVersion(changelog, "9.9.9"), null);
});

test("commitCible : premier commit first-parent portant la version", () => {
  const versions = { a: "0.1.0", b: "0.0.1", c: "0.0.1", d: "0.0.2" };
  const git = (args) => (args[0] === "log" ? "a\nb\nc\nd\n" : JSON.stringify({ version: versions[args[1].split(":")[0]] }));
  assert.equal(commitCible("0.0.1", git), "b");
  assert.equal(commitCible("0.0.2", git), "d");
  assert.equal(commitCible("1.0.0", git), null);
});

test("commitCible sur le vrai dépôt : v0.0.1 → fusion de la PR #16", () => {
  const sha = commitCible("0.0.1");
  assert.match(sha ?? "", /^[0-9a-f]{40}$/);
});
