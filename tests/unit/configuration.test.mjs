import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODULES, PARAMETRES, SKILLS, configurationPublique, harnessSkill, lireConfiguration, parametre, skillActif
} from "../../worker/src/configuration.js";

test("défauts : sans variable, la configuration reprend les valeurs historiques", () => {
  const c = lireConfiguration({});
  assert.equal(c.LLM_ACTIF, false);
  assert.equal(c.LIMITE_TOKENS_SESSION, 1000);
  assert.equal(c.MAX_TOKENS_APPEL, 500);
  assert.equal(c.MAX_TOKENS_DEFI, 1500);
  assert.equal(c.DEFI_GENERATIONS_JOUR, 3);
  assert.equal(c.MODELE_DEFI, "custom/haiku");
  assert.equal(c.MODELE_CHAT, "claude-haiku-5-5");
  assert.equal(c.MODELE_CAHIERS, "custom/sonnet-5-5");
  assert.equal(c.MAX_TOKENS_CAHIERS, 100000);
  assert.deepEqual(c.SKILLS_ACTIFS, Object.keys(SKILLS));
  assert.ok(Object.isFrozen(c));
});

test("entiers bornés min–max, valeurs invalides ramenées au défaut", () => {
  assert.equal(parametre({ LIMITE_TOKENS_SESSION: "99999" }, "LIMITE_TOKENS_SESSION"), 4000);
  assert.equal(parametre({ LIMITE_TOKENS_SESSION: "10" }, "LIMITE_TOKENS_SESSION"), 200);
  assert.equal(parametre({ DEFI_GENERATIONS_JOUR: "-2" }, "DEFI_GENERATIONS_JOUR"), 0);
  assert.equal(parametre({ DEFI_GENERATIONS_JOUR: "2.5" }, "DEFI_GENERATIONS_JOUR"), 3);
  assert.equal(parametre({ TAILLE_MAX_MESSAGE: "abc" }, "TAILLE_MAX_MESSAGE"), 500);
  assert.equal(parametre({ MAX_TOKENS_CAHIERS: "200000" }, "MAX_TOKENS_CAHIERS"), 128000);
  assert.equal(parametre({ MAX_TOKENS_CAHIERS: "10" }, "MAX_TOKENS_CAHIERS"), 1000);
  assert.throws(() => parametre({}, "INCONNU"));
});

test("le budget par appel ne dépasse jamais le budget de session", () => {
  const c = lireConfiguration({ LIMITE_TOKENS_SESSION: "300", MAX_TOKENS_APPEL: "800" });
  assert.equal(c.MAX_TOKENS_APPEL, 300);
  const tuteur = configurationPublique({ LIMITE_TOKENS_SESSION: "300" }).modules.find((m) => m.id === "tuteur");
  assert.equal(tuteur.parametres.find((p) => p.cle === "MAX_TOKENS_APPEL").max, 300);
});

test("alias de modèle : identifiant accepté, texte suspect rejeté", () => {
  assert.equal(parametre({ MODELE_DEFI: "custom/sonnet" }, "MODELE_DEFI"), "custom/sonnet");
  assert.equal(parametre({ MODELE_WORKERS_AI: "@cf/meta/llama-3.1-8b-instruct" }, "MODELE_WORKERS_AI"), "@cf/meta/llama-3.1-8b-instruct");
  assert.equal(parametre({ MODELE_DEFI: "custom/haiku; rm -rf" }, "MODELE_DEFI"), "custom/haiku");
  assert.equal(parametre({ MODELE_CHAT: "x".repeat(200) }, "MODELE_CHAT"), "claude-haiku-5-5");
});

test("skills : liste filtrée, identifiants inconnus ignorés", () => {
  assert.deepEqual(parametre({ SKILLS_ACTIFS: " tuteur , inconnu,tuteur" }, "SKILLS_ACTIFS"), ["tuteur"]);
  assert.equal(skillActif({ SKILLS_ACTIFS: "tuteur" }, "defi-express"), false);
  assert.equal(skillActif({}, "defi-express"), true);
  assert.equal(skillActif({}, "inconnu"), false);
  assert.deepEqual(harnessSkill("defi-express"), {
    nom: "KermicLab", version: "1.0.0", prompt: "defi-express-v1", perimetre: "catalogue-kermiclab", acces: "gratuit-provisoire"
  });
});

test("vue publique : chaque paramètre appartient à un module affiché, skills inactifs si LLM coupé", () => {
  assert.ok(PARAMETRES.every((p) => MODULES.includes(p.module)));
  assert.ok(Object.values(SKILLS).every((s) => MODULES.includes(s.module)));
  const vue = configurationPublique({ LLM_ACTIF: "false" });
  assert.equal(vue.modules.flatMap((m) => m.parametres).length, PARAMETRES.length);
  assert.ok(vue.modules.flatMap((m) => m.skills).every((s) => s.actif === false));
  assert.ok(configurationPublique({ LLM_ACTIF: "true" }).modules.flatMap((m) => m.skills).every((s) => s.actif));
});
