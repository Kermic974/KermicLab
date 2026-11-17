import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifierReferentiel } from "../../scripts/check-referentiel.mjs";
import { verifierIntegrite } from "../../scripts/lib/referentiel-integrite.mjs";
import { lireHistorique } from "../../scripts/lib/referentiel-historique.mjs";

const notion = (nom, extra = {}) => ({ id: "notion.maths." + nom, type: "notion", label: nom, status: "draft", version: 1, ...extra });
const lien = (nom, type, s, t, extra = {}) => ({ id: "relation.maths." + nom, type, source: s.id, target: t.id, status: "draft", version: 1, ...extra });
const etat = (...objets) => new Map(objets.map(o => [o.id, o]));
const a = notion("a");
const b = notion("b");
const av = { ...a, status: "validated" };
const bv = { ...b, status: "validated" };
const bd = { ...bv, status: "deprecated", version: 2 };
const req = lien("prerequis", "requires", av, bv, { status: "validated", rationale: "Exemple" });
const curriculum = nom => ({ id: "curriculum.maths." + nom, type: "curriculum", jurisdiction: "FR", authority: "Exemple", title: nom, curriculumVersion: "2025", status: "draft", version: 1 });
const p = curriculum("fr");
const q = curriculum("autre");
const stage = code => ({ id: "stage.maths." + code, type: "stage", curriculum: p.id, stageType: "cycle", code, label: code, status: "draft", version: 1 });
const e3 = stage("cycle-3");
const e4 = stage("cycle-4");
const mapping = (nom, o, programme, e, version = 1) => ({ id: "curriculum-mapping.maths." + nom, type: "curriculum-mapping", object: o.id,
  curriculum: programme.id, stage: e.id, status: "draft", role: "introduced", version, provenance: { type: "editorial", ref: "source" } });

async function espace(t, objets) {
  const cwd = await mkdtemp(join(tmpdir(), "s4-referentiel-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const dossier = join(cwd, "referentiel", "objets");
  await mkdir(dossier, { recursive: true });
  await Promise.all(objets.map((o, i) => writeFile(join(dossier, i + ".json"), typeof o === "string" ? o : JSON.stringify(o))));
  return { cwd, dossier };
}

async function rapport(t, objets, historique = []) {
  const { cwd } = await espace(t, objets);
  return verifierReferentiel(cwd, async () => {
    if (!historique) throw new Error("Historique indisponible");
    return historique;
  });
}

const signalements = r => new Set(r.issues.map(i => i.rule));
const erreurs = [
  ["lecture et structure", ["{", { ...a, version: 0 }], ["S4-JSON", "S4-VERSION"]],
  ["contrat inconnu", [{}], ["S4-SCHEMA-TYPE"]],
  ["référence absente", [a, lien("ab", "requires", a, b)], ["S4-REFERENCE-ABSENTE"]],
  ["matrice", [a, b, lien("ab", "teaches", a, b)], ["S4-RELATION-MATRICE"]],
  ["symétrie", [a, b, lien("ab", "relatedTo", a, b), lien("ba", "relatedTo", b, a)], ["S4-RELATION-CANONIQUE", "S4-RELATION-DOUBLON"]],
  ["réflexivité", [a, lien("aa", "requires", a, a)], ["S4-RELATION-REFLEXIVE"]],
  ["cycle de prérequis", [a, b, lien("ab", "requires", a, b), lien("ba", "requires", b, a)], ["S4-CYCLE-REQUIRES"]],
  ["cycle d’extension", [a, b, lien("ab", "extends", a, b), lien("ba", "extends", b, a)], ["S4-CYCLE-EXTENDS"]],
  ["id en double", [a, a], ["S4-ID-DOUBLON"]],
  ["donnée apprenant", [{ ...a, apprenant: "synthétique" }], ["S4-SCHEMA-CHAMP"]],
  ["stage incohérent", [a, p, q, e3, mapping("a", a, q, e3)], ["S4-MAPPING-CURRICULUM"]],
  ["doublon à version égale", [a, p, e3, mapping("a", a, p, e3), mapping("b", a, p, e3)], ["S4-MAPPING-DOUBLON"]],
  ["doublon à version différente", [a, p, e3, mapping("a", a, p, e3), mapping("b", a, p, e3, 2)], ["S4-MAPPING-DOUBLON"]],
  ["remplacement cyclique", [{ ...a, status: "deprecated", replacedBy: b.id }, { ...b, status: "deprecated", replacedBy: a.id }],
    ["S4-REMPLACEMENT-CIBLE", "S4-REMPLACEMENT-CYCLE"]],
  ["nouvelle référence à une cible dépréciée", [av, bd, req], ["S4-REFERENCE-STATUT"], [etat(av, bv)]],
  ["référence supprimée puis recréée", [av, bd, req], ["S4-REFERENCE-STATUT", "S4-ID-REUTILISE"], [etat(av, bv, req), etat(av, bd)]],
  ["transition interdite", [{ ...av, version: 2 }], ["S4-TRANSITION"], [etat(a)]],
  ["réutilisation ID", [a], ["S4-ID-REUTILISE"], [etat(a), etat()]],
  ["révision insuffisante", [{ ...a, label: "Corrigé" }], ["S4-REVISION"], [etat(a)]],
  ["historique indisponible", [a], ["S4-HISTORIQUE-INDISPONIBLE"], null]
];

for (const [nom, objets, attentes, historique] of erreurs) {
  test(nom, async t => {
    const r = await rapport(t, objets, historique);
    assert.equal(r.verdict, "FAIL");
    assert.deepEqual(signalements(r), new Set(attentes));
    assert.equal(r.warnings, 0);
  });
}

test("révision au même statut et deux placements distincts", async t => {
  const r = await rapport(t, [{ ...a, label: "Corrigé", version: 2 }, p, e3, e4, mapping("a", a, p, e3), mapping("b", a, p, e4)], [etat(a)]);
  assert.deepEqual([r.verdict, r.errors, r.warnings], ["PASS", 0, 0]);
});

test("avertissements de graphe et de niveau", async t => {
  const r = await rapport(t, [a, b, p, e3, e4, mapping("a", a, p, e3), mapping("b", b, p, e4),
    lien("ab", "supports", a, b), lien("ba", "supports", b, a), lien("prerequis", "requires", a, b)]);
  assert.deepEqual([r.verdict, r.errors, r.warnings], ["PASS", 0, 3]);
  assert.deepEqual(signalements(r), new Set(["S4-CYCLE-SUPPORTS", "S4-PREREQUIS-NIVEAU"]));
});

test("conditions de validation du Knowledge Core", async t => {
  const m = { ...av, id: "microskill.maths.m", type: "microskill" };
  const s = { ...av, id: "skill.maths.s", type: "skill" };
  assert.deepEqual(signalements(await rapport(t, [av, m, s])), new Set(["S4-MICROSKILL-TEACHES", "S4-SKILL-CONTRIBUTES"]));
  const complet = await rapport(t, [av, m, s, lien("teaches", "teaches", av, m, { status: "validated" }),
    lien("contributes", "contributesTo", m, s, { status: "validated" })]);
  assert.equal(complet.verdict, "PASS");
});

test("historique Git réel et WARNING pour référence antérieure", async t => {
  const { cwd, dossier } = await espace(t, [av, bv, req]);
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-q");
  git("config", "user.name", "Tests S4");
  git("config", "user.email", "tests@example.invalid");
  git("add", ".");
  git("-c", "commit.gpgsign=false", "commit", "-qm", "Référence initiale");
  await writeFile(join(dossier, "1.json"), JSON.stringify(bd));
  git("add", ".");
  git("-c", "commit.gpgsign=false", "commit", "-qm", "Dépréciation");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  assert.equal((await lireHistorique(cwd)).length, 2);
  const r = await verifierReferentiel(cwd);
  assert.deepEqual([r.verdict, r.errors, r.warnings], ["PASS", 0, 1]);
  assert.deepEqual(signalements(r), new Set(["S4-REFERENCE-HISTORIQUE"]));
});

test("commande JSON stable, codes de sortie PASS et FAIL", async t => {
  const valide = await espace(t, []);
  const invalide = await espace(t, ["{", "{"]);
  const script = fileURLToPath(new URL("../../scripts/check-referentiel.mjs", import.meta.url));
  const lancer = cwd => spawnSync(process.execPath, [script, "--json"], { cwd, encoding: "utf8" });
  assert.equal(lancer(valide.cwd).status, 0);
  const resultat = lancer(invalide.cwd);
  assert.equal(resultat.status, 1);
  assert.equal(resultat.stdout, lancer(invalide.cwd).stdout);
  const r = JSON.parse(resultat.stdout);
  assert.deepEqual(Object.keys(r), ["specificationVersion", "verdict", "errors", "warnings", "issues"]);
  assert.deepEqual([r.verdict, r.errors, r.issues[0].location], ["FAIL", 2, "referentiel/objets/0.json"]);
});

test("type de cible incompatible dans l’index de références", () => {
  const relation = lien("incompatible", "requires", a, p);
  const issues = [];
  verifierIntegrite([a, p, relation].map(objet => ({ objet })), [], (_entree, regle) => issues.push(regle));
  assert.ok(issues.includes("S4-REFERENCE-TYPE"));
});

test("équivalence entre objets validés", async t => {
  const r = await rapport(t, [av, bv, lien("equivalence", "equivalentTo", av, bv, { status: "validated", rationale: "Exemple" })]);
  assert.equal(r.verdict, "PASS");
  assert.deepEqual(signalements(r), new Set(["S4-RELATION-EQUIVALENCE"]));
});
