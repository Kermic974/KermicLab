import { readFile, stat } from "node:fs/promises";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { lireCsv } from "./lib/csv.mjs";

export async function verifierArtefacts(racine = process.cwd()) {
  const issues = [];
  const signaler = (rule, location, message) => issues.push({ rule, severity: "ERROR", message, location });
  const lire = async nom => {
    const chemin = resolve(racine, nom);
    const relatif = relative(resolve(racine), chemin);
    if (isAbsolute(relatif) || relatif === ".." || relatif.startsWith(".." + sep)) throw new Error("Chemin hors dépôt");
    if (!(await stat(chemin)).isFile()) throw new Error("Fichier attendu");
    return readFile(chemin, "utf8");
  };
  let lignes, sources;
  try {
    lignes = lireCsv(await lire("referentiel/RULE_CATALOG.csv"));
    sources = JSON.parse(await lire("referentiel/sources-normatives.json"));
    if (!sources || typeof sources !== "object" || Array.isArray(sources)) throw new Error("Index invalide");
  } catch {
    signaler("S5-LECTURE", "referentiel", "Catalogue CSV ou index des sources illisible.");
    return rapport();
  }
  const colonnes = ["rule_id", "source_section", "level", "severity", "description", "fixture_refs", "implementation", "test_refs"];
  if (JSON.stringify(lignes.shift()) !== JSON.stringify(colonnes)) {
    signaler("S5-COLONNES", "referentiel/RULE_CATALOG.csv", "En-tête CSV inattendu.");
  }
  const ids = new Set();
  if (!lignes.length) signaler("S5-LIGNE", "referentiel/RULE_CATALOG.csv", "Au moins une règle est requise.");
  for (const [i, valeurs] of lignes.entries()) {
    const lieu = "referentiel/RULE_CATALOG.csv#ligne-" + (i + 2);
    const r = Object.fromEntries(colonnes.map((c, j) => [c, valeurs[j]]));
    if (valeurs.length !== colonnes.length || valeurs.some(v => !v.trim())) {
      signaler("S5-LIGNE", lieu, "Huit champs non vides sont requis."); continue;
    }
    if (!/^S4-[A-Z0-9-]+$/.test(r.rule_id) || ids.has(r.rule_id)) signaler("S5-REGLE", lieu, "Identifiant invalide ou dupliqué.");
    ids.add(r.rule_id);
    if (!["1", "2", "3", "4"].includes(r.level) || !["ERROR", "WARNING"].includes(r.severity)) {
      signaler("S5-VALEUR", lieu, "Niveau ou sévérité invalide.");
    }
    const source = sources[r.source_section];
    if (!source?.reference || !source?.decision || source.status !== "adopted") signaler("S5-SOURCE", lieu, "Source adoptée absente.");
    else {
      try {
        const decision = await lire(source.decision);
        if (!decision.includes("D1") || !/^https:\/\/app\.notion\.com\/p\/[a-f0-9]{32}$/.test(source.reference)) throw new Error();
      } catch { signaler("S5-SOURCE", lieu, "Source ou décision d’adoption invalide."); }
    }
    for (const champ of ["implementation", "test_refs", "fixture_refs"]) {
      for (const ref of r[champ].split(" | ")) {
        const index = ref.indexOf("#");
        const nom = index < 0 ? ref : ref.slice(0, index);
        const fragment = index < 0 ? "" : ref.slice(index + 1);
        try {
          const contenu = await lire(nom);
          if (champ === "fixture_refs") {
            if (!fragment) throw new Error();
            if (nom.endsWith(".json")) {
              if (!JSON.parse(contenu).some(cas => cas.name === fragment && cas.rule === r.rule_id)) throw new Error();
            } else if (!nom.endsWith(".test.mjs") || !contenu.includes(JSON.stringify(fragment))) throw new Error();
          }
        } catch { signaler("S5-REFERENCE", lieu, "Référence introuvable ou fixture incompatible : " + ref); }
      }
    }
  }
  return rapport();

  function rapport() {
    const uniques = [...new Map(issues.map(i => [JSON.stringify(i), i])).values()];
    const champs = ["location", "rule", "severity", "message"];
    uniques.sort((a, b) => {
      for (const c of champs) if (a[c] !== b[c]) return a[c] < b[c] ? -1 : 1;
      return 0;
    });
    return { specificationVersion: "1.0.0", verdict: uniques.length ? "FAIL" : "PASS", errors: uniques.length, warnings: 0, issues: uniques };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(a => a !== "--json")) {
    console.error("Usage : npm run check:artefacts -- [--json]");
    process.exitCode = 2;
  } else {
    const r = await verifierArtefacts();
    console.log(args.includes("--json") ? JSON.stringify(r, null, 2) : r.verdict + " (" + r.errors + " erreurs)\n" + r.issues.map(i => i.rule + " " + i.location + " " + i.message).join("\n"));
    process.exitCode = r.errors ? 1 : 0;
  }
}
