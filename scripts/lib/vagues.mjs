// Vagues de métiers ONISEP (chantier Métiers, vagues complémentaires). Module pur et déterministe : il prépare le
// squelette d'une vague à partir de l'extrait ONISEP versionné, le vérifie une fois les gestes rédigés, puis le
// fusionne dans `referentiel/metiers-v0.json`. Aucun texte descriptif de l'ONISEP n'est repris (ADR 0042 §3) : seuls
// identifiants et classifications viennent de l'extrait, les gestes et le contexte sont rédigés par KermicLab.
// Testé par tests/unit/vagues.test.mjs.

import { appliquerRattachements, fichesDeLExtrait, proposerDisciplines, rapprocher, sansAccents, slugMetier } from "./onisep.mjs";

export const VERSION_VAGUE = 1;
export const GESTES_PAR_METIER = 3;

/**
 * Famille de l'Espace Métiers d'un domaine ONISEP (« domaine/sous-domaine »). Le sous-domaine prime quand il est
 * listé (sport et travail social rejoignent les services, pas la santé).
 */
export const FAMILLES = Object.freeze({
  "agriculture, animaux": "nature",
  "armee, securite": "services",
  "arts, culture, artisanat": "craft",
  "banque, assurances, immobilier": "trade",
  "commerce, marketing, vente": "trade",
  "construction, architecture, travaux publics": "btp",
  "economie, droit, politique": "services",
  "electricite, electronique, robotique": "btp",
  "environnement, energies, proprete": "nature",
  "gestion des entreprises, comptabilite": "trade",
  "histoire-geographie, psychologie, sociologie": "disc",
  "hotellerie-restauration, tourisme": "services",
  "information-communication, audiovisuel": "mkt",
  "informatique, internet": "app",
  "lettres, langues, enseignement": "services",
  "logistique, transport": "btp",
  "matieres premieres, fabrication, industries": "btp",
  "mecanique": "btp",
  "sante, social, sport": "health",
  "sante, social, sport/sport": "services",
  "sante, social, sport/travail social": "services",
  "sciences": "disc"
});

const cle = (s) => sansAccents(s).replace(/\s+/g, " ").trim();
/** Premier niveau (domaine) d'une valeur « domaine/sous-domaine », normalisé. */
export const domaineDe = (valeur) => cle(String(valeur ?? "").split("/")[0]);

export function familleDe(fiche, familles = FAMILLES) {
  const premier = fiche.domaines?.[0] ?? "";
  return familles[cle(premier)] ?? familles[domaineDe(premier)] ?? "disc";
}

const majuscule = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Nom affiché d'une fiche, à partir des formes masculine et féminine que l'extrait range parmi les synonymes (formes
 * sans « / » dont le slug est celui de l'intitulé). La fin commune n'est écrite qu'une fois : « Boulanger, boulangère »,
 * « Moniteur, monitrice d'escalade ». Sans forme féminine distincte : l'intitulé sans écriture inclusive.
 */
export function nomAffiche(fiche) {
  const formes = (fiche.synonymes ?? []).filter((s) => !s.includes("/"));
  const i = formes.findIndex((s) => slugMetier(s) === fiche.slug);
  if (i < 0) return majuscule(String(fiche.nom).replace(/\s*\/\s*[^\s/]+/g, "").replace(/\s+/g, " ").trim());
  const masculin = formes[i].split(" ");
  const feminin = (formes[i + 1] ?? "").split(" ");
  if (feminin.length !== masculin.length || cle(feminin.join(" ")) === cle(masculin.join(" "))) return majuscule(masculin.join(" "));
  let commun = 0;
  while (commun < masculin.length - 1 && masculin.at(-1 - commun) === feminin.at(-1 - commun)) commun++;
  const fin = masculin.slice(masculin.length - commun).join(" ");
  const debut = (mots) => mots.slice(0, mots.length - commun).join(" ");
  return `${majuscule(debut(masculin))}, ${debut(feminin)}${fin ? ` ${fin}` : ""}`;
}

/**
 * Disciplines proposées, de la règle la plus précise à la plus générale : règle ROME précise (préfixe de trois
 * caractères ou plus), puis repli par domaine ONISEP (sous-domaine d'abord, `regles.domaines`), puis règle ROME par
 * grand domaine (lettre seule), souvent trop large pour les métiers transverses.
 */
export function disciplinesDe(fiche, regles) {
  const max = regles.maxDisciplines ?? 3;
  const precises = proposerDisciplines(fiche.rome, { ...regles, regles: (regles.regles ?? []).filter((r) => r.prefixe.length > 1) });
  if (precises.length) return precises;
  const premier = fiche.domaines?.[0] ?? "";
  const repli = (regles.domaines ?? []).find((d) => cle(d.domaine) === cle(premier))
    ?? (regles.domaines ?? []).find((d) => cle(d.domaine) === domaineDe(premier));
  if (repli) return repli.disciplines.slice(0, max);
  return proposerDisciplines(fiche.rome, regles);
}

const numero = (id) => Number(String(id ?? "").replace(/\D/g, "")) || 0;

/**
 * Squelette d'une vague : les fiches candidates (non rattachées au référentiel) dont le premier domaine figure dans
 * `domaines`, triées par identifiant ONISEP, avec slug unique, nom affiché, famille et disciplines proposées. Les
 * gestes et le contexte restent à rédiger.
 */
export function genererVague(extrait, donnees, regles, { domaines, numero: n }) {
  const voulus = new Set(domaines.map(cle));
  const { candidats } = rapprocher(fichesDeLExtrait(extrait), donnees.metiers);
  return {
    version: VERSION_VAGUE,
    vague: n,
    domaines,
    source: `${extrait.source} (${extrait.date}), licence ${extrait.licence.split(" (")[0]}`,
    metiers: candidats.filter((f) => voulus.has(domaineDe(f.domaines?.[0])))
      .sort((a, b) => numero(a.onisep) - numero(b.onisep))
      .map((f) => ({ onisep: f.onisep, id: f.slug, nom: nomAffiche(f), categorie: familleDe(f), disciplines: disciplinesDe(f, regles), gestes: [], contexte: "" }))
  };
}

/**
 * Erreurs d'une vague prête à fusionner : chaque métier retenu a `GESTES_PAR_METIER` gestes et un contexte, des
 * disciplines et une famille connues, un identifiant et une fiche ONISEP libres. Un métier écarté porte `exclu` (raison).
 */
export function verifierVague(vague, donnees) {
  const erreurs = [];
  if (vague?.version !== VERSION_VAGUE) erreurs.push("version de vague inconnue");
  const disciplines = new Set(donnees.disciplines.map((d) => d.id));
  const categories = new Set(donnees.categories.map((c) => c.id));
  const ids = new Set(donnees.metiers.map((m) => m.id));
  const onisep = new Set(donnees.metiers.map((m) => m.onisep).filter(Boolean));
  for (const m of vague?.metiers ?? []) {
    if (m.exclu !== undefined) { if (!String(m.exclu).trim()) erreurs.push(`${m.id} : raison d'exclusion vide`); continue; }
    if (ids.has(m.id)) erreurs.push(`${m.id} : identifiant déjà utilisé`);
    ids.add(m.id);
    if (onisep.has(m.onisep)) erreurs.push(`${m.id} : fiche ${m.onisep} déjà rattachée`);
    onisep.add(m.onisep);
    if ((m.gestes ?? []).filter((g) => String(g).trim()).length !== GESTES_PAR_METIER) erreurs.push(`${m.id} : ${GESTES_PAR_METIER} gestes attendus`);
    if (!String(m.contexte ?? "").trim()) erreurs.push(`${m.id} : contexte à rédiger`);
    if (!categories.has(m.categorie)) erreurs.push(`${m.id} : famille inconnue ${m.categorie}`);
    if (!m.disciplines?.length) erreurs.push(`${m.id} : aucune discipline`);
    for (const d of m.disciplines ?? []) if (!disciplines.has(d)) erreurs.push(`${m.id} : discipline inconnue ${d}`);
  }
  return erreurs;
}

const mots = (s) => cle(s).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
/**
 * Garde anti-recopie : textes rédigés (gestes, contexte) qui reprennent une suite de `taille` mots d'un texte de
 * l'extrait ONISEP (intitulés, synonymes, domaines). Les textes descriptifs ne sont pas versionnés : la relecture
 * humaine reste la garde principale.
 */
export function reprisesOnisep(vague, extrait, taille = 8) {
  const suites = new Set();
  for (const f of extrait.fiches) for (const t of [f.nom, ...(f.synonymes ?? []), ...(f.domaines ?? [])]) {
    const m = mots(t);
    for (let i = 0; i + taille <= m.length; i++) suites.add(m.slice(i, i + taille).join(" "));
  }
  const reprises = [];
  for (const metier of vague.metiers ?? []) for (const texte of [...(metier.gestes ?? []), metier.contexte ?? ""]) {
    const m = mots(texte);
    for (let i = 0; i + taille <= m.length; i++) if (suites.has(m.slice(i, i + taille).join(" "))) { reprises.push({ metier: metier.id, texte }); break; }
  }
  return reprises;
}

/**
 * Fusion d'une vague vérifiée : les métiers retenus entrent en « proposition » avec leur identifiant ONISEP, puis
 * reçoivent niveau, codes ROME, domaines et synonymes de l'extrait (sans rien écraser du référentiel).
 */
export function fusionnerVague(donnees, vague, extrait) {
  const retenus = vague.metiers.filter((m) => m.exclu === undefined);
  const ajoutes = retenus.map((m) => ({ id: m.id, nom: m.nom, categorie: m.categorie, disciplines: m.disciplines, gestes: m.gestes, contexte: m.contexte, correspondance: "proposition", onisep: m.onisep }));
  const parId = new Map(fichesDeLExtrait(extrait).map((f) => [f.onisep, f]));
  const rattachements = retenus.map((m) => ({ ...parId.get(m.onisep), metier: m.id })).filter((r) => r.onisep);
  const { conflits, ...applique } = appliquerRattachements({ ...donnees, metiers: [...donnees.metiers, ...ajoutes] }, rattachements);
  return { donnees: applique, ajoutes: ajoutes.length, exclus: vague.metiers.length - retenus.length, conflits };
}

/** Domaines ONISEP (premier niveau) des fiches encore candidates, avec leur nombre : aide au découpage des vagues. */
export function domainesRestants(extrait, donnees) {
  const { candidats } = rapprocher(fichesDeLExtrait(extrait), donnees.metiers);
  const compte = new Map();
  for (const f of candidats) {
    const d = String(f.domaines?.[0] ?? "sans domaine").split("/")[0];
    compte.set(d, (compte.get(d) ?? 0) + 1);
  }
  return [...compte].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
}


