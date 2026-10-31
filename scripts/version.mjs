// Outils de publication : notes d'une version extraites du CHANGELOG et commit cible du tag.
// Usage : node scripts/version.mjs notes <version>   → notes Markdown de la version
//         node scripts/version.mjs cible <version>   → SHA du 1er commit de main (first-parent) portant cette version
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

/** Section « ## [version] » du changelog, sans son titre, jusqu'à la section suivante. */
export function notesVersion(changelog, version) {
  const lignes = changelog.split(/\r?\n/);
  const debut = lignes.findIndex((l) => l.startsWith(`## [${version}]`));
  if (debut < 0) return null;
  const fin = lignes.findIndex((l, i) => i > debut && l.startsWith("## ["));
  return lignes.slice(debut + 1, fin < 0 ? undefined : fin).join("\n").trim();
}

/** Premier commit (historique first-parent, du plus ancien au plus récent) où package.json a cette version. */
export function commitCible(version, git = (args) => execFileSync("git", args, { encoding: "utf8" })) {
  const commits = git(["log", "--first-parent", "--reverse", "--format=%H", "HEAD", "--", "package.json"]).split("\n").filter(Boolean);
  for (const sha of commits) {
    try {
      if (JSON.parse(git(["show", `${sha}:package.json`])).version === version) return sha;
    } catch { /* package.json absent ou invalide à ce commit */ }
  }
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [commande, version] = process.argv.slice(2);
  if (commande === "notes") {
    const notes = notesVersion(await readFile("CHANGELOG.md", "utf8"), version);
    if (!notes) { console.error(`Aucune section « ## [${version}] » dans CHANGELOG.md`); process.exit(1); }
    console.log(notes);
  } else if (commande === "cible") {
    const sha = commitCible(version);
    if (!sha) { console.error(`Aucun commit de main avec la version ${version}`); process.exit(1); }
    console.log(sha);
  } else {
    console.error("usage : node scripts/version.mjs notes|cible <version>");
    process.exit(2);
  }
}
