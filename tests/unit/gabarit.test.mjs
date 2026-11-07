import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { genererPage, TYPES_FIGURE, validerContenu } from "../../scripts/lib/gabarit.mjs";
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
  casse((c) => { c.application.figure = { type: "camembert" }; }, /figure « camembert » inconnue \(attendu : affine, des, fraction, parabole, proportion, pythagore, thales/);
  casse((c) => { c.application.figure = { type: "proportion", libelleX: "x" }; }, /« libelleX » et « libelleY » requis/);
  casse((c) => { c.application.figure = { type: "thales", rapport: 1 }; }, /« rapport » doit être compris entre 0,1 et 0,9/);
  casse((c) => { c.application.figure = { type: "thales", ab: 0 }; }, /« ab » doit être compris entre 1 et 20/);
  casse((c) => { c.niveaux[0].paragraphes = ["fetch('https://exemple.test')"]; }, /contenu interdit/);
});

test("gabarit : erreurs fréquentes (notation déterministe, issue #183) validées au build", () => {
  const base = () => ({
    niveaux: [{ titre: "A", niveau: "6e", paragraphes: ["x"] }, { titre: "B", niveau: "5e", paragraphes: ["y"] }],
    application: { exercices: Array.from({ length: 3 }, () => ({ type: "qcm", question: "q", choix: ["a", "b", "c"], bonne: 0, explication: "e" })) },
    situation: { titre: "t", histoire: ["h"], conclusion: "c", etapes: Array.from({ length: 2 }, () => ({ type: "nombre", question: "q", reponse: 15, tolerance: 0.5, indices: ["i"], solution: "s" })) }
  });
  const avec = (modifier) => { const c = base(); modifier(c); return c; };
  assert.doesNotThrow(() => validerContenu(avec((c) => {
    c.application.exercices[0].erreurs = [{ choix: 1, message: "m" }, { choix: 2, message: "n" }];
    c.situation.etapes[0].erreurs = [{ reponse: 21, message: "m" }, { reponse: 225, tolerance: 1, message: "n" }];
  })));
  const casse = (modifier, motif) => assert.throws(() => validerContenu(avec(modifier)), motif);
  casse((c) => { c.application.exercices[0].erreurs = []; }, /liste non vide/);
  casse((c) => { c.application.exercices[0].erreurs = [{ choix: 0, message: "m" }]; }, /mauvaise réponse/);
  casse((c) => { c.application.exercices[0].erreurs = [{ choix: 3, message: "m" }]; }, /mauvaise réponse/);
  casse((c) => { c.application.exercices[0].erreurs = [{ choix: 1, message: "m" }, { choix: 1, message: "n" }]; }, /déjà décrit/);
  casse((c) => { c.application.exercices[0].erreurs = [{ choix: 1, message: " " }]; }, /« message » requis/);
  casse((c) => { c.situation.etapes[0].erreurs = [{ reponse: 15.2, message: "m" }]; }, /recouvre la bonne réponse/);
  casse((c) => { c.situation.etapes[0].erreurs = [{ reponse: 17, tolerance: 2, message: "m" }]; }, /recouvre la bonne réponse/);
  casse((c) => { c.situation.etapes[0].erreurs = [{ reponse: 21, message: "m" }, { reponse: 21.5, tolerance: 1, message: "n" }]; }, /recouvre erreurs\[0\]/);
  casse((c) => { c.situation.etapes[0].erreurs = [{ reponse: "21", message: "m" }]; }, /« reponse » doit être un nombre/);
  casse((c) => { c.situation.etapes[0].erreurs = [{ reponse: 21, tolerance: -1, message: "m" }]; }, /« tolerance » invalide/);
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
  assert.equal(scriptsEnLigne(html).length, 3, "trois scripts exécutables : le pont local, les événements (ADR 0025) et le moteur");
  assert.match(scriptsEnLigne(html)[0].attributs, /id="trophees"/);
  assert.match(scriptsEnLigne(html)[1].attributs, /id="evenements"/, "le module d'événements précède le moteur qui l'utilise");
  assert.ok(!html.includes("</script><script>alert"), "le contenu ne peut pas fermer la balise de données");
  const donnees = html.match(/<script type="application\/json" id="kermiclab-contenu">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(donnees).intro, contenu.intro);
  await assert.rejects(genererPage({ fiche: { ...fiche, date: undefined }, contenu }), /« date »/);
});

test("gabarit : une page n'embarque que sa propre figure (figures modulaires, ADR 0020)", async () => {
  const types = (await readdir(`${racine}gabarit/figures`)).filter((f) => f.endsWith(".js")).map((f) => f.slice(0, -3)).sort();
  assert.deepEqual(TYPES_FIGURE, types, "les types de figure sont découverts dans gabarit/figures/");
  const moteur = await readFile(`${racine}gabarit/moteur.js`, "utf8");
  assert.equal(moteur.match(/^ *\/\/ @figure\b/gm)?.length, 1, "un seul marqueur d'insertion dans le moteur");
  const figuresDe = (html) => [...html.matchAll(/FIGURES\.([a-z-]+) = function/g)].map((m) => m[1]);
  const fiche = lireFrontMatter(await readFile(`${racine}catalogue/pythagore/fiche.md`, "utf8"));
  const contenu = await lireJson(`${racine}catalogue/pythagore/contenu.json`);
  for (const type of TYPES_FIGURE) {
    const html = await genererPage({ fiche, contenu: { ...contenu, application: { ...contenu.application, figure: { type, libelleX: "x", libelleY: "y" } } } });
    assert.deepEqual(figuresDe(html), [type], `${type} : seule figure présente`);
    assert.ok(!html.includes("@figure"), `${type} : marqueur remplacé`);
    assert.ok(!html.includes("Figure « "), `${type} : en-tête de commentaires retiré`);
  }
  const { figure, ...sansFigure } = contenu.application;
  const html = await genererPage({ fiche, contenu: { ...contenu, application: sansFigure } });
  assert.deepEqual(figuresDe(html), [], "aucune figure sans application.figure");
  assert.match(html, /const FIGURES = \{\};/);
  for (const { nom, contenu: c } of await notions()) {
    const page = await readFile(`${racine}catalogue/${nom}/page.html`, "utf8");
    assert.deepEqual(figuresDe(page), c.application.figure ? [c.application.figure.type] : [], `${nom} : page.html à jour`);
  }
});
