import { test } from "node:test";
import assert from "node:assert/strict";
import { DEBUT, FIN, WORKFLOWS, validations, selectionnerPr, actualiser, preparer } from "../../scripts/roadmap.mjs";

const sha = "a".repeat(40);
const autre = "b".repeat(40);
const html = `avant${DEBUT}ancien${FIN}après`;
const runs = WORKFLOWS.map((path, i) => ({
  path, id: i + 1, name: `Validation ${i}`, head_sha: sha, event: "push", head_branch: "main",
  status: "completed", conclusion: "success", run_number: 1, run_attempt: 1
}));
const pr = (number, options = {}) => ({
  number, title: `PR ${number}`, merged_at: "2026-11-05T05:00:00Z",
  merge_commit_sha: sha, base: { ref: "main" }, head: { ref: `feature/${number}` }, ...options
});
const donnees = { prs: [pr(1)], runs, sha, depot: "Kermic974/trigoLab", total: 180, jeux: 9 };

test("roadmap : trois succès sur le même SHA, la bonne branche et un push sont obligatoires", () => {
  assert.deepEqual(validations({ workflow_runs: runs }, sha), runs);
  assert.equal(validations({ workflow_runs: runs.slice(1) }, sha), null);
  for (const changement of [
    { conclusion: "failure" }, { conclusion: "cancelled" }, { status: "in_progress" },
    { head_sha: autre }, { event: "pull_request" }, { head_branch: "autre" }
  ]) {
    assert.equal(validations({ workflow_runs: [{ ...runs[0], ...changement }, ...runs.slice(1)] }, sha), null);
  }
});

test("roadmap : une relance ou exécution plus récente échouée invalide un ancien succès", () => {
  for (const nouvelle of [{ run_attempt: 2 }, { run_number: 2 }]) {
    const reponse = { workflow_runs: [...runs, { ...runs[0], ...nouvelle, conclusion: "failure" }] };
    assert.equal(validations(reponse, sha), null);
    assert.equal(validations({ workflow_runs: reponse.workflow_runs.reverse() }, sha), null);
  }
});

test("roadmap : seules les PR fusionnées présentes dans main sont retenues, sans boucle automatique", () => {
  const resultat = selectionnerPr([
    pr(1), pr(2, { merged_at: null }), pr(3, { base: { ref: "autre" } }),
    pr(4, { head: { ref: "automatisation/roadmap" } }),
    pr(5, { merge_commit_sha: autre }), pr(6, { merge_commit_sha: "--help" })
  ], (commit) => commit === sha);
  assert.deepEqual(resultat.map((p) => p.number), [1]);
  assert.deepEqual(selectionnerPr(Array.from({ length: 25 }, (_, i) => pr(i + 1)), () => true)
    .map((p) => p.number), Array.from({ length: 20 }, (_, i) => 25 - i));
});

test("roadmap : HTML échappé, URL canonique et conservation exacte du contenu éditorial", () => {
  const resultat = actualiser(html, { ...donnees, prs: [pr(7, { title: '<script>alert("x")</script> & texte' })] });
  assert.ok(resultat.startsWith(`avant${DEBUT}`));
  assert.ok(resultat.endsWith(`${FIN}après`));
  assert.match(resultat, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; texte/);
  assert.match(resultat, /(?:^|[^A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-])https:\/\/github\.com\/Kermic974\/trigoLab\/pull\/7(?:$|[^A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-])/);
  assert.match(resultat, /180 pages, dont 9 jeux/);
  assert.equal(actualiser(resultat, { ...donnees, prs: [pr(7, { title: '<script>alert("x")</script> & texte' })] }), resultat);
});

test("roadmap : bornes absentes, dupliquées ou inversées et références invalides sont refusées", () => {
  for (const source of ["", `${DEBUT}${DEBUT}${FIN}`, `${FIN}${DEBUT}`]) {
    assert.throws(() => actualiser(source, donnees), /Bornes/);
  }
  assert.throws(() => actualiser(html, { ...donnees, depot: 'x/"><script>' }), /invalide/);
  assert.throws(() => actualiser(html, { ...donnees, sha: "main" }), /invalide/);
});

test("roadmap : aucune récupération de PR avant validation, erreurs propagées", async () => {
  const options = { ...donnees, html, estAncetre: () => true };
  let appels = 0;
  assert.equal(await preparer({ ...options, demander: async () => {
    appels++; return { workflow_runs: [], total_count: 0 };
  } }), null);
  assert.equal(appels, 1);
  await assert.rejects(preparer({ ...options, demander: async () => { throw new Error("HTTP 403"); } }), /HTTP 403/);
  await assert.rejects(preparer({ ...options, demander: async () =>
    ({ workflow_runs: runs, total_count: 101 }) }), /contrôle manuel/);
});

test("roadmap : réconciliation des fusions et génération identique lors d'une relance", async () => {
  const demander = async (route) => route.includes("/actions/runs?")
    ? { workflow_runs: runs, total_count: 3 } : [pr(1), pr(2), pr(3, { merged_at: null })];
  const options = { ...donnees, demander, html, estAncetre: () => true };
  const resultat = await preparer(options);
  assert.match(resultat, /\/pull\/1/);
  assert.match(resultat, /\/pull\/2/);
  assert.doesNotMatch(resultat, /\/pull\/3/);
  assert.equal(await preparer({ ...options, html: resultat }), resultat);
});

test("roadmap : la fusion de sa propre PR ne déclenche pas une nouvelle proposition", () => {
  const resultat = actualiser(html, donnees);
  assert.equal(actualiser(resultat, { ...donnees, sha: autre,
    runs: runs.map((run) => ({ ...run, head_sha: autre, id: run.id + 10 })) }), resultat);
  assert.notEqual(actualiser(resultat, { ...donnees, prs: [pr(2), pr(1)] }), resultat);
  assert.notEqual(actualiser(resultat, { ...donnees, total: 181 }), resultat);
});
