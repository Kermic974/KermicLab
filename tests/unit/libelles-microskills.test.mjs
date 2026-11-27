import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { libellesMicroskills } from "../../scripts/lib/libelles-microskills.mjs";

// Espace Métiers (ADR 0041) : libellés des MicroSkills lus dans les objets canoniques, par nom de fichier.
test("libellés des MicroSkills : sous-dossiers, autres objets ignorés, lecture par lots, dossier absent", async () => {
  const racine = await mkdtemp(join(tmpdir(), "kermiclab-libelles-"));
  try {
    const ecrire = async (chemin, objet) => {
      await mkdir(join(racine, ...chemin.slice(0, -1)), { recursive: true });
      await writeFile(join(racine, ...chemin), JSON.stringify(objet));
    };
    await ecrire(["v0.5", "svt", "microskill.svt.observer.json"], { id: "microskill.svt.observer", type: "microskill", label: "Observer une cellule" });
    await ecrire(["v0.5", "maths", "microskill.maths.calculer.json"], { id: "microskill.maths.calculer", type: "microskill", label: "Calculer une moyenne" });
    await ecrire(["pilote", "microskill.maths.sans-libelle.json"], { id: "microskill.maths.sans-libelle", type: "microskill" });
    await ecrire(["pilote-maths", "microskill", "placer-un-angle.json"], { id: "microskill.maths.placer-un-angle", type: "microskill", label: "placer un angle sur le cercle" });
    await ecrire(["v0.5", "maths", "notion.maths.stats.json"], { id: "notion.maths.stats", type: "notion", label: "Statistiques" });
    await ecrire(["v0.5", "maths", "relation.maths.x.json"], { id: "microskill.maths.piege", type: "relation", label: "Piège" });
    const libelles = await libellesMicroskills(racine, { lot: 1 });
    assert.deepEqual(Object.fromEntries(libelles), {
      "microskill.maths.calculer": "Calculer une moyenne",
      "microskill.maths.placer-un-angle": "Placer un angle sur le cercle",
      "microskill.svt.observer": "Observer une cellule"
    }, "deux conventions de nommage ; première lettre en majuscule ; notion, relation et objet sans libellé ignorés");
    assert.equal((await libellesMicroskills(join(racine, "absent"))).size, 0);
  } finally {
    await rm(racine, { recursive: true, force: true });
  }
});

test("libellés des MicroSkills : le référentiel réel donne un libellé à chaque MicroSkill de la projection", async () => {
  const racine = fileURLToPath(new URL("../../referentiel/", import.meta.url));
  const libelles = await libellesMicroskills(join(racine, "objets"));
  const { readFile } = await import("node:fs/promises");
  const projection = JSON.parse(await readFile(join(racine, "projection-v0.json"), "utf8"));
  const sansLibelle = Object.keys(projection.competences).filter((id) => !libelles.has(id));
  assert.deepEqual(sansLibelle, []);
});
