import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";

const schemas = new URL("../../referentiel/schemas/", import.meta.url);
const contrats = {
  "notion": "notion",
  "microskill": "micro-skill",
  "skill": "skill",
  "relation": "relation",
  "curriculum": "curriculum",
  "stage": "stage",
  "domain": "domain",
  "curriculum-mapping": "curriculum-mapping"
};
const fichiers = ["primitives", ...Object.values(contrats)];

export async function chargerSchemasReferentiel() {
  const ajv = new Ajv2020({ allErrors: true });
  const documents = await Promise.all(fichiers.map(async (nom) =>
    JSON.parse(await readFile(new URL(nom + ".schema.json", schemas), "utf8"))));
  for (const document of documents) ajv.addSchema(document);
  return new Map(Object.entries(contrats).map(([contrat, nom]) =>
    [contrat, ajv.getSchema(new URL(nom + ".schema.json", "https://schemas.kermiclab.online/s4/").href)]));
}

const reglesParChamp = new Map(Object.entries({
  id: "S4-ID",
  status: "S4-STATUT",
  version: "S4-VERSION",
  provenance: "S4-PROVENANCE",
  evidence: "S4-EVIDENCE",
  source: "S4-REFERENCE-FORMAT",
  target: "S4-REFERENCE-FORMAT",
  object: "S4-REFERENCE-FORMAT",
  curriculum: "S4-REFERENCE-FORMAT",
  stage: "S4-REFERENCE-FORMAT",
  domain: "S4-REFERENCE-FORMAT",
  replacedBy: "S4-REFERENCE-FORMAT",
  rationale: "S4-RELATION-RATIONALE",
  stageType: "S4-STAGE-TYPE",
  code: "S4-STAGE-CODE",
  jurisdiction: "S4-JURIDICTION",
  curriculumVersion: "S4-CURRICULUM-VERSION",
  role: "S4-MAPPING-ROLE"
}));

function regleErreur(erreur, objet) {
  const { keyword, instancePath, params } = erreur;
  const champ = instancePath.split("/")[1] ?? params.missingProperty;
  if (champ === "provenance" || champ === "evidence") return reglesParChamp.get(champ);
  if (keyword === "additionalProperties") return "S4-SCHEMA-CHAMP";
  if (keyword === "required" && champ !== "rationale") return "S4-SCHEMA-REQUIS";
  if (champ === "status" && Object.hasOwn(objet, "replacedBy") &&
      erreur.schemaPath.endsWith("/then/properties/status/const")) return "S4-REMPLACEMENT-STATUT";
  return reglesParChamp.get(champ) ?? "S4-SCHEMA-FORME";
}

export function erreursStructure(validateur, objet) {
  if (validateur(objet)) return [];
  return validateur.errors
    .filter(({ keyword }) => keyword !== "if")
    .map((erreur) => ({
      rule: regleErreur(erreur, objet),
      severity: "ERROR",
      location: erreur.instancePath,
      message: erreur.message
    }));
}
