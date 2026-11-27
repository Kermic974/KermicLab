// Vagues complémentaires de métiers ONISEP (chantier Métiers). Sans réseau : lit l'extrait versionné.
//
//   npm run vague:metiers -- --restants                             domaines encore candidats et leur nombre
//   npm run vague:metiers -- --numero 2 --domaines "santé, social, sport"
//        écrit referentiel/vagues/vague-02.json (squelette : gestes et contexte à rédiger ; --ecraser pour remplacer)
//   npm run vague:metiers -- --verifier referentiel/vagues/vague-02.json
//   npm run vague:metiers -- --appliquer referentiel/vagues/vague-02.json
//        vérifie puis fusionne dans referentiel/metiers-v0.json (métiers en « proposition »)
//
// Plusieurs domaines se séparent par « ; ». Codes de sortie : 0 succès, 1 vague invalide, 2 invocation invalide.
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { domainesRestants, fusionnerVague, genererVague, reprisesOnisep, verifierVague } from "./lib/vagues.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXTRAIT = "referentiel/sources/onisep/ideo-metiers-2026-11-24.json";
const args = process.argv.slice(2);
const option = (nom) => { const i = args.indexOf(nom); return i < 0 ? undefined : args.splice(i, 2)[1]; };
const drapeau = (nom) => { const i = args.indexOf(nom); if (i >= 0) args.splice(i, 1); return i >= 0; };
const lire = async (f) => JSON.parse(await readFile(join(racine, f), "utf8"));
const ecrire = (f, objet) => writeFile(join(racine, f), `${JSON.stringify(objet, null, 2)}\n`);

const restants = drapeau("--restants");
const ecraser = drapeau("--ecraser");
const n = option("--numero");
const domaines = option("--domaines");
const aVerifier = option("--verifier");
const aAppliquer = option("--appliquer");
const usage = () => {
  console.error("Usage : vague-metiers.mjs --restants | --numero N --domaines \"d1 ; d2\" [--ecraser] | --verifier <vague> | --appliquer <vague>");
  process.exit(2);
};
if (args.length || [restants, n !== undefined, aVerifier, aAppliquer].filter(Boolean).length !== 1) usage();

const [extrait, donnees, regles] = await Promise.all([lire(EXTRAIT), lire("referentiel/metiers-v0.json"), lire("referentiel/regles-metiers.json")]);

if (restants) {
  const liste = domainesRestants(extrait, donnees);
  for (const [d, nb] of liste) console.log(`${String(nb).padStart(4)}  ${d}`);
  console.log(`${liste.reduce((s, [, nb]) => s + nb, 0)} fiche(s) candidate(s).`);
} else if (n !== undefined) {
  if (!/^\d+$/.test(n) || !domaines?.trim()) usage();
  const sortie = `referentiel/vagues/vague-${n.padStart(2, "0")}.json`;
  const existe = await access(join(racine, sortie)).then(() => true, () => false);
  if (existe && !ecraser) { console.error(`${sortie} existe déjà (--ecraser pour le remplacer).`); process.exit(1); }
  const vague = genererVague(extrait, donnees, regles, { domaines: domaines.split(";").map((d) => d.trim()).filter(Boolean), numero: Number(n) });
  await mkdir(join(racine, "referentiel/vagues"), { recursive: true });
  await ecrire(sortie, vague);
  console.log(`${sortie} : ${vague.metiers.length} métier(s) à rédiger (gestes, contexte), disciplines et familles proposées à vérifier.`);
} else {
  const chemin = aVerifier ?? aAppliquer;
  const vague = await lire(chemin);
  const erreurs = verifierVague(vague, donnees);
  const reprises = reprisesOnisep(vague, extrait);
  for (const r of reprises) erreurs.push(`${r.metier} : texte repris de l'ONISEP (« ${r.texte} »)`);
  if (erreurs.length) {
    console.error(`${chemin} : ${erreurs.length} erreur(s)\n- ${erreurs.join("\n- ")}`);
    process.exit(1);
  }
  if (aVerifier) console.log(`${chemin} : vague valide (${vague.metiers.length} métier(s)).`);
  else {
    const resultat = fusionnerVague(donnees, vague, extrait);
    resultat.donnees.source = `${resultat.donnees.source} Vague ${vague.vague} (${vague.domaines.join(" ; ")}) : ${resultat.ajoutes} métier(s) ONISEP en « proposition ».`;
    await ecrire("referentiel/metiers-v0.json", resultat.donnees);
    console.log(`Vague ${vague.vague} fusionnée : ${resultat.ajoutes} métier(s) ajouté(s), ${resultat.exclus} écarté(s)${resultat.conflits.length ? `, ${resultat.conflits.length} conflit(s)` : ""}.`);
  }
}
