import { execFile } from "node:child_process";
import { promisify } from "node:util";

const executer = promisify(execFile);
const chemin = "referentiel/objets";

export async function lireHistorique(cwd) {
  const git = async (...args) => (await executer("git", args, { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })).stdout;
  if ((await git("rev-parse", "--is-shallow-repository")).trim() !== "false") throw new Error("Historique Git incomplet.");
  const base = (await git("merge-base", "HEAD", "refs/remotes/origin/main")).trim();
  const revisions = (await git("rev-list", "--first-parent", "--full-history", "--reverse", base, "--", chemin)).trim().split("\n").filter(Boolean);
  const historique = [];
  for (const revision of revisions) {
    const noms = (await git("ls-tree", "-r", "-z", "--name-only", revision, "--", chemin)).split("\0").filter(nom => nom.endsWith(".json"));
    const etat = new Map();
    for (const nom of noms) {
      const objet = JSON.parse(await git("show", revision + ":" + nom));
      if (typeof objet?.id !== "string" || etat.has(objet.id)) throw new Error("Identifiant historique absent ou dupliqué.");
      etat.set(objet.id, objet);
    }
    historique.push(etat);
  }
  return historique;
}
