import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";

export const typesEvaluation = Object.freeze(["definition", "attempt", "observation", "submission", "decision", "closure", "journal", "methods"]);
export async function chargerSchemasEvaluations() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  for (const chemin of ["referentiel/schemas/primitives.schema.json", "experiences/schemas/primitives.schema.json",
    ...["primitives", ...typesEvaluation].map(n => "evaluations/schemas/" + n + ".schema.json")]) {
    ajv.addSchema(JSON.parse(await readFile(new URL("../../" + chemin, import.meta.url), "utf8")));
  }
  return new Map(typesEvaluation.map(n => [n, ajv.getSchema("https://schemas.kermiclab.online/s7/" + n + ".schema.json")]));
}
