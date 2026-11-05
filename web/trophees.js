// Instantanés locaux des modules, séparés de l'XP d'exploration : les niveaux n'ont pas la même échelle.
export const CLE_STOCKAGE = "kermiclab:trophees";
const entier = (v) => Number.isInteger(v) && v >= 0 && v <= 1e9;
const texte = (v, max) => typeof v === "string" && v.length <= max;
const objet = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const CHIFFRES = ["xp", "niveau", "etoiles", "etoilesTotal", "lecons", "leconsTotal", "grades", "gradesTotal", "serie", "revisions", "victoires", "record"];

export function normaliser(brut) {
  if (!objet(brut) || !["notions", "jeux", "labs"].includes(brut.genre)) return null;
  if (!Array.isArray(brut.badges) || brut.badges.length > 100) return null;
  if (!objet(brut.etat) && !Array.isArray(brut.etat)) return null;
  try { if (JSON.stringify(brut.etat).length > 100000) return null; } catch { return null; }
  const resultat = { genre: brut.genre, etat: brut.etat, badges: [] };
  for (const cle of CHIFFRES) {
    if (brut[cle] === undefined) continue;
    if (!entier(brut[cle])) return null;
    resultat[cle] = brut[cle];
  }
  if (brut.dernierJour !== undefined && brut.dernierJour !== null) {
    if (!texte(brut.dernierJour, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(brut.dernierJour)) return null;
    resultat.dernierJour = brut.dernierJour;
  }
  for (const b of brut.badges) {
    if (!objet(b) || !texte(b.id, 80) || !texte(b.nom, 120) || !texte(b.description, 500) ||
        !texte(b.icone, 20) || !entier(b.actuel) || !entier(b.cible) || b.cible === 0 || typeof b.obtenu !== "boolean") return null;
    resultat.badges.push({ id: b.id, nom: b.nom, description: b.description, icone: b.icone,
      actuel: Math.min(b.actuel, b.cible), cible: b.cible, obtenu: b.obtenu });
  }
  return resultat;
}

export function charger(stockage) {
  try {
    const brut = JSON.parse(stockage?.getItem(CLE_STOCKAGE) ?? "{}");
    if (!objet(brut)) return {};
    return Object.fromEntries(Object.entries(brut).slice(0, 200)
      .filter(([id]) => /^[a-z0-9][a-z0-9-]{0,79}$/.test(id))
      .map(([id, valeur]) => [id, normaliser(valeur)]).filter(([, valeur]) => valeur));
  } catch { return {}; }
}

export function sauver(stockage, modules) {
  try { stockage?.setItem(CLE_STOCKAGE, JSON.stringify(modules)); } catch { /* même repli en mémoire que progression.js */ }
}

export function lireCollection(brut) {
  if (!Array.isArray(brut?.modules) || brut.modules.length > 200) throw new Error("trophées : collection invalide");
  const collection = {};
  for (const m of brut.modules) {
    const p = normaliser(m?.progression);
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(m?.id) || !p ||
        (m.id !== "mini-cercle" && !texte(m.titre, 200)) || Object.hasOwn(collection, m.id)) {
      throw new Error("trophées : module invalide dans la collection");
    }
    collection[m.id] = { ...p, titre: m.titre };
  }
  return collection;
}
