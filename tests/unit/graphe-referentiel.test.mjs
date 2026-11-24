import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cheminLePlusCourt, compacter, construireGraphe, decompacter, disciplineDe, disposer, filtrer, indicateurs, libelleDe } from "../../web/graphe-referentiel.js";

// Graphe du référentiel (ADR 0040) : construction, disposition déterministe, filtres et plus court chemin.
const projection = {
  notions: { a: "notion.maths.a", b: "notion.maths.b", c: "notion.physique.c", d: "notion.physique.d" },
  competences: { "microskill.maths.calculer": "calculer", "microskill.physique.mesurer": "mesurer" },
  fiches: {
    a: { prerequis: [], competences: ["calculer"] },
    b: { prerequis: ["a", "inconnue"], competences: ["calculer"] },
    c: { prerequis: ["b"], competences: ["mesurer", "calculer"] },
    d: { prerequis: [], competences: ["mesurer"] },
    fantome: { prerequis: [], competences: [] }
  }
};
const graphe = construireGraphe(projection);
const lu = decompacter(JSON.parse(JSON.stringify(compacter(graphe, disposer(graphe, { iterations: 20 })))));
const i = (id) => lu.noeuds.findIndex((n) => n.id === id);

test("graphe : nœuds, liens, références ignorées, MicroSkill transdisciplinaire", () => {
  assert.equal(disciplineDe("notion.maths.a"), "maths");
  assert.equal(libelleDe("notion.maths.cercle-trigo"), "Cercle trigo");
  assert.deepEqual(graphe.noeuds.map((n) => n.id), ["notion.maths.a", "notion.maths.b", "notion.physique.c", "notion.physique.d", "microskill.maths.calculer", "microskill.physique.mesurer"]);
  assert.equal(graphe.liens.filter((l) => l.type === "prerequis").length, 2);
  assert.equal(graphe.liens.filter((l) => l.type === "microskill").length, 5, "les doublons ne sont comptés qu'une fois");
  assert.equal(graphe.ignores, 2, "prérequis inconnu et fiche hors notions");
  assert.deepEqual(graphe.noeuds.find((n) => n.id === "microskill.maths.calculer").disciplines, ["maths", "physique"]);
  assert.equal(graphe.noeuds.find((n) => n.id === "microskill.maths.calculer").transdisciplinaire, true);
  assert.equal(graphe.noeuds.find((n) => n.id === "microskill.physique.mesurer").transdisciplinaire, false);
});

test("graphe : la forme compacte se relit à l'identique, disposition déterministe", () => {
  assert.equal(lu.noeuds.length, 6);
  assert.equal(lu.liens.length, 7);
  assert.equal(lu.noeuds[i("microskill.maths.calculer")].transdisciplinaire, true);
  assert.deepEqual(disposer(graphe, { iterations: 20 }), disposer(graphe, { iterations: 20 }));
  assert.ok(disposer(graphe, { iterations: 20 }).flat().every(Number.isInteger));
  assert.throws(() => decompacter({ version: 99, noeuds: [], liens: [] }), /graphe-invalide/);
});

test("graphe : indicateurs par discipline", () => {
  const ind = indicateurs(lu);
  assert.deepEqual({ notions: ind.notions, microskills: ind.microskills, transdisciplinaires: ind.transdisciplinaires, prerequis: ind.prerequis }, { notions: 4, microskills: 2, transdisciplinaires: 1, prerequis: 2 });
  assert.deepEqual(ind.disciplines.find((d) => d.discipline === "physique"), { discipline: "physique", notions: 2, microskills: 2, prerequis: 1, sansPrerequis: 1, sansMicroskill: 0 });
});

test("graphe : filtres (discipline, types, recherche avec voisins, isolement)", () => {
  assert.equal(filtrer(lu).noeuds.size, 6);
  assert.deepEqual([...filtrer(lu, { discipline: "physique" }).noeuds].sort(), [i("notion.physique.c"), i("notion.physique.d"), i("microskill.maths.calculer"), i("microskill.physique.mesurer")].sort());
  assert.equal(filtrer(lu, { microskills: false }).noeuds.size, 4);
  assert.equal(filtrer(lu, { transSeules: true }).noeuds.size, 5);
  assert.equal(filtrer(lu, { prerequis: false }).liens.length, 5);
  assert.equal(filtrer(lu, { masquees: new Set(["maths", "physique"]) }).noeuds.size, 0);
  const recherche = filtrer(lu, { recherche: "notion.physique.d" });
  assert.deepEqual([...recherche.noeuds].sort(), [i("notion.physique.d"), i("microskill.physique.mesurer")].sort(), "la recherche garde les voisins directs");
  assert.equal(filtrer(lu, { isole: i("notion.maths.b") }).noeuds.size, 4);
});

test("graphe : plus court chemin, sens ignoré, vide si non relié", () => {
  assert.deepEqual(cheminLePlusCourt(lu, i("notion.maths.a"), i("notion.physique.c")).length, 3);
  assert.deepEqual(cheminLePlusCourt(lu, i("notion.physique.d"), i("notion.maths.a")).map((k) => lu.noeuds[k].id).at(-1), "notion.maths.a");
  assert.deepEqual(cheminLePlusCourt(lu, i("notion.maths.a"), i("notion.maths.a")), [i("notion.maths.a")]);
  const isole = decompacter({ version: 1, noeuds: [["notion.x.a", 0, 0, 0], ["notion.x.b", 1, 1, 1]], liens: [] });
  assert.deepEqual(cheminLePlusCourt(isole, 0, 1), []);
});

test("graphe : le référentiel réel se construit sans référence inconnue", async () => {
  const reel = construireGraphe(JSON.parse(await readFile(new URL("../../referentiel/projection-v0.json", import.meta.url), "utf8")));
  assert.equal(reel.ignores, 0);
  assert.equal(reel.noeuds.filter((n) => n.type === "notion").length, Object.keys(JSON.parse(await readFile(new URL("../../referentiel/projection-v0.json", import.meta.url), "utf8")).notions).length);
});

test("graphe : sous-ensemble centré sur des notions (prérequis directs et MicroSkills)", async () => {
  const { sousEnsemble } = await import("../../web/graphe-referentiel.js");
  const s = sousEnsemble(lu, ["notion.maths.b"]);
  assert.deepEqual([...s.noeuds].sort(), [i("notion.maths.a"), i("notion.maths.b"), i("microskill.maths.calculer")].sort());
  assert.deepEqual([...s.centres], [i("notion.maths.b")]);
  assert.equal(s.liens.length, 2, "prérequis a→b et b→calculer ; pas a→calculer (a n'est pas un centre)");
  assert.equal(sousEnsemble(lu, ["notion.maths.b"], { microskills: false }).noeuds.size, 2);
  assert.equal(sousEnsemble(lu, ["notion.inconnue.x"]).noeuds.size, 0);
});

test("graphe : sous-graphe autonome, disposition propre et déterministe", async () => {
  const { sousGraphe } = await import("../../web/graphe-referentiel.js");
  const a = sousGraphe(lu, ["notion.maths.b"]);
  assert.deepEqual(a.graphe.noeuds.map((n) => n.id).sort(), ["microskill.maths.calculer", "notion.maths.a", "notion.maths.b"]);
  assert.equal(a.graphe.liens.length, 2);
  assert.deepEqual([...a.centres].map((i) => a.graphe.noeuds[i].id), ["notion.maths.b"]);
  assert.deepEqual(sousGraphe(lu, ["notion.maths.b"]).graphe.noeuds, a.graphe.noeuds, "même entrée, même disposition");
});
