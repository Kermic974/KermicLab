import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { verifierEvaluations } from "../../scripts/check-evaluations.mjs";
import { verifierRegistreMethodes } from "../../scripts/lib/evaluations-methodes.mjs";
import { copieEvaluation, schemasEvaluation } from "../evaluation-fixtures.mjs";
import { verifierCouverture } from "../preuves-referentiel.mjs";
const couverture = verifierCouverture("tests/unit/evaluations-validateur.test.mjs");

async function espace(t, avecDefinition = true) {
  const cwd = await mkdtemp(join(tmpdir(), "s7-validateur-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  for (const d of ["evaluations/objets", "experiences/objets", "referentiel/objets", "catalogue/demo", "docs", "web"]) await mkdir(join(cwd, d), { recursive: true });
  const ecrire = (chemin, v) => writeFile(join(cwd, chemin), typeof v === "string" ? v : JSON.stringify(v));
  const registre = JSON.parse(await readFile(new URL("../../evaluations/methodes.json", import.meta.url), "utf8"));
  await ecrire("evaluations/methodes.json", registre);
  await ecrire("web/evaluation-correction-v1.js", await readFile(new URL("../../web/evaluation-correction-v1.js", import.meta.url), "utf8"));
  const b = copieEvaluation();
  if (avecDefinition) {
    await ecrire("evaluations/objets/demo.json", b.definition);
    await ecrire("experiences/objets/demo.json", { ...b.experience, label: "Fixture synthétique", description: "Contrat de test sans apprenant réel.",
      objective: "Calculer une somme de deux unités.", sources: [b.experience.task.prompt], provenance: { type: "editorial", references: b.definition.provenance } });
    for (const [i, cible] of b.targets.entries()) await ecrire("referentiel/objets/cible-" + i + ".json", { ...cible, label: "Cible synthétique" });
    await ecrire("catalogue/demo/contenu.json", { unites: [b.prepared] });
    await ecrire("docs/evaluation-demo.md", "# fixture\nSource synthétique, aucune attestation humaine réelle.\n");
  }
  const git = (...args) => execFileSync("git", args, { cwd, stdio: "pipe", encoding: "utf8" });
  git("init", "-q"); git("add", "."); git("-c", "user.name=S7 fixture", "-c", "user.email=s7@example.invalid", "commit", "-qm", "Fixture S7 synthétique");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  return { cwd, ecrire, b, registre, git };
}

test("S7 CLI : modèle réel synthétique, sources et historique qualifiés, rapport déterministe en lecture seule", async t => {
  const { cwd, git } = await espace(t);
  const avant = git("status", "--porcelain");
  const r = await verifierEvaluations(cwd);
  assert.deepEqual([r.errors, r.warnings, r.objects, r.verdict], [0, 1, 1, "WARNING"], JSON.stringify(r));
  assert.equal(r.issues[0].rule, "S7-15-REVIEW");
  assert.deepEqual(await verifierEvaluations(cwd), r);
  assert.equal(git("status", "--porcelain"), avant);
});

test("S7 CLI : référence incorrecte ou source changée sans version reste une erreur", async t => {
  const { cwd, b, ecrire } = await espace(t);
  b.definition.experience.version = 2;
  await ecrire("evaluations/objets/demo.json", b.definition);
  let r = await verifierEvaluations(cwd);
  assert.ok(r.issues.some(i => i.rule === "S7-02" && i.severity === "ERROR"));
  b.definition.experience.version = 1;
  await ecrire("evaluations/objets/demo.json", b.definition);
  b.prepared.bonne = 2;
  await ecrire("catalogue/demo/contenu.json", { unites: [b.prepared] });
  r = await verifierEvaluations(cwd);
  assert.ok(r.issues.some(i => i.rule === "S7-15" && i.severity === "ERROR"), JSON.stringify(r));
});

test("S7-15 : une méthode et son empreinte ne sont pas réécrites sous la même version", async t => {
  const { cwd, ecrire, registre } = await espace(t, false);
  const code = (await readFile(join(cwd, "web/evaluation-correction-v1.js"), "utf8")) + "\n// modification historique interdite\n";
  await ecrire("web/evaluation-correction-v1.js", code);
  const sha256 = createHash("sha256").update(code.replace(/\r\n/g, "\n")).digest("hex");
  registre.methods.forEach(m => { m.sha256 = sha256; });
  await ecrire("evaluations/methodes.json", registre);
  const issues = [];
  await verifierRegistreMethodes(cwd, schemasEvaluation.get("methods"), (rule, message) => issues.push({ rule, message, severity: "ERROR" }));
  couverture(issues, t.name);
  assert.ok(issues.some(i => i.rule === "S7-15" && /réécrite/.test(i.message)));
});

test("S7 CLI : invocation, JSON invalide et corpus vide ont des sorties distinctes", async t => {
  const { cwd, ecrire } = await espace(t, false);
  const script = fileURLToPath(new URL("../../scripts/check-evaluations.mjs", import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8", windowsHide: true });
  assert.equal(run("--inconnu").status, 2);
  const vide = run("--json");
  assert.equal(vide.status, 0, vide.stderr);
  assert.deepEqual([JSON.parse(vide.stdout).verdict, JSON.parse(vide.stdout).objects], ["PASS", 0]);
  await ecrire("evaluations/objets/invalide.json", "{");
  const invalide = run("--json");
  assert.equal(invalide.status, 1);
  couverture(JSON.parse(invalide.stdout).issues, t.name);
  assert.equal(JSON.parse(invalide.stdout).issues[0].rule, "S7-01");
});
