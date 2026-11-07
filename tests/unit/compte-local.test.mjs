import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validerIdentifiant, validerMotDePasse, validerPassphrase, creerEnregistrement, verifierMotDePasse, lireEnregistrement,
  deriverSecrets, chiffrer, dechiffrer, instantane, restaurer, lireSession, FORMAT_PSEUDONYME, FORMAT_JETON, FORMAT_IV,
  ITERATIONS_NAVIGATEUR
} from "../../web/compte-local.js";

// Compte local (ADR 0024) : règles partagées entre l'interface et le Worker, et pseudonymisation dans le navigateur.
// Les dérivations coûteuses utilisent peu d'itérations dans les tests ; le protocole réel en garde ITERATIONS_NAVIGATEUR.
const RAPIDE = { iterations: 100000 };

test("identifiant : sans email, sans numéro, minuscules normalisées", () => {
  assert.deepEqual(validerIdentifiant("  Lea.Martin "), { ok: true, identifiant: "lea.martin" });
  assert.deepEqual(validerIdentifiant("ab"), { ok: false, erreur: "court" });
  assert.deepEqual(validerIdentifiant("a".repeat(33)), { ok: false, erreur: "long" });
  assert.deepEqual(validerIdentifiant("lea@exemple.fr"), { ok: false, erreur: "caracteres" }, "pas d'email pour se connecter");
  assert.deepEqual(validerIdentifiant("léa"), { ok: false, erreur: "caracteres" });
  assert.deepEqual(validerIdentifiant("123456"), { ok: false, erreur: "caracteres" }, "au moins une lettre");
  assert.deepEqual(validerIdentifiant("lea0612345678"), { ok: false, erreur: "chiffres" });
  assert.deepEqual(validerIdentifiant(".lea"), { ok: false, erreur: "caracteres" });
});

test("mot de passe : 12 caractères minimum, quatre familles, sans l'identifiant", () => {
  assert.deepEqual(validerMotDePasse("Court1!"), { ok: false, erreur: "court" });
  assert.deepEqual(validerMotDePasse("x".repeat(129)), { ok: false, erreur: "long" });
  assert.deepEqual(validerMotDePasse("toutenminuscule"), { ok: false, erreur: "complexite", manquants: ["majuscule", "chiffre", "special"] });
  assert.deepEqual(validerMotDePasse("Sans-Chiffre-Ici"), { ok: false, erreur: "complexite", manquants: ["chiffre"] });
  assert.deepEqual(validerMotDePasse("Kermic-lea.martin-1", { identifiant: "lea.martin" }), { ok: false, erreur: "identifiant" });
  assert.deepEqual(validerMotDePasse("Été-Soleil-2026"), { ok: true }, "lettres accentuées acceptées");
  assert.deepEqual(validerMotDePasse("Correct-Cheval-9"), { ok: true });
});

test("phrase secrète : 12 caractères minimum, différente du mot de passe", () => {
  assert.deepEqual(validerPassphrase("trop courte"), { ok: false, erreur: "court" });
  assert.deepEqual(validerPassphrase("x".repeat(257)), { ok: false, erreur: "long" });
  assert.deepEqual(validerPassphrase("Correct-Cheval-9", { motDePasse: "Correct-Cheval-9" }), { ok: false, erreur: "identique" });
  assert.deepEqual(validerPassphrase("le chat dort sur le toit", { motDePasse: "Correct-Cheval-9" }), { ok: true });
});

test("enregistrement local : vérificateur salé, jamais le mot de passe en clair", async () => {
  const e = await creerEnregistrement("lea.martin", "Correct-Cheval-9", RAPIDE);
  assert.equal(JSON.stringify(e).includes("Cheval"), false);
  assert.equal(await verifierMotDePasse("Correct-Cheval-9", e), true);
  assert.equal(await verifierMotDePasse("Correct-Cheval-8", e), false);
  const autre = await creerEnregistrement("lea.martin", "Correct-Cheval-9", RAPIDE);
  assert.notEqual(autre.verificateur, e.verificateur, "sel aléatoire");
  assert.equal(ITERATIONS_NAVIGATEUR >= 310000, true);

  const relu = lireEnregistrement(JSON.stringify({ ...e, synchro: { empreinte: "abcd", version: 3, maj: "2026-11-07" } }));
  assert.deepEqual(relu.synchro, { empreinte: "abcd", version: 3, maj: "2026-11-07" });
  assert.equal(lireEnregistrement("{pas du json"), null);
  assert.equal(lireEnregistrement(JSON.stringify({ ...e, identifiant: "a@b" })), null);
  assert.equal(lireEnregistrement(JSON.stringify({ ...e, iterations: 10 })), null, "itérations trop faibles refusées");
});

test("pseudonymisation : secrets déterministes, propres à la phrase et à l'identifiant", async () => {
  const a = await deriverSecrets("le chat dort sur le toit", "lea.martin", RAPIDE);
  assert.match(a.pseudonyme, FORMAT_PSEUDONYME);
  assert.match(a.jeton, FORMAT_JETON);
  assert.deepEqual(await deriverSecrets("le chat dort sur le toit", "lea.martin", RAPIDE), a, "même phrase, mêmes secrets (autre appareil)");
  const autrePhrase = await deriverSecrets("le chat dort sur le toît", "lea.martin", RAPIDE);
  const autreCompte = await deriverSecrets("le chat dort sur le toit", "tom", RAPIDE);
  for (const b of [autrePhrase, autreCompte]) {
    assert.notEqual(b.pseudonyme, a.pseudonyme);
    assert.notEqual(b.jeton, a.jeton);
    assert.notEqual(b.cle, a.cle);
  }
  assert.equal(a.pseudonyme.includes("lea"), false);
});

test("chiffrement : AES-GCM lié au pseudonyme, illisible sans la bonne clé", async () => {
  const s = await deriverSecrets("le chat dort sur le toit", "lea.martin", RAPIDE);
  const donnees = { v: 1, donnees: { "kermiclab:pseudo": "Léa" } };
  const boite = await chiffrer(s.cle, s.pseudonyme, donnees);
  assert.match(boite.iv, FORMAT_IV);
  assert.equal(boite.chiffre.includes("Léa"), false);
  assert.deepEqual(await dechiffrer(s.cle, s.pseudonyme, boite), donnees);
  const autre = await deriverSecrets("une autre phrase secrète", "lea.martin", RAPIDE);
  await assert.rejects(dechiffrer(autre.cle, s.pseudonyme, boite), "mauvaise clé");
  await assert.rejects(dechiffrer(s.cle, autre.pseudonyme, boite), "données associées différentes");
});

test("instantané : seules les clés synchronisées sont copiées et restaurées", () => {
  const cles = ["kermiclab:pseudo", "kermiclab:progression"];
  const zone = new Map([["kermiclab:pseudo", "Léa"], ["kermiclab:theme", "dark"]]);
  const inst = instantane((c) => zone.get(c) ?? null, cles);
  assert.deepEqual(inst, { v: 1, donnees: { "kermiclab:pseudo": "Léa" } });

  const cible = new Map([["kermiclab:progression", "ancienne"]]);
  const ok = restaurer({ v: 1, donnees: { "kermiclab:pseudo": "Léa", "kermiclab:theme": "intrus" } }, cles,
    (c, v) => cible.set(c, v), (c) => cible.delete(c));
  assert.equal(ok, true);
  assert.deepEqual([...cible], [["kermiclab:pseudo", "Léa"]], "clé inconnue ignorée, clé absente effacée");
  assert.equal(restaurer({ v: 2 }, cles, () => {}, () => {}), false);
});

test("session : liée à l'identifiant, secrets de synchronisation vérifiés", async () => {
  const s = await deriverSecrets("le chat dort sur le toit", "lea.martin", RAPIDE);
  const synchro = { pseudonyme: s.pseudonyme, jeton: s.jeton, cle: s.cle, jetonServeur: "x".repeat(43) };
  assert.deepEqual(lireSession(JSON.stringify({ identifiant: "lea.martin", synchro }), "lea.martin"), { identifiant: "lea.martin", synchro });
  assert.equal(lireSession(JSON.stringify({ identifiant: "tom" }), "lea.martin"), null);
  assert.deepEqual(lireSession(JSON.stringify({ identifiant: "lea.martin", synchro: { pseudonyme: "x" } }), "lea.martin"), { identifiant: "lea.martin", synchro: null });
  assert.equal(lireSession("{", "lea.martin"), null);
});
