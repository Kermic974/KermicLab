#!/usr/bin/env node
// Sources ouvertes de l'Éducation nationale (ADR 0044).
//   node scripts/sources-ouvertes.mjs importer  → télécharge les jeux, écrit les instantanés, régénère le rapport (réseau)
//   node scripts/sources-ouvertes.mjs rapport   → régénère le rapport hors ligne
// La CI ne lance jamais l'import : elle vérifie le rapport à partir des instantanés versionnés.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lireFrontMatter, liste } from "./lib/fiche-catalogue.mjs";
import {
  JEUX_PROGRAMMES, LICENCE, NIVEAUX_EVALUATIONS, jeuEvaluations, normaliserEvaluations, normaliserProgrammes,
  rapportMarkdown, rattacherProgrammes, urlExport, urlJeu, verifierCorrespondances
} from "./lib/sources-ouvertes.mjs";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DOSSIER = path.join(racine, "referentiel", "sources-ouvertes");
export const RAPPORT = path.join(racine, "docs", "referentiel", "sources-ouvertes.md");

/** Fiches du catalogue public : { id, titre, sujet, niveaux }. */
export async function lireFiches(dossier = path.join(racine, "catalogue")) {
  const fiches = [];
  for (const nom of (await readdir(dossier, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    let texte;
    try { texte = await readFile(path.join(dossier, nom, "fiche.md"), "utf8"); } catch { continue; }
    const f = lireFrontMatter(texte);
    fiches.push({ id: String(f.id ?? nom), titre: String(f.titre ?? ""), sujet: String(f.sujet ?? ""), niveaux: liste(f.niveaux) });
  }
  return fiches;
}

const lireJson = async (nom) => JSON.parse(await readFile(path.join(DOSSIER, nom), "utf8"));

/** Construit le rapport à partir des instantanés, de la table de correspondance et du catalogue ; lève si la table est fausse. */
export async function construireRapport() {
  const [{ evaluations }, { programmes }, table, fiches] = await Promise.all([
    lireJson("evaluations-nationales.json"), lireJson("programmes.json"), lireJson("correspondances-evaluations.json"), lireFiches()
  ]);
  const erreurs = verifierCorrespondances(table, evaluations, new Set(fiches.map((f) => f.id)));
  if (erreurs.length) throw new Error(erreurs.join("\n"));
  return rapportMarkdown({
    evaluations, programmes, table,
    rattachements: rattacherProgrammes(fiches, programmes),
    titres: new Map(fiches.map((f) => [f.id, f.titre]))
  });
}

async function telecharger(jeu) {
  const reponse = await fetch(urlExport(jeu), { headers: { "user-agent": "kermiclab-sources-ouvertes" } });
  if (!reponse.ok) throw new Error(`${jeu} : HTTP ${reponse.status}`);
  return reponse.json();
}

async function importer() {
  const extraitLe = new Date().toISOString().slice(0, 10);
  const parNiveau = {};
  for (const niveau of NIVEAUX_EVALUATIONS) parNiveau[niveau] = await telecharger(jeuEvaluations(niveau));
  const lignesProgrammes = [];
  for (const jeu of JEUX_PROGRAMMES) lignesProgrammes.push(...await telecharger(jeu));
  const provenance = (jeux) => ({ licence: LICENCE, extrait_le: extraitLe, jeux: jeux.map((id) => ({ id, url: urlJeu(id) })) });
  await mkdir(DOSSIER, { recursive: true });
  const ecrire = (nom, objet) => writeFile(path.join(DOSSIER, nom), `${JSON.stringify(objet, null, 2)}\n`);
  await ecrire("evaluations-nationales.json", {
    source: provenance(NIVEAUX_EVALUATIONS.map(jeuEvaluations)), evaluations: normaliserEvaluations(parNiveau)
  });
  await ecrire("programmes.json", { source: provenance(JEUX_PROGRAMMES), programmes: normaliserProgrammes(lignesProgrammes) });
  console.log(`Instantanés écrits dans ${path.relative(racine, DOSSIER)} (extraits le ${extraitLe}).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const commande = process.argv[2];
  if (!["importer", "rapport"].includes(commande)) {
    console.error("Usage : node scripts/sources-ouvertes.mjs importer|rapport");
    process.exit(2);
  }
  if (commande === "importer") await importer();
  await writeFile(RAPPORT, await construireRapport());
  console.log(`Rapport écrit : ${path.relative(racine, RAPPORT)}`);
}
