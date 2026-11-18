import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";

export const typesExperience = Object.freeze([
  "explanation", "example", "exercise", "quiz", "guided-activity", "visualization",
  "manipulation", "lab", "mission", "remediation", "deepening-resource"
]);

const dossier = new URL("../../experiences/schemas/", import.meta.url);

export async function chargerSchemasExperiences() {
  // Les propriétés requises des branches sont définies par le contrat commun via allOf.
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  // Réutilise le contrat S4 des cibles, sans accepter des expériences dans S4.
  ajv.addSchema(JSON.parse(await readFile(new URL("../../referentiel/schemas/primitives.schema.json", import.meta.url), "utf8")));
  const documents = await Promise.all(["primitives", "common", ...typesExperience].map(async nom =>
    JSON.parse(await readFile(new URL(nom + ".schema.json", dossier), "utf8"))));
  for (const document of documents) ajv.addSchema(document);
  return new Map(typesExperience.map(type => [type,
    ajv.getSchema("https://schemas.kermiclab.online/s6/" + type + ".schema.json")]));
}
