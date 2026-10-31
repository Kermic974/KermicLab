// Lit les fichiers SARIF d'un dossier et échoue s'ils contiennent des alertes de niveau « error » ou « warning ».
// Utilisé par le workflow CodeQL quand l'envoi des résultats à GitHub n'est pas possible (dépôt privé sans GHAS).
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const dossier = process.argv[2];
if (!dossier) { console.error("usage : node scripts/verifier-sarif.mjs <dossier>"); process.exit(2); }

const fichiers = (await readdir(dossier)).filter((f) => f.endsWith(".sarif"));
if (!fichiers.length) { console.error(`Aucun fichier SARIF dans ${dossier}`); process.exit(2); }

/** Niveau effectif d'un résultat : le sien, sinon celui de sa règle, sinon « warning » (prudent). */
function niveau(resultat, run) {
  if (resultat.level) return resultat.level;
  const composants = [run.tool?.driver, ...(run.tool?.extensions ?? [])];
  const ref = resultat.rule ?? {};
  const composant = ref.toolComponent?.index !== undefined ? run.tool?.extensions?.[ref.toolComponent.index] : null;
  const index = ref.index ?? resultat.ruleIndex;
  let regle = composant && index !== undefined ? composant.rules?.[index] : null;
  if (!regle && index !== undefined && ref.toolComponent === undefined) regle = run.tool?.driver?.rules?.[index];
  if (!regle) {
    const id = ref.id ?? resultat.ruleId;
    regle = composants.flatMap((c) => c?.rules ?? []).find((r) => r.id === id);
  }
  return regle?.defaultConfiguration?.level ?? "warning";
}

const alertes = [];
for (const f of fichiers) {
  const sarif = JSON.parse(await readFile(path.join(dossier, f), "utf8"));
  for (const run of sarif.runs ?? []) {
    for (const r of run.results ?? []) {
      const n = niveau(r, run);
      if (n !== "error" && n !== "warning") continue;
      const loc = r.locations?.[0]?.physicalLocation;
      alertes.push(`${n} ${r.ruleId ?? r.rule?.id} ${loc?.artifactLocation?.uri ?? "?"}:${loc?.region?.startLine ?? "?"} — ${r.message?.text ?? ""}`);
    }
  }
}

if (alertes.length) {
  console.error(`${alertes.length} alerte(s) CodeQL :\n${alertes.join("\n")}`);
  process.exit(1);
}
console.log(`CodeQL : aucune alerte (${fichiers.length} fichier(s) SARIF).`);
