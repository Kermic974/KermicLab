import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { disciplinesDe, domainesRestants, familleDe, fusionnerVague, genererVague, nomAffiche, reprisesOnisep, verifierVague } from "../../scripts/lib/vagues.mjs";
import { verifierMetiers } from "../../web/metiers.js";

// Vagues complémentaires du chantier Métiers : squelette, vérification, garde anti-recopie, fusion.
const extrait = {
  format: "kermiclab-onisep-extrait", version: 1, date: "2026-11-24", source: "test", licence: "ODbL 1.0 (Open Database License)",
  fiches: [
    { onisep: "MET.1", nom: "moniteur/trice d'escalade", synonymes: ["moniteur d'escalade", "monitrice d'escalade"], rome: ["G1204"], domaines: ["santé, social, sport/sport"], niveauAcces: "bac" },
    { onisep: "MET.2", nom: "ostéopathe", synonymes: ["ostéopathe", "ostéopathe"], rome: [], domaines: ["santé, social, sport/soins"], niveauAcces: "bac+5" },
    { onisep: "MET.3", nom: "boulanger/ère", synonymes: ["boulanger", "boulangère"], rome: ["D1102"], domaines: ["agriculture, animaux/alimentation"] },
    { onisep: "MET.4", nom: "médiateur/trice familial/e", synonymes: [], rome: [], domaines: ["santé, social, sport/travail social"] }
  ]
};
const donnees = {
  categories: [{ id: "services" }, { id: "health" }, { id: "nature" }, { id: "disc" }],
  disciplines: ["education-physique", "physiologie-humaine", "psychologie-sociale", "biologie", "droit-et-institutions", "langues-vivantes"].map((id) => ({ id })),
  metiers: [{ id: "boulanger", nom: "Boulanger", onisep: "MET.3", categorie: "nature", disciplines: ["biologie"], gestes: ["a"], contexte: "c", correspondance: "v5" }]
};
const regles = {
  maxDisciplines: 3,
  regles: [{ prefixe: "G", disciplines: ["langues-vivantes"] }, { prefixe: "G12", disciplines: ["education-physique", "langues-vivantes"] }],
  domaines: [
    { domaine: "santé, social, sport", disciplines: ["physiologie-humaine", "biologie"] },
    { domaine: "santé, social, sport/travail social", disciplines: ["psychologie-sociale", "droit-et-institutions"] }
  ]
};

test("vagues : nom affiché (fin commune écrite une fois), famille par domaine et sous-domaine", () => {
  assert.equal(nomAffiche({ nom: "moniteur/trice d'escalade", slug: "moniteur-d-escalade", synonymes: ["moniteur d'escalade", "monitrice d'escalade"] }), "Moniteur, monitrice d'escalade");
  assert.equal(nomAffiche({ nom: "boulanger/ère", slug: "boulanger", synonymes: ["mitron", "boulanger", "boulangère"] }), "Boulanger, boulangère");
  assert.equal(nomAffiche({ nom: "ostéopathe", slug: "osteopathe", synonymes: ["ostéopathe", "ostéopathe"] }), "Ostéopathe", "forme épicène");
  assert.equal(nomAffiche({ nom: "médiateur/trice familial/e", slug: "mediateur-familial", synonymes: [] }), "Médiateur familial", "sans formes : intitulé sans écriture inclusive");
  assert.equal(familleDe({ domaines: ["santé, social, sport/sport"] }), "services");
  assert.equal(familleDe({ domaines: ["santé, social, sport/soins"] }), "health");
  assert.equal(familleDe({ domaines: [] }), "disc");
});

test("vagues : disciplines de la règle la plus précise à la plus générale", () => {
  assert.deepEqual(disciplinesDe({ rome: ["G1204"], domaines: ["santé, social, sport/sport"] }, regles), ["education-physique", "langues-vivantes"], "ROME précis");
  assert.deepEqual(disciplinesDe({ rome: ["G1601"], domaines: ["santé, social, sport/soins"] }, regles), ["physiologie-humaine", "biologie"], "domaine avant la lettre ROME");
  assert.deepEqual(disciplinesDe({ rome: [], domaines: ["santé, social, sport/travail social"] }, regles), ["psychologie-sociale", "droit-et-institutions"], "sous-domaine d'abord");
  assert.deepEqual(disciplinesDe({ rome: ["G9999"], domaines: ["inconnu"] }, regles), ["langues-vivantes"], "lettre ROME en dernier recours");
});

test("vagues : squelette filtré par domaine, candidats seulement, ordre ONISEP, à rédiger", () => {
  const vague = genererVague(extrait, donnees, regles, { domaines: ["Santé, social, sport"], numero: 2 });
  assert.deepEqual(vague.metiers.map((m) => [m.onisep, m.id, m.categorie]), [["MET.1", "moniteur-d-escalade", "services"], ["MET.2", "osteopathe", "health"], ["MET.4", "mediateur-familial", "services"]]);
  assert.ok(vague.metiers.every((m) => m.gestes.length === 0 && m.contexte === ""));
  assert.match(vague.source, /ODbL 1\.0$/);
  assert.deepEqual(JSON.stringify(genererVague(extrait, donnees, regles, { domaines: ["Santé, social, sport"], numero: 2 })), JSON.stringify(vague), "déterministe");
  assert.deepEqual(domainesRestants(extrait, donnees), [["santé, social, sport", 3]], "MET.3 déjà rattaché");
});

test("vagues : vérification (gestes, contexte, familles, disciplines, doublons, exclusions) et anti-recopie", () => {
  const vague = genererVague(extrait, donnees, regles, { domaines: ["santé, social, sport"], numero: 2 });
  assert.ok(verifierVague(vague, donnees).some((e) => /3 gestes attendus/.test(e)));
  const redigee = structuredClone(vague);
  for (const m of redigee.metiers) Object.assign(m, { gestes: ["Préparer la séance", "Vérifier le matériel", "Accompagner le groupe"], contexte: "Un métier au service des autres." });
  redigee.metiers[2].exclu = "Intitulé trop proche d'un métier existant";
  assert.deepEqual(verifierVague(redigee, donnees), []);
  const fautive = structuredClone(redigee);
  fautive.metiers[0].categorie = "lune";
  fautive.metiers[1].disciplines = ["astrologie"];
  fautive.metiers[1].id = "boulanger";
  fautive.metiers[2].exclu = " ";
  const erreurs = verifierVague(fautive, donnees).join(" | ");
  for (const motif of [/famille inconnue lune/, /discipline inconnue astrologie/, /boulanger : identifiant déjà utilisé/, /raison d'exclusion vide/]) assert.match(erreurs, motif);
  const recopie = structuredClone(redigee);
  recopie.metiers[0].contexte = "Il est un vrai moniteur d'escalade et une monitrice d'escalade chaque jour.";
  assert.deepEqual(reprisesOnisep(recopie, extrait, 3).map((r) => r.metier), ["moniteur-d-escalade"]);
  assert.deepEqual(reprisesOnisep(redigee, extrait, 3), []);
});

test("vagues : fusion en « proposition » avec les données ONISEP, sans les métiers écartés", () => {
  const vague = genererVague(extrait, donnees, regles, { domaines: ["santé, social, sport"], numero: 2 });
  for (const m of vague.metiers) Object.assign(m, { gestes: ["g1", "g2", "g3"], contexte: "c" });
  vague.metiers[2].exclu = "raison";
  const { donnees: fusion, ajoutes, exclus } = fusionnerVague(donnees, vague, extrait);
  assert.deepEqual([ajoutes, exclus], [2, 1]);
  const moniteur = fusion.metiers.find((m) => m.id === "moniteur-d-escalade");
  assert.equal(moniteur.correspondance, "proposition");
  assert.equal(moniteur.niveauAcces, "bac");
  assert.deepEqual(moniteur.rome, ["G1204"]);
  assert.equal(fusion.metiers.length, 3);
  assert.equal(donnees.metiers.length, 1, "le référentiel d'origine n'est pas modifié");
});

test("vagues : règles réelles et squelette réel cohérents avec le référentiel", async () => {
  const lire = async (f) => JSON.parse(await readFile(new URL(`../../referentiel/${f}`, import.meta.url), "utf8"));
  const [ex, metiers, r, proj] = await Promise.all([lire("sources/onisep/ideo-metiers-2026-11-24.json"), lire("metiers-v0.json"), lire("regles-metiers.json"), lire("projection-v0.json")]);
  // Un domaine qui a encore des candidats (aucun une fois toutes les vagues fusionnées).
  const restant = domainesRestants(ex, metiers)[0]?.[0];
  if (!restant) return;
  const vague = genererVague(ex, metiers, r, { domaines: [restant], numero: 2 });
  assert.ok(vague.metiers.length > 0);
  const disciplines = new Set(metiers.disciplines.map((d) => d.id));
  const familles = new Set(metiers.categories.map((c) => c.id));
  for (const m of vague.metiers) {
    assert.ok(m.disciplines.length && m.disciplines.every((d) => disciplines.has(d)), m.id);
    assert.ok(familles.has(m.categorie), m.id);
  }
  assert.equal(new Set(vague.metiers.map((m) => m.id)).size, vague.metiers.length, "identifiants uniques");
  for (const m of vague.metiers) Object.assign(m, { gestes: ["g1", "g2", "g3"], contexte: "c" });
  assert.deepEqual(verifierVague(vague, metiers), []);
  assert.deepEqual(verifierMetiers(fusionnerVague(metiers, vague, ex).donnees, new Set(Object.values(proj.notions))), [], "une vague fusionnée reste valide");
});
