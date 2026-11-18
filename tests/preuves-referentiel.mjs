import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after } from "node:test";
import { lireCsv } from "../scripts/lib/csv.mjs";

export function verifierCouverture(fichier) {
  const [colonnes, ...lignes] = lireCsv(readFileSync(new URL("../referentiel/RULE_CATALOG.csv", import.meta.url), "utf8"));
  const regles = new Map(lignes.map(l => {
    const r = Object.fromEntries(colonnes.map((c, i) => [c, l[i]]));
    return [r.rule_id, r];
  }));
  const attendues = [...regles.values()].flatMap(r => r.fixture_refs.split(" | ")
    .filter(ref => ref.startsWith(fichier + "#"))
    .map(ref => [ref.slice(fichier.length + 1), r.rule_id]));
  const vues = new Set();
  after(() => {
    for (const [cas, regle] of attendues) assert.ok(vues.has(JSON.stringify([cas, regle])), "Diagnostic non exercé : " + cas + " / " + regle);
  });
  return (issues, cas) => {
    for (const issue of issues) {
      assert.ok(regles.has(issue.rule), "Règle inconnue : " + issue.rule);
      assert.equal(issue.severity, regles.get(issue.rule).severity, issue.rule);
      vues.add(JSON.stringify([cas, issue.rule]));
    }
  };
}
