// Import de l'API « Marché du travail » de France Travail (chantier Métiers, ADR 0044, lot 8) : fonctions pures,
// testées par tests/unit/marche.test.mjs. Le script scripts/importer-marche.mjs lit et écrit les fichiers.
//
// PRÉPARÉ SANS DONNÉES RÉELLES (2026-11-27) : la documentation de francetravail.io n'était pas accessible. L'import lit
// des réponses JSON enregistrées à la main depuis la console de l'API (aucune adresse de service n'est devinée ici) et
// suppose la forme décrite dans `normaliserReponse`. Toute réponse qui ne la respecte pas est refusée avec un message
// clair, pour ajuster le code au premier fichier réel plutôt que d'importer des valeurs fausses.
//
// Indicateur retenu : difficultés de recrutement (tension), en cinq tranches de « très faible » à « très élevée »
// (gradation publiée par France Travail, Data Emploi), par code ROME, au niveau France.

export const FORMAT_EXTRAIT = "kermiclab-marche-extrait";
export const VERSION_EXTRAIT = 1;
// Tranches de tension, de 1 (très faible) à 5 (très élevée).
export const NIVEAUX_TENSION = Object.freeze(["tres-faible", "faible", "moyenne", "elevee", "tres-elevee"]);
const MOTIF_ROME = /^[A-N]\d{4}$/;

const sansAccents = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Tranche de tension (1 à 5) d'un libellé (« Très élevée ») ou d'un nombre entier de 1 à 5 ; `null` sinon. */
export function niveauTension(valeur) {
  if (typeof valeur === "number") return Number.isInteger(valeur) && valeur >= 1 && valeur <= 5 ? valeur : null;
  const s = sansAccents(valeur).replace(/[\s-]+/g, " ");
  if (/^[1-5]$/.test(s)) return Number(s);
  const libelles = ["tres faible", "faible", "moyenne", "elevee", "tres elevee"];
  const i = libelles.indexOf(s.replace(/^tension /, ""));
  return i >= 0 ? i + 1 : null;
}

/**
 * Lignes normalisées d'une réponse de l'API. Forme supposée (à confirmer sur une réponse réelle) :
 * `{ listeValeursParPeriode: [{ codeTypeTerritoire, codeTerritoire, codeTypeActivite: "ROME", codeActivite,
 * codeNomenclature, codeTypePeriode, codePeriode, libPeriode?, valeurPrincipaleNom? | valeurPrincipaleNombre?, datMaj? }] }`.
 * Renvoie `[{ rome, territoire, indicateur, periode, niveau }]` ; lève une erreur si la forme n'est pas reconnue.
 */
export function normaliserReponse(reponse, { indicateur = "PERSP_2" } = {}) {
  const liste = reponse?.listeValeursParPeriode;
  if (!Array.isArray(liste)) throw new Error("réponse non reconnue : champ listeValeursParPeriode absent (adapter normaliserReponse, scripts/lib/marche.mjs)");
  const lignes = [];
  for (const v of liste) {
    if (v?.codeNomenclature !== undefined && v.codeNomenclature !== indicateur) continue;
    if (String(v?.codeTypeActivite ?? "").toUpperCase() !== "ROME" || !MOTIF_ROME.test(String(v?.codeActivite ?? ""))) {
      throw new Error(`réponse non reconnue : activité ${v?.codeTypeActivite}/${v?.codeActivite} (code ROME attendu)`);
    }
    const niveau = niveauTension(v.valeurPrincipaleNom ?? v.valeurPrincipaleNombre);
    if (niveau === null) throw new Error(`réponse non reconnue : tension « ${v.valeurPrincipaleNom ?? v.valeurPrincipaleNombre} » pour ${v.codeActivite}`);
    lignes.push({
      rome: v.codeActivite,
      territoire: `${v.codeTypeTerritoire ?? "?"}:${v.codeTerritoire ?? "?"}`,
      indicateur,
      periode: String(v.libPeriode ?? v.codePeriode ?? ""),
      niveau
    });
  }
  return lignes;
}

/** Extrait compact et versionné : une tension par code ROME (niveau France), la période la plus récente. */
export function extraitCompact(lignes, { date, source }) {
  const parRome = new Map();
  for (const l of lignes) {
    if (l.territoire !== "NAT:FR") continue;
    const actuel = parRome.get(l.rome);
    if (!actuel || l.periode.localeCompare(actuel.periode) > 0) parRome.set(l.rome, { rome: l.rome, periode: l.periode, tension: l.niveau });
  }
  return {
    format: FORMAT_EXTRAIT,
    version: VERSION_EXTRAIT,
    date,
    source,
    licence: "Conditions d'utilisation de francetravail.io (à confirmer, ADR 0044)",
    attribution: "France Travail, API « Marché du travail », francetravail.io",
    portee: "France entière",
    tensions: [...parRome.values()].sort((a, b) => a.rome.localeCompare(b.rome))
  };
}

/** Extrait relu : vérifie son format et renvoie un accès par code ROME. */
export function lireExtrait(extrait) {
  if (extrait?.format !== FORMAT_EXTRAIT) throw new Error(`format d'extrait inattendu : ${extrait?.format}`);
  return { ...extrait, parRome: new Map(extrait.tensions.map((t) => [t.rome, t])) };
}

/** Codes ROME du référentiel à demander à l'API (un par métier, sans doublon). */
export function codesAInterroger(referentiel) {
  return [...new Set(referentiel.metiers.flatMap((m) => m.rome ?? []))].sort();
}

/**
 * Enrichit le référentiel : `marche` ({ tension, periode }) pour chaque métier dont un code ROME a une tension, la plus
 * forte s'il en a plusieurs ; recalculé à chaque import. Ajoute la source à `sources`.
 */
export function appliquerMarche(referentiel, extrait) {
  const { parRome } = lireExtrait(extrait);
  const rapport = { rattaches: 0, sansDonnees: [] };
  const metiers = referentiel.metiers.map((m) => {
    const { marche: _m, ...reste } = m;
    const valeurs = (m.rome ?? []).map((c) => parRome.get(c)).filter(Boolean).sort((a, b) => b.tension - a.tension);
    if (!valeurs.length) { rapport.sansDonnees.push(m.id); return reste; }
    rapport.rattaches += 1;
    return { ...reste, marche: { tension: valeurs[0].tension, periode: valeurs[0].periode } };
  });
  const source = {
    nom: "API Marché du travail",
    producteur: "France Travail",
    licence: "Conditions d'utilisation de francetravail.io",
    url: "https://www.data.gouv.fr/dataservices/api-marche-du-travail",
    date: extrait.date,
    champs: ["marche"]
  };
  const sources = [...(referentiel.sources ?? []).filter((s) => s.nom !== source.nom), ...(rapport.rattaches ? [source] : [])];
  return { referentiel: { ...referentiel, sources, metiers }, rapport };
}
