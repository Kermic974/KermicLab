import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { verifierPlateforme, verifierCercle, verifierEvolutions, verifierDepot } from "../../scripts/verifier-versions.mjs";

// Trois versions distinctes : plateforme, notion, application du cercle (AGENTS.md §6 ter ; issue #177).
const racine = new URL("../..", import.meta.url).pathname;
const changelog = "# Journal\n\n## [Non publié]\n\n## [0.0.2] — 2026-11-08\n\n## [0.0.1] — 2026-10-31\n";
const cercle = (v) => `const VERSION = '${v}';`;
const fiche = (v) => `---\nid: x\nversion: ${v}\n---\n`;

test("plateforme : version SemVer de package.json et section datée du CHANGELOG", () => {
  assert.deepEqual(verifierPlateforme({ version: "0.0.2" }, changelog), []);
  assert.match(verifierPlateforme({ version: "0.0.3" }, changelog)[0], /section « ## \[0\.0\.3\]/);
  assert.match(verifierPlateforme({ version: "1.0" }, changelog)[0], /non SemVer/);
  assert.match(verifierPlateforme({ version: "0.0.1" }, "## [0.0.1] — 2026-10-31")[0], /Non publié/);
});

test("cercle : archive de la version courante, rangée dans le dossier de sa version", () => {
  const archives = { "v1.0": "<html>ancienne archive sans constante</html>", "v1.4": cercle("1.4.0") };
  assert.deepEqual(verifierCercle(cercle("1.4.0"), archives), []);
  assert.match(verifierCercle(cercle("1.5.0"), archives)[0], /versions\/v1\.5\/standalone\.html absent/);
  assert.match(verifierCercle(cercle("1.4.1"), archives)[0], /porte la version 1\.4\.0, attendu 1\.4\.1/);
  assert.match(verifierCercle(cercle("1.4.0"), { ...archives, "v1.3": cercle("1.4.0") })[0], /v1\.3\/standalone\.html porte la version 1\.4\.0/);
  assert.match(verifierCercle("const AUTRE = 1;", archives)[0], /VERSION SemVer introuvable/);
});

test("évolutions : contenu modifié → nouvelle version ; jamais de recul ; src/ → nouvelle VERSION du cercle", () => {
  const depot = (base, tete) => ({ lire: (ref, chemin) => (ref === "base" ? base : tete)[chemin] ?? null });
  const avant = { "catalogue/a/fiche.md": fiche("1.0.0"), "catalogue/a/contenu.json": "{}", "src/ui/main.js": cercle("1.4.0") };
  const ok = depot(avant, { ...avant, "catalogue/a/fiche.md": fiche("1.0.1"), "src/ui/main.js": cercle("1.4.1") });
  assert.deepEqual(verifierEvolutions({ ...ok, modifies: ["catalogue/a/contenu.json", "catalogue/a/fiche.md", "src/core/angle.js"] }), []);
  const sansHausse = depot(avant, avant);
  assert.match(verifierEvolutions({ ...sansHausse, modifies: ["catalogue/a/contenu.json"] })[0], /contenu\.json modifié sans nouvelle version/);
  assert.deepEqual(verifierEvolutions({ ...sansHausse, modifies: ["catalogue/a/fiche.md"] }), [], "métadonnées seules (référentiel, relecture) : pas de hausse imposée");
  assert.deepEqual(verifierEvolutions({ ...sansHausse, modifies: ["catalogue/a/page.html"] }), [], "page régénérée par le build : non contrôlée");
  const recul = depot(avant, { ...avant, "catalogue/a/fiche.md": fiche("0.9.0") });
  assert.match(verifierEvolutions({ ...recul, modifies: ["catalogue/a/fiche.md"] })[0], /inférieure à 1\.0\.0/);
  assert.match(verifierEvolutions({ ...sansHausse, modifies: ["src/core/angle.js"] })[0], /src\/ modifié sans nouvelle VERSION/);
  const nouvelle = depot({}, { "catalogue/b/fiche.md": fiche("1.0.0"), "catalogue/b/contenu.json": "{}" });
  assert.deepEqual(verifierEvolutions({ ...nouvelle, modifies: ["catalogue/b/fiche.md", "catalogue/b/contenu.json"] }), [], "nouvelle notion");
});

test("dépôt réel : les trois versions sont cohérentes et documentées", async () => {
  assert.deepEqual(verifierDepot(racine).erreurs, []);
  const agents = await readFile(`${racine}AGENTS.md`, "utf8");
  assert.match(agents, /## 6 ter\. Trois versions/);
});
