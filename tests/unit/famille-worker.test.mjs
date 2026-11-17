import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker, { _reinitialiser } from "../../worker/src/index.js";
import { CATALOGUE } from "../../worker/src/generated/catalogue.js";
import { noterConsommation, purgerFamille } from "../../worker/src/famille.js";
import { VERSION_CONSENTEMENT } from "../../web/comptes.js";
import { MAX_ENFANTS_FAMILLE } from "../../web/famille.js";
import { creerD1Complet } from "../helpers/d1-complet.mjs";

// Espace famille des comptes locaux côté Worker (ADR 0029) : chaque règle est vérifiée par le serveur.
const ORIGINE = "https://www.kermiclab.online";
const MDP = "Correct-Cheval-9";
const MDP_ENFANT = "Petit-Renard-42";
const notions = CATALOGUE.index.maquettes.filter((m) => !m.sujet.startsWith("jeux/") && CATALOGUE.pages[m.id]).map((m) => m.id);

function creerAlias() {
  const appels = [];
  return {
    appels,
    run: async (modele, parametres) => {
      appels.push({ modele });
      const { notions: liste, plan } = JSON.parse(parametres.messages[1].content);
      const bloc = (c, i) => ({
        creneau: c.creneau, titre: `Titre ${c.creneau}`, texte: `${c.genre} ${i + 1}.`,
        indice: ["exercice", "defi"].includes(c.genre) ? "Pense à la définition." : "",
        reponse: ["exercice", "defi"].includes(c.genre) ? `Solution ${c.creneau}.` : ""
      });
      const sortie = { titre: "La mission des nombres", introduction: "Bienvenue.", sections: liste.map((n) => ({ notion: n.notion, blocs: plan.map(bloc) })), conclusion: "Bravo !" };
      return { choices: [{ message: { content: JSON.stringify(sortie) }, finish_reason: "stop" }], usage: { completion_tokens: 1500 } };
    }
  };
}

let env, ctx;
beforeEach(() => {
  env = {
    DB: creerD1Complet(), COMPTES_LOCAUX_SECRET: "s".repeat(40), ORIGINES_AUTORISEES: ORIGINE,
    LLM_ACTIF: "true", LLM_SESSION_SECRET: "secret-factice-de-test-de-plus-de-32-caracteres", AI: creerAlias()
  };
  const promesses = [];
  ctx = { waitUntil: (p) => promesses.push(p), attendre: () => Promise.all(promesses) };
  _reinitialiser();
});
afterEach(() => env.DB.sqlite.close());

const sql = () => env.DB.sqlite;
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
const famille = (route, options) => appeler(`/api/famille/${route}`, options);
async function inscrire(identifiant, motDePasse = MDP) {
  const r = await appeler("/api/compte-local/inscription", { corps: { identifiant, motDePasse }, ip: `ip-${identifiant}` });
  assert.equal(r.statut, 201, JSON.stringify(r.donnees));
  return r.donnees.jeton;
}
const idDe = async (jeton) => (await famille("moi", { methode: "GET", jeton })).donnees;
const compteIdDeJeton = async (jeton) => {
  const { sha256Hex } = await import("../../web/compte-local.js");
  return sql().prepare("SELECT compte_id FROM sessions_locales WHERE jeton_hash = ?").get(await sha256Hex(jeton)).compte_id;
};
const donnerRole = (id, role = "parent") => sql().prepare("INSERT INTO attributions_roles (type_compte, compte_id, role_id) VALUES ('compte-local', ?, ?)").run(id, role);
const profil = { prenom: "Noé", trancheAge: "11-14", consentement: VERSION_CONSENTEMENT };

async function parentEtEnfant() {
  const parent = await inscrire("papa.kermic");
  donnerRole(await compteIdDeJeton(parent));
  const enfant = await inscrire("noe.kermic", MDP_ENFANT);
  const { donnees: invitation } = await famille("invitation", { jeton: enfant });
  const r = await famille("rejoindre", { jeton: parent, corps: { code: invitation.code, ...profil } });
  assert.equal(r.statut, 201, JSON.stringify(r.donnees));
  return { parent, enfant, enfantId: r.donnees.id, parentId: await compteIdDeJeton(parent) };
}

test("accès : session porteuse obligatoire, origine contrôlée, rôle parent exigé pour la gestion", async () => {
  assert.equal((await famille("moi", { methode: "GET" })).statut, 401);
  const solo = await inscrire("solo.kermic");
  const r = await worker.fetch(new Request("https://api.test/api/famille/moi", { headers: { origin: "https://ailleurs.example", authorization: `Bearer ${solo}` } }), env, ctx);
  assert.equal(r.status, 403);
  const moi = await idDe(solo);
  assert.deepEqual(moi, { role: "visiteur", parent: false, enfants: 0, enfant: null, invitation: null });
  for (const [route, methode] of [["tableau", "GET"], ["rejoindre", "POST"], ["enfants", "POST"], ["cahiers", "POST"]]) {
    const refus = await famille(route, { methode, jeton: solo, corps: methode === "POST" ? {} : undefined });
    assert.equal(refus.statut, 403, route);
    assert.equal(refus.donnees.erreur, "role-parent-requis");
  }
  donnerRole(await compteIdDeJeton(solo));
  assert.equal((await idDe(solo)).parent, true);
  assert.equal((await famille("tableau", { methode: "GET", jeton: solo })).statut, 200);
});

test("invitation : un compte solo invite son parent ; code à usage unique, empreinte seule gardée", async () => {
  const parent = await inscrire("papa.kermic");
  donnerRole(await compteIdDeJeton(parent));
  const enfant = await inscrire("noe.kermic", MDP_ENFANT);
  const { statut, donnees } = await famille("invitation", { jeton: enfant });
  assert.equal(statut, 201);
  assert.match(donnees.code, /^[A-HJKMNP-TV-Z2-9]{8}$/);
  assert.ok(donnees.expire > Date.now() / 1000 + 47 * 3600);
  assert.equal(JSON.stringify(sql().prepare("SELECT * FROM familles_invitations").all()).includes(donnees.code), false, "code jamais stocké en clair");
  assert.ok((await idDe(enfant)).invitation);

  // Consentement et profil obligatoires ; un mauvais code ne dit rien de plus qu'un code expiré.
  assert.equal((await famille("rejoindre", { jeton: parent, corps: { code: donnees.code, prenom: "Noé", trancheAge: "11-14" } })).donnees.erreur, "consentement-requis");
  assert.equal((await famille("rejoindre", { jeton: parent, corps: { ...profil, code: "ABCD-EFGH" } })).donnees.erreur, "code-invalide");
  assert.equal((await famille("rejoindre", { jeton: parent, corps: { ...profil, code: donnees.code.toLowerCase().replace(/^(.{4})/, "$1-") } })).statut, 201);
  // Réutilisation refusée.
  assert.equal((await famille("rejoindre", { jeton: parent, corps: { ...profil, code: donnees.code } })).donnees.erreur, "code-invalide");

  const vu = await idDe(enfant);
  assert.deepEqual(vu.enfant.prenom, "Noé");
  assert.equal(vu.parent, false);
  assert.equal(vu.invitation, null);
  // Un enfant rattaché ne peut ni inviter de nouveau, ni gérer, même avec un rôle parent.
  assert.equal((await famille("invitation", { jeton: enfant })).donnees.erreur, "deja-en-famille");
  donnerRole(await compteIdDeJeton(enfant));
  assert.equal((await famille("tableau", { methode: "GET", jeton: enfant })).donnees.erreur, "compte-enfant");
  // Un parent avec des enfants ne peut pas devenir enfant.
  assert.equal((await famille("invitation", { jeton: parent })).donnees.erreur, "compte-parent");
});

test("création d'un compte enfant par le parent : règles du compte local, plafond de profils", async () => {
  const parent = await inscrire("papa.kermic");
  donnerRole(await compteIdDeJeton(parent));
  const corps = { ...profil, identifiant: "lou.kermic", motDePasse: MDP_ENFANT };
  assert.equal((await famille("enfants", { jeton: parent, corps: { ...corps, motDePasse: "court" } })).donnees.erreur, "mot-de-passe-court");
  assert.equal((await famille("enfants", { jeton: parent, corps: { ...corps, identifiant: "lou@exemple.fr" } })).donnees.erreur, "identifiant-caracteres");
  const r = await famille("enfants", { jeton: parent, corps });
  assert.equal(r.statut, 201);
  // L'enfant se connecte avec ses propres identifiants.
  const connexion = await appeler("/api/compte-local/connexion", { corps: { identifiant: "lou.kermic", motDePasse: MDP_ENFANT } });
  assert.equal(connexion.statut, 200);
  assert.equal((await idDe(connexion.donnees.jeton)).enfant.prenom, "Noé");
  assert.equal((await famille("enfants", { jeton: parent, corps })).donnees.erreur, "identifiant-pris");
  for (let i = 1; i < MAX_ENFANTS_FAMILLE; i++) {
    assert.equal((await famille("enfants", { jeton: parent, corps: { ...corps, identifiant: `enfant${i}.kermic` }, ip: `ip${i}` })).statut, 201);
  }
  assert.equal((await famille("enfants", { jeton: parent, corps: { ...corps, identifiant: "un.de.trop" }, ip: "ipx" })).donnees.erreur, "quota-enfants");
});

test("gestion : modifier, nouveau mot de passe et suppression exigent le parent propriétaire et sa réauthentification", async () => {
  const { parent, enfant, enfantId } = await parentEtEnfant();
  const autre = await inscrire("autre.parent");
  donnerRole(await compteIdDeJeton(autre));
  assert.equal((await famille(`enfants/${enfantId}/modifier`, { jeton: autre, corps: { prenom: "Pirate" } })).statut, 404, "pas l'enfant d'un autre parent");
  const m = await famille(`enfants/${enfantId}/modifier`, { jeton: parent, corps: { prenom: "Noé K", trancheAge: "15-17" } });
  assert.deepEqual(m.donnees, { id: enfantId, prenom: "Noé K", trancheAge: "15-17" });

  assert.equal((await famille(`enfants/${enfantId}/mot-de-passe`, { jeton: parent, corps: { motDePasse: "Nouveau-Secret-77" } })).statut, 401);
  const nouveau = await famille(`enfants/${enfantId}/mot-de-passe`, { jeton: parent, corps: { motDePasse: "Nouveau-Secret-77", motDePasseParent: MDP } });
  assert.equal(nouveau.statut, 204);
  assert.equal((await famille("moi", { methode: "GET", jeton: enfant })).statut, 401, "sessions de l'enfant fermées");
  assert.equal((await appeler("/api/compte-local/connexion", { corps: { identifiant: "noe.kermic", motDePasse: "Nouveau-Secret-77" } })).statut, 200);

  assert.equal((await famille(`enfants/${enfantId}/supprimer`, { jeton: parent, corps: { motDePasseParent: "faux" } })).statut, 401);
  assert.equal((await famille(`enfants/${enfantId}/supprimer`, { jeton: parent, corps: { motDePasseParent: MDP } })).statut, 204);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM comptes_locaux WHERE id = ?").get(enfantId).n, 0);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM familles_liens").get().n, 0);
});

test("détacher : le compte de l'enfant redevient solo, sa progression locale n'est pas touchée", async () => {
  const { parent, enfant, enfantId } = await parentEtEnfant();
  assert.equal((await famille(`enfants/${enfantId}/detacher`, { jeton: parent })).statut, 204);
  assert.equal((await idDe(enfant)).enfant, null);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM comptes_locaux WHERE id = ?").get(enfantId).n, 1);
});

test("bilan : envoyé par l'enfant, borné, sans texte libre ; lu par le parent dans le tableau", async () => {
  const { parent, enfant, enfantId } = await parentEtEnfant();
  const solo = await inscrire("solo.kermic");
  const bilan = {
    jour: "2026-11-17", xp: 340, niveau: 4, serie: 3, serieMax: 5, questions: 12, tempsMin: 95, dernierJour: "2026-11-17",
    badges: ["premier-pas", "<script>"], pseudo: "Noé le grand", jours: [{ jour: "2026-11-17", xp: 40, min: 25, q: 3 }],
    notions: { pythagore: { etat: "maitrisee", tentes: 4, reussis: 4 }, "Pas un id": { etat: "en-cours" }, fractions: { etat: "inconnu" } }
  };
  assert.equal((await famille("bilan", { methode: "PUT", jeton: solo, corps: { bilan } })).statut, 403, "seul un enfant rattaché envoie un bilan");
  assert.equal((await famille("bilan", { methode: "PUT", jeton: enfant, corps: { bilan: { xp: 3 } } })).statut, 400);
  assert.equal((await famille("bilan", { methode: "PUT", jeton: enfant, corps: { bilan } })).statut, 204);
  const stocke = sql().prepare("SELECT bilan FROM familles_bilans WHERE enfant_id = ?").get(enfantId).bilan;
  assert.equal(stocke.includes("Noé"), false);
  assert.equal(stocke.includes("script"), false);
  const { donnees } = await famille("tableau", { methode: "GET", jeton: parent });
  const e = donnees.enfants[0];
  assert.equal(e.prenom, "Noé");
  assert.equal(e.bilan.xp, 340);
  assert.deepEqual(Object.keys(e.bilan.notions), ["pythagore"]);
});

test("cahiers : génération par le parent (IA ou catalogue), calibrage puis avancement par l'enfant", async () => {
  const { parent, enfant, enfantId } = await parentEtEnfant();
  const demande = { enfantId, type: "exercices", notions: notions.slice(0, 2), longueur: "court", univers: "espace", objectif: "reviser", langue: "fr" };
  const sansIa = await famille("cahiers", { jeton: parent, corps: demande });
  assert.equal(sansIa.statut, 201);
  assert.equal(sansIa.donnees.source, "catalogue");
  const avecIa = await famille("cahiers", { jeton: parent, corps: { ...demande, utiliserLlm: true } });
  assert.equal(avecIa.donnees.source, "ia", JSON.stringify(avecIa.donnees));
  assert.equal(avecIa.donnees.quota.utilisees, 1);
  assert.equal((await famille("cahiers", { jeton: parent, corps: { ...demande, notions: ["inconnue"] } })).statut, 400);

  const { donnees: { cahiers } } = await famille("mes-cahiers", { methode: "GET", jeton: enfant });
  assert.equal(cahiers.length, 2);
  const ia = cahiers.find((c) => c.id === avecIa.donnees.id);
  assert.equal(ia.statut, "assigne");
  assert.equal(ia.cahier.sections.length, 2);
  // Calibrage : seules les notions du cahier sont gardées, une seule fois.
  const r = await famille(`mes-cahiers/${ia.id}/calibrage`, { jeton: enfant, corps: { resultats: { [notions[0]]: true, autre: true } } });
  assert.deepEqual(r.donnees.calibrage, { [notions[0]]: true, [notions[1]]: false });
  assert.equal((await famille(`mes-cahiers/${ia.id}/calibrage`, { jeton: enfant, corps: {} })).statut, 409);
  // L'avancement suit le bilan ; tout réussi → terminé.
  const bilan = { jour: "2026-11-17", cahiers: [{ famille: ia.id, reussis: 6, total: 6 }, { famille: sansIa.donnees.id, reussis: 1, total: 4 }] };
  await famille("bilan", { methode: "PUT", jeton: enfant, corps: { bilan } });
  const { donnees } = await famille("tableau", { methode: "GET", jeton: parent });
  const parId = Object.fromEntries(donnees.enfants[0].cahiers.map((c) => [c.id, c]));
  assert.equal(parId[ia.id].statut, "termine");
  assert.equal(parId[sansIa.donnees.id].statut, "assigne", "pas encore calibré : avancement ignoré");
  assert.equal(parId[ia.id].titre, "La mission des nombres");
  // Consommation de la génération comptée pour le parent.
  const conso = donnees.consommations.lignes.find((l) => l.module === "cahier-famille");
  assert.deepEqual([conso.appels, conso.tokens], [1, 1500]);
  // Archiver : le cahier disparaît chez l'enfant.
  assert.equal((await famille(`cahiers/${ia.id}/archiver`, { jeton: parent })).statut, 204);
  assert.equal((await famille("mes-cahiers", { methode: "GET", jeton: enfant })).donnees.cahiers.length, 1);
});

test("consommations : comptées pour les membres d'une famille seulement, purgées après 90 jours", async () => {
  const { parent, enfantId } = await parentEtEnfant();
  const solo = await inscrire("solo.kermic");
  assert.equal(await noterConsommation(env, await compteIdDeJeton(solo), "chat", { tokens: 10 }), false);
  assert.equal(await noterConsommation(env, enfantId, "chat", { tokens: 120 }), true);
  assert.equal(await noterConsommation(env, enfantId, "chat", { tokens: 30 }), true);
  assert.equal(await noterConsommation(env, enfantId, "inconnu"), false);
  const { donnees } = await famille("tableau", { methode: "GET", jeton: parent });
  assert.deepEqual(donnees.consommations.lignes.map((l) => [l.compte, l.module, l.appels, l.tokens]), [[enfantId, "chat", 2, 150]]);
  const r = await purgerFamille(env, Date.now() + 91 * 86400000);
  assert.equal(r.consommations, 1);
});

test("suppression d'un compte local : les données de famille partent avec lui", async () => {
  const { parent, enfantId, parentId } = await parentEtEnfant();
  await noterConsommation(env, parentId, "chat", { tokens: 5 });
  const r = await appeler("/api/compte-local/compte/supprimer", { jeton: parent, corps: { motDePasse: MDP } });
  assert.equal(r.statut, 204);
  for (const table of ["familles_liens", "familles_consommations"]) assert.equal(sql().prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0, table);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM comptes_locaux WHERE id = ?").get(enfantId).n, 1, "l'enfant redevient solo");
});

test("activités : défi, évaluation de 5 à 40 questions et objectif, pour un enfant ou toute la famille", async () => {
  const { parent, enfant, enfantId, parentId } = await parentEtEnfant();
  const lou = await famille("enfants", { jeton: parent, corps: { ...profil, prenom: "Lou", identifiant: "lou.kermic", motDePasse: MDP_ENFANT } });
  const jetonLou = (await appeler("/api/compte-local/connexion", { corps: { identifiant: "lou.kermic", motDePasse: MDP_ENFANT } })).donnees.jeton;
  const deux = notions.slice(0, 2);
  // Bornes du nombre de questions, notions requises, cible vérifiée.
  for (const nb of [4, 41, 7.5]) {
    assert.equal((await famille("activites", { jeton: parent, corps: { type: "evaluation", cible: { famille: true }, notions: deux, nbQuestions: nb } })).donnees.erreur, "nb-questions-invalide", String(nb));
  }
  assert.equal((await famille("activites", { jeton: parent, corps: { type: "defi", cible: { famille: true }, notions: [] } })).donnees.erreur, "notions-requises");
  assert.equal((await famille("activites", { jeton: parent, corps: { type: "defi", cible: {}, notions: deux } })).donnees.erreur, "cible-invalide");
  const autre = await inscrire("autre.parent");
  donnerRole(await compteIdDeJeton(autre));
  assert.equal((await famille("activites", { jeton: autre, corps: { type: "defi", cible: { enfantId }, notions: deux } })).statut, 404, "pas l'enfant d'un autre parent");
  assert.equal((await famille("activites", { jeton: autre, corps: { type: "defi", cible: { famille: true }, notions: deux } })).donnees.erreur, "aucun-enfant");
  // Enfant seul (le solo n'a pas accès aux routes du parent).
  assert.equal((await famille("activites", { jeton: enfant, corps: { type: "defi", cible: { famille: true }, notions: deux } })).statut, 403);

  const evaluation = await famille("activites", { jeton: parent, corps: { type: "evaluation", cible: { famille: true }, notions: deux, nbQuestions: 40, libelle: "Bilan du trimestre" } });
  assert.equal(evaluation.statut, 201);
  const defi = await famille("activites", { jeton: parent, corps: { type: "defi", cible: { enfantId }, notions: deux } });
  const objectif = await famille("activites", { jeton: parent, corps: { type: "objectif", cible: { famille: true }, objectif: { mesure: "temps", valeur: 60 } } });
  assert.equal(objectif.statut, 201);

  // Noé voit les trois, Lou seulement celles de toute la famille.
  const deNoe = (await famille("mes-activites", { methode: "GET", jeton: enfant })).donnees.activites;
  const deLou = (await famille("mes-activites", { methode: "GET", jeton: jetonLou })).donnees.activites;
  assert.equal(deNoe.length, 3);
  assert.deepEqual(deLou.map((a) => a.type).sort(), ["evaluation", "objectif"]);
  assert.equal(deLou.find((a) => a.type === "evaluation").parametres.nbQuestions, 40);

  // Résultats : compteurs seulement ; une évaluation ne compte qu'une fois ; un défi se rejoue (meilleur score).
  const envoyer = (jeton, resultats) => famille("resultats", { methode: "PUT", jeton, corps: { resultats } });
  assert.equal((await envoyer(enfant, [{ activite: evaluation.donnees.id, reussis: 30, total: 40, dureeS: 900, termine: true }])).donnees.enregistres, 1);
  assert.equal((await envoyer(enfant, [{ activite: evaluation.donnees.id, reussis: 40, total: 40, termine: true }])).donnees.refuses[0].raison, "deja-terminee");
  await envoyer(enfant, [{ activite: defi.donnees.id, reussis: 2, total: 5, dureeS: 60, termine: true }]);
  await envoyer(enfant, [{ activite: defi.donnees.id, reussis: 5, total: 5, dureeS: 40, termine: true }]);
  assert.equal((await envoyer(jetonLou, [{ activite: defi.donnees.id, reussis: 5, total: 5, termine: true }])).donnees.refuses[0].raison, "introuvable", "défi donné à Noé seulement");
  assert.equal((await envoyer(enfant, [{ activite: objectif.donnees.id, reussis: 1, total: 1, termine: true }])).donnees.refuses[0].raison, "introuvable", "un objectif se mesure, il ne s'envoie pas");

  const { donnees } = await famille("tableau", { methode: "GET", jeton: parent });
  assert.equal(donnees.activites.length, 3);
  const rDefi = donnees.resultats.find((r) => r.activite === defi.donnees.id);
  assert.deepEqual([rDefi.meilleur, rDefi.tentatives, rDefi.dureeS], [5, 2, 100]);
  assert.equal(donnees.resultats.find((r) => r.activite === evaluation.donnees.id).reussis, 30);

  // Archiver : l'activité disparaît chez l'enfant ; supprimer efface aussi les résultats.
  assert.equal((await famille(`activites/${objectif.donnees.id}/archiver`, { jeton: parent })).statut, 204);
  assert.equal((await famille("mes-activites", { methode: "GET", jeton: jetonLou })).donnees.activites.length, 1);
  assert.equal((await famille(`activites/${defi.donnees.id}/supprimer`, { jeton: parent })).statut, 204);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM familles_resultats WHERE activite_id = ?").get(defi.donnees.id).n, 0);

  // Détacher Noé efface ses résultats ; supprimer le parent efface ses activités.
  await famille(`enfants/${enfantId}/detacher`, { jeton: parent });
  assert.equal(sql().prepare("SELECT count(*) AS n FROM familles_resultats WHERE enfant_id = ?").get(enfantId).n, 0);
  assert.equal((await appeler("/api/compte-local/compte/supprimer", { jeton: parent, corps: { motDePasse: MDP } })).statut, 204);
  assert.equal(sql().prepare("SELECT count(*) AS n FROM familles_activites WHERE parent_id = ?").get(parentId).n, 0);
  assert.ok(lou.statut === 201);
});

test("cahier pour toute la famille : une génération, une copie par enfant, même groupe", async () => {
  const { parent, enfant } = await parentEtEnfant();
  await famille("enfants", { jeton: parent, corps: { ...profil, prenom: "Lou", identifiant: "lou.kermic", motDePasse: MDP_ENFANT } });
  const r = await famille("cahiers", { jeton: parent, corps: { famille: true, type: "fiches", notions: notions.slice(0, 1), utiliserLlm: true } });
  assert.equal(r.statut, 201, JSON.stringify(r.donnees));
  assert.equal(r.donnees.ids.length, 2);
  assert.equal(env.AI.appels.length, 1, "une seule génération pour toute la famille");
  const lignes = sql().prepare("SELECT groupe FROM familles_cahiers").all();
  assert.equal(new Set(lignes.map((l) => l.groupe)).size, 1);
  assert.ok(lignes[0].groupe);
  assert.equal((await famille("mes-cahiers", { methode: "GET", jeton: enfant })).donnees.cahiers.length, 1);
});
