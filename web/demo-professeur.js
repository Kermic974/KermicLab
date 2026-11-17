// Démonstration de l'expérience Professeur (ADR 0030) : mêmes routes, mêmes règles (web/professeur.js) et mêmes
// formes de réponse que `/api/professeur/`, sans compte ni Worker. Logique pure, testable sous Node : l'état est un
// objet sérialisable conservé par l'appelant (sessionStorage). Activée par « Tester les rôles → Professeur ».
// Rien n'est envoyé au serveur ; les élèves sont fictifs. `demo/simuler` fait rejoindre un élève fictif par un lien.
import {
  MAX_CLASSES, MAX_ELEVES_CLASSE, MAX_ELEVES_PROF, MAX_INVITATIONS_ACTIVES, tirerCodeProf, validerClasse,
  validerDemandeInvitation, validerProfilProf
} from "./professeur.js";

export const CLE_DEMO = "kermiclab:demo-professeur";
const PSEUDOS = ["Inès", "Lucas", "Maëlys", "Noah", "Jade", "Hugo", "Lina", "Adam", "Chloé", "Sacha"];

const jourDecale = (aujourdhui, n) => new Date(Date.parse(`${aujourdhui}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

/** Bilan fictif borné (même format que web/famille.js) : activité récente et quelques notions. */
function bilanFictif(aujourdhui, graine, notions) {
  const inactif = graine % 4 === 3;
  const dernier = jourDecale(aujourdhui, inactif ? 9 + graine : graine % 3);
  const jours = inactif ? [] : [0, 1, 2, 4].map((n, i) => ({ jour: jourDecale(aujourdhui, n + (graine % 2)), xp: 20 + ((graine + i) * 7) % 40, min: 8 + ((graine * 3 + i) % 20), q: i % 3 }));
  const etats = ["maitrisee", "en-cours", "a-revoir", "decouverte"];
  return {
    v: 1, jour: aujourdhui, xp: 300 + graine * 45, niveau: 2 + (graine % 4), serie: inactif ? 0 : 1 + (graine % 5), serieMax: 6,
    questions: 3 + graine, tempsMin: 60 + graine * 11, dernierJour: dernier, badges: [], cahiers: [], jours,
    notions: Object.fromEntries(notions.map((id, i) => [id, { etat: etats[(graine + i) % etats.length], tentes: 2 + i, reussis: 1 + ((graine + i) % 2) }]))
  };
}

export function etatInitial({ aujourdhui = new Date().toISOString().slice(0, 10), notions = [] } = {}) {
  const classe = { id: "demo-classe-4b", nom: "4e B", matiere: "mathematiques", niveau: "4e", creeLe: `${aujourdhui} 08:00:00` };
  const eleves = PSEUDOS.slice(0, 4).map((pseudo, i) => ({
    id: `demo-eleve-${i + 1}`, pseudo, classeId: i < 3 ? classe.id : null, rejointLe: jourDecale(aujourdhui, 10 - i),
    bilan: bilanFictif(aujourdhui, i, notions.slice(i % 2, (i % 2) + 4))
  }));
  return {
    v: 1, profil: { nomAffiche: "M. Martin", matieres: ["mathematiques"], niveaux: ["4e", "3e"] },
    classes: [classe], invitations: [], eleves, compteur: 0, notions
  };
}

export function lireEtat(texte, options) {
  try {
    const e = JSON.parse(texte);
    if (!e || e.v !== 1 || !Array.isArray(e.classes) || !Array.isArray(e.eleves)) return etatInitial(options);
    return e;
  } catch {
    return etatInitial(options);
  }
}

const reponse = (etat, statut, donnees = null) => ({ etat, statut, donnees });
const erreur = (etat, code, statut) => reponse(etat, statut, { erreur: code });

/**
 * Traite une requête de démonstration comme le Worker.
 * @returns {{ etat: object, statut: number, donnees: object | null }}
 */
export function traiter(etat, methode, route, corps = {}, { maintenant = Date.now(), aleatoire = (n) => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256)) } = {}) {
  const s = Math.floor(maintenant / 1000);
  const actives = (e) => e.invitations.filter((i) => i.expire > s && i.utilisations < i.max);
  const est = (m, r) => methode === m && route === r;
  let m;
  if (est("GET", "moi")) return reponse(etat, 200, { role: "prof", professeur: true, profil: etat.profil, professeurs: 0 });
  if (est("PUT", "profil")) {
    const r = validerProfilProf(corps);
    return r.ok ? reponse({ ...etat, profil: r.profil }, 200, { profil: r.profil }) : erreur(etat, r.code, 400);
  }
  if (est("GET", "classes")) {
    const effectif = (id) => etat.eleves.filter((e) => e.classeId === id).length;
    return reponse(etat, 200, {
      classes: etat.classes.map((c) => ({ ...c, eleves: effectif(c.id) })), particuliers: effectif(null),
      invitations: actives(etat).map(({ code, ...i }) => i), limites: { classes: MAX_CLASSES, elevesParClasse: MAX_ELEVES_CLASSE, eleves: MAX_ELEVES_PROF }
    });
  }
  if (est("POST", "classes")) {
    const r = validerClasse(corps, etat.profil);
    if (!r.ok) return erreur(etat, r.code, r.code === "profil-requis" ? 409 : 400);
    if (etat.classes.length >= MAX_CLASSES) return erreur(etat, "quota-classes", 409);
    const classe = { id: `demo-classe-${etat.compteur + 1}`, ...r.classe, creeLe: new Date(maintenant).toISOString().replace("T", " ").slice(0, 19) };
    return reponse({ ...etat, compteur: etat.compteur + 1, classes: [...etat.classes, classe] }, 201, { classe: { ...classe, eleves: 0 } });
  }
  if (methode === "POST" && (m = route.match(/^classes\/([a-z0-9-]+)\/(modifier|supprimer)$/))) {
    const ligne = etat.classes.find((c) => c.id === m[1]);
    if (!ligne) return erreur(etat, "introuvable", 404);
    if (m[2] === "supprimer") {
      return reponse({
        ...etat, classes: etat.classes.filter((c) => c.id !== ligne.id),
        eleves: etat.eleves.filter((e) => e.classeId !== ligne.id), invitations: etat.invitations.filter((i) => i.classeId !== ligne.id)
      }, 204);
    }
    const r = validerClasse({ nom: corps?.nom ?? ligne.nom, matiere: corps?.matiere ?? ligne.matiere, niveau: corps?.niveau ?? ligne.niveau }, etat.profil);
    if (!r.ok) return erreur(etat, r.code, 400);
    return reponse({ ...etat, classes: etat.classes.map((c) => (c.id === ligne.id ? { ...c, ...r.classe } : c)) }, 200, { classe: { id: ligne.id, ...r.classe } });
  }
  if (est("POST", "invitations")) {
    const r = validerDemandeInvitation(corps);
    if (!r.ok) return erreur(etat, r.code, 400);
    if (!etat.profil) return erreur(etat, "profil-requis", 409);
    const { mode, classeId, dureeJours } = r.invitation;
    if (mode === "classe" && !etat.classes.some((c) => c.id === classeId)) return erreur(etat, "introuvable", 404);
    if (actives(etat).length >= MAX_INVITATIONS_ACTIVES) return erreur(etat, "quota-invitations", 409);
    const invitation = {
      id: `demo-invitation-${etat.compteur + 1}`, code: tirerCodeProf(aleatoire), classeId, mode, expire: s + dureeJours * 86400,
      utilisations: 0, max: mode === "classe" ? MAX_ELEVES_CLASSE : 1, creeLe: new Date(maintenant).toISOString().replace("T", " ").slice(0, 19)
    };
    const { creeLe, utilisations, ...publique } = invitation;
    return reponse({ ...etat, compteur: etat.compteur + 1, invitations: [invitation, ...actives(etat)] }, 201, publique);
  }
  if (methode === "POST" && (m = route.match(/^invitations\/([a-z0-9-]+)\/revoquer$/))) {
    if (!etat.invitations.some((i) => i.id === m[1])) return erreur(etat, "introuvable", 404);
    return reponse({ ...etat, invitations: etat.invitations.filter((i) => i.id !== m[1]) }, 204);
  }
  if (est("GET", "eleves")) return reponse(etat, 200, { classes: etat.classes, eleves: etat.eleves.map((e) => ({ ...e, bilanMaj: e.bilan ? e.bilan.jour : null })) });
  if (methode === "POST" && (m = route.match(/^eleves\/([a-z0-9-]+)\/(deplacer|retirer)$/))) {
    const eleve = etat.eleves.find((e) => e.id === m[1]);
    if (!eleve) return erreur(etat, "introuvable", 404);
    if (m[2] === "retirer") return reponse({ ...etat, eleves: etat.eleves.filter((e) => e.id !== eleve.id) }, 204);
    const cible = corps?.classeId ? String(corps.classeId) : null;
    if (cible && !etat.classes.some((c) => c.id === cible)) return erreur(etat, "introuvable", 404);
    if (cible && eleve.classeId !== cible && etat.eleves.filter((e) => e.classeId === cible).length >= MAX_ELEVES_CLASSE) return erreur(etat, "classe-complete", 409);
    return reponse({ ...etat, eleves: etat.eleves.map((e) => (e.id === eleve.id ? { ...e, classeId: cible } : e)) }, 200, { id: eleve.id, classeId: cible });
  }
  // Démonstration seulement : un élève fictif rejoint par le lien (le parcours réel se fait depuis le compte de l'élève).
  if (methode === "POST" && (m = route.match(/^demo\/simuler\/([a-z0-9-]+)$/))) {
    const inv = actives(etat).find((i) => i.id === m[1]);
    if (!inv) return erreur(etat, "code-invalide", 400);
    if (etat.eleves.length >= MAX_ELEVES_PROF) return erreur(etat, "classe-complete", 409);
    const n = etat.compteur + 1;
    const aujourdhui = new Date(maintenant).toISOString().slice(0, 10);
    const eleve = {
      id: `demo-eleve-n${n}`, pseudo: `${PSEUDOS[n % PSEUDOS.length]} ${n}`, classeId: inv.classeId, rejointLe: aujourdhui,
      bilan: n % 2 ? bilanFictif(aujourdhui, n, (etat.notions ?? []).slice(0, 3)) : null
    };
    return reponse({
      ...etat, compteur: n, eleves: [...etat.eleves, eleve],
      invitations: etat.invitations.map((i) => (i.id === inv.id ? { ...i, utilisations: i.utilisations + 1 } : i))
    }, 201, { pseudo: eleve.pseudo });
  }
  return erreur(etat, "introuvable", 404);
}
