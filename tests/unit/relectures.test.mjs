import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GRILLES, codeRelecteur, empreinteContenu, grilleDeSujet, ordreSuivi, roleRelecteurManuel, statutDe,
  syntheseRelectures, texteEmpreinte, validerSaisie
} from "../../web/relectures.js";

const page = (contenu) => `<script type="application/json" id="kermiclab-contenu">${contenu}</script><script>var moteur = 1;</script>`;

test("empreinte : le JSON pédagogique seul, pas le moteur ni les hashes", async () => {
  const a = await empreinteContenu({ fr: page('{"intro":"A"}'), en: `${page('{"intro":"A"}')}<meta content="hash-ancien">` });
  const b = await empreinteContenu({ en: page('{"intro":"A"}'), fr: `${page('{"intro":"A"}')}<meta content="hash-nouveau">` });
  assert.equal(a, b, "l'ordre des langues est stable et le hors-contenu est ignoré");
  assert.equal(a.length, 64);
  const c = await empreinteContenu({ fr: page('{"intro":"B"}') });
  assert.notEqual(a, c);
  const main = `<html><body><p>Règles du jeu</p><script>var x = 1;</script></body></html>`;
  assert.equal(texteEmpreinte(main), `fr\n${main}`);
  assert.notEqual(await empreinteContenu(main), await empreinteContenu(`${main} `));
});

test("grille : v1 pour une notion, jeux-v1 pour un jeu", () => {
  assert.equal(grilleDeSujet("mathematiques/pythagore"), "v1");
  assert.equal(grilleDeSujet("jeux/echecs"), "jeux-v1");
  assert.equal(GRILLES.v1.length, 6);
  assert.equal(GRILLES["jeux-v1"].length, 6);
});

test("saisie : conforme exige tous les critères, à corriger au moins un écart", () => {
  const tous = Object.fromEntries(GRILLES.v1.map((id) => [id, true]));
  assert.equal(validerSaisie({ decision: "conforme", criteres: tous, commentaire: "  " }, "v1").saisie.commentaire, null);
  assert.equal(validerSaisie({ decision: "conforme", criteres: { ...tous, exactitude: false } }, "v1").ok, false);
  assert.equal(validerSaisie({ decision: "a_corriger", criteres: tous }, "v1").ok, false);
  const partiel = validerSaisie({ decision: "a_corriger", criteres: { ...tous, exercices: false }, commentaire: "L'indice donne la réponse." }, "v1");
  assert.deepEqual(partiel.saisie.criteres, GRILLES.v1.filter((id) => id !== "exercices"));
  assert.equal(validerSaisie({ decision: "conforme", criteres: tous, commentaire: "a@b.c" }, "v1").ok, true, "le filtre personnel est celui du Worker");
  assert.equal(validerSaisie({ decision: "conforme", criteres: { ...tous, enTrop: true } }, "v1").ok, false);
  assert.equal(validerSaisie({ decision: "conforme", criteres: tous }, "jeux-v1").ok, false);
});

test("rôle manuel : la permission, pas le nom du rôle ni la souscription", () => {
  const definitions = [
    { id: "prof", permissions: ["relecture.humaine", "contributions.relire"] },
    { id: "admin", permissions: ["relecture.humaine"] },
    { id: "contributeur", permissions: ["contributions.proposer"] },
    { id: "relecteur-svt", permissions: ["relecture.humaine"] }
  ];
  assert.equal(roleRelecteurManuel(["visiteur", "prof"], definitions), "prof");
  assert.equal(roleRelecteurManuel(["contributeur"], definitions), null);
  assert.equal(roleRelecteurManuel(["prof", "admin"], definitions), "admin");
  assert.equal(roleRelecteurManuel(["relecteur-svt"], definitions), "relecteur-svt");
  assert.equal(roleRelecteurManuel(["prof"], [{ id: "prof", permissions: [] }]), null, "permission retirée du rôle");
  assert.equal(codeRelecteur("00000000-0000-4000-8000-0000000000ab"), "0000AB");
});

test("statut : l'empreinte différente passe la décision à « à revoir »", () => {
  assert.equal(statutDe(null, "aaa"), "non-relue");
  const ligne = { empreinte: "aaa", decision: "conforme" };
  assert.equal(statutDe(ligne, "aaa"), "relue");
  assert.equal(statutDe({ ...ligne, decision: "a_corriger" }, "aaa"), "a-corriger");
  assert.equal(statutDe(ligne, "bbb"), "a-revoir");
  const lignes = [
    { statut: "relue", created_at: "2026-11-01" },
    { statut: "a-revoir", created_at: "2026-11-20" },
    { statut: "a-corriger", created_at: "2026-11-23" }
  ];
  assert.deepEqual(ordreSuivi(lignes).map((l) => l.statut), ["a-revoir", "a-corriger", "relue"]);
  assert.deepEqual(syntheseRelectures(lignes), { total: 3, relues: 1, aRevoir: 1, aCorriger: 1 });
});
