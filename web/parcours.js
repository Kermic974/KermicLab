// Contenus pilotés depuis le back-office (ADR 0026) : parcours publiés (`/api/parcours`) et contenus mis en avant
// (`enAvant` dans `/api/catalogue`). Logique pure, testable sans navigateur : le site n'affiche que des contenus
// présents au catalogue et ne garde rien d'autre que la progression locale déjà existante.

export const MAX_PARCOURS = 6;
export const MAX_EN_AVANT = 4;
const MAX_ETAPES = 30;
const texte = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Parcours affichables : forme vérifiée, étapes limitées aux contenus connus du catalogue, sans doublon.
 * Un parcours sans étape connue est écarté.
 * @param {unknown} liste réponse de `/api/parcours`
 * @param {(id: string) => ({ id: string, titre: string } | undefined)} trouver contenu du catalogue par identifiant
 */
export function parcoursAffichables(liste, trouver) {
  if (!Array.isArray(liste)) return [];
  const resultat = [];
  for (const brut of liste) {
    const id = texte(brut?.id, 80), titre = texte(brut?.titre, 120);
    if (!id || !titre || resultat.some((p) => p.id === id)) continue;
    const etapes = [];
    for (const e of Array.isArray(brut.etapes) ? brut.etapes.slice(0, MAX_ETAPES) : []) {
      const contenu = typeof e?.id === "string" ? trouver(e.id) : undefined;
      if (contenu && !etapes.some((x) => x.id === contenu.id)) etapes.push({ id: contenu.id, titre: contenu.titre });
    }
    if (etapes.length) resultat.push({ id, titre, description: texte(brut.description, 500), etapes });
    if (resultat.length >= MAX_PARCOURS) break;
  }
  return resultat;
}

/**
 * Avancement d'un parcours d'après les contenus déjà ouverts sur l'appareil.
 * @returns {{ faites: number, total: number, suivante: { id: string, titre: string } | null, termine: boolean }}
 */
export function avancement(parcours, ouverts) {
  const vus = ouverts instanceof Set ? ouverts : new Set(ouverts ?? []);
  const faites = parcours.etapes.filter((e) => vus.has(e.id)).length;
  const suivante = parcours.etapes.find((e) => !vus.has(e.id)) ?? null;
  return { faites, total: parcours.etapes.length, suivante, termine: !suivante };
}

/** Contenus mis en avant depuis le back-office, dans l'ordre du catalogue. */
export function contenusEnAvant(notions, max = MAX_EN_AVANT) {
  return (Array.isArray(notions) ? notions : []).filter((n) => n?.enAvant === true && typeof n.id === "string" && typeof n.titre === "string").slice(0, max);
}

/** Niveau choisi dans « Ma classe » : gardé seulement s'il existe encore dans le catalogue. */
export const classeValide = (choix, niveaux) => (typeof choix === "string" && niveaux.includes(choix) ? choix : null);
