import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { genererPage, validerContenu } from "../../scripts/lib/gabarit.mjs";
import { appliquerCsp, lireFrontMatter, lireMetaHtml } from "../../scripts/lib/catalogue.mjs";
import { routerLocal } from "../../worker/src/router.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";

const notions = [
  "laicite", "liberte", "egalite", "fraternite", "justice", "etat-de-droit",
  "citoyennete", "democratie", "interet-general", "droits-de-lhomme",
  "discrimination", "engagement-civique"
];
const racine = new URL("../..", import.meta.url).pathname;

test("EMC : le libellé de matière est traduit dans chaque langue du chat", async () => {
  for (const langue of ["fr", "en"]) {
    const textes = JSON.parse(await readFile(`${racine}web/i18n/${langue}.json`, "utf8"));
    assert.ok(textes.matiere_emc?.trim(), `${langue} : libellé EMC`);
  }
});

for (const id of notions) {
  test(`EMC ${id} : progression, activités et page autonome au catalogue`, async () => {
    const dossier = `${racine}catalogue/${id}`;
    const fiche = lireFrontMatter(await readFile(`${dossier}/fiche.md`, "utf8"));
    const contenu = JSON.parse(await readFile(`${dossier}/contenu.json`, "utf8"));
    assert.equal(fiche.id, id);
    assert.equal(fiche.sujet, `emc/${id}`);
    assert.equal(fiche.niveau, "college");
    assert.equal(fiche.langues, "fr");
    assert.doesNotThrow(() => validerContenu(contenu, id));
    assert.deepEqual(contenu.niveaux.map((n) => n.niveau), ["pour démarrer", "collège", "lycée"]);
    for (const niveau of contenu.niveaux) {
      assert.ok(niveau.aRetenir?.trim(), `${niveau.titre} : à retenir`);
      assert.ok(niveau.exemple?.titre?.trim(), `${niveau.titre} : exemple`);
      assert.ok(niveau.exemple.etapes.length >= 2);
    }
    for (const ex of [...contenu.application.exercices, ...contenu.situation.etapes]) {
      assert.equal(ex.type, "qcm");
      assert.equal(new Set(ex.choix).size, ex.choix.length, `${ex.question} : choix distincts`);
    }
    assert.ok(fiche.questions.some((q) => /\b(what|how|explain)\b/i.test(q)), "suggestion anglaise");
    assert.ok(fiche.questions.some((q) => !/\b(what|how|explain)\b/i.test(q)), "suggestion française");
    for (const question of fiche.questions) {
      assert.equal(routerLocal(question, CATALOGUE.index), id, question);
    }
    const entree = CATALOGUE.index.maquettes.find((m) => m.id === id);
    assert.ok(entree, `${id} indexé`);
    assert.equal(entree.sujet, fiche.sujet);
    const html = appliquerCsp(await genererPage({ fiche, contenu }));
    assert.equal(await readFile(`${dossier}/page.html`, "utf8"), html, "page générée à jour");
    assert.equal(CATALOGUE.pages[id].fr, html, "page servie telle quelle");
    const meta = lireMetaHtml(html);
    assert.equal(meta.sujet, fiche.sujet);
    assert.equal(meta.version, fiche.version);
    assert.deepEqual(meta.onglets, ["explication", "application", "mise-en-situation", "self-test"]);
  });
}

test("EMC : variantes typographiques et notions voisines restent routables", () => {
  const cas = [
    ["LAÏCITÉ !!!", "laicite"],
    ["L'État-de-droit", "etat-de-droit"],
    ["les droits de l’homme", "droits-de-lhomme"],
    ["l’intérêt général", "interet-general"],
    ["un engagement citoyen", "engagement-civique"],
    ["la liberté d'expression", "liberte"],
    ["l'égalité en droits", "egalite"],
    ["une décision discriminatoire", "discrimination"]
  ];
  for (const [question, id] of cas) assert.equal(routerLocal(question, CATALOGUE.index), id, question);
});
