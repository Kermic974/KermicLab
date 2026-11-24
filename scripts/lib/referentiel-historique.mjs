import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const executer = promisify(execFile);
const decoder = new TextDecoder("utf-8", { fatal: true });

async function lireBlobs(cwd, ids) {
  if (!ids.length) return new Map();
  const sortie = await new Promise((resoudre, rejeter) => {
    const enfant = spawn("git", ["-c", "core.longpaths=true", "cat-file", "--batch"], { cwd, windowsHide: true });
    const morceaux = [];
    let taille = 0;
    enfant.on("error", rejeter);
    enfant.stdin.on("error", rejeter);
    enfant.stdout.on("data", morceau => {
      taille += morceau.length;
      if (taille > 128 * 1024 * 1024) { enfant.kill(); rejeter(new Error("Historique trop volumineux.")); }
      else morceaux.push(morceau);
    });
    enfant.stderr.resume();
    enfant.on("close", code => code === 0 ? resoudre(Buffer.concat(morceaux)) : rejeter(new Error("Lecture des blobs Git impossible.")));
    enfant.stdin.end(ids.join("\n") + "\n");
  });
  const resultat = new Map();
  let position = 0;
  for (const id of ids) {
    const fin = sortie.indexOf(10, position);
    if (fin < position) throw new Error("En-tête Git incomplet.");
    const entete = sortie.subarray(position, fin).toString("ascii");
    const attendu = entete.match(/^([a-f0-9]+) blob ([0-9]+)$/);
    const taille = Number(attendu?.[2]);
    if (!attendu || attendu[1] !== id || !Number.isSafeInteger(taille) || taille > 16 * 1024 * 1024) throw new Error("Blob historique invalide.");
    position = fin + 1;
    if (position + taille >= sortie.length || sortie[position + taille] !== 10) throw new Error("Blob Git tronqué.");
    resultat.set(id, JSON.parse(decoder.decode(sortie.subarray(position, position + taille))));
    position += taille + 1;
  }
  if (position !== sortie.length) throw new Error("Réponse Git surnuméraire.");
  return resultat;
}

export async function lireHistorique(cwd, chemin = "referentiel/objets") {
  if (!["referentiel/objets", "experiences/objets"].includes(chemin)) throw new Error("Espace canonique inconnu.");
  const git = async (...args) => (await executer("git", ["-c", "core.longpaths=true", ...args],
    { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })).stdout;
  if ((await git("rev-parse", "--is-shallow-repository")).trim() !== "false") throw new Error("Historique Git incomplet.");
  const base = (await git("merge-base", "HEAD", "refs/remotes/origin/main")).trim();
  // S6 versionne aussi le contenu lié : un commit source seul doit rester visible.
  const perimetre = chemin === "experiences/objets" ? [chemin, "catalogue", "Sample/lab", "src/pedagogy"] : [chemin];
  const revisions = (await git("rev-list", "--first-parent", "--full-history", "--reverse", base, "--", ...perimetre)).trim().split("\n").filter(Boolean);
  const historique = [];
  const cache = new Map();
  for (const revision of revisions) {
    const lignes = (await git("ls-tree", "-r", "-z", revision, "--", chemin)).split("\0").filter(Boolean);
    const blobs = lignes.filter(ligne => ligne.endsWith(".json")).map(ligne => {
      const entree = ligne.match(/^(100644|100755) blob ([a-f0-9]+)\t[\s\S]+$/);
      if (!entree) throw new Error("Fichier canonique historique non régulier.");
      return entree[2];
    });
    const nouveaux = [...new Set(blobs.filter(id => !cache.has(id)))];
    for (const [id, objet] of await lireBlobs(cwd, nouveaux)) cache.set(id, objet);
    const etat = new Map();
    Object.defineProperty(etat, "revision", { value: revision });
    for (const id of blobs) {
      const objet = structuredClone(cache.get(id));
      if (typeof objet?.id !== "string" || etat.has(objet.id)) throw new Error("Identifiant historique absent ou dupliqué.");
      etat.set(objet.id, objet);
    }
    historique.push(etat);
  }
  return historique;
}
