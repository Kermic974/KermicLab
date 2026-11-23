import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { lireConfiguration } from "../../worker/src/configuration.js";
import {
  FONCTIONNALITES, PERMISSIONS, ROLES_SYSTEME, accesAutorise, listerRoles, listerStrategies, roleAccedeAuBackOffice,
  validerRole, validerStrategie
} from "../../worker/src/roles.js";
import {
  PLAFONDS_SCHEMA, chargerReglages, ecrireEtatContenu, ecrireParametre, ecrireSouscriptions, ecrireTheme, envAvecReglages,
  indexVisible, invaliderReglages, reglagesDe, validerNiveaux, validerParametre
} from "../../worker/src/reglages.js";
import { CONTRASTE_MIN, THEMES, contraste, cssTheme, deriverVariables, validerTheme } from "../../web/theme.js";
import { gererAuth } from "../../worker/src/auth/routes.js";
import { creerD1Complet } from "../helpers/d1-complet.mjs";

let env;
beforeEach(() => { env = { DB: creerD1Complet() }; invaliderReglages(); });

// ---------- Rôles et stratégies ----------

test("rôles système : toujours présents, permissions connues, administrateur complet", async () => {
  const roles = await listerRoles(env);
  assert.deepEqual(roles.map((r) => r.id), Object.keys(ROLES_SYSTEME));
  assert.ok(roles.every((r) => r.systeme && r.permissions.every((p) => PERMISSIONS.includes(p))));
  assert.deepEqual(roles.find((r) => r.id === "admin").permissions, PERMISSIONS);
  assert.ok(!roles.find((r) => r.id === "visiteur").permissions.some((p) => p.startsWith("admin.")));
});

test("rôles : surcharge d'un rôle système et rôle personnalisé, permissions inconnues écartées", async () => {
  assert.deepEqual(validerRole("Mauvais Id", { libelle: "x" }), { ok: false, code: "identifiant-invalide" });
  assert.deepEqual(validerRole("moderateur", { libelle: "  " }), { ok: false, code: "libelle-requis" });
  const v = validerRole("moderateur", { libelle: "Modérateur", description: "Relit les signalements", permissions: ["admin.securite", "inconnue", "chat", "chat"] });
  assert.deepEqual(v.role.permissions, ["admin.securite", "chat"]);
  const inserer = (r) => env.DB.sqlite.prepare("INSERT INTO roles (id, libelle, description, permissions) VALUES (?, ?, ?, ?)").run(r.id, r.libelle, r.description, JSON.stringify(r.permissions));
  inserer(v.role);
  inserer({ id: "parent", libelle: "Parent", description: "", permissions: ["chat"] });
  const roles = await listerRoles(env);
  assert.deepEqual(roles.find((r) => r.id === "parent").permissions, ["chat"]);
  assert.equal(roles.find((r) => r.id === "parent").modifie, true);
  assert.deepEqual(roles.at(-1), { id: "moderateur", systeme: false, libelle: "Modérateur", description: "Relit les signalements", permissions: ["admin.securite", "chat"], modifie: true });
});

test("lien du back-office : seulement pour un rôle qui a une permission d'administration", async () => {
  assert.equal(await roleAccedeAuBackOffice(env, "admin"), true);
  for (const role of ["visiteur", "parent", "contributeur", "prof", "beta-testeur", "inconnu", undefined, null, 42]) {
    assert.equal(await roleAccedeAuBackOffice(env, role), false, String(role));
  }
  // Les rôles suivent le back-office : une permission d'administration ajoutée ou retirée change la réponse.
  const inserer = (id, permissions) => env.DB.sqlite.prepare("INSERT INTO roles (id, libelle, description, permissions) VALUES (?, ?, '', ?)").run(id, id, JSON.stringify(permissions));
  inserer("moderateur", ["chat", "admin.securite"]);
  inserer("admin", ["chat"]);
  assert.equal(await roleAccedeAuBackOffice(env, "moderateur"), true);
  assert.equal(await roleAccedeAuBackOffice(env, "admin"), false, "rôle admin privé de ses permissions d'administration");
  // Table `roles` absente (migration 0002 non appliquée) : les rôles système s'appliquent, sans erreur.
  const sansTable = { DB: { prepare() { throw new Error("no such table: roles"); } } };
  assert.equal(await roleAccedeAuBackOffice(sansTable, "admin"), true);
  assert.equal(await roleAccedeAuBackOffice(sansTable, "prof"), false);
  assert.equal(await roleAccedeAuBackOffice(sansTable, "moderateur"), false);
});

test("/auth/me : le compte porte `backOffice`, calculé par le serveur à partir du rôle", async () => {
  const sql = env.DB.sqlite;
  const ouvrir = (id, role) => {
    sql.prepare("INSERT INTO comptes (id, email_hash, role) VALUES (?, ?, ?)").run(id, `hash-${id}`, role);
    sql.prepare("INSERT INTO sessions (id, compte_id, expires_at) VALUES (?, ?, datetime('now', '+1 day'))").run(`s-${id}`, id);
  };
  ouvrir("a1", "admin");
  ouvrir("p1", "parent");
  const moi = async (session) => (await gererAuth(new Request("https://api.test/auth/me", { headers: session ? { cookie: `session=${session}` } : {} }), env));
  const admin = await (await moi("s-a1")).json();
  assert.equal(admin.connecte, true);
  assert.deepEqual({ id: admin.compte.id, role: admin.compte.role, backOffice: admin.compte.backOffice }, { id: "a1", role: "admin", backOffice: true });
  assert.equal((await (await moi("s-p1")).json()).compte.backOffice, false);
  assert.equal(admin.compte.relectureHumaine, true, "l'admin peut confirmer une relecture humaine");
  assert.equal((await (await moi("s-p1")).json()).compte.relectureHumaine, false);
  const anonyme = await moi();
  assert.equal(anonyme.status, 401);
  assert.deepEqual(await anonyme.json(), { connecte: false });
});

test("stratégies : « tous » par défaut pour chaque fonctionnalité", async () => {
  const strategies = await listerStrategies(env);
  assert.deepEqual(strategies.map((s) => s.fonctionnalite), FONCTIONNALITES);
  assert.ok(strategies.every((s) => s.mode === "tous"));
  assert.equal(validerStrategie("inconnue", { mode: "tous" }).code, "fonctionnalite-inconnue");
  assert.equal(validerStrategie("chat", { mode: "parfois" }).code, "mode-invalide");
  assert.deepEqual(validerStrategie("ia.cahiers", { mode: "roles", roles: ["prof", "fantome"], niveaux: ["premium"] }, { roles: ["prof"], niveaux: ["gratuit", "premium"] }).strategie,
    { fonctionnalite: "ia.cahiers", mode: "roles", roles: ["prof"], niveaux: ["premium"] });
});

test("bêta : contrôle d'accès inactif, toute fonctionnalité est ouverte à tous les utilisateurs", async () => {
  const contexte = { strategies: [{ fonctionnalite: "ia.cahiers", mode: "personne", roles: [], niveaux: [] }], roles: await listerRoles(env) };
  for (const fonctionnalite of FONCTIONNALITES) {
    assert.deepEqual(accesAutorise({}, { fonctionnalite, role: "visiteur" }, contexte), { autorise: true, raison: "controle-inactif" });
  }
  assert.equal(accesAutorise({}, { fonctionnalite: "chat", role: "role-inexistant" }, contexte).autorise, true);
});

test("contrôle activé (préparé) : permission du rôle, puis stratégie par rôle ou par niveau", async () => {
  const actif = { CONTROLE_ACCES_ACTIF: "true" };
  const roles = await listerRoles(env);
  const strategies = [
    { fonctionnalite: "ia.cahiers", mode: "roles", roles: ["prof"], niveaux: ["premium"] },
    { fonctionnalite: "jeux", mode: "personne", roles: [], niveaux: [] }
  ];
  const decide = (sujet) => accesAutorise(actif, sujet, { strategies, roles });
  assert.deepEqual(decide({ fonctionnalite: "chat", role: "visiteur" }), { autorise: true, raison: "ouverte-a-tous" });
  assert.deepEqual(decide({ fonctionnalite: "famille", role: "visiteur" }), { autorise: false, raison: "permission-absente" });
  assert.deepEqual(decide({ fonctionnalite: "ia.cahiers", role: "parent" }), { autorise: false, raison: "strategie" });
  assert.deepEqual(decide({ fonctionnalite: "ia.cahiers", role: "prof" }), { autorise: true, raison: "role-autorise" });
  assert.deepEqual(decide({ fonctionnalite: "ia.cahiers", role: "parent", niveau: "premium" }), { autorise: true, raison: "niveau-autorise" });
  assert.deepEqual(decide({ fonctionnalite: "jeux", role: "admin" }), { autorise: false, raison: "fonctionnalite-fermee" });
  assert.deepEqual(decide({ fonctionnalite: "chat", role: "fantome" }), { autorise: false, raison: "role-inconnu" });
});

test("contrôle activé (préparé) : la souscription du compte restreint les permissions du rôle", async () => {
  const actif = { CONTROLE_ACCES_ACTIF: "true" };
  const roles = await listerRoles(env);
  const souscriptions = [{ id: "gratuit", fonctionnalites: ["chat", "jeux"] }, { id: "parent", fonctionnalites: ["chat", "jeux", "famille", "ia.cahiers"] }];
  const decide = (sujet) => accesAutorise(actif, sujet, { strategies: [], roles, souscriptions });
  assert.deepEqual(decide({ fonctionnalite: "ia.cahiers", role: "parent", niveau: "gratuit" }), { autorise: false, raison: "hors-souscription" });
  assert.deepEqual(decide({ fonctionnalite: "ia.cahiers", role: "parent", niveau: "parent" }), { autorise: true, raison: "ouverte-a-tous" });
  assert.deepEqual(decide({ fonctionnalite: "famille", role: "visiteur", niveau: "parent" }), { autorise: false, raison: "permission-absente" }, "l'offre n'ajoute rien au rôle");
  assert.deepEqual(decide({ fonctionnalite: "ia.cahiers", role: "parent", niveau: "inconnu" }), { autorise: true, raison: "ouverte-a-tous" }, "sans souscription connue, seul le rôle compte");
  assert.deepEqual(accesAutorise({}, { fonctionnalite: "ia.cahiers", role: "parent", niveau: "gratuit" }, { roles, souscriptions }), { autorise: true, raison: "controle-inactif" });
});

// ---------- Réglages à chaud ----------

test("paramètres : validation stricte, bornes du registre et plafonds du schéma", () => {
  assert.deepEqual(validerParametre("INCONNU", "1"), { ok: false, code: "parametre-inconnu" });
  assert.deepEqual(validerParametre("LLM_ACTIF", "peut-etre"), { ok: false, code: "booleen-attendu" });
  assert.deepEqual(validerParametre("LLM_ACTIF", false), { ok: true, valeur: "false" });
  assert.deepEqual(validerParametre("LIMITE_PAR_MINUTE", "121"), { ok: false, code: "hors-bornes" });
  assert.deepEqual(validerParametre("LIMITE_PAR_MINUTE", 30), { ok: true, valeur: "30" });
  assert.equal(PLAFONDS_SCHEMA.LIMITE_TOKENS_SESSION, 1000);
  assert.deepEqual(validerParametre("LIMITE_TOKENS_SESSION", 1001), { ok: false, code: "hors-bornes" }, "au-delà, la contrainte CHECK de sessions_llm ferait échouer la réservation");
  assert.deepEqual(validerParametre("MODELE_CHAT", "claude haiku"), { ok: false, code: "alias-invalide" });
  assert.deepEqual(validerParametre("MODELE_CHAT", " claude-haiku-5-5 "), { ok: true, valeur: "claude-haiku-5-5" });
  assert.deepEqual(validerParametre("SKILLS_ACTIFS", ["tuteur", "fantome"]), { ok: false, code: "valeur-inconnue" });
  assert.deepEqual(validerParametre("SKILLS_ACTIFS", "tuteur, defi-express"), { ok: true, valeur: "tuteur,defi-express" });
  assert.deepEqual(validerParametre("INSTRUCTIONS_TUTEUR", "x".repeat(2001)), { ok: false, code: "trop-long" });
  assert.deepEqual(validerParametre("INSTRUCTIONS_TUTEUR", "  "), { ok: true, valeur: null });
  assert.deepEqual(validerParametre("LIMITE_PAR_MINUTE", ""), { ok: true, valeur: null }, "vide : retour à la valeur du déploiement");
});

test("réglages : la surcharge passe par lireConfiguration, les liaisons et secrets sont hérités", async () => {
  const deploiement = { DB: env.DB, LIMITE_PAR_MINUTE: "20", LLM_SESSION_SECRET: "secret", AI: { run: () => "ok" } };
  assert.equal(lireConfiguration(envAvecReglages(deploiement, await chargerReglages(deploiement))).LIMITE_PAR_MINUTE, 20);
  await ecrireParametre(deploiement, "LIMITE_PAR_MINUTE", "45");
  await ecrireParametre(deploiement, "INSTRUCTIONS_TUTEUR", "Tutoie toujours.");
  const derive = envAvecReglages(deploiement, await chargerReglages(deploiement));
  assert.equal(lireConfiguration(derive).LIMITE_PAR_MINUTE, 45);
  assert.equal(lireConfiguration(derive).INSTRUCTIONS_TUTEUR, "Tutoie toujours.");
  assert.equal(derive.LLM_SESSION_SECRET, "secret");
  assert.equal(derive.AI.run(), "ok");
  assert.equal(derive.DB, env.DB);
  assert.equal(deploiement.LIMITE_PAR_MINUTE, "20", "l'env du déploiement n'est jamais modifié");
  assert.equal(lireConfiguration(envAvecReglages(deploiement, reglagesDe(derive), { LLM_ACTIF: "false" })).LLM_ACTIF, false);
  await ecrireParametre(deploiement, "LIMITE_PAR_MINUTE", null);
  assert.equal(lireConfiguration(envAvecReglages(deploiement, await chargerReglages(deploiement))).LIMITE_PAR_MINUTE, 20);
});

test("réglages : une valeur stockée devenue invalide est ignorée ; sans table, rien n'est surchargé", async () => {
  env.DB.sqlite.exec(`INSERT INTO reglages (cle, valeur) VALUES ('param:LIMITE_PAR_MINUTE', '9999'), ('param:INCONNU', 'x'), ('theme', '{"id":"fluo"}'), ('niveaux', 'pas du json')`);
  const reglages = await chargerReglages(env);
  assert.deepEqual(reglages.parametres, {});
  assert.deepEqual(reglages.theme, { id: "indigo" });
  assert.deepEqual(reglages.niveaux.map((n) => n.id), ["solo", "parent", "professeur"], "liste illisible : offres pressenties");
  assert.equal(reglages.souscriptionsParDefaut, true);
  invaliderReglages();
  const sansTable = await chargerReglages({ DB: { prepare: () => { throw new Error("no such table"); } } });
  assert.deepEqual(sansTable.parametres, {});
  assert.deepEqual((await chargerReglages({})).parametres, {});
});

test("niveaux de souscription : bornes du registre, identifiants uniques, « gratuit » réservé", () => {
  const premium = { id: "premium", libelle: "Premium", tokensSession: 4000, tokensAppel: 1000, defisJour: 10, cahiersJour: 5 };
  assert.deepEqual(validerNiveaux([premium]), { ok: true, niveaux: [premium] });
  assert.equal(validerNiveaux([{ ...premium, id: "gratuit" }]).code, "identifiant-invalide");
  assert.equal(validerNiveaux([premium, premium]).code, "identifiant-invalide");
  assert.equal(validerNiveaux([{ ...premium, tokensSession: 4001 }]).code, "hors-bornes:tokensSession");
  assert.equal(validerNiveaux([{ ...premium, cahiersJour: "beaucoup" }]).code, "hors-bornes:cahiersJour");
  assert.equal(validerNiveaux([{ ...premium, libelle: "" }]).code, "libelle-requis");
  assert.equal(validerNiveaux("premium").code, "liste-invalide");
});

test("anciens niveaux repris en souscriptions ; les souscriptions enregistrées priment", async () => {
  const niveau = { id: "famille", libelle: "Famille", tokensSession: 1000, tokensAppel: 500, defisJour: 6, cahiersJour: 3 };
  env.DB.sqlite.prepare("INSERT INTO reglages (cle, valeur) VALUES ('niveaux', ?)").run(JSON.stringify([niveau]));
  let reglages = await chargerReglages(env);
  assert.deepEqual(reglages.niveaux, [{ id: "famille", libelle: "Famille" }]);
  assert.deepEqual(reglages.souscriptions[1].limites, { ...niveau.limites, tokensSession: 1000, tokensAppel: 500, defisJour: 6, cahiersJour: 3, cahiersMois: 0, enfantsMax: 0, classesMax: 0, elevesMax: 0 });
  assert.equal(reglages.souscriptionsParDefaut, false);
  await ecrireSouscriptions(env, reglages.souscriptions.slice(0, 1));
  reglages = await chargerReglages(env);
  assert.deepEqual(reglages.souscriptions.map((s) => s.id), ["gratuit"]);
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM reglages WHERE cle = 'niveaux'").get().n, 0, "la clé historique est retirée");
});

test("thème et contenus masqués : écrits puis relus", async () => {
  await ecrireTheme(env, { id: "lagon" });
  await ecrireEtatContenu(env, "pythagore", { enLigne: false, enAvant: false });
  await ecrireEtatContenu(env, "fractions", { enLigne: true, enAvant: true });
  const reglages = await chargerReglages(env);
  assert.deepEqual(reglages.theme, { id: "lagon" });
  const index = { maquettes: [{ id: "pythagore" }, { id: "fractions" }, { id: "angles" }] };
  assert.deepEqual(indexVisible(index, reglages).maquettes.map((m) => m.id), ["fractions", "angles"]);
  assert.equal(indexVisible(index, reglages), indexVisible(index, reglages), "même objet filtré tant que les réglages ne changent pas");
  assert.deepEqual([...reglages.enAvant], ["fractions"]);
  await ecrireTheme(env, { id: "indigo" });
  await ecrireEtatContenu(env, "pythagore", { enLigne: true, enAvant: false });
  const apres = await chargerReglages(env);
  assert.equal(indexVisible(index, apres), index, "rien de masqué : l'index du build lui-même");
  assert.equal(env.DB.sqlite.prepare("SELECT count(*) AS n FROM reglages WHERE cle = 'theme'").get().n, 0, "la charte d'origine ne stocke rien");
});

// ---------- Charte graphique ----------

test("thèmes : trois thèmes proposés, contraste AA garanti en clair et en sombre", () => {
  assert.deepEqual(Object.keys(THEMES), ["indigo", "lagon", "bougainvillier"]);
  const couleurs = [...Object.values(THEMES), { accent: "#ffee00", secondaire: "#00ff88" }, { accent: "#000000", secondaire: "#ffffff" }, { accent: "#808080", secondaire: "#7f7f7f" }];
  for (const { accent, secondaire } of couleurs) {
    const { clair, sombre } = deriverVariables({ accent, secondaire });
    const verifier = (a, b, quoi) => assert.ok(contraste(a, b) >= CONTRASTE_MIN, `${accent} ${quoi} : ${contraste(a, b).toFixed(2)}`);
    verifier(clair.accent, "#ffffff", "bouton clair");
    verifier(clair["accent-doux-texte"], clair["accent-doux"], "texte doux clair");
    verifier(clair.lab, "#ffffff", "lab clair");
    verifier(sombre.accent, "#161a30", "accent sombre");
    verifier(sombre["accent-texte"], sombre.accent, "bouton sombre");
    verifier(sombre["accent-doux-texte"], sombre["accent-doux"], "texte doux sombre");
    verifier(sombre["bulle-moi-texte"], sombre["bulle-moi"], "bulle sombre");
    verifier(sombre.lab, "#161a30", "lab sombre");
    for (const valeur of [...Object.values(clair), ...Object.values(sombre)]) assert.match(valeur, /^#[0-9a-f]{6}$/);
  }
});

test("thème : validation et feuille de style (vide pour la charte d'origine)", () => {
  assert.deepEqual(validerTheme({ id: "lagon", accent: "ignoré" }), { ok: true, theme: { id: "lagon" } });
  assert.deepEqual(validerTheme({ id: "fluo" }), { ok: false, code: "theme-inconnu" });
  assert.deepEqual(validerTheme({ id: "personnalise", accent: "#12AB9F", secondaire: "#445566" }), { ok: true, theme: { id: "personnalise", accent: "#12ab9f", secondaire: "#445566" } });
  for (const accent of ["rouge", "#fff", "#12ab9g", "url(x)", "#123456; color: red"]) {
    assert.deepEqual(validerTheme({ id: "personnalise", accent, secondaire: "#445566" }), { ok: false, code: "couleur-invalide" }, accent);
  }
  assert.equal(cssTheme({ id: "indigo" }), "");
  assert.equal(cssTheme(null), "");
  assert.equal(cssTheme({ id: "fluo" }), "");
  const css = cssTheme({ id: "lagon" });
  assert.match(css, /^:root \{ --accent: #[0-9a-f]{6};/);
  assert.match(css, /prefers-color-scheme: dark/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.doesNotMatch(css, /[<>]|url\(|@import|expression/, "aucune construction active dans la feuille générée");
});
