import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("../", import.meta.url));

export function normaliserSource(fichier, contenu) {
  if (fichier !== "web/feuille-de-route.html") return contenu;
  return Buffer.from(contenu.toString("utf8").replace(
    /(<!-- roadmap:auto:debut -->)[\s\S]*?(<!-- roadmap:auto:fin -->)/, "$1$2"));
}

export async function verifierReference(sources, revision = "HEAD") {
  const git = (...args) => execFileSync("git", args, { cwd: racine });
  const inconnus = git("ls-files", "--others", "--exclude-standard", "-z", "--", ...sources)
    .toString("utf8").split("\0").filter(Boolean);
  assert.deepEqual(inconnus, [], "Sources UX non suivies : les committer avant de versionner");
  const modifies = git("diff", "--name-only", "-z", revision, "--", ...sources)
    .toString("utf8").split("\0").filter(Boolean);
  for (const fichier of modifies) {
    const actuel = normaliserSource(fichier, await readFile(path.join(racine, fichier)));
    const reference = normaliserSource(fichier, git("show", `${revision}:${fichier}`));
    assert.ok(actuel.equals(reference),
      `${fichier} : sources différentes du commit ${revision} ; committer les sources puis actualiser le suivi UX`);
  }
}
