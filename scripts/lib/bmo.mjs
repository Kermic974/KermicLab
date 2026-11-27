// Import de l'enquête « Besoins en main-d'œuvre » (BMO) de France Travail (chantier Métiers, ADR 0044, lot 9) :
// fonctions pures, testées par tests/unit/bmo.test.mjs. Le script scripts/importer-bmo.mjs lit et écrit les fichiers.
//
// Source : « Base open data BMO » (xlsx annuel, data.gouv.fr), Licence Ouverte. Une ligne par métier BMO (code FAP 2021)
// et par bassin d'emploi : projets de recrutement (`met`), dont jugés difficiles (`xmet`) et saisonniers (`smet`) ; les
// petites valeurs sont masquées (« * », secret statistique). Les totaux France sont donc des minimums.
// Lecture xlsx minimale (zip + XML) avec zlib : aucune dépendance ajoutée.
import { inflateRawSync } from "node:zlib";

export const FORMAT_EXTRAIT = "kermiclab-bmo-extrait";
export const VERSION_EXTRAIT = 1;
export const PALIERS = Object.freeze(["faible", "moyen", "fort"]);
const MOTIF_FAP = /^[A-Z][0-9A-Z][A-Z]\d{2}$/;

/** Fichiers d'une archive zip (méthodes « stockée » et « deflate »), par nom. */
export function lireZip(octets) {
  const buf = Buffer.from(octets);
  let fin = buf.length - 22;
  while (fin >= 0 && buf.readUInt32LE(fin) !== 0x06054b50) fin -= 1;
  if (fin < 0) throw new Error("archive zip invalide (fin du répertoire central introuvable)");
  const nombre = buf.readUInt16LE(fin + 10);
  let pos = buf.readUInt32LE(fin + 16);
  const fichiers = new Map();
  for (let i = 0; i < nombre; i += 1) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error("archive zip invalide (répertoire central)");
    const methode = buf.readUInt16LE(pos + 10);
    const taille = buf.readUInt32LE(pos + 20);
    const lgNom = buf.readUInt16LE(pos + 28), lgExtra = buf.readUInt16LE(pos + 30), lgCommentaire = buf.readUInt16LE(pos + 32);
    const local = buf.readUInt32LE(pos + 42);
    const nom = buf.toString("utf8", pos + 46, pos + 46 + lgNom);
    const debut = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const donnees = buf.subarray(debut, debut + taille);
    fichiers.set(nom, methode === 0 ? donnees : methode === 8 ? inflateRawSync(donnees) : null);
    pos += 46 + lgNom + lgExtra + lgCommentaire;
  }
  return fichiers;
}

const entites = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };
const texteXml = (s) => s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : entites[e]);

/** Index d'une référence de colonne (« A » → 0, « AB » → 27). */
const colonne = (ref) => [...ref.replace(/\d+/g, "")].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

// Analyse XML volontairement simple et linéaire (pas d'expressions régulières à quantificateurs concurrents, sujettes
// au retour arrière polynomial sur un fichier malformé) : une balise est repérée par « <nom », close au premier « > »,
// et ses attributs sont lus un à un.
const MOTIF_ATTRIBUT = /([\w:.-]+)="([^"]*)"/g;

/** Attributs d'une balise ouvrante (texte entre `<nom` et `>`), par nom, valeurs décodées. */
function attributs(texte) {
  return Object.fromEntries([...texte.matchAll(MOTIF_ATTRIBUT)].map(([, cle, valeur]) => [cle, texteXml(valeur)]));
}

/**
 * Éléments `<nom …>…</nom>` (ou `<nom …/>`) d'un texte XML, parcourus d'un seul passage : `[{ attributs, contenu }]`.
 * Chaque recherche reprend après l'élément précédent ; un élément sans fermeture arrête le parcours (fichier tronqué).
 */
function elements(xml, nom) {
  const resultat = [];
  const ouverture = `<${nom}`;
  const fermeture = `</${nom}>`;
  let i = xml.indexOf(ouverture);
  while (i >= 0) {
    const suivant = xml[i + ouverture.length];
    if (suivant !== " " && suivant !== ">" && suivant !== "/" && suivant !== "\t" && suivant !== "\n" && suivant !== "\r") {
      i = xml.indexOf(ouverture, i + ouverture.length);
      continue;
    }
    const fin = xml.indexOf(">", i + ouverture.length);
    if (fin < 0) break;
    const interieur = xml.slice(i + ouverture.length, fin);
    if (interieur.endsWith("/")) {
      resultat.push({ attributs: attributs(interieur), contenu: "" });
      i = xml.indexOf(ouverture, fin + 1);
      continue;
    }
    const ferme = xml.indexOf(fermeture, fin + 1);
    if (ferme < 0) break;
    resultat.push({ attributs: attributs(interieur), contenu: xml.slice(fin + 1, ferme) });
    i = xml.indexOf(ouverture, ferme + fermeture.length);
  }
  return resultat;
}

/** Texte d'un élément de chaîne (`<si>`, `<is>`) : concaténation de ses `<t>`. */
const texteDe = (xml) => elements(xml, "t").map((e) => texteXml(e.contenu)).join("");

/** Noms des feuilles d'un classeur xlsx, dans l'ordre. */
export function feuillesDuClasseur(octets) {
  const xml = lireZip(octets).get("xl/workbook.xml")?.toString("utf8") ?? "";
  return elements(xml, "sheet").map((e) => e.attributs.name).filter(Boolean);
}

/** Lignes (tableaux de chaînes) de la feuille `nom` d'un classeur xlsx. */
export function lireFeuille(octets, nom) {
  const zip = lireZip(octets);
  const lire = (chemin) => zip.get(chemin)?.toString("utf8") ?? "";
  const chaines = lire("xl/sharedStrings.xml");
  const partages = elements(chaines, "si").map((e) => texteDe(e.contenu));
  const feuille = elements(lire("xl/workbook.xml"), "sheet").find((e) => e.attributs.name === nom);
  if (!feuille) throw new Error(`feuille introuvable : ${nom}`);
  const relation = elements(lire("xl/_rels/workbook.xml.rels"), "Relationship").find((e) => e.attributs.Id === feuille.attributs["r:id"]);
  if (!relation?.attributs.Target) throw new Error(`feuille sans fichier associé : ${nom}`);
  const xml = lire(`xl/${relation.attributs.Target.replace(/^\/?xl\//, "")}`);
  const lignes = [];
  for (const rangee of elements(xml, "row")) {
    const ligne = [];
    for (const cellule of elements(rangee.contenu, "c")) {
      const { r: ref, t: type } = cellule.attributs;
      const [valeur] = elements(cellule.contenu, "v");
      const brut = valeur ? texteXml(valeur.contenu) : texteDe(cellule.contenu);
      const index = /^[A-Z]+\d+$/.test(ref ?? "") ? colonne(ref) : ligne.length;
      ligne[index] = type === "s" ? partages[Number(brut)] : brut;
    }
    lignes.push(Array.from(ligne, (x) => x ?? ""));
  }
  return lignes;
}

const entier = (v) => (/^\d+$/.test(String(v ?? "").trim()) ? Number(v) : null);

/**
 * Totaux France par métier BMO à partir des lignes de la feuille (en-tête en première ligne : `Code métier BMO`,
 * `Nom métier BMO`, `Lbl_fam_met`, `met`, `xmet`, `smet`). `masquees` compte les valeurs couvertes par le secret.
 */
export function agregerBmo(lignes) {
  const [entete, ...donnees] = lignes;
  const i = (nom) => {
    const k = entete.findIndex((c) => String(c).trim() === nom);
    if (k < 0) throw new Error(`colonne BMO introuvable : ${nom}`);
    return k;
  };
  const col = { code: i("Code métier BMO"), nom: i("Nom métier BMO"), famille: i("Lbl_fam_met"), met: i("met"), xmet: i("xmet"), smet: i("smet"), annee: i("annee") };
  const parCode = new Map();
  let annee;
  for (const l of donnees) {
    const code = String(l[col.code] ?? "").trim();
    if (!MOTIF_FAP.test(code)) continue;
    annee ??= entier(l[col.annee]);
    const a = parCode.get(code) ?? { code, nom: String(l[col.nom]).trim(), famille: String(l[col.famille]).trim(), projets: 0, difficiles: 0, saisonniers: 0, masquees: 0 };
    for (const [cle, k] of [["projets", col.met], ["difficiles", col.xmet], ["saisonniers", col.smet]]) {
      const v = entier(l[k]);
      if (v === null) a.masquees += 1;
      else a[cle] += v;
    }
    parCode.set(code, a);
  }
  return { annee, metiers: [...parCode.values()].sort((a, b) => a.code.localeCompare(b.code)) };
}

/**
 * Palier de recrutement d'un métier BMO, par tiers du nombre de projets parmi tous les métiers de l'enquête :
 * `fort` (tiers supérieur), `moyen`, `faible`. Comparaison relative, lisible de 7 à 77 ans.
 */
export function paliers(metiers) {
  const tries = [...metiers].map((m) => m.projets).sort((a, b) => a - b);
  const seuil = (q) => tries[Math.min(tries.length - 1, Math.floor(q * tries.length))];
  const [bas, haut] = [seuil(1 / 3), seuil(2 / 3)];
  return new Map(metiers.map((m) => [m.code, m.projets >= haut ? "fort" : m.projets >= bas ? "moyen" : "faible"]));
}

/** Extrait compact et versionné : un métier BMO par ligne, totaux France et palier. */
export function extraitCompact({ annee, metiers }, { date, source }) {
  const p = paliers(metiers);
  return {
    format: FORMAT_EXTRAIT,
    version: VERSION_EXTRAIT,
    annee,
    date,
    source,
    licence: "Licence Ouverte 2.0 (Etalab), https://www.etalab.gouv.fr/licence-ouverte-open-licence/",
    attribution: "France Travail, enquête « Besoins en main-d'œuvre » (BMO), data.gouv.fr",
    portee: "France entière, somme des bassins d'emploi ; valeurs masquées par le secret statistique exclues (totaux minimaux)",
    metiers: metiers.map((m) => ({ ...m, palier: p.get(m.code) }))
  };
}

/** Extrait relu : vérifie son format et renvoie un accès par code FAP. */
export function lireExtrait(extrait) {
  if (extrait?.format !== FORMAT_EXTRAIT) throw new Error(`format d'extrait inattendu : ${extrait?.format}`);
  return { ...extrait, parCode: new Map(extrait.metiers.map((m) => [m.code, m])) };
}

const pourcent = (n, total) => (total ? Math.round((100 * n) / total) : 0);

/**
 * Enrichit le référentiel des métiers : chaque métier rattaché à un métier BMO (champ `fap`, choisi à la main)
 * reçoit `perspectives` (année, groupe BMO, projets, part difficile et saisonnière en %, palier), recalculé à chaque import.
 */
export function appliquerBmo(referentiel, extrait) {
  const { parCode } = lireExtrait(extrait);
  const rapport = { rattaches: 0, sansFap: [], inconnus: [] };
  const metiers = referentiel.metiers.map((m) => {
    const { perspectives: _p, ...reste } = m;
    if (!m.fap) { rapport.sansFap.push(m.id); return reste; }
    const b = parCode.get(m.fap);
    if (!b) { rapport.inconnus.push(`${m.id}:${m.fap}`); return reste; }
    rapport.rattaches += 1;
    return {
      ...reste,
      perspectives: { annee: extrait.annee, groupe: b.nom, projets: b.projets, partDifficile: pourcent(b.difficiles, b.projets), partSaisonnier: pourcent(b.saisonniers, b.projets), palier: b.palier }
    };
  });
  const source = {
    nom: `Enquête Besoins en main-d'œuvre ${extrait.annee}`,
    producteur: "France Travail",
    licence: "Licence Ouverte 2.0",
    url: "https://www.data.gouv.fr/datasets/enquete-besoins-en-main-doeuvre-bmo",
    date: extrait.date,
    champs: ["perspectives"]
  };
  const sources = [...(referentiel.sources ?? []).filter((s) => !s.nom.startsWith("Enquête Besoins en main-d'œuvre")), source];
  return { referentiel: { ...referentiel, sources, metiers }, rapport };
}
