// Sources de données ouvertes de l'Éducation nationale (ADR 0044) : fonctions pures, sans réseau.
// L'import (réseau) est dans scripts/sources-ouvertes.mjs ; la CI ne lit que les instantanés versionnés.

export const PORTAIL = "https://data.education.gouv.fr";
export const LICENCE = "Licence Ouverte v2.0 (Etalab)";

/** Niveaux des évaluations Repères retenus, dans l'ordre scolaire, et leur jeu régional (qui porte la ligne NATIONAL). */
export const NIVEAUX_EVALUATIONS = ["CP", "CE1", "CE2", "CM1", "CM2"];
export const jeuEvaluations = (niveau) => `fr-en-evaluations_nationales_${niveau.toLowerCase()}_region`;
export const JEUX_PROGRAMMES = ["fr-en-programmes-enseignement-premier-degre", "fr-en-programmes-enseignement-2nd-degre"];
export const urlExport = (jeu) => `${PORTAIL}/api/explore/v2.1/catalog/datasets/${jeu}/exports/json`;
export const urlJeu = (jeu) => `${PORTAIL}/explore/dataset/${jeu}/`;

const texte = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const compareFr = (a, b) => a.localeCompare(b, "fr");

/**
 * Taux de maîtrise nationaux : pour chaque niveau, la dernière année publiée, ligne « NATIONAL », population « Ensemble ».
 * `lignesParNiveau` associe un niveau (CP…CM2) aux lignes brutes de son jeu régional.
 */
export function normaliserEvaluations(lignesParNiveau) {
  const sortie = [];
  for (const niveau of NIVEAUX_EVALUATIONS) {
    const lignes = (lignesParNiveau[niveau] ?? []).filter((l) =>
      texte(l.libelle_region_academique ?? l.region).toUpperCase() === "NATIONAL" &&
      texte(l.caracteristique ?? l.categorie) === "Ensemble" && Number.isFinite(Number(l.taux_de_maitrise)));
    if (!lignes.length) throw new Error(`évaluations ${niveau} : aucune ligne NATIONAL / Ensemble`);
    const annee = lignes.map((l) => texte(l.annee).slice(0, 4)).sort().at(-1);
    const vues = new Set();
    for (const l of lignes.filter((x) => texte(x.annee).slice(0, 4) === annee)) {
      const competence = texte(l.competence ?? l.domaine);
      const cle = `${texte(l.discipline)}|${competence}`;
      if (vues.has(cle)) throw new Error(`évaluations ${niveau} ${annee} : compétence en double « ${competence} »`);
      vues.add(cle);
      sortie.push({ niveau, annee, discipline: texte(l.discipline), competence, taux: Math.round(Number(l.taux_de_maitrise) * 10) / 10 });
    }
  }
  const rang = (n) => NIVEAUX_EVALUATIONS.indexOf(n);
  return sortie.sort((a, b) => rang(a.niveau) - rang(b.niveau) || compareFr(a.discipline, b.discipline) || compareFr(a.competence, b.competence));
}

/** Niveau d'enseignement du jeu DGESCO → niveau KermicLab (`niveaux` des fiches). Les autres niveaux sont ignorés. */
const NIVEAUX_PROGRAMMES = new Map([
  ["cycle 1", "cycle-1"], ["cycle 2", "cycle-2"], ["cycle 3", "cycle-3"], ["cycle 4", "cycle-4"],
  ["seconde générale et technologique", "seconde"], ["première générale", "premiere"], ["terminale générale", "terminale"]
]);
const VOIES_RETENUES = new Set(["", "-", "générale", "générale et technologique"]);
const ORDRE_NIVEAUX = ["cycle-1", "cycle-2", "cycle-3", "cycle-4", "seconde", "premiere", "terminale"];

/** Programmes en vigueur (« abrogé » vide ou « - ») de l'école, du collège et du lycée général et technologique. */
export function normaliserProgrammes(lignes) {
  const vus = new Set();
  const sortie = [];
  for (const l of lignes) {
    const abroge = texte(l.abroge_a_la_rentree);
    if (abroge && abroge !== "-" && abroge.toLowerCase() !== "none") continue;
    if (!VOIES_RETENUES.has(texte(l.voie).toLowerCase())) continue;
    const niveau = NIVEAUX_PROGRAMMES.get(texte(l.niveau_d_enseignement).toLowerCase());
    if (!niveau) continue;
    const discipline = texte(l.discipline) === "-" ? "" : texte(l.discipline);
    const programme = {
      niveau, discipline, descriptif: texte(l.descriptif), texte: texte(l.texte_officiel),
      lien: texte(l.lien_vers_le_texte_officiel), contenu: texte(l.contenu_sur_le_site),
      rentree: texte(l.entre_en_vigueur_a_la_rentree).slice(0, 4)
    };
    const cle = `${niveau}|${discipline}|${programme.texte}|${programme.contenu}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    sortie.push(programme);
  }
  return sortie.sort((a, b) => ORDRE_NIVEAUX.indexOf(a.niveau) - ORDRE_NIVEAUX.indexOf(b.niveau) ||
    compareFr(a.discipline, b.discipline) || compareFr(a.contenu, b.contenu));
}

/**
 * Matière d'une fiche → disciplines du jeu DGESCO au lycée. Une règle `prefixe` (identifiant de fiche) l'emporte sur la
 * matière. Au primaire et au collège, le texte du cycle (discipline vide) couvre toutes les matières.
 */
export const DISCIPLINES_LYCEE = [
  { prefixe: "snt-", disciplines: ["Sciences numériques et technologie"] },
  { prefixe: "nsi-", disciplines: ["Numérique et sciences informatiques"] },
  { prefixe: "si-", disciplines: ["Sciences de l'ingénieur"] },
  { prefixe: "hggsp-", disciplines: ["Histoire-géographie, géopolitique et sciences politiques"] },
  { prefixe: "hlp-", disciplines: ["Humanités, littérature et philosophie"] },
  { matiere: "mathematiques", disciplines: ["Mathématiques", "Mathématiques complémentaires", "Mathématiques expertes"] },
  { matiere: "francais", disciplines: ["Français"] },
  { matiere: "physique-chimie", disciplines: ["Physique-chimie", "Enseignement scientifique"] },
  { matiere: "svt", disciplines: ["Sciences de la vie et de la Terre", "Enseignement scientifique"] },
  { matiere: "histoire", disciplines: ["Histoire-géographie"] },
  { matiere: "geographie", disciplines: ["Histoire-géographie"] },
  { matiere: "emc", disciplines: ["Enseignement moral et civique"] },
  { matiere: "ses", disciplines: ["Sciences économiques et sociales"] },
  { matiere: "philosophie", disciplines: ["Philosophie"] },
  { matiere: "anglais", disciplines: ["Langues vivantes", "Langues, littératures et cultures étrangères et régionales - anglais"] },
  { matiere: "eps", disciplines: ["Éducation physique et sportive"] },
  { matiere: "musique", disciplines: ["Enseignement optionnel d'arts", "Enseignement optionnel d'arts (musique)", "Enseignement de spécialité d'arts (musique)"] },
  { matiere: "arts-plastiques", disciplines: ["Enseignement optionnel d'arts", "Enseignement optionnel d'arts (Arts plastiques, Cinéma-audiovisuel, Danse, Histoire des arts, Théâtre)", "Enseignement de spécialité d'arts"] },
  { matiere: "technologie", disciplines: ["Sciences numériques et technologie", "Enseignement optionnel de sciences de l'ingénieur", "Enseignement optionnel de création et innovation technologiques"] }
];

const LYCEE = new Set(["seconde", "premiere", "terminale"]);

/**
 * Rattache chaque fiche ({ id, sujet, niveaux }) aux programmes en vigueur. Les jeux (matière `jeux`) sont ignorés.
 * Retourne [{ id, matiere, niveaux, textes: [{ niveau, discipline, texte, lien, contenu, rentree }] }] trié par id.
 */
export function rattacherProgrammes(fiches, programmes, regles = DISCIPLINES_LYCEE) {
  const sortie = [];
  for (const f of fiches) {
    const matiere = String(f.sujet ?? "").split("/")[0];
    if (!matiere || matiere === "jeux") continue;
    const regle = regles.find((r) => r.prefixe && f.id.startsWith(r.prefixe)) ?? regles.find((r) => r.matiere === matiere);
    const textes = [];
    for (const niveau of f.niveaux ?? []) {
      const candidats = LYCEE.has(niveau)
        ? programmes.filter((p) => p.niveau === niveau && (regle?.disciplines ?? []).includes(p.discipline))
        : programmes.filter((p) => p.niveau === niveau && p.discipline === "");
      for (const p of candidats) if (!textes.includes(p)) textes.push(p);
    }
    sortie.push({ id: f.id, matiere, niveaux: [...(f.niveaux ?? [])], textes });
  }
  return sortie.sort((a, b) => compareFr(a.id, b.id));
}

/** Contrôle de la table de correspondance : compétences présentes dans l'instantané, notions présentes au catalogue. */
export function verifierCorrespondances(table, evaluations, idsCatalogue) {
  const erreurs = [];
  if (!table || !Array.isArray(table.correspondances)) return ["correspondances : tableau `correspondances` attendu"];
  if (!Number.isFinite(table.seuil) || table.seuil <= 0 || table.seuil > 100) erreurs.push("correspondances : `seuil` entre 0 et 100 attendu");
  const connues = new Set(evaluations.map((e) => `${e.niveau}|${e.competence}`));
  const vues = new Set();
  for (const c of table.correspondances) {
    const cle = `${c.niveau}|${c.competence}`;
    if (!connues.has(cle)) erreurs.push(`correspondances : compétence inconnue ${c.niveau} « ${c.competence} »`);
    if (vues.has(cle)) erreurs.push(`correspondances : compétence en double ${c.niveau} « ${c.competence} »`);
    vues.add(cle);
    if (!Array.isArray(c.notions)) { erreurs.push(`correspondances : notions manquantes pour ${cle}`); continue; }
    for (const n of c.notions) if (!idsCatalogue.has(n)) erreurs.push(`correspondances : notion inconnue ${n} (${cle})`);
    if (new Set(c.notions).size !== c.notions.length) erreurs.push(`correspondances : notion en double pour ${cle}`);
  }
  for (const cle of connues) if (!vues.has(cle)) erreurs.push(`correspondances : compétence sans entrée ${cle.replace("|", " « ")} »`);
  return erreurs;
}

/**
 * Priorités : chaque notion reçoit le taux le plus bas des compétences qui la visent. Les notions dont ce taux est sous
 * le seuil sont prioritaires. Retourne [{ notion, taux, competences: [{ niveau, competence, taux }] }], du plus faible.
 */
export function prioriserNotions(table, evaluations) {
  const taux = new Map(evaluations.map((e) => [`${e.niveau}|${e.competence}`, e]));
  const parNotion = new Map();
  for (const c of table.correspondances) {
    const e = taux.get(`${c.niveau}|${c.competence}`);
    if (!e) continue;
    for (const n of c.notions) {
      if (!parNotion.has(n)) parNotion.set(n, []);
      parNotion.get(n).push({ niveau: e.niveau, competence: e.competence, taux: e.taux });
    }
  }
  return [...parNotion].map(([notion, competences]) => ({
    notion, taux: Math.min(...competences.map((c) => c.taux)),
    competences: competences.sort((a, b) => a.taux - b.taux || compareFr(a.competence, b.competence))
  })).sort((a, b) => a.taux - b.taux || compareFr(a.notion, b.notion));
}

const cellule = (v) => String(v).replace(/\|/g, "\\|");
const pourcent = (t) => `${String(t.toFixed(1)).replace(".", ",")} %`;

/** Rapport Markdown déterministe (dépend seulement des instantanés, de la table et du catalogue). */
export function rapportMarkdown({ evaluations, programmes, table, rattachements, titres }) {
  const titre = (id) => (titres.get(id) ? `${titres.get(id)} (\`${id}\`)` : `\`${id}\``);
  const priorites = prioriserNotions(table, evaluations);
  const sousSeuil = priorites.filter((p) => p.taux < table.seuil);
  const corr = new Map(table.correspondances.map((c) => [`${c.niveau}|${c.competence}`, c.notions]));
  const sansNotion = evaluations.filter((e) => !(corr.get(`${e.niveau}|${e.competence}`) ?? []).length);
  const annees = [...new Set(evaluations.map((e) => `${e.niveau} ${e.annee}`))].join(", ");
  const l = [];
  l.push("# Sources ouvertes : évaluations nationales et programmes", "");
  l.push("> Fichier généré par `npm run sources:rapport` (ADR 0044). Ne pas modifier à la main.", "");
  l.push(`Sources : [data.education.gouv.fr](${PORTAIL}), ${LICENCE}. Évaluations Repères (DEPP), taux de maîtrise`);
  l.push(`nationaux, population « Ensemble » : ${annees}. Programmes d'enseignement (DGESCO), textes en vigueur.`);
  l.push(`Instantanés : \`referentiel/sources-ouvertes/\`. Correspondances : statut **${table.statut}**, seuil ${table.seuil} %.`, "");

  l.push("## Notions prioritaires", "");
  l.push(`Notions du catalogue visées par au moins une compétence maîtrisée par moins de ${table.seuil} % des élèves`);
  l.push("(taux le plus bas retenu). Elles passent en tête pour l'enrichissement et la relecture.", "");
  l.push("| Notion | Taux le plus bas | Compétences nationales |", "|---|---|---|");
  for (const p of sousSeuil) {
    l.push(`| ${cellule(titre(p.notion))} | ${pourcent(p.taux)} | ${cellule(p.competences.map((c) => `${c.niveau} « ${c.competence} » ${pourcent(c.taux)}`).join(" ; "))} |`);
  }
  if (!sousSeuil.length) l.push("| (aucune) | | |");
  l.push("");

  l.push("## Compétences sans notion au catalogue", "");
  l.push("Candidates à une issue `maquette-manquante` (ou à un complément d'une notion existante).", "");
  l.push("| Niveau | Discipline | Compétence | Taux |", "|---|---|---|---|");
  for (const e of sansNotion) l.push(`| ${e.niveau} | ${e.discipline} | ${cellule(e.competence)} | ${pourcent(e.taux)} |`);
  if (!sansNotion.length) l.push("| (aucune) | | | |");
  l.push("");

  l.push("## Toutes les compétences", "");
  l.push("| Niveau | Année | Discipline | Compétence | Taux | Notions |", "|---|---|---|---|---|---|");
  for (const e of evaluations) {
    const notions = (corr.get(`${e.niveau}|${e.competence}`) ?? []).map((n) => `\`${n}\``).join(", ") || "—";
    l.push(`| ${e.niveau} | ${e.annee} | ${e.discipline} | ${cellule(e.competence)} | ${pourcent(e.taux)} | ${notions} |`);
  }
  l.push("");

  const parNiveau = new Map();
  for (const p of programmes) parNiveau.set(p.niveau, (parNiveau.get(p.niveau) ?? 0) + 1);
  const rentreeMax = programmes.map((p) => p.rentree).filter(Boolean).sort().at(-1) ?? "?";
  const sansTexte = rattachements.filter((r) => !r.textes.length);
  l.push("## Programmes officiels", "");
  l.push(`Textes en vigueur retenus : ${[...parNiveau].map(([n, c]) => `${n} ${c}`).join(", ")}. Entrée en vigueur la plus`);
  l.push(`récente du jeu : rentrée ${rentreeMax}. **Attention** : le jeu ne contient pas les programmes publiés depuis`);
  l.push("(cycles 1 à 3 de 2024, EMC 2024) ; pour l'école et le collège, le texte rattaché peut être remplacé.", "");
  l.push(`Fiches rattachées à au moins un texte : ${rattachements.length - sansTexte.length} sur ${rattachements.length}.`, "");
  l.push("### Fiches sans texte officiel", "");
  l.push("| Fiche | Matière | Niveaux |", "|---|---|---|");
  for (const r of sansTexte) l.push(`| ${cellule(titre(r.id))} | ${r.matiere} | ${r.niveaux.join(", ") || "—"} |`);
  if (!sansTexte.length) l.push("| (aucune) | | |");
  l.push("");
  l.push("### Textes et nombre de fiches rattachées", "");
  l.push("| Niveau | Discipline | Texte | Rentrée | Fiches |", "|---|---|---|---|---|");
  for (const p of programmes) {
    const n = rattachements.filter((r) => r.textes.includes(p)).length;
    if (!n) continue;
    const lien = p.contenu ? `[${cellule(p.texte || p.descriptif)}](${p.contenu})` : cellule(p.texte || p.descriptif);
    l.push(`| ${p.niveau} | ${cellule(p.discipline || "toutes")} | ${lien} | ${p.rentree} | ${n} |`);
  }
  l.push("");
  return l.join("\n");
}
