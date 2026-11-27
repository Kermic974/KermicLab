import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

/**
 * Libellés des MicroSkills canoniques (Espace Métiers, ADR 0041) : identifiant → champ `label` des objets MicroSkill
 * trouvés sous `dossier` (sous-dossiers compris), sous leurs deux conventions de nommage : `microskill.<id>.json`
 * (corpus v0.5) et `microskill/<slug>.json` (corpus pilote). Les fichiers sont choisis par leur nom et celui de leur
 * dossier (pas par une expression sur le chemin, dont le séparateur dépend du système) et lus par lots bornés, comme le
 * corpus de la projection, pour ne pas épuiser les descripteurs de fichiers sous Windows. Le libellé commence par une
 * majuscule (le corpus pilote les écrit en minuscules). Ordre déterministe ; un dossier absent donne une table vide.
 */
export async function libellesMicroskills(dossier, { lot = 64 } = {}) {
  let entrees;
  try { entrees = await readdir(dossier, { recursive: true, withFileTypes: true }); } catch (e) { if (e.code === "ENOENT") return new Map(); throw e; }
  const estMicroskill = (e) => e.isFile() && e.name.endsWith(".json")
    && (e.name.startsWith("microskill.") || basename(e.parentPath ?? e.path) === "microskill");
  const chemins = entrees.filter(estMicroskill).map((e) => join(e.parentPath ?? e.path, e.name)).sort();
  const libelles = new Map();
  for (let i = 0; i < chemins.length; i += lot) {
    const objets = await Promise.all(chemins.slice(i, i + lot).map(async (c) => JSON.parse(await readFile(c, "utf8"))));
    for (const o of objets) {
      if (o?.type !== "microskill" || typeof o.id !== "string" || typeof o.label !== "string" || !o.label.trim()) continue;
      const libelle = o.label.trim();
      // Le premier fichier rencontré (ordre trié) l'emporte : un identifiant décrit deux fois garde un seul libellé.
      if (!libelles.has(o.id)) libelles.set(o.id, libelle[0].toLocaleUpperCase("fr") + libelle.slice(1));
    }
  }
  return libelles;
}
