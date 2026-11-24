import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifierExperiences } from "../../scripts/check-experiences.mjs";
import { verifierCouverture } from "../preuves-referentiel.mjs";

const couverture = verifierCouverture("tests/unit/experiences-validateur.test.mjs");

const source = { path: "catalogue/test/contenu.json", anchor: "unite-a", format: "catalogue-json" };
const document = anchor => ({ path: "docs/fixture.md", anchor });
const unite = { experienceId: "unite-a", type: "qcm", question: "Combien font 2 + 2 ?", choix: ["3", "4"], bonne: 1, explication: "Deux et deux font quatre." };
const base = { id: "experience.maths.test", type: "explanation", version: 1, status: "draft", label: "Fixture", description: "Fixture synthétique de validation", objective: "Calculer une somme.", targets: ["notion.maths.test"],
  provenance: { type: "editorial", references: [document("Source")] }, sources: [source],
  review: { source: document("Revue"), date: "2026-01-01", version: 1, scope: ["content", "targets", "accessibility"] },
  accessibility: { modalities: ["text", "keyboard"], alternatives: [], review: document("Accessibilite") } };

async function espace(t, objet = base, unites = [unite]) {
  const cwd = await mkdtemp(join(tmpdir(), "s6-validateur-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  for (const d of ["experiences/objets", "referentiel/objets", "catalogue/test", "docs"]) await mkdir(join(cwd, d), { recursive: true });
  const ecrire = (path, valeur) => writeFile(join(cwd, path), typeof valeur === "string" ? valeur : JSON.stringify(valeur));
  await ecrire("experiences/objets/a.json", objet);
  await ecrire("referentiel/objets/a.json", { id: "notion.maths.test", type: "notion", version: 1, status: "review", label: "Somme" });
  await ecrire(source.path, { unites });
  await ecrire("docs/fixture.md", "# Source\nFixture synthétique.\n# Revue\nAttestation fictive réservée au test.\n# Accessibilite\nPreuve synthétique.\n");
  const rapport = async options => {
    const r = await verifierExperiences(cwd, { historiqueDe: async () => [], ...options });
    couverture(r.issues, t.name);
    return r;
  };
  return { cwd, ecrire, rapport };
}
const contient = (r, regle) => assert.ok(r.issues.some(i => i.rule === regle), JSON.stringify(r));

test("F-CORE-VALID", async t => {
  const { rapport } = await espace(t);
  const r = await rapport();
  assert.deepEqual([r.verdict, r.errors, r.warnings, r.objects], ["PASS", 0, 0, 1]);
  assert.deepEqual(await rapport(), r);
});
test("F-LAB-VALID", async t => {
  const exercice = { ...base, type: "exercise", task: { format: "qcm", prompt: source, expected: source } };
  const model = { ...source, anchor: "modele" };
  const objectif = { ...source, anchor: "mission" };
  const mission = { ...base, id: "experience.maths.mission", type: "mission", sources: [objectif],
    components: [{ id: exercice.id, version: 1 }], successCriteria: [objectif] };
  const lab = { ...base, id: "experience.maths.lab", type: "lab", sources: [model],
    parameters: model, interactions: model, limits: model, components: [{ id: mission.id, version: 1 }] };
  const { rapport, ecrire } = await espace(t, exercice, [unite,
    { experienceId: "modele", parameters: { longueur: 1 }, interactions: ["Déplacer le point."], limits: ["Modèle simplifié."] },
    { experienceId: "mission", consigne: "Explore le modèle puis calcule.", successCriteria: ["Repérer la valeur attendue."] }]);
  await ecrire("experiences/objets/mission.json", mission);
  await ecrire("experiences/objets/lab.json", lab);
  const r = await rapport();
  assert.deepEqual([r.verdict, r.errors, r.warnings, r.objects], ["PASS", 0, 0, 3]);
});
test("F-JSON-ERROR", async t => {
  const { rapport } = await espace(t, "{");
  contient(await rapport(), "S6-JSON");
});
test("F-SCHEMA-TYPE-ERROR", async t => {
  const { rapport } = await espace(t, { ...base, type: "unknown" });
  contient(await rapport(), "S6-SCHEMA-TYPE");
});
test("F-LAYER-ERROR", async t => {
  const { rapport } = await espace(t, { ...base, studentAnswer: "Donnée synthétique interdite" });
  contient(await rapport(), "S6-SCHEMA-FORME");
});
test("F-CANONICAL-ERROR", async t => {
  const { rapport, ecrire } = await espace(t);
  await ecrire("referentiel/objets/a.json", { id: "notion.maths.test", type: "notion", status: "inconnu" });
  contient(await rapport(), "S6-CANONICAL");
});
test("F-SOURCE-ERROR", async t => {
  const { rapport } = await espace(t, { ...base, sources: [{ ...source, anchor: "absente" }] });
  contient(await rapport(), "S6-SOURCE");
});
test("les ancres dupliquées sont refusées, même si leurs contenus sont identiques", async t => {
  const { rapport } = await espace(t, base, [unite, unite]);
  contient(await rapport(), "S6-SOURCE");
});
test("un état individuel dans une unité source est refusé", async t => {
  const { rapport } = await espace(t, base, [{ ...unite, studentAnswer: "Donnée synthétique interdite" }]);
  contient(await rapport(), "S6-SOURCE");
});
test("F-ANSWER-ERROR", async t => {
  const o = { ...base, type: "exercise", task: { format: "qcm", prompt: source, expected: source } };
  const { rapport } = await espace(t, o, [{ ...unite, bonne: 99 }]);
  contient(await rapport(), "S6-ANSWER");
});
test("F-PROVENANCE-ERROR", async t => {
  const { rapport } = await espace(t, { ...base, provenance: { ...base.provenance, references: [document("Section-absente")] } });
  contient(await rapport(), "S6-PROVENANCE");
});
test("F-HISTORY-ERROR", async t => {
  const { rapport } = await espace(t);
  contient(await rapport({ historiqueDe: async () => { throw new Error("Fixture sans historique"); } }), "S6-HISTORY");
});
test("une alternative déclarée mais introuvable reste une erreur en review", async t => {
  const o = { ...base, accessibility: { modalities: ["visual"], alternatives: [{ modality: "visual", source: { ...source, anchor: "manquante" } }], review: document("Accessibilite") } };
  const { rapport } = await espace(t, o);
  contient(await rapport(), "S6-SOURCE");
  contient(await rapport(), "S6-ACCESS-REVIEW");
});
test("une revue d’une autre version ou une date impossible ne valide pas cette version", async t => {
  const { rapport, ecrire } = await espace(t, { ...base, review: { ...base.review, version: 2 } });
  contient(await rapport(), "S6-EVIDENCE-REVIEW");
  await ecrire("experiences/objets/a.json", { ...base, review: { ...base.review, date: "2026-02-30" } });
  contient(await rapport(), "S6-EVIDENCE-REVIEW");
});
test("les erreurs précèdent les avertissements et le rapport reste trié et déterministe", async t => {
  const o = structuredClone(base);
  delete o.review;
  delete o.accessibility;
  o.targets = ["notion.maths.inconnue"];
  const { rapport } = await espace(t, o);
  const r = await rapport();
  assert.equal(r.verdict, "ERROR");
  assert.equal(r.errors, 1);
  assert.equal(r.warnings, 2);
  assert.deepEqual(await rapport(), r);
  const cles = r.issues.map(i => JSON.stringify([i.location, i.rule, i.severity, i.message]));
  assert.deepEqual(cles, [...cles].sort());
});
test("les trois formats lisent des réponses préparées, pas des résultats individuels", async t => {
  const o = { ...base, type: "exercise", task: { format: "number", prompt: source, expected: source } };
  const nombre = { experienceId: "unite-a", type: "nombre", question: "2 + 2 ?", reponse: 4, indices: ["Ajoute deux unités."], solution: "4" };
  const { rapport, ecrire } = await espace(t, o, [nombre]);
  assert.equal((await rapport()).verdict, "PASS");
  await ecrire("experiences/objets/a.json", { ...o, task: { format: "action", prompt: source, expected: source, actions: source } });
  await ecrire(source.path, { unites: [{ experienceId: "unite-a", question: "Déplace le point.", actions: ["Déplacer"], successCriteria: ["Atteindre la cible."] }] });
  assert.equal((await rapport()).verdict, "PASS");
});
test("la forme des JSON et l’ordre de leurs clés ne créent pas de nouvelle révision", async t => {
  const { cwd, ecrire } = await espace(t);
  const { creerLecteurSources, preparerSources } = await import("../../scripts/lib/experiences-sources.mjs");
  const empreinte = async () => (await preparerSources({ objet: base, location: "fixture" }, creerLecteurSources(cwd), () => {})).signature;
  const avant = await empreinte();
  const inverse = Object.fromEntries(Object.entries(unite).reverse());
  await ecrire(source.path, JSON.stringify({ unites: [inverse] }, null, 2).replace(/\n/g, "\r\n"));
  assert.equal(await empreinte(), avant);
});
test("l’historique voit un changement source seul, même corrigé avant le prochain changement S6", async t => {
  const { cwd, ecrire } = await espace(t);
  const git = (...args) => execFileSync("git", ["-c", "core.autocrlf=false", ...args], { cwd, stdio: "pipe" });
  git("init", "-b", "main");
  git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
  const commit = () => { git("add", "."); git("commit", "-m", "Fixture"); git("update-ref", "refs/remotes/origin/main", "HEAD"); };
  commit();
  await ecrire(source.path, { unites: [{ ...unite, question: "Combien font 3 + 3 ?" }] });
  commit();
  await ecrire(source.path, { unites: [unite] });
  commit();
  contient(await verifierExperiences(cwd), "S6-REVISION");
});
test("le CLI distingue invocation invalide, erreurs, avertissements et corpus vide", async t => {
  const { cwd } = await espace(t, "{");
  const script = fileURLToPath(new URL("../../scripts/check-experiences.mjs", import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
  assert.equal(run("--invalide").status, 2);
  const erreur = run("--json");
  assert.equal(erreur.status, 1);
  assert.equal(JSON.parse(erreur.stdout).verdict, "ERROR");
  const o = structuredClone(base);
  delete o.review;
  delete o.accessibility;
  await writeFile(join(cwd, "experiences/objets/a.json"), JSON.stringify(o));
  const git = (...args) => execFileSync("git", args, { cwd, stdio: "pipe" });
  git("init", "-b", "main"); git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
  git("add", "."); git("commit", "-m", "Fixture"); git("update-ref", "refs/remotes/origin/main", "HEAD");
  const warning = run("--json");
  assert.equal(warning.status, 0);
  assert.equal(JSON.parse(warning.stdout).verdict, "WARNING");
  await rm(join(cwd, "experiences/objets/a.json"));
  const vide = run("--json");
  assert.equal(vide.status, 0);
  assert.equal(JSON.parse(vide.stdout).objects, 0);
  assert.ok(await readFile(join(cwd, source.path), "utf8"));
});
