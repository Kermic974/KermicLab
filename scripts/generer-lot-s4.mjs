import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { lireFrontMatter, lireReferentiel } from "./lib/fiche-catalogue.mjs";
import { chargerSchemasReferentiel, erreursStructure } from "./lib/referentiel-structure.mjs";
import { projeterFiches } from "./lib/referentiel-projection.mjs";
import { lireHistorique } from "./lib/referentiel-historique.mjs";
import { typesRelation, verifierIntegrite } from "./lib/referentiel-integrite.mjs";

const champs = ["prerequis", "niveaux", "competences"];
const lire = async fichier => JSON.parse(await readFile(fichier, "utf8"));
const json = v => JSON.stringify(v, null, 2) + "\n";
const dictionnaire = v => v !== null && typeof v === "object" && !Array.isArray(v);
function exiger(ok, message) {
  if (!ok) throw new Error(message);
}

function fusionner(avant, ajouts, nom) {
  exiger(dictionnaire(ajouts), nom + " : dictionnaire requis.");
  const resultat = { ...avant };
  for (const [cle, valeur] of Object.entries(ajouts).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    exiger(!["__proto__", "constructor", "prototype"].includes(cle), nom + " : clé réservée.");
    exiger(!Object.hasOwn(resultat, cle) || isDeepStrictEqual(resultat[cle], valeur), nom + " : conflit pour " + cle);
    resultat[cle] = valeur;
  }
  return resultat;
}

export async function preparerLotS4(racine, proposition, historiqueDe = lireHistorique) {
  const dossier = join(racine, "referentiel");
  const [inventaire, config, schemas, historique] = await Promise.all([
    lire(join(dossier, "inventaire-v0.5.json")), lire(join(dossier, "projection-v0.json")),
    chargerSchemasReferentiel(), historiqueDe(racine)
  ]);
  const { discipline, objets, projection, journal } = proposition ?? {};
  const fichesInventaire = inventaire.disciplines[discipline];
  exiger(Array.isArray(fichesInventaire) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(discipline), "Discipline hors inventaire.");
  exiger(Array.isArray(objets) && objets.length && dictionnaire(projection) && dictionnaire(journal), "Objets, projection et journal requis.");
  exiger(dictionnaire(projection.fiches) && Object.keys(projection.fiches).length, "Le lot doit déclarer ses fiches.");
  const sortie = new Map();
  const fichiers = (await readdir(join(dossier, "objets"), { recursive: true, withFileTypes: true }))
    .filter(e => e.isFile() && e.name.endsWith(".json")).map(e => join(e.parentPath, e.name)).sort();
  const catalogue = new Map();
  for (const fichier of fichiers) {
    const objet = await lire(fichier);
    exiger(!catalogue.has(objet.id), "ID existant dupliqué : " + objet.id);
    catalogue.set(objet.id, objet);
  }
  const ids = new Set();
  for (const objet of objets) {
    const type = typesRelation.has(objet?.type) ? "relation" : objet?.type;
    const schema = schemas.get(type);
    exiger(schema, "Contrat inconnu : " + objet?.type);
    const erreurs = erreursStructure(schema, objet);
    exiger(!erreurs.length, objet?.id + " : " + erreurs.map(e => e.rule).join(", "));
    exiger(objet.status === "draft" && objet.version === 1 && objet.provenance, objet.id + " : brouillon v1 et provenance requis.");
    exiger(objet.id.split(".")[1] === discipline, objet.id + " : namespace disciplinaire incompatible.");
    exiger(!ids.has(objet.id), "Objet en double : " + objet.id);
    ids.add(objet.id);
    if (catalogue.has(objet.id)) {
      exiger(isDeepStrictEqual(catalogue.get(objet.id), objet), "Objet existant à réviser hors générateur : " + objet.id);
    } else {
      catalogue.set(objet.id, objet);
      sortie.set(join(dossier, "objets", "v0.5", discipline, objet.id + ".json"), json(objet));
    }
  }
  const fusion = { ...config };
  for (const table of ["notions", "competences", "fiches"]) fusion[table] = fusionner(config[table], projection[table], table);
  const corpus = [...catalogue.values()];
  const diagnostics = [];
  verifierIntegrite(corpus.map(objet => ({ objet })), historique, (entree, rule, message, severity = "ERROR") =>
    diagnostics.push({ id: entree.objet.id, rule, severity, message }));
  const erreurs = diagnostics.filter(d => d.severity === "ERROR");
  exiger(!erreurs.length, erreurs.map(e => e.rule + " " + e.id + " : " + e.message).join("\n"));
  const projections = projeterFiches(fusion, corpus);
  const slugs = Object.keys(projection.fiches).sort();
  const lignes = [];
  const actives = corpus.filter(o => o.status !== "deprecated");
  const slugsParId = new Map(Object.entries(fusion.notions).map(([slug, id]) => [id, slug]));
  for (const slug of slugs) {
    exiger(fichesInventaire.includes(slug), slug + " : fiche hors du lot.");
    const note = journal[slug];
    exiger(typeof note === "string" && note.trim(), slug + " : trace source et justification requises.");
    const fiche = lireFrontMatter(await readFile(join(racine, "catalogue", slug, "fiche.md"), "utf8"));
    exiger(fiche.id === slug && fiche.sujet.split("/")[0] === discipline, slug + " : identité de fiche incohérente.");
    const attendu = projections.get(slug);
    exiger(attendu?.niveaux?.length && attendu.competences?.length, slug + " : niveau et compétence requis.");
    const avant = lireReferentiel(fiche);
    for (const champ of champs) {
      exiger(!Object.hasOwn(avant, champ) || isDeepStrictEqual(avant[champ], attendu[champ]), slug + " : valeur V0 existante modifiée (" + champ + ").");
    }
    const id = fusion.notions[slug];
    for (const o of actives) {
      if (o.type !== "requires" || o.source !== id || !ids.has(o.id)) continue;
      const cible = slugsParId.get(o.target);
      exiger(avant.prerequis?.includes(cible) || o.rationale, o.id + " : justification requise pour un nouveau prérequis.");
    }
    const liens = actives.filter(o => o.source === id && o.type === "teaches");
    for (const lien of liens) {
      exiger(actives.some(o => o.source === lien.target && o.type === "contributesTo"), lien.target + " : Skill étayée manquante.");
    }
    const placements = actives.filter(o => o.type === "curriculum-mapping" && o.object === id && o.curriculum === fusion.curriculum);
    for (const o of placements) {
      const role = catalogue.get(o.stage)?.code === attendu.niveaux[0] ? "introduced" : "reinforced";
      exiger(o.role === role, o.id + " : rôle attendu " + role);
    }
    lignes.push({ fiche: slug, notion: id, avant: Object.fromEntries(champs.filter(c => Object.hasOwn(avant, c)).map(c => [c, avant[c]])), apres: attendu, justification: note });
  }
  if (!isDeepStrictEqual(config, fusion)) sortie.set(join(dossier, "projection-v0.json"), json(fusion));
  const rapport = { discipline, fiches: lignes, objetsProposes: [...ids].sort(), warnings: diagnostics.filter(d => d.severity === "WARNING") };
  return { sortie, rapport };
}

async function principal() {
  const [fichier, mode, ...reste] = process.argv.slice(2);
  if (!fichier || !["--check", "--write"].includes(mode) || reste.length) {
    throw new Error("Usage : node scripts/generer-lot-s4.mjs <proposition.json> --check|--write");
  }
  const { sortie, rapport } = await preparerLotS4(process.cwd(), await lire(resolve(fichier)));
  if (mode === "--write") {
    for (const [destination, contenu] of sortie) {
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, contenu, "utf8");
    }
  }
  console.log(json({ ...rapport, fichiersAGenerer: sortie.size }).trimEnd());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await principal(); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
