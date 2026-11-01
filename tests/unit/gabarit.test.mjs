import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { genererPage, validerContenu } from "../../scripts/lib/gabarit.mjs";
import { lireFrontMatter, lireMetaHtml, scriptsEnLigne } from "../../scripts/lib/catalogue.mjs";

const racine = new URL("../..", import.meta.url).pathname;
const lireJson = async (f) => JSON.parse(await readFile(f, "utf8"));

/** Notions du catalogue public décrites par un contenu.json. */
async function notions() {
  const sortie = [];
  for (const nom of (await readdir(`${racine}catalogue`)).sort()) {
    try { sortie.push({ nom, contenu: await lireJson(`${racine}catalogue/${nom}/contenu.json`) }); } catch { /* page écrite à la main */ }
  }
  return sortie;
}

test("gabarit : les notions pilotes ont un contenu valide", async () => {
  const liste = await notions();
  assert.ok(liste.length >= 11, `${liste.length} notions générées`);
  for (const attendu of ["fractions", "proportionnalite", "pythagore", "equations", "thales", "probabilites"]) assert.ok(liste.some((n) => n.nom === attendu), attendu);
  for (const { nom, contenu } of liste) assert.doesNotThrow(() => validerContenu(contenu, nom), nom);
});

test("vague 4 : chaque notion propose un exemple, un mémo et des exercices variés", async () => {
  const attendues = [
    "limites-et-continuite", "logarithme", "integrales", "recurrence", "denombrement", "loi-binomiale",
    "geometrie-dans-l-espace", "lois-de-newton", "gravitation-et-satellites", "cinetique-chimique",
    "radioactivite", "thermodynamique", "condensateur-et-circuit-rc", "diffraction-et-interferences"
  ];
  const catalogue = new Map((await notions()).map(({ nom, contenu }) => [nom, contenu]));
  for (const nom of attendues) {
    const contenu = catalogue.get(nom);
    assert.ok(contenu, `${nom} : contenu présent`);
    assert.ok(contenu.niveaux.some((niveau) => niveau.exemple?.etapes?.length), `${nom} : exemple guidé`);
    assert.ok(contenu.niveaux.some((niveau) => niveau.aRetenir?.trim()), `${nom} : mémo`);
    const types = new Set(contenu.application.exercices.map((exercice) => exercice.type));
    assert.ok(types.has("nombre") && types.has("qcm"), `${nom} : exercices numériques et QCM`);
    assert.ok(contenu.application.exercices.every((exercice) => exercice.type !== "nombre" || exercice.solution?.trim()), `${nom} : solutions des exercices numériques`);
    assert.ok(contenu.situation.etapes.length >= 2, `${nom} : situation progressive`);
  }
});

test("gabarit : chaque réponse attendue est cohérente avec son type", async () => {
  for (const { nom, contenu } of await notions()) {
    for (const ex of [...contenu.application.exercices, ...contenu.situation.etapes]) {
      if (ex.type === "nombre" && ex.fractionIrreductible) {
        // La réponse d'une fraction irréductible doit être un nombre rationnel « simple » (dénominateur ≤ 100).
        assert.ok([...Array(100).keys()].some((d) => Number.isInteger(+(ex.reponse * (d + 1)).toFixed(9))), `${nom} : ${ex.question}`);
      }
    }
  }
});

test("philosophie : huit notions progressives avec exercices et défi narratif", async () => {
  const ids = ["art", "bonheur", "conscience", "inconscient", "nature", "religion", "temps", "travail"];
  for (const id of ids) {
    const dossier = `${racine}catalogue/${id}`;
    const fiche = lireFrontMatter(await readFile(`${dossier}/fiche.md`, "utf8"));
    assert.equal(fiche.id, id);
    assert.equal(fiche.sujet, `philosophie/${id}`);
    assert.equal(fiche.niveau, "terminale");
    assert.equal(fiche.langues, "fr");
    const contenu = await lireJson(`${dossier}/contenu.json`);
    assert.doesNotThrow(() => validerContenu(contenu, id));
    assert.deepEqual(Object.keys(contenu.titresOnglets).sort(), ["application", "explication", "mise-en-situation"]);
    assert.ok(contenu.intro.trim(), id);
    assert.deepEqual(contenu.niveaux.map((n) => n.niveau), ["pour démarrer", "college", "terminale"]);
    for (const niveau of contenu.niveaux) {
      assert.ok(niveau.exemple.titre.trim(), id);
      assert.ok(niveau.exemple.etapes.length >= 2, id);
      assert.ok(niveau.aRetenir.trim(), id);
    }
    assert.ok(contenu.application.exercices.length >= 4 && contenu.application.exercices.length <= 6, id);
    assert.ok(contenu.situation.histoire.every((p) => p.trim()), id);
  }
});

test("gabarit : erreurs de contenu explicites", () => {
  const base = () => ({
    niveaux: [{ titre: "A", niveau: "6e", paragraphes: ["x"] }, { titre: "B", niveau: "5e", paragraphes: ["y"] }],
    application: { exercices: Array.from({ length: 3 }, () => ({ type: "qcm", question: "q", choix: ["a", "b"], bonne: 0, explication: "e" })) },
    situation: { titre: "t", histoire: ["h"], conclusion: "c", etapes: Array.from({ length: 2 }, () => ({ type: "nombre", question: "q", reponse: 2, indices: ["i"], solution: "s" })) }
  });
  assert.doesNotThrow(() => validerContenu(base()));
  const casse = (modifier, motif) => { const c = base(); modifier(c); assert.throws(() => validerContenu(c), motif); };
  casse((c) => { c.niveaux.pop(); }, /au moins 2 « niveaux »/);
  casse((c) => { c.application.exercices[1].bonne = 5; }, /« bonne » doit être l'indice/);
  casse((c) => { c.application.exercices[0].type = "glisser"; }, /type « glisser » inconnu/);
  casse((c) => { c.situation.etapes[0].reponse = "2"; }, /« reponse » doit être un nombre/);
  casse((c) => { c.situation.etapes[1].indices = []; }, /au moins un « indices »/);
  casse((c) => { c.application.figure = { type: "camembert" }; }, /figure « camembert » inconnue/);
  casse((c) => { c.niveaux[0].paragraphes = ["fetch('https://exemple.test')"]; }, /contenu interdit/);
});

test("gabarit : la page générée respecte le contrat et neutralise le HTML du contenu", async () => {
  const fiche = lireFrontMatter(await readFile(`${racine}catalogue/pythagore/fiche.md`, "utf8"));
  const contenu = await lireJson(`${racine}catalogue/pythagore/contenu.json`);
  contenu.intro = "</script><script>alert(1)</script>";
  const html = await genererPage({ fiche, contenu });
  const meta = lireMetaHtml(html);
  assert.equal(meta.id, "pythagore");
  assert.deepEqual(meta.onglets, ["explication", "memo", "application", "mise-en-situation", "self-test"]);
  const { memo, ...sansMemo } = contenu;
  assert.deepEqual(lireMetaHtml(await genererPage({ fiche, contenu: sansMemo })).onglets, ["explication", "application", "mise-en-situation", "self-test"]);
  await assert.rejects(genererPage({ fiche, contenu: { ...contenu, memo: {} } }), /memo/);
  assert.equal(scriptsEnLigne(html).length, 1, "un seul script exécutable : le moteur");
  assert.ok(!html.includes("</script><script>alert"), "le contenu ne peut pas fermer la balise de données");
  const donnees = html.match(/<script type="application\/json" id="kermiclab-contenu">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(donnees).intro, contenu.intro);
  await assert.rejects(genererPage({ fiche: { ...fiche, date: undefined }, contenu }), /« date »/);
});
