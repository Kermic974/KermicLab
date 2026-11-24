import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { METHODES_EVALUATION } from "../../web/evaluation-correction-v1.js";

const executer = promisify(execFile);
const empreinte = texte => createHash("sha256").update(texte.replace(/\r\n/g, "\n")).digest("hex");
const decoder = new TextDecoder("utf-8", { fatal: true });
const cle = m => m.id + "@" + m.version;

export async function verifierRegistreMethodes(cwd, schema, signaler, options = {}) {
  const registre = JSON.parse(decoder.decode(await readFile(resolve(cwd, "evaluations/methodes.json"))));
  if (!schema(registre)) { signaler("S7-08", "Registre des méthodes hors schéma."); return new Map(); }
  const cache = new Map();
  const lireSource = async (chemin, revision) => {
    if (!/^web\/evaluation-correction-v[1-9][0-9]*\.js(?![\s\S])/.test(chemin)) throw new Error("Chemin de méthode interdit.");
    if (revision) return decoder.decode((await executer("git", ["show", revision + ":" + chemin], { cwd, encoding: "buffer", maxBuffer: 8 * 1024 * 1024 })).stdout);
    const racine = await realpath(cwd), fichier = await realpath(resolve(cwd, chemin));
    const r = relative(racine, fichier);
    if (isAbsolute(r) || r === ".." || r.startsWith(".." + sep)) throw new Error("Implémentation hors dépôt.");
    return decoder.decode(await readFile(fichier));
  };
  const lire = (chemin, revision) => {
    const k = (revision || "courant") + ":" + chemin;
    if (!cache.has(k)) cache.set(k, lireSource(chemin, revision));
    return cache.get(k);
  };
  let etats = [];
  if (options.historique !== undefined) etats = options.historique;
  else {
    const git = async (...args) => (await executer("git", args, { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 })).stdout.trim();
    if (await git("rev-parse", "--is-shallow-repository") !== "false") throw new Error("Historique des méthodes incomplet.");
    const base = await git("merge-base", "HEAD", "refs/remotes/origin/main");
    for (const revision of (await git("rev-list", "--first-parent", "--reverse", base, "--", "evaluations/methodes.json", "web/evaluation-correction-v*.js")).split("\n").filter(Boolean)) {
      const arbre = await git("ls-tree", revision, "--", "evaluations/methodes.json");
      if (!arbre) continue;
      const ancien = JSON.parse(await git("show", revision + ":evaluations/methodes.json"));
      if (!schema(ancien)) throw new Error("Registre historique illisible.");
      etats.push({ revision, registre: ancien });
    }
  }
  const connus = new Map();
  let avant = new Map();
  for (const etat of [...etats, { registre }]) {
    const courant = new Map();
    for (const m of etat.registre.methods) {
      if (courant.has(cle(m))) signaler("S7-08", "Méthode dupliquée dans le registre.");
      courant.set(cle(m), m);
      const ancien = connus.get(cle(m));
      if (ancien && (ancien.mode !== m.mode || ancien.implementation !== m.implementation || ancien.sha256 !== m.sha256 ||
          (ancien.status === "deprecated" && m.status !== "deprecated"))) signaler("S7-15", "Méthode réécrite ou réactivée sous la même identité/version.");
      try {
        if (empreinte(await lire(m.implementation, etat.revision)) !== m.sha256) signaler("S7-15", "Implémentation de méthode différente de son empreinte figée.");
      } catch { signaler("S7-15", "Implémentation historique ou actuelle de méthode introuvable."); }
      connus.set(cle(m), m);
    }
    for (const id of avant.keys()) if (!courant.has(id)) signaler("S7-15", "Méthode historique supprimée du registre.");
    avant = courant;
  }
  for (const m of METHODES_EVALUATION) {
    const r = avant.get(cle(m));
    if (!r || r.mode !== m.mode || r.implementation !== "web/evaluation-correction-v" + m.version + ".js")
      signaler("S7-08", "Méthode d'exécution absente du registre ou liée à une autre implémentation.");
  }
  for (const m of avant.values()) {
    if (!METHODES_EVALUATION.some(v => v.id === m.id && v.version === m.version && v.mode === m.mode)) signaler("S7-08", "Méthode déclarée sans implémentation d'exécution.");
  }
  return avant;
}
