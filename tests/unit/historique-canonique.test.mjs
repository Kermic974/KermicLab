import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { lireHistorique, lireCorpusRevision, lireFichiersRevision } from "../../scripts/lib/referentiel-historique.mjs";

async function depot(t) {
  const cwd = await mkdtemp(join(tmpdir(), "s6-historique-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", ["-c", "core.longpaths=true", "-c", "core.autocrlf=false", ...args], { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Fixture synthétique");
  git("config", "user.email", "fixture@example.invalid");
  const commit = () => { git("add", "."); git("commit", "-m", "Fixture historique"); };
  return { cwd, git, commit };
}

test("lecture par lots identique à git show, UTF-8, renommages et séparation S4/S6", async t => {
  const { cwd, git, commit } = await depot(t);
  for (const chemin of ["referentiel/objets", "experiences/objets"]) await mkdir(join(cwd, chemin), { recursive: true });
  const s4 = { id: "notion.maths.test", type: "notion", label: "Été, triangle ∆ et 😀", status: "draft", version: 1 };
  const s6 = { id: "experience.maths.test", label: "Ligne 1\nLigne 2 : é", version: 1 };
  await writeFile(join(cwd, "referentiel/objets/é avec espace.json"), JSON.stringify(s4));
  await writeFile(join(cwd, "experiences/objets/initial.json"), JSON.stringify(s6));
  commit();
  await rename(join(cwd, "experiences/objets/initial.json"), join(cwd, "experiences/objets/renommé.json"));
  commit();
  await writeFile(join(cwd, "experiences/objets/renommé.json"), JSON.stringify({ ...s6, version: 2, label: "Révision française" }));
  commit();
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  git("switch", "-c", "feature");
  await writeFile(join(cwd, "experiences/objets/renommé.json"), JSON.stringify({ ...s6, version: 3 }));
  commit();

  for (const chemin of ["referentiel/objets", "experiences/objets"]) {
    const revisions = git("rev-list", "--first-parent", "--full-history", "--reverse", "origin/main", "--", chemin).split("\n");
    const attendu = revisions.map(revision => {
      const noms = execFileSync("git", ["ls-tree", "-r", "-z", "--name-only", revision, "--", chemin], { cwd, encoding: "utf8" }).split("\0").filter(n => n.endsWith(".json"));
      return new Map(noms.map(nom => {
        const o = JSON.parse(git("show", revision + ":" + nom));
        return [o.id, o];
      }));
    });
    assert.deepEqual(await lireHistorique(cwd, chemin), attendu);
  }
  const historique = await lireHistorique(cwd, "experiences/objets");
  historique[0].get(s6.id).label = "Mutation du consommateur";
  assert.equal(historique[1].get(s6.id).label, s6.label);
  assert.equal(historique.at(-1).get(s6.id).version, 2, "La branche non publiée reste hors historique.");
  await assert.rejects(lireHistorique(cwd, "../autre"), /Espace canonique/);
});

test("le cache des blobs ne masque pas un doublon d’identité historique", async t => {
  const { cwd, git, commit } = await depot(t);
  await mkdir(join(cwd, "experiences/objets"), { recursive: true });
  const contenu = JSON.stringify({ id: "experience.maths.double", version: 1 });
  for (const nom of ["a", "b"]) await writeFile(join(cwd, "experiences/objets/" + nom + ".json"), contenu);
  commit();
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  await assert.rejects(lireHistorique(cwd, "experiences/objets"), /dupliqué/);
});

test("les lecteurs figés conservent les sources UTF-8 et refusent les chemins hors périmètre", async t => {
  const { cwd, git, commit } = await depot(t);
  await mkdir(join(cwd, "catalogue/test"), { recursive: true });
  await mkdir(join(cwd, "referentiel/objets"), { recursive: true });
  const chemin = "catalogue/test/contenu.json";
  const avant = '{"texte":"Été 😀"}\r\n';
  await writeFile(join(cwd, chemin), avant);
  const objet = { id: "notion.maths.fixture", version: 1, label: "Avant" };
  await writeFile(join(cwd, "referentiel/objets/a.json"), JSON.stringify(objet));
  commit();
  const revision = git("rev-parse", "HEAD");
  await writeFile(join(cwd, chemin), '{"texte":"Courant modifié"}');
  await writeFile(join(cwd, "referentiel/objets/a.json"), JSON.stringify({ ...objet, version: 2 }));
  const sources = await lireFichiersRevision(cwd, revision, [chemin]);
  assert.equal(sources.get(chemin).toString("utf8"), avant);
  assert.deepEqual((await lireCorpusRevision(cwd, revision)).get(objet.id), objet);
  await assert.rejects(lireFichiersRevision(cwd, revision, ["catalogue/../worker/secret.json"]), /interdite/);
  await assert.rejects(lireFichiersRevision(cwd, revision, ["docs/secret.md"]), /interdite/);
  await assert.rejects(lireFichiersRevision(cwd, revision, ["catalogue/test/absent.json"]), /absente/);
  await assert.rejects(lireCorpusRevision(cwd, "--help"), /invalide/);
});
