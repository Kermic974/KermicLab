import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

// Lien entre la feuille de route et les projets GitHub (docs/projets.md) : .github/projets.json est la source unique.
const registre = JSON.parse(await readFile(".github/projets.json", "utf8"));
const labels = JSON.parse(await readFile(".github/labels.json", "utf8")).map((label) => label.name);
const roadmap = await readFile(registre.roadmap, "utf8");
const doc = await readFile("docs/projets.md", "utf8");
const HORIZONS = ["maintenant", "ensuite", "plus-tard", "sous-condition"];

test("projets : registre bien formé, clés, épiques et priorités uniques", () => {
  assert.match(registre.depot, /^[\w.-]+\/[\w.-]+$/);
  const { projets } = registre;
  assert.ok(projets.length > 0);
  for (const champ of ["cle", "epic", "priorite", "ancre"]) {
    const valeurs = projets.map((p) => p[champ]);
    assert.equal(new Set(valeurs).size, valeurs.length, `${champ} en double`);
  }
  for (const p of projets) {
    assert.match(p.cle, /^[a-z][a-z-]*$/, p.cle);
    assert.ok(Number.isInteger(p.epic) && p.epic > 0, `${p.cle} : épique invalide`);
    assert.ok(HORIZONS.includes(p.horizon), `${p.cle} : horizon inconnu ${p.horizon}`);
    assert.ok(Array.isArray(p.chantiers));
  }
  assert.deepEqual(projets.map((p) => p.priorite).sort((a, b) => a - b), projets.map((_, i) => i + 1));
});

test("projets : labels epic, projet:<clé> et horizon:<…> déclarés dans .github/labels.json", () => {
  assert.ok(labels.includes("epic"));
  for (const h of HORIZONS) assert.ok(labels.includes(`horizon:${h}`), `label horizon:${h} absent`);
  for (const p of registre.projets) assert.ok(labels.includes(`projet:${p.cle}`), `label projet:${p.cle} absent`);
  const orphelins = labels.filter((l) => l.startsWith("projet:") && !registre.projets.some((p) => `projet:${p.cle}` === l));
  assert.deepEqual(orphelins, [], "label projet: sans entrée dans le registre");
});

test("projets : chaque phase de la roadmap a un projet, et chaque projet est relié depuis la roadmap", () => {
  const phases = [...roadmap.matchAll(/<li class="fr-phase" id="(phase-\d+)">/g)].map((m) => m[1]);
  assert.ok(phases.length > 0);
  for (const phase of phases) assert.ok(registre.projets.some((p) => p.ancre === phase), `${phase} sans projet`);
  for (const p of registre.projets) {
    assert.ok(roadmap.includes(`id="${p.ancre}"`), `ancre ${p.ancre} absente de la roadmap`);
    const lien = `<p class="fr-suivi" data-projet="${p.cle}"><strong>Suivi :</strong> <a href="https://github.com/${registre.depot}/issues/${p.epic}">`;
    assert.equal(roadmap.split(lien).length, 2, `${p.cle} : lien vers l'épique #${p.epic} absent ou en double`);
    if (p.ancre.startsWith("phase-")) {
      const debut = roadmap.indexOf(`id="${p.ancre}"`);
      const suivante = roadmap.indexOf('<li class="fr-phase"', debut + 1);
      const fin = suivante < 0 ? roadmap.indexOf("</ol>", debut) : suivante;
      assert.ok(roadmap.indexOf(lien) > debut && roadmap.indexOf(lien) < fin, `${p.cle} : lien hors de sa phase`);
    }
  }
});

test("projets : docs/projets.md liste chaque épique et les fiches chantier citées existent", async () => {
  for (const p of registre.projets) {
    assert.ok(doc.includes(`[#${p.epic}](https://github.com/${registre.depot}/issues/${p.epic})`), `#${p.epic} absent de docs/projets.md`);
    assert.ok(doc.includes(`#${p.ancre})`), `ancre ${p.ancre} absente de docs/projets.md`);
    for (const fiche of p.chantiers) await access(`docs/chantiers/${fiche}`);
  }
});
