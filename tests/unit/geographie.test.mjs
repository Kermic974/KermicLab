import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { routerLocal } from "../../worker/src/router.js";
import { appliquerCsp, lireFrontMatter, lireMetaHtml } from "../../scripts/lib/catalogue.mjs";
import { ajouterBoiteIdees } from "../../scripts/lib/idees.mjs";
import { validerContenu } from "../../scripts/lib/gabarit.mjs";

const NOTIONS = [
  "metropolisation", "urbanisation", "espaces-ruraux", "risques-naturels",
  "changement-climatique", "ressources", "mobilites", "migrations", "france-territoires"
];
const lire = (id, fichier) => readFile(new URL(`../../catalogue/${id}/${fichier}`, import.meta.url), "utf8");
const nonVide = (texte) => assert.ok(typeof texte === "string" && texte.trim().length > 0);
const REPONSES = {
  metropolisation: [[0, 1, 2], [1, 2, 0]],
  urbanisation: [[1, 2, 0], [0, 1, 2]],
  "espaces-ruraux": [[2, 0, 1], [1, 2, 0]],
  "risques-naturels": [[0, 1, 2], [1, 2, 0]],
  "changement-climatique": [[1, 2, 0], [0, 1, 2]],
  ressources: [[2, 0, 1], [1, 2, 0]],
  mobilites: [[0, 1, 2], [1, 2, 0]],
  migrations: [[1, 2, 0], [0, 1, 2]],
  "france-territoires": [[2, 0, 1], [1, 2, 0]]
};

test("géographie : les neuf notions et leurs métadonnées sont publiées", async () => {
  for (const id of NOTIONS) {
    const entree = CATALOGUE.index.maquettes.find((m) => m.id === id);
    assert.ok(entree, id);
    const fiche = lireFrontMatter(await lire(id, "fiche.md"));
    const meta = lireMetaHtml(await lire(id, "page.html"));
    for (const donnees of [fiche, meta]) {
      assert.equal(donnees.id, id);
      assert.equal(donnees.sujet, `geographie/${id}`);
      assert.equal(donnees.version, "1.0.0");
      assert.equal(donnees.date, "2026-11-01");
      nonVide(donnees.titre);
    }
    assert.equal(fiche.niveau, "college");
    assert.equal(fiche.langues, "fr");
    assert.deepEqual(entree.langues, ["fr"]);
    assert.equal(meta.langue, "fr");
    assert.equal(fiche.onglets, "explication, application, mise-en-situation");
    assert.deepEqual(entree.onglets, ["explication", "application", "mise-en-situation"]);
    assert.deepEqual(meta.onglets, [...entree.onglets, "self-test"]);
    assert.equal(fiche.questions.length, 3);
    assert.equal(entree.sujet, fiche.sujet);
    for (const question of fiche.questions) assert.equal(routerLocal(question, CATALOGUE.index), id, question);
  }
});

test("géographie : progression, exemples concrets et cartes mentales textuelles", async () => {
  for (const id of NOTIONS) {
    const contenu = JSON.parse(await lire(id, "contenu.json"));
    assert.doesNotThrow(() => validerContenu(contenu, id));
    assert.equal(contenu.niveaux.length, 3, id);
    assert.deepEqual(contenu.niveaux.map((n) => n.niveau), ["pour démarrer", "collège", "lycée"]);
    assert.match(contenu.niveaux[0].titre, /Intuition/);
    for (const niveau of contenu.niveaux) {
      assert.ok(niveau.paragraphes.length >= 2, `${id} : paragraphes`);
      niveau.paragraphes.forEach(nonVide);
      assert.match(niveau.exemple.titre, /Carte mentale/);
      assert.ok(niveau.exemple.etapes.length >= 3, `${id} : étapes de carte mentale`);
      niveau.exemple.etapes.forEach(nonVide);
      nonVide(niveau.aRetenir);
    }
    const html = await lire(id, "page.html");
    const donnees = html.match(/<script type="application\/json" id="kermiclab-contenu">([\s\S]*?)<\/script>/);
    assert.ok(donnees, `${id} : données embarquées`);
    assert.deepEqual(JSON.parse(donnees[1]), contenu, `${id} : page synchronisée avec le contenu`);
    assert.match(html, /connect-src 'none'/);
    assert.match(html, /sha256-/);
  }
});

test("géographie : QCM de notions, acteurs, échelles et défis contextualisés", async () => {
  for (const id of NOTIONS) {
    const contenu = JSON.parse(await lire(id, "contenu.json"));
    assert.deepEqual(contenu.application.exercices.map((ex) => ex.titre), ["Notion", "Acteurs", "Échelles"]);
    for (const [i, liste] of [contenu.application.exercices, contenu.situation.etapes].entries()) {
      assert.ok(liste.length >= 3, id);
      assert.deepEqual(liste.map((ex) => ex.bonne), REPONSES[id][i], `${id} : réponses relues`);
      assert.ok(new Set(liste.map((ex) => ex.bonne)).size >= 2, `${id} : bonnes réponses variées`);
      for (const ex of liste) {
        assert.equal(ex.type, "qcm");
        assert.ok(ex.choix.length >= 3);
        assert.equal(new Set(ex.choix).size, ex.choix.length);
        assert.ok(Number.isInteger(ex.bonne) && ex.bonne >= 0 && ex.bonne < ex.choix.length);
        for (const texte of [ex.question, ex.indice, ex.explication, ...ex.choix]) nonVide(texte);
      }
    }
    assert.match(contenu.situation.titre, /Habiter|habiter|logements|Se déplacer|Partager l'eau/);
    assert.match(contenu.situation.histoire.join(" "), /ficti|invent/);
    assert.match(contenu.situation.conclusion, /papier/);
    assert.match(contenu.situation.conclusion, /joue/i);
    assert.match(contenu.situation.conclusion, /personnel|personnes réelles|adresse/);
  }
});

test("géographie : routage avec accents, pluriels et formulations naturelles", () => {
  const formulations = {
    metropolisation: ["Explique la MÉTROPOLISATION !", "À quoi servent les fonctions métropolitaines ?", "Qu'est-ce qu'une métropole mondiale ?"],
    urbanisation: ["Pourquoi l'URBANISATION augmente ?", "Explique-moi l'étalement urbain.", "Je découvre la périurbanisation"],
    "espaces-ruraux": ["Comment habite-t-on un espace rural ?", "Pourquoi les espaces ruraux sont-ils divers ?", "Explique la ruralité !"],
    "risques-naturels": ["Comment prévenir un risque naturel ?", "Quels sont les risques naturels ?", "Qu'est-ce qu'un ALÉA NATUREL ?"],
    "changement-climatique": ["Explique le CHANGEMENT CLIMATIQUE.", "Que faire face au réchauffement climatique ?", "À quoi sert l'atténuation climatique ?"],
    ressources: ["Comment gérer une ressource naturelle ?", "Les RESSOURCES RENOUVELABLES sont-elles infinies ?", "Explique la gestion de l'eau"],
    mobilites: ["Explique les MOBILITÉS !", "Qu'est-ce qu'une mobilité quotidienne ?", "Comment penser l'intermodalité ?"],
    migrations: ["Explique les MIGRATIONS !", "Qu'est-ce qu'une migration humaine ?", "Je veux comprendre les migrations internationales"],
    "france-territoires": ["Quels sont les territoires français ?", "Explique l'aménagement du territoire français.", "Comment relier la France métropole et outre-mer ?"]
  };
  for (const [id, questions] of Object.entries(formulations)) {
    for (const question of questions) {
      assert.equal(routerLocal(question, CATALOGUE.index), id, question);
      const sansAccents = question.normalize("NFD").replace(/\p{M}/gu, "");
      assert.equal(routerLocal(sansAccents, CATALOGUE.index), id, sansAccents);
    }
  }
  // Le volcanisme relève des SVT (séismes et volcans), pas des risques naturels de géographie.
  assert.equal(routerLocal("c'est quoi un volcan ?", CATALOGUE.index), "seismes-et-volcans");
  assert.equal(routerLocal("c'est quoi un geyser ?", CATALOGUE.index), null);
});

test("géographie : les distinctions fondamentales sont explicitement enseignées", async () => {
  const texte = async (id) => JSON.parse(await lire(id, "contenu.json")).niveaux.flatMap((n) => n.paragraphes).join(" ");
  assert.match(await texte("metropolisation"), /urbanisation/i);
  assert.match(await texte("urbanisation"), /métropolisation/i);
  assert.match(await texte("mobilites"), /migration.*résidence/i);
  assert.match(await texte("migrations"), /La Réunion.*métropole.*interne/i);
  const risques = await texte("risques-naturels");
  for (const mot of ["aléa", "exposition", "vulnérabilité"]) assert.match(risques, new RegExp(mot, "i"));
  assert.match(await texte("changement-climatique"), /météo/i);
  assert.match(await texte("changement-climatique"), /trente ans/);
  assert.match(await texte("ressources"), /n'est pas illimitée/);
  assert.match(await texte("france-territoires"), /Guyane.*continent/i);
  assert.match(await texte("france-territoires"), /statuts.*pas tous identiques/i);
});

test("géographie : les formulations proches distinguent croissance, fonctions et déplacements", () => {
  const paires = [
    [
      ["Pourquoi l'urbanisation transforme les villes ?", "urbanisation"],
      ["Pourquoi la métropolisation transforme les villes ?", "metropolisation"]
    ],
    [
      ["Comment l'étalement urbain diffère-t-il de la métropolisation ?", "urbanisation"],
      ["Pourquoi les fonctions métropolitaines ne se résument-elles pas à l'urbanisation ?", "metropolisation"]
    ],
    [
      ["Comment les mobilités transforment les territoires ?", "mobilites"],
      ["Comment les migrations transforment les territoires ?", "migrations"]
    ],
    [
      ["Comment les déplacements quotidiens et l'intermodalité se distinguent-ils des migrations ?", "mobilites"],
      ["Comment une migration interne se distingue-t-elle des mobilités ?", "migrations"]
    ]
  ];
  for (const paire of paires) {
    assert.notEqual(paire[0][1], paire[1][1]);
    for (const [question, attendu] of paire) {
      for (const variante of [
        question,
        question.toUpperCase(),
        question.normalize("NFD").replace(/\p{M}/gu, "")
      ]) {
        assert.equal(routerLocal(variante, CATALOGUE.index), attendu, variante);
      }
    }
  }
});

const NOTIONS_MONDIALISATION = {
  mondialisation: { calculs: [60, 20], question: "Comment fonctionne une chaîne de valeur mondiale ?" },
  "mers-oceans": { calculs: [75, 1200], question: "Quel rôle jouent les mers et océans dans la mondialisation ?" },
  "union-europeenne": { calculs: [40, 75], question: "Quelle différence entre l'Union européenne et la zone euro ?" },
  "dynamiques-territoriales": { calculs: [10, 15], question: "Quelle différence entre métropolisation et périurbanisation ?" },
  "france-regions": { calculs: [18, 25], question: "Comment les régions de France sont-elles reliées au monde ?" },
  "espaces-productifs": { calculs: [50, 60], question: "Comment les espaces productifs sont-ils reliés au monde ?" },
  tourisme: { calculs: [12, 40], question: "Quelle différence entre un touriste et un excursionniste ?" },
  "afrique-australe": { calculs: [75, 2], question: "Comment le corridor de Maputo relie-t-il les territoires ?" }
};

for (const [id, attendu] of Object.entries(NOTIONS_MONDIALISATION)) {
  test(`géographie : ${id}, contenu progressif, corrigés et page publiée`, async () => {
    const fiche = lireFrontMatter(await lire(id, "fiche.md"));
    const contenu = JSON.parse(await lire(id, "contenu.json"));
    validerContenu(contenu, id);
    assert.equal(fiche.id, id);
    assert.equal(fiche.sujet, `geographie/${id}`);
    assert.equal(fiche.langues, "fr");
    assert.equal(fiche.niveau, "college");
    assert.ok(contenu.niveaux.some((n) => /3e|4e/.test(n.niveau)), "un niveau collège");
    assert.ok(contenu.niveaux.some((n) => /première|terminale/.test(n.niveau)), "un approfondissement lycée");
    const exercices = [...contenu.application.exercices, ...contenu.situation.etapes];
    assert.deepEqual(exercices.filter((ex) => ex.type === "nombre").map((ex) => ex.reponse), attendu.calculs);
    for (const ex of exercices) {
      if (ex.type === "qcm") {
        assert.ok(ex.indice?.trim(), `${id} : indice du QCM`);
        assert.equal(new Set(ex.choix).size, ex.choix.length, "choix distincts");
      }
    }
    const index = CATALOGUE.index;
    assert.ok(index.maquettes.some((m) => m.id === id));
    for (const question of [attendu.question, ...fiche.questions]) {
      assert.equal(routerLocal(question, index), id, question);
      assert.equal(routerLocal(question.toUpperCase(), index), id, question);
    }
    const html = await lire(id, "page.html");
    const publiee = appliquerCsp(ajouterBoiteIdees(html, { page: id, version: fiche.version }));
    assert.equal(CATALOGUE.pages[id].fr, publiee, "page pédagogique inchangée, boîte à idées incorporée au build");
    const meta = lireMetaHtml(html);
    assert.equal(meta.id, id);
    assert.equal(meta.version, fiche.version);
    assert.equal(meta.sujet, fiche.sujet);
  });
}

test("géographie : les QCM distinguent les ensembles et les repères sensibles", async () => {
  const cas = [
    ["mers-oceans", "Les droits dans une ZEE", "L'État côtier y a des droits sur les ressources, avec maintien notamment de la liberté de navigation"],
    ["union-europeenne", "Europe ou UE ?", "L'UE regroupe une partie des pays européens"],
    ["union-europeenne", "La monnaie", "Les États de l'UE ayant adopté l'euro"],
    ["union-europeenne", "Une frontière", "Les deux ensembles ne sont pas identiques"],
    ["france-regions", "Un piège de localisation", "La Guyane"],
    ["tourisme", "Une visite à la journée", "un excursionniste"],
    ["afrique-australe", "Région ou État ?", "L'Afrique australe est une région et l'Afrique du Sud est un État"],
    ["afrique-australe", "Localiser Maputo", "Le Mozambique"]
  ];
  for (const [id, titre, reponse] of cas) {
    const contenu = JSON.parse(await lire(id, "contenu.json"));
    const ex = contenu.application.exercices.find((e) => e.titre === titre);
    assert.ok(ex, `${id} : ${titre}`);
    assert.equal(ex.choix[ex.bonne], reponse, `${id} : ${titre}`);
  }
});
