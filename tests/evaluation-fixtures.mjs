import { readFile } from "node:fs/promises";
import { chargerSchemasEvaluations } from "../scripts/lib/evaluations-structure.mjs";
import { corrigerCritere, motifsPrepares } from "../web/evaluation-correction-v1.js";

export const bases = JSON.parse(await readFile(new URL("fixtures/evaluations/base.json", import.meta.url), "utf8"));
export const schemasEvaluation = await chargerSchemasEvaluations();
export const copieEvaluation = () => structuredClone(bases);
export const idOccurrence = (type, n) => type + "." + n.toString(16).padStart(32, "0");
export function journalDe(b = copieEvaluation()) { return { formatVersion: 1, attempt: b.attempt, events: [b.observation, b.submission, b.decision] }; }
export function contexteJournal(b = copieEvaluation(), options = {}) {
  return {
    validateJournal: schemasEvaluation.get("journal"),
    resolveDefinition: r => r.id === b.definition.id && r.version === b.definition.version ? b.definition : null,
    resolveExperience: r => r.id === b.experience.id && r.version === b.experience.version ? b.experience : null,
    authorizeReviewer: ref => ref === "reviewer.synthese",
    knownPatterns: () => motifsPrepares(b.prepared),
    prepareDe: () => b.prepared,
    replaySynthetic: (_decision, critere) => corrigerCritere(critere, b.prepared, { responseState: "provided", value: 1 }),
    ...options
  };
}
export function contexteDefinitions(b = copieEvaluation()) {
  return {
    experiences: new Map([[b.experience.id + "@" + b.experience.version, b.experience]]),
    cibles: new Map(b.targets.map(t => [t.id + "@" + t.version, t])), relations: [],
    signatures: new Map([[b.experience.id + "@" + b.experience.version, "empreinte-source-synthetique"]]),
    lecteur: { source: async () => b.prepared, document: async () => "# fixture\nSource synthétique." }
  };
}
