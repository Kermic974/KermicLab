// Démonstration de l'Espace famille (« green card ») : parcours parent / enfant complet sans OAuth ni Worker.
// Logique pure, testable sous Node : l'état est un objet sérialisable conservé par l'appelant (sessionStorage).
// Rien n'est envoyé au serveur ; les identifiants sont préfixés « demo- » pour ne jamais se mêler aux vrais.

export const CLE_DEMO = "kermiclab:demo-famille";
export const PARAMETRE_DEMO = "famille";

export function etatInitial() {
  return { connecte: false, fournisseur: null, enfants: [], progres: {}, compteur: 0 };
}

/** Relit un état sauvegardé ; tout état illisible repart de zéro. */
export function lireEtat(texte) {
  try {
    const e = JSON.parse(texte);
    if (!e || typeof e !== "object" || !Array.isArray(e.enfants)) return etatInitial();
    return { ...etatInitial(), ...e };
  } catch {
    return etatInitial();
  }
}

/** Connexion simulée : le bouton Google ou Microsoft connecte immédiatement un parent de démonstration. */
export function connecter(etat, fournisseur) {
  return { ...etat, connecte: true, fournisseur: ["google", "microsoft"].includes(fournisseur) ? fournisseur : "google" };
}

export function deconnecter(etat) {
  return { ...etat, connecte: false, fournisseur: null };
}

/** Même forme de réponse que `/auth/me`. */
export function moi(etat) {
  return etat.connecte
    ? { connecte: true, compte: { id: "demo-parent", role: "parent", demo: true, fournisseur: etat.fournisseur } }
    : { connecte: false };
}

/** Même forme de réponse que `GET /api/eleves`. */
export function eleves(etat) {
  if (!etat.connecte) throw new Error("non-connecte");
  return etat.enfants.map(({ id, prenom_affiche, age_tranche }) => ({ id, prenom_affiche, age_tranche }));
}

/** Même contrat que `POST /api/eleves` (validation déjà faite par comptes.validerEnfant). */
export function creerEleve(etat, { prenom_affiche, age_tranche }) {
  if (!etat.connecte) throw new Error("non-connecte");
  const id = `demo-${etat.compteur + 1}`;
  return { etat: { ...etat, compteur: etat.compteur + 1, enfants: [...etat.enfants, { id, prenom_affiche, age_tranche }] }, id };
}

export function supprimerEleve(etat, id) {
  if (!etat.connecte) throw new Error("non-connecte");
  const { [id]: _efface, ...progres } = etat.progres;
  return { ...etat, enfants: etat.enfants.filter((e) => e.id !== id), progres };
}

/** Même forme que `GET /api/progres?eleveId=` : une ligne par notion. */
export function lireProgres(etat, id) {
  return Object.entries(etat.progres[id] ?? {}).map(([notion_id, n]) => ({ notion_id, score: n.score ?? 0, etoiles: n.etoiles ?? 0 }));
}

export function sauverProgres(etat, id, progres) {
  if (!etat.enfants.some((e) => e.id === id)) return etat;
  return { ...etat, progres: { ...etat.progres, [id]: { ...(progres?.notions ?? {}) } } };
}
