import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as r from "../../web/contributions.js";
import * as demo from "../../web/demo-contributions.js";

// Règles des contributions (ADR 0023), partagées par l'interface, la démonstration et le Worker.
const contenu = JSON.parse(await readFile(new URL("../../catalogue/pythagore/contenu.json", import.meta.url), "utf8"));
const proposition = (extra = {}) => ({
  notion_id: "pythagore", chemin: "intro", nature: "modification", type: "clarification",
  texte_actuel: contenu.intro, texte_propose: `${contenu.intro} Commence par l'intuition.`,
  motif: "Guider les débutants.", charte_version: r.VERSION_CHARTE, ...extra
});

test("rôles : contribuer (contributeur, prof, admin), relire (prof, admin), jamais le parent", () => {
  assert.equal(r.peutContribuer("parent"), false);
  assert.equal(r.peutContribuer("contributeur"), true);
  assert.equal(r.peutRelire("contributeur"), false);
  assert.equal(r.peutRelire("prof"), true);
  assert.equal(r.peutRelire("admin"), true);
  assert.equal(r.peutContribuer(undefined), false);
});

test("chemins : feuilles textuelles connues seulement, jamais les nombres, types ou figures", () => {
  for (const ok of ["intro", "niveaux.1.paragraphes.0", "niveaux.0.exemple.etapes.2", "application.exercices.3.explication",
    "situation.conclusion", "memo.pointsCles.0", "application.exercices.0.choix.1"]) assert.equal(r.cheminValide(ok), true, ok);
  for (const ko of ["application.exercices.0.bonne", "application.exercices.0.reponse", "application.figure.type",
    "application.exercices.0.type", "titresOnglets.explication", "__proto__.intro", "niveaux.1.paragraphes.0.x.y.z.w",
    "autre.intro", "", null, "niveaux..titre"]) assert.equal(r.cheminValide(ko), false, String(ko));
  assert.equal(r.ajoutPossible("niveaux.1.paragraphes.0"), true);
  assert.equal(r.ajoutPossible("intro"), false);
  assert.equal(r.ajoutPossible("niveaux.1.aRetenir"), false);
});

test("champs éditables : textes de la notion dans l'ordre, valeurs exactes", () => {
  const champs = r.champsEditables(contenu);
  assert.equal(champs[0].chemin, "intro");
  assert.ok(champs.some((c) => c.chemin === "niveaux.1.paragraphes.0" && c.liste));
  assert.ok(champs.every((c) => r.cheminValide(c.chemin) && r.valeurAChemin(contenu, c.chemin) === c.valeur));
  assert.ok(!champs.some((c) => /\.(?:figure|bonne|reponse|type)(?:\.|$)/.test(c.chemin)));
  assert.deepEqual(r.champsEditables(null), []);
});

test("libellé d'un chemin : sections traduites, indices à partir de 1", () => {
  assert.equal(r.libelleChemin("niveaux.1.paragraphes.0", (c) => c.replace("champ_", "")), "niveaux 2 › paragraphes 1");
});

test("validation : texte non vide, borné, sans balise ni lien, différent de l'actuel ; motif ; charte", () => {
  assert.equal(r.validerContribution(proposition()).ok, true);
  const erreurs = (extra) => r.validerContribution(proposition(extra)).erreurs;
  assert.equal(erreurs({ texte_propose: "  " }).texte, "vide");
  assert.equal(erreurs({ texte_propose: "x".repeat(r.TEXTE_MAX + 1) }).texte, "trop-long");
  assert.equal(erreurs({ texte_propose: "<script>alert(1)</script>" }).texte, "balise");
  assert.equal(erreurs({ texte_propose: "Voir https://exemple.org" }).texte, "lien");
  assert.equal(erreurs({ texte_propose: contenu.intro }).texte, "identique");
  assert.equal(erreurs({ motif: "ok" }).motif, "trop-court");
  assert.equal(erreurs({ charte_version: undefined }).charte, "requise");
  assert.equal(erreurs({ type: "pub" }).type, "invalide");
  assert.equal(erreurs({ nature: "ajout" }).nature, "ajout-impossible");
  assert.equal(erreurs({ chemin: "application.exercices.0.bonne" }).chemin, "invalide");
  assert.equal(erreurs({ notion_id: "../x" }).notion, "invalide");
  const ajout = r.validerContribution(proposition({ chemin: "niveaux.1.paragraphes.0", nature: "ajout", texte_actuel: "Texte", texte_propose: "Texte" }));
  assert.equal(ajout.ok, true, "un ajout peut reprendre le texte voisin");
});

test("commentaire du relecteur : requis pour refuser ou demander une révision", () => {
  assert.deepEqual(r.validerCommentaire("", "valider"), { ok: true, commentaire: "" });
  assert.deepEqual(r.validerCommentaire("", "refuser"), { ok: false, erreur: "requis" });
  assert.deepEqual(r.validerCommentaire("Préciser l'exemple.", "reviser"), { ok: true, commentaire: "Préciser l'exemple." });
});

test("transitions : auteur, relecteur, relecture à quatre yeux, statuts compatibles", () => {
  const c = { auteur_id: "a", statut: "proposee" };
  assert.deepEqual(r.transition(c, "valider", { compteId: "p", role: "prof" }), { ok: true, vers: "validee" });
  assert.equal(r.transition(c, "valider", { compteId: "x", role: "contributeur" }).code, "role-requis");
  assert.equal(r.transition({ ...c, auteur_id: "p" }, "valider", { compteId: "p", role: "prof" }).code, "relecture-quatre-yeux");
  assert.equal(r.transition({ ...c, auteur_id: "p" }, "valider", { compteId: "p", role: "admin" }).ok, true);
  assert.equal(r.transition(c, "retirer", { compteId: "p", role: "prof" }).code, "reserve-auteur");
  assert.equal(r.transition(c, "retirer", { compteId: "a", role: "contributeur" }).vers, "retiree");
  assert.equal(r.transition({ ...c, statut: "a_reviser" }, "modifier", { compteId: "a", role: "contributeur" }).vers, "proposee");
  assert.equal(r.transition({ ...c, statut: "validee" }, "refuser", { compteId: "p", role: "prof" }).code, "statut-incompatible");
  assert.equal(r.transition({ ...c, statut: "validee" }, "integrer", { compteId: "p", role: "prof" }).vers, "integree");
  assert.equal(r.transition(c, "publier", { compteId: "p", role: "prof" }).code, "action-inconnue");
  assert.deepEqual(r.actionsPossibles(c, { compteId: "p", role: "prof" }), ["valider", "refuser", "reviser"]);
  assert.deepEqual(r.actionsPossibles(c, { compteId: "a", role: "contributeur" }), ["retirer"]);
});

test("tableau de bord : compteurs, filtres, contenu modifié depuis la proposition", () => {
  const liste = [
    { notion_id: "a", statut: "proposee", created_at: "2" }, { notion_id: "b", statut: "proposee", created_at: "1" },
    { notion_id: "a", statut: "validee", created_at: "3" }
  ];
  const resume = r.resumer(liste);
  assert.equal(resume.proposee, 2);
  assert.equal(resume.validee, 1);
  assert.equal(resume.total, 3);
  assert.deepEqual(r.filtrer(liste).map((c) => c.notion_id), ["b", "a"], "les plus anciennes d'abord");
  assert.equal(r.filtrer(liste, { statut: "tous", notion: "a" }).length, 2);
  const c = proposition();
  assert.equal(r.estObsolete(c, contenu), false);
  assert.equal(r.estObsolete(c, { ...contenu, intro: "Autre" }), true);
  assert.equal(r.estObsolete(c, null), false);
});

test("appliquer : modification ou ajout après l'élément, sans toucher à l'original", () => {
  const modifie = r.appliquer(contenu, { chemin: "intro", nature: "modification", texte_propose: "Nouveau" });
  assert.equal(modifie.intro, "Nouveau");
  assert.notEqual(contenu.intro, "Nouveau");
  const n = contenu.niveaux[1].paragraphes.length;
  const ajoute = r.appliquer(contenu, { chemin: "niveaux.1.paragraphes.0", nature: "ajout", texte_propose: "Inséré" });
  assert.equal(ajoute.niveaux[1].paragraphes.length, n + 1);
  assert.equal(ajoute.niveaux[1].paragraphes[1], "Inséré");
  assert.throws(() => r.appliquer(contenu, { chemin: "intro", nature: "ajout", texte_propose: "x" }));
});

test("diff mot à mot : morceaux égaux, retirés, ajoutés ; texte reconstruit", () => {
  const d = r.diffMots("le petit chat dort", "le gros chat dort bien");
  assert.equal(d.filter((m) => m.type !== "ajoute").map((m) => m.texte).join(""), "le petit chat dort");
  assert.equal(d.filter((m) => m.type !== "retire").map((m) => m.texte).join(""), "le gros chat dort bien");
  assert.ok(d.some((m) => m.type === "retire" && m.texte.includes("petit")));
});

test("code auteur court, normalisation des listes reçues", () => {
  assert.equal(r.codeAuteur("1234-abcdef"), "ABCDEF");
  assert.equal(r.codeAuteur(null), "?");
  const liste = r.normaliserContributions([{ id: "x", statut: "proposee", chemin: "intro", secret: 1 }, { id: "y", statut: "inconnu", chemin: "intro" }]);
  assert.equal(liste.length, 1);
  assert.equal("secret" in liste[0], false);
});

test("démonstration : contributeur propose, prof relit et valide, mêmes règles que le Worker", () => {
  let e = demo.etatInitial();
  assert.throws(() => demo.lister(e));
  e = demo.connecter(e, "contributeur");
  assert.deepEqual(demo.moi(e).compte.role, "contributeur");
  assert.throws(() => demo.lister(e, "relecture"), /role-requis/);
  const refus = demo.creer(e, proposition({ motif: "" }));
  assert.equal(refus.erreurs.motif, "trop-court");
  const cree = demo.creer(e, proposition(), { maintenant: "2026-11-07T10:00:00Z" });
  e = cree.etat;
  assert.equal(demo.lister(e).length, 1);
  assert.equal(demo.agir(e, cree.id, { action: "valider" }).code, "role-requis");

  e = demo.connecter(e, "prof");
  const relecture = demo.lister(e, "relecture");
  assert.ok(relecture.some((c) => c.id === cree.id));
  assert.deepEqual(demo.agir(e, cree.id, { action: "refuser", commentaire: "" }).erreurs, { commentaire: "requis" });
  const revision = demo.agir(e, cree.id, { action: "reviser", commentaire: "Ajoute un exemple chiffré." });
  assert.equal(revision.contribution.statut, "a_reviser");
  e = demo.connecter(revision.etat, "contributeur");
  const corrigee = demo.agir(e, cree.id, { action: "modifier", texte_propose: `${contenu.intro} Exemple : 3, 4, 5.`, motif: "Exemple ajouté.", type: "exemple", nature: "modification", charte_version: r.VERSION_CHARTE });
  assert.equal(corrigee.contribution.statut, "proposee");
  e = demo.connecter(corrigee.etat, "prof");
  const validee = demo.agir(e, cree.id, { action: "valider" });
  assert.equal(validee.contribution.statut, "validee");
  assert.ok(validee.contribution.issue_numero);
  assert.equal(demo.lireEtat("{cassé").connecte, false);
});

test("édition ciblée : champs regroupés par onglet dans l'ordre de la page, propositions en cours par champ", () => {
  const liste = [
    { notion_id: "pythagore", chemin: "intro", statut: "proposee" },
    { notion_id: "pythagore", chemin: "intro", statut: "a_reviser" },
    { notion_id: "pythagore", chemin: "intro", statut: "validee" },
    { notion_id: "fractions", chemin: "intro", statut: "proposee" }
  ];
  assert.equal(r.ongletDuChemin("niveaux.1.paragraphes.0"), "explication");
  assert.equal(r.ongletDuChemin("situation.conclusion"), "mise-en-situation");
  const groupes = r.champsParOnglet(contenu, liste, "pythagore");
  assert.deepEqual(groupes.map((g) => g.onglet), ["explication", "memo", "application", "mise-en-situation"]);
  assert.equal(groupes[0].champs.find((c) => c.chemin === "intro").enCours, 2, "validée et autre notion exclues");
  assert.equal(groupes.flatMap((g) => g.champs).length, r.champsEditables(contenu).length);
  assert.equal(r.compterEnCoursParChemin(liste).get("intro"), 3);
});

test("tableau de bord : synthèse par matière puis notion, filtre par matière", () => {
  const matieres = { pythagore: "mathematiques", fractions: "mathematiques", photosynthese: "svt" };
  const de = (id) => matieres[id];
  const liste = [
    { notion_id: "pythagore", statut: "proposee", created_at: "1" }, { notion_id: "pythagore", statut: "proposee", created_at: "2" },
    { notion_id: "fractions", statut: "validee", created_at: "3" }, { notion_id: "photosynthese", statut: "proposee", created_at: "4" },
    { notion_id: "inconnue", statut: "refusee", created_at: "5" }
  ];
  const g = r.grouperParMatiere(liste, de);
  assert.deepEqual(g.map((x) => x.matiere), ["mathematiques", "svt", "autres"], "les matières les plus chargées d'abord");
  assert.equal(g[0].resume.proposee, 2);
  assert.equal(g[0].resume.total, 3);
  assert.deepEqual(g[0].notions.map((n) => n.id), ["pythagore", "fractions"]);
  assert.equal(r.filtrer(liste, { statut: "tous", matiere: "mathematiques" }, de).length, 3);
  assert.equal(r.filtrer(liste, { statut: "tous", matiere: "autres" }, de).length, 1);
});
