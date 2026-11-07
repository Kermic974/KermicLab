// Démonstration des contributions (« green card », ADR 0023) : parcours contributeur et prof sans OAuth ni Worker.
// Logique pure, testable sous Node : l'état est un objet sérialisable conservé par l'appelant (sessionStorage).
// Rien n'est envoyé au serveur ; les identifiants sont préfixés « demo- ». Les règles sont celles du Worker
// (web/contributions.js) : mêmes validations, mêmes transitions, mêmes formes de réponse que `/api/contributions`.
import * as regles from "./contributions.js";

export const CLE_DEMO = "kermiclab:demo-contributions";
export const PARAMETRE_DEMO = "contributions";
const AUTRES = ["demo-auteur-a7k2q9", "demo-auteur-m3x8p1"];

/** Contributions d'autres comptes, pour que le tableau de bord du prof ne soit pas vide. */
function exemples() {
  const base = { notion_version: "1.0.0", charte_version: regles.VERSION_CHARTE, commentaire: null, issue_numero: null, decided_at: null };
  return [
    {
      ...base, id: "demo-c1", auteur_id: AUTRES[0], notion_id: "pythagore", chemin: "intro", nature: "modification", type: "clarification",
      texte_actuel: "Une seule page pour toute la notion : ouvre les niveaux dans l'ordre que tu veux, du plus simple au plus avancé.",
      texte_propose: "Une seule page pour toute la notion : ouvre les niveaux dans l'ordre que tu veux, du plus simple au plus avancé. Commence par l'intuition si c'est ta première fois.",
      motif: "Guider les élèves qui découvrent la notion.", statut: "proposee", created_at: "2026-11-05T09:12:00Z", updated_at: "2026-11-05T09:12:00Z"
    },
    {
      ...base, id: "demo-c2", auteur_id: AUTRES[1], notion_id: "pythagore", chemin: "niveaux.1.paragraphes.0", nature: "modification", type: "orthographe",
      texte_actuel: "Dans un triangle rectangle, le côté opposé à l'angle droit s'appelle l'**hypoténuse**. C'est toujours le plus long des trois côtés.",
      texte_propose: "Dans un triangle rectangle, le côté opposé à l'angle droit s'appelle l'**hypoténuse** : c'est toujours le plus long des trois côtés.",
      motif: "Ponctuation plus fluide.", statut: "proposee", created_at: "2026-11-06T14:40:00Z", updated_at: "2026-11-06T14:40:00Z"
    },
    {
      ...base, id: "demo-c3", auteur_id: AUTRES[0], notion_id: "fractions", chemin: "intro", nature: "modification", type: "autre",
      texte_actuel: "—", texte_propose: "Les fractions, c'est facile !", motif: "Plus motivant.", statut: "refusee",
      commentaire: "Formulation trop générale : préférer un exemple concret.", created_at: "2026-11-02T08:00:00Z",
      updated_at: "2026-11-03T10:00:00Z", decided_at: "2026-11-03T10:00:00Z"
    }
  ];
}

export function etatInitial() {
  return { connecte: false, role: null, contributions: exemples(), compteur: 0, issues: 0 };
}

export function lireEtat(texte) {
  try {
    const e = JSON.parse(texte);
    if (!e || typeof e !== "object" || !Array.isArray(e.contributions)) return etatInitial();
    return { ...etatInitial(), ...e };
  } catch {
    return etatInitial();
  }
}

const compteDemo = (role) => `demo-${role}`;

/** Connexion simulée avec le rôle choisi (contributeur ou prof). */
export function connecter(etat, role) {
  return { ...etat, connecte: true, role: ["contributeur", "prof"].includes(role) ? role : "contributeur" };
}

export function deconnecter(etat) {
  return { ...etat, connecte: false, role: null };
}

/** Même forme de réponse que `/auth/me`. */
export function moi(etat) {
  return etat.connecte
    ? { connecte: true, compte: { id: compteDemo(etat.role), role: etat.role, demo: true } }
    : { connecte: false };
}

function exiger(etat) {
  if (!etat.connecte) throw new Error("non-connecte");
  return { compteId: compteDemo(etat.role), role: etat.role };
}

/** Même forme que `GET /api/contributions?vue=miennes|relecture`. */
export function lister(etat, vue = "miennes") {
  const { compteId, role } = exiger(etat);
  if (vue === "relecture") {
    if (!regles.peutRelire(role)) throw new Error("role-requis");
    return etat.contributions.filter((c) => c.statut !== "retiree");
  }
  return etat.contributions.filter((c) => c.auteur_id === compteId);
}

/** Même contrat que `POST /api/contributions` (validation par regles.validerContribution). */
export function creer(etat, donnees, { maintenant = new Date().toISOString() } = {}) {
  const { compteId } = exiger(etat);
  const v = regles.validerContribution(donnees);
  if (!v.ok) return { etat, erreurs: v.erreurs };
  const ouvertes = etat.contributions.filter((c) => c.auteur_id === compteId && regles.STATUTS_OUVERTS.includes(c.statut)).length;
  if (ouvertes >= regles.MAX_OUVERTES_PAR_AUTEUR) return { etat, erreurs: { quota: "atteint" } };
  const id = `demo-n${etat.compteur + 1}`;
  const contribution = {
    ...v.contribution, id, auteur_id: compteId, notion_version: donnees.notion_version ?? "", statut: "proposee",
    commentaire: null, issue_numero: null, created_at: maintenant, updated_at: maintenant, decided_at: null
  };
  return { etat: { ...etat, compteur: etat.compteur + 1, contributions: [...etat.contributions, contribution] }, id };
}

/** Même contrat que `PATCH /api/contributions/:id` : `{ action, commentaire?, ...nouvelle proposition }`. */
export function agir(etat, id, corps = {}, { maintenant = new Date().toISOString() } = {}) {
  const contexte = exiger(etat);
  const c = etat.contributions.find((x) => x.id === id);
  if (!c) return { etat, code: "introuvable" };
  const tr = regles.transition(c, corps.action, contexte);
  if (!tr.ok) return { etat, code: tr.code };
  let maj = { statut: tr.vers, updated_at: maintenant };
  if (corps.action === "modifier") {
    const v = regles.validerContribution({ ...c, ...corps, notion_id: c.notion_id, chemin: c.chemin, texte_actuel: c.texte_actuel });
    if (!v.ok) return { etat, erreurs: v.erreurs };
    maj = { ...maj, type: v.contribution.type, nature: v.contribution.nature, texte_propose: v.contribution.texte_propose, motif: v.contribution.motif };
  } else if (["valider", "refuser", "reviser"].includes(corps.action)) {
    const com = regles.validerCommentaire(corps.commentaire, corps.action);
    if (!com.ok) return { etat, erreurs: { commentaire: com.erreur } };
    maj = { ...maj, commentaire: com.commentaire || null, decided_at: maintenant };
  }
  let issues = etat.issues;
  if (corps.action === "valider") maj.issue_numero = 9000 + ++issues;
  const contributions = etat.contributions.map((x) => (x.id === id ? { ...x, ...maj } : x));
  return { etat: { ...etat, issues, contributions }, contribution: contributions.find((x) => x.id === id) };
}
