import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker, { _reinitialiser } from "../../worker/src/index.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { purgerProfesseur } from "../../worker/src/professeur.js";
import { MAX_PROFS_ELEVE, VERSION_ACCORD_ELEVE } from "../../web/professeur.js";
import { creerD1Complet } from "../helpers/d1-complet.mjs";

// Expérience Professeur côté Worker (ADR 0030) : chaque règle est vérifiée par le serveur.
const ORIGINE = "https://www.kermiclab.online";
const MDP = "Correct-Cheval-9";
const maquette = (matiere) => CATALOGUE.index.maquettes.find((m) => m.sujet.startsWith(`${matiere}/`))?.id;
const MATHS = maquette("mathematiques");
const AUTRE = CATALOGUE.index.maquettes.find((m) => !m.sujet.startsWith("mathematiques/") && !m.sujet.startsWith("jeux/"))?.id;

let env;
beforeEach(() => {
  env = { DB: creerD1Complet(), COMPTES_LOCAUX_SECRET: "s".repeat(40), ORIGINES_AUTORISEES: ORIGINE };
  _reinitialiser();
});
afterEach(() => env.DB.sqlite.close());

const sql = () => env.DB.sqlite;
const ctx = { waitUntil: () => {} };
async function appeler(chemin, { methode = "POST", corps, jeton, ip = "1.2.3.4" } = {}) {
  const r = await worker.fetch(new Request(`https://api.test${chemin}`, {
    method: methode,
    headers: { origin: ORIGINE, "cf-connecting-ip": ip, "content-type": "application/json", ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) },
    body: corps === undefined ? undefined : JSON.stringify(corps)
  }), env, ctx);
  let donnees = null;
  try { donnees = await r.json(); } catch { /* 204 */ }
  return { statut: r.status, donnees };
}
const prof = (route, options) => appeler(`/api/professeur/${route}`, options);
async function inscrire(identifiant) {
  const r = await appeler("/api/compte-local/inscription", { corps: { identifiant, motDePasse: MDP }, ip: `ip-${identifiant}` });
  assert.equal(r.statut, 201, JSON.stringify(r.donnees));
  return r.donnees.jeton;
}
const compteIdDeJeton = async (jeton) => {
  const { sha256Hex } = await import("../../web/compte-local.js");
  return sql().prepare("SELECT compte_id FROM sessions_locales WHERE jeton_hash = ?").get(await sha256Hex(jeton)).compte_id;
};
const donnerRole = async (jeton, role = "prof") => sql().prepare("INSERT INTO attributions_roles (type_compte, compte_id, role_id) VALUES ('compte-local', ?, ?)").run(await compteIdDeJeton(jeton), role);
const PROFIL = { nomAffiche: "M. Martin", matieres: ["mathematiques"], niveaux: ["4e", "3e"] };

async function professeurAvecClasse() {
  const jeton = await inscrire("m.martin");
  await donnerRole(jeton);
  assert.equal((await prof("profil", { methode: "PUT", jeton, corps: PROFIL })).statut, 200);
  const c = await prof("classes", { jeton, corps: { nom: "4e B", matiere: "mathematiques", niveau: "4e" } });
  assert.equal(c.statut, 201, JSON.stringify(c.donnees));
  return { jeton, classe: c.donnees.classe, profId: await compteIdDeJeton(jeton) };
}
const lien = async (jeton, corps) => {
  const r = await prof("invitations", { jeton, corps });
  assert.equal(r.statut, 201, JSON.stringify(r.donnees));
  return r.donnees;
};
const rejoindre = (jeton, code, pseudo = "Léa") => prof("rejoindre", { jeton, corps: { code, pseudo, accord: VERSION_ACCORD_ELEVE } });

test("professeur : session obligatoire, rôle Professeur exigé pour les routes du professeur", async () => {
  assert.equal((await prof("moi", { methode: "GET" })).statut, 401);
  const jeton = await inscrire("simple.visiteur");
  const moi = await prof("moi", { methode: "GET", jeton });
  const { id, ...reste } = moi.donnees;
  assert.match(id, /^[0-9a-f-]{36}$/, "identifiant du compte, pour reconnaître ses contributions");
  assert.deepEqual(reste, { role: "visiteur", roles: ["visiteur"], professeur: false, contribution: null, profil: null, professeurs: 0 });
  assert.equal((await prof("classes", { methode: "GET", jeton })).donnees.erreur, "role-professeur-requis");
  // Un contributeur ou un parent n'a pas l'expérience Professeur ; le contributeur peut proposer (ADR 0023 §6 ter).
  await donnerRole(jeton, "contributeur");
  assert.equal((await prof("moi", { methode: "GET", jeton })).donnees.contribution, "contributeur");
  assert.equal((await prof("profil", { methode: "PUT", jeton, corps: PROFIL })).statut, 403);
});

test("professeur : profil configuré avant les classes, classes contrôlées par le profil", async () => {
  const jeton = await inscrire("mme.diallo");
  await donnerRole(jeton);
  assert.equal((await prof("classes", { jeton, corps: { nom: "4e B", matiere: "mathematiques", niveau: "4e" } })).donnees.erreur, "profil-requis");
  assert.equal((await prof("profil", { methode: "PUT", jeton, corps: { ...PROFIL, matieres: ["jeux"] } })).donnees.erreur, "matieres-invalides");
  const p = await prof("profil", { methode: "PUT", jeton, corps: PROFIL });
  assert.deepEqual(p.donnees.profil, PROFIL);
  assert.deepEqual((await prof("moi", { methode: "GET", jeton })).donnees.profil, PROFIL);
  assert.equal((await prof("classes", { jeton, corps: { nom: "2nde A", matiere: "mathematiques", niveau: "seconde" } })).donnees.erreur, "niveau-hors-profil");
  const c = await prof("classes", { jeton, corps: { nom: "3e A", matiere: "mathematiques", niveau: "3e" } });
  assert.equal(c.statut, 201);
  const m = await prof(`classes/${c.donnees.classe.id}/modifier`, { jeton, corps: { nom: "3e A bis" } });
  assert.equal(m.donnees.classe.nom, "3e A bis");
  const liste = await prof("classes", { methode: "GET", jeton });
  assert.deepEqual(liste.donnees.classes.map((x) => [x.nom, x.eleves]), [["3e A bis", 0]]);
  // Un autre professeur ne touche pas à cette classe.
  const autre = await inscrire("m.autre");
  await donnerRole(autre);
  assert.equal((await prof(`classes/${c.donnees.classe.id}/supprimer`, { jeton: autre })).statut, 404);
});

test("professeur : lien de classe, aperçu, adhésion de l'élève avec accord, bilan restreint à la matière", async () => {
  const { jeton, classe } = await professeurAvecClasse();
  const inv = await lien(jeton, { mode: "classe", classeId: classe.id, dureeJours: 30 });
  assert.equal(inv.max, 40);
  // Seule l'empreinte du code est gardée.
  assert.ok(!env.DB.toutLeTexte().some((v) => v.valeur.includes(inv.code)));

  const eleve = await inscrire("lea.eleve");
  const apercu = await prof(`invitation/${inv.code}`, { methode: "GET", jeton: eleve });
  assert.equal(apercu.statut, 200);
  assert.equal(apercu.donnees.professeur, "M. Martin");
  assert.deepEqual(apercu.donnees.classe, { nom: "4e B", matiere: "mathematiques", niveau: "4e" });
  assert.equal((await prof(`invitation/ABCDEFGHJK`, { methode: "GET", jeton: eleve })).donnees.erreur, "code-invalide");

  assert.equal((await prof("rejoindre", { jeton: eleve, corps: { code: inv.code, pseudo: "Léa" } })).donnees.erreur, "accord-requis");
  assert.equal((await rejoindre(jeton, inv.code)).donnees.erreur, "propre-invitation");
  const r = await rejoindre(eleve, inv.code);
  assert.equal(r.statut, 201, JSON.stringify(r.donnees));
  assert.equal((await prof("mes-professeurs", { methode: "GET", jeton: eleve })).donnees.professeurs[0].professeur, "M. Martin");

  // Bilan : la notion d'une autre matière n'est pas montrée au professeur de mathématiques.
  const jour = new Date().toISOString().slice(0, 10);
  const notions = { [MATHS]: { etat: "a-revoir", tentes: 2, reussis: 0 }, [AUTRE]: { etat: "maitrisee", tentes: 1, reussis: 1 } };
  assert.equal((await prof("bilan", { methode: "PUT", jeton: eleve, corps: { bilan: { jour, xp: 50, dernierJour: jour, notions, badges: ["x"] } } })).statut, 204);
  const liste = await prof("eleves", { methode: "GET", jeton });
  assert.equal(liste.donnees.eleves.length, 1);
  const e = liste.donnees.eleves[0];
  assert.equal(e.pseudo, "Léa");
  assert.equal(e.classeId, classe.id);
  assert.deepEqual(Object.keys(e.bilan.notions), [MATHS]);
  assert.deepEqual(e.bilan.badges, []);
  assert.equal((await prof("classes", { methode: "GET", jeton })).donnees.classes[0].eleves, 1);
});

test("professeur : cours particulier à usage unique, déplacement et retrait d'un élève", async () => {
  const { jeton, classe } = await professeurAvecClasse();
  const inv = await lien(jeton, { mode: "particulier" });
  assert.equal(inv.max, 1);
  const a = await inscrire("eleve.a");
  const b = await inscrire("eleve.b");
  assert.equal((await rejoindre(a, inv.code, "Alix")).statut, 201);
  assert.equal((await rejoindre(b, inv.code, "Bao")).donnees.erreur, "code-invalide");
  const { donnees } = await prof("eleves", { methode: "GET", jeton });
  const id = donnees.eleves[0].id;
  assert.equal(donnees.eleves[0].classeId, null);
  assert.equal((await prof("classes", { methode: "GET", jeton })).donnees.particuliers, 1);
  assert.equal((await prof(`eleves/${id}/deplacer`, { jeton, corps: { classeId: classe.id } })).donnees.classeId, classe.id);
  assert.equal((await prof(`eleves/${id}/retirer`, { jeton })).statut, 204);
  assert.equal((await prof("eleves", { methode: "GET", jeton })).donnees.eleves.length, 0);
  assert.equal((await prof("bilan", { methode: "PUT", jeton: a, corps: { bilan: { jour: "2026-11-17" } } })).donnees.erreur, "aucun-professeur");
});

test("professeur : révocation, l'élève quitte et son bilan est effacé, quota de professeurs", async () => {
  const { jeton, classe, profId } = await professeurAvecClasse();
  const inv = await lien(jeton, { mode: "classe", classeId: classe.id });
  const revoque = await lien(jeton, { mode: "classe", classeId: classe.id });
  assert.equal((await prof(`invitations/${revoque.id}/revoquer`, { jeton })).statut, 204);
  const eleve = await inscrire("eleve.c");
  assert.equal((await rejoindre(eleve, revoque.code)).donnees.erreur, "code-invalide");
  assert.equal((await rejoindre(eleve, inv.code)).statut, 201);
  await prof("bilan", { methode: "PUT", jeton: eleve, corps: { bilan: { jour: "2026-11-17" } } });
  assert.equal(sql().prepare("SELECT count(*) AS n FROM professeurs_bilans").get().n, 1);
  assert.equal((await prof(`mes-professeurs/${profId}/quitter`, { jeton: eleve })).statut, 204);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM professeurs_bilans").get().n, 0);

  // Au plus MAX_PROFS_ELEVE professeurs par élève.
  for (let i = 0; i < MAX_PROFS_ELEVE; i++) {
    sql().prepare("INSERT INTO professeurs_eleves (prof_id, eleve_id, pseudo, accord_version) VALUES (?, ?, 'Léa', ?)").run(`p-${i}`, await compteIdDeJeton(eleve), VERSION_ACCORD_ELEVE);
  }
  assert.equal((await rejoindre(eleve, inv.code)).donnees.erreur, "quota-professeurs");
});

test("professeur : supprimer une classe détache ses élèves ; supprimer le compte efface tout", async () => {
  const { jeton, classe } = await professeurAvecClasse();
  const inv = await lien(jeton, { mode: "classe", classeId: classe.id });
  const eleve = await inscrire("eleve.d");
  await rejoindre(eleve, inv.code);
  assert.equal((await prof(`classes/${classe.id}/supprimer`, { jeton })).statut, 204);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM professeurs_eleves").get().n, 0);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM professeurs_invitations").get().n, 0);

  const c2 = (await prof("classes", { jeton, corps: { nom: "3e C", matiere: "mathematiques", niveau: "3e" } })).donnees.classe;
  await rejoindre(eleve, (await lien(jeton, { mode: "classe", classeId: c2.id })).code);
  const supp = await appeler("/api/compte-local/compte/supprimer", { jeton, corps: { motDePasse: MDP } });
  assert.ok(supp.statut < 300, JSON.stringify(supp));
  for (const table of ["professeurs_profils", "professeurs_classes", "professeurs_invitations", "professeurs_eleves", "professeurs_bilans"]) {
    assert.equal(sql().prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0, table);
  }
});

test("professeur : la purge quotidienne retire les liens expirés ou épuisés", async () => {
  const { jeton, classe } = await professeurAvecClasse();
  await lien(jeton, { mode: "classe", classeId: classe.id, dureeJours: 1 });
  assert.deepEqual(await purgerProfesseur(env, Date.now() + 2 * 86400000), { invitations: 1, consommations: 0 });
});

test("non-conservation : aucun texte inattendu d'une requête professeur ou élève n'est gardé", async () => {
  const CANARI = "CANARI-PROF-7391";
  const { jeton, classe } = await professeurAvecClasse();
  assert.equal((await prof("profil", { methode: "PUT", jeton, corps: { ...PROFIL, nomAffiche: "zorglub@example.org" } })).statut, 400);
  assert.equal((await prof("classes", { jeton, corps: { nom: "06 98 76 54 32", matiere: "mathematiques", niveau: "4e" } })).statut, 400);
  await prof("profil", { methode: "PUT", jeton, corps: { ...PROFIL, commentaire: CANARI } });
  const inv = await lien(jeton, { mode: "classe", classeId: classe.id, note: CANARI });
  const eleve = await inscrire("eleve.canari");
  assert.equal((await rejoindre(eleve, inv.code, "zorglub@example.org")).statut, 400);
  await prof("rejoindre", { jeton: eleve, corps: { code: inv.code, pseudo: "Léa", accord: VERSION_ACCORD_ELEVE, message: CANARI } });
  await prof("bilan", { methode: "PUT", jeton: eleve, corps: { bilan: { jour: "2026-11-17", question: CANARI, notions: { [CANARI]: { etat: "maitrisee" } } } } });
  const fuite = env.DB.toutLeTexte().find(({ valeur }) => /CANARI-PROF|zorglub|98 76/i.test(valeur));
  assert.equal(fuite, undefined, `retrouvé dans ${fuite?.table}`);
});

// ---------- Activités (ADR 0030 §9) ----------

async function classeAvecDeuxEleves() {
  const { jeton, classe, profId } = await professeurAvecClasse();
  const inv = await lien(jeton, { mode: "classe", classeId: classe.id });
  const a = await inscrire("eleve.alix");
  const b = await inscrire("eleve.bao");
  await rejoindre(a, inv.code, "Alix");
  await rejoindre(b, inv.code, "Bao");
  const ids = (await prof("eleves", { methode: "GET", jeton })).donnees.eleves.map((e) => e.id);
  return { jeton, classe, profId, a, b, ids };
}
const activite = (jeton, corps) => prof("activites", { jeton, corps });

test("activités : validation (type, cible, notions du profil, 5 à 40 questions, objectif, échéance)", async () => {
  const { jeton, classe, ids } = await classeAvecDeuxEleves();
  const cible = { classeId: classe.id };
  assert.equal((await activite(jeton, { type: "quiz", cible, notions: [MATHS] })).donnees.erreur, "type-invalide");
  assert.equal((await activite(jeton, { type: "defi", cible: {}, notions: [MATHS] })).donnees.erreur, "cible-invalide");
  assert.equal((await activite(jeton, { type: "defi", cible: { classeId: classe.id, eleveId: ids[0] }, notions: [MATHS] })).donnees.erreur, "cible-invalide");
  assert.equal((await activite(jeton, { type: "defi", cible, notions: [] })).donnees.erreur, "notions-requises");
  assert.equal((await activite(jeton, { type: "defi", cible, notions: [AUTRE] })).donnees.erreur, "notion-hors-profil");
  assert.equal((await activite(jeton, { type: "evaluation", cible, notions: [MATHS], nbQuestions: 4 })).donnees.erreur, "nb-questions-invalide");
  assert.equal((await activite(jeton, { type: "evaluation", cible, notions: [MATHS], nbQuestions: 41 })).donnees.erreur, "nb-questions-invalide");
  assert.equal((await activite(jeton, { type: "objectif", cible, objectif: { mesure: "temps", valeur: 5 } })).donnees.erreur, "objectif-invalide");
  assert.equal((await activite(jeton, { type: "defi", cible, notions: [MATHS], echeance: "2000-01-01" })).donnees.erreur, "echeance-invalide");
  assert.equal((await activite(jeton, { type: "cahier", cible, notions: [MATHS], cahier: { type: "brouillon" } })).donnees.erreur, "cahier-invalide");
  assert.equal((await activite(jeton, { type: "defi", cible: { eleveId: "00000000-0000-4000-8000-000000000000" }, notions: [MATHS] })).statut, 404);
  const ok = await activite(jeton, { type: "evaluation", cible, notions: [MATHS], nbQuestions: 40, libelle: "Contrôle du chapitre 3" });
  assert.equal(ok.statut, 201, JSON.stringify(ok.donnees));
  const obj = await activite(jeton, { type: "objectif", cible: { eleveId: ids[0] }, objectif: { mesure: "temps", valeur: 60 } });
  assert.equal(obj.statut, 201);
  const cahier = await activite(jeton, { type: "cahier", cible, notions: [MATHS], cahier: { type: "exercices", ia: true } });
  assert.equal(cahier.donnees.source, "catalogue");
  assert.equal(cahier.donnees.raison, "ia-indisponible");
  const liste = (await prof("activites", { methode: "GET", jeton })).donnees;
  assert.deepEqual(liste.activites.map((x) => x.type).sort(), ["cahier", "evaluation", "objectif"]);
  assert.equal(liste.activites.find((x) => x.type === "evaluation").parametres.nbQuestions, 40);
  // Un élève n'a pas accès aux routes du professeur.
  assert.equal((await activite((await inscrire("intrus.x")), { type: "defi", cible, notions: [MATHS] })).statut, 403);
});

test("activités : l'élève voit celles de sa classe et les siennes, envoie ses résultats ; une évaluation ne se repasse pas", async () => {
  const { jeton, classe, a, b, ids } = await classeAvecDeuxEleves();
  const defi = (await activite(jeton, { type: "defi", cible: { classeId: classe.id }, notions: [MATHS] })).donnees.id;
  const evalA = (await activite(jeton, { type: "evaluation", cible: { eleveId: ids.find(Boolean) }, notions: [MATHS], nbQuestions: 10 })).donnees.id;
  const vuesA = (await prof("mes-activites", { methode: "GET", jeton: a })).donnees.activites;
  const vuesB = (await prof("mes-activites", { methode: "GET", jeton: b })).donnees.activites;
  // ids est trié par pseudo : Alix d'abord.
  assert.deepEqual(vuesA.map((x) => x.type).sort(), ["defi", "evaluation"]);
  assert.deepEqual(vuesB.map((x) => x.type), ["defi"]);
  assert.equal(vuesA[0].professeur, "M. Martin");

  const envoyer = (jet, resultats) => prof("resultats", { methode: "PUT", jeton: jet, corps: { resultats } });
  assert.equal((await envoyer(a, [{ activite: defi, reussis: 2, total: 5, dureeS: 60, termine: true }])).donnees.enregistres, 1);
  await envoyer(a, [{ activite: defi, reussis: 4, total: 5, dureeS: 50, termine: true }]);
  await envoyer(a, [{ activite: evalA, reussis: 7, total: 10, dureeS: 600, termine: true }]);
  const second = await envoyer(a, [{ activite: evalA, reussis: 10, total: 10, termine: true }]);
  assert.deepEqual(second.donnees.refuses, [{ activite: evalA, raison: "deja-terminee" }]);
  // B ne peut pas répondre à l'évaluation de A.
  assert.deepEqual((await envoyer(b, [{ activite: evalA, reussis: 10, total: 10, termine: true }])).donnees.refuses, [{ activite: evalA, raison: "introuvable" }]);

  const { resultats } = (await prof("activites", { methode: "GET", jeton })).donnees;
  const rDefi = resultats.find((r) => r.activite === defi);
  assert.equal(rDefi.tentatives, 2);
  assert.equal(rDefi.meilleur, 4);
  assert.equal(rDefi.dureeS, 110);
  assert.equal(resultats.find((r) => r.activite === evalA).reussis, 7);
  assert.equal(resultats.length, 2);

  // Archivée : l'activité disparaît chez l'élève ; supprimée : ses résultats aussi.
  assert.equal((await prof(`activites/${defi}/archiver`, { jeton })).statut, 204);
  assert.deepEqual((await prof("mes-activites", { methode: "GET", jeton: b })).donnees.activites, []);
  assert.equal((await prof(`activites/${evalA}/supprimer`, { jeton })).statut, 204);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM professeurs_resultats WHERE activite_id = ?").get(evalA).n, 0);
});

test("activités : quitter, retirer, supprimer la classe ou le compte effacent activités et résultats liés", async () => {
  const { jeton, classe, profId, a, ids } = await classeAvecDeuxEleves();
  const perso = (await activite(jeton, { type: "defi", cible: { eleveId: ids[0] }, notions: [MATHS] })).donnees.id;
  const deClasse = (await activite(jeton, { type: "defi", cible: { classeId: classe.id }, notions: [MATHS] })).donnees.id;
  await prof("resultats", { methode: "PUT", jeton: a, corps: { resultats: [{ activite: perso, reussis: 1, total: 5, termine: true }, { activite: deClasse, reussis: 3, total: 5, termine: true }] } });
  assert.equal(sql().prepare("SELECT count(*) AS n FROM professeurs_resultats").get().n, 2);
  assert.equal((await prof(`mes-professeurs/${profId}/quitter`, { jeton: a })).statut, 204);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM professeurs_resultats").get().n, 0);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM professeurs_activites WHERE id = ?").get(perso).n, 0, "activité personnelle effacée");
  assert.equal(sql().prepare("SELECT count(*) AS n FROM professeurs_activites WHERE id = ?").get(deClasse).n, 1, "activité de classe gardée");
  assert.equal((await prof(`classes/${classe.id}/supprimer`, { jeton })).statut, 204);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM professeurs_activites").get().n, 0);
  await prof("classes", { jeton, corps: { nom: "3e C", matiere: "mathematiques", niveau: "3e" } });
  await activite(jeton, { type: "objectif", cible: { eleveId: ids[1] }, objectif: { mesure: "xp", valeur: 100 } });
  await appeler("/api/compte-local/compte/supprimer", { jeton, corps: { motDePasse: MDP } });
  for (const table of ["professeurs_activites", "professeurs_resultats", "professeurs_consommations"]) {
    assert.equal(sql().prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0, table);
  }
});

test("activités : cahier rédigé par l'IA sous quota du professeur", async () => {
  env.LLM_ACTIF = "true";
  env.LLM_SESSION_SECRET = "secret-factice-de-test-de-plus-de-32-caracteres";
  env.AI = { run: async (_m, parametres) => {
    const { notions: liste, plan } = JSON.parse(parametres.messages[1].content);
    const bloc = (c, i) => ({ creneau: c.creneau, titre: `T${c.creneau}`, texte: `${c.genre} ${i}.`, indice: ["exercice", "defi"].includes(c.genre) ? "Indice." : "", reponse: ["exercice", "defi"].includes(c.genre) ? "Réponse." : "" });
    return { choices: [{ message: { content: JSON.stringify({ titre: "Mission", introduction: "Bonjour.", sections: liste.map((n) => ({ notion: n.notion, blocs: plan.map(bloc) })), conclusion: "Bravo." }) }, finish_reason: "stop" }], usage: { completion_tokens: 900 } };
  } };
  const { jeton, classe, a } = await classeAvecDeuxEleves();
  const r = await activite(jeton, { type: "cahier", cible: { classeId: classe.id }, notions: [MATHS], cahier: { type: "exercices", ia: true } });
  assert.equal(r.statut, 201, JSON.stringify(r.donnees));
  assert.equal(r.donnees.source, "ia");
  assert.equal(r.donnees.quota.utilisees, 1);
  const vue = (await prof("mes-activites", { methode: "GET", jeton: a })).donnees.activites[0];
  assert.equal(vue.contenu.titre, "Mission");
  assert.equal(sql().prepare("SELECT tokens FROM professeurs_consommations").get().tokens, 900);
});
