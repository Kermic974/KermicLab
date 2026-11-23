// Expérience Professeur des comptes locaux (ADR 0030). Routes `/api/professeur/…`, session porteuse du compte local
// (ADR 0024), mêmes garanties que l'Espace famille (ADR 0029).
//
// - Un compte « professeur » est un compte local dont le rôle (back-office, ADR 0026) donne la permission
//   `professeur` (rôle système « Professeur »). Il configure son profil (nom affiché, matières, niveaux), gère ses
//   classes et crée des liens d'invitation : un lien de classe (plusieurs élèves, jusqu'à expiration) ou un lien de
//   cours particulier (usage unique). Seule l'empreinte du code est gardée.
// - Un élève connecté ouvre le lien, voit qui l'invite et ce qui sera partagé, choisit son pseudo et donne son accord.
//   Il peut quitter un professeur à tout moment ; son bilan est effacé quand il n'a plus de professeur.
// - Le professeur ne voit du bilan que les notions des matières concernées (celle de la classe, ou celles de son
//   profil pour un cours particulier).
// Toute règle est vérifiée ici : masquer une action dans l'interface ne suffit jamais.
import { validerPseudo } from "../../web/profil.js";
import { sha256Hex } from "../../web/compte-local.js";
import { validerBilan } from "../../web/famille.js";
import {
  MAX_ACTIVITES_ACTIVES, MAX_CLASSES, MAX_ELEVES_CLASSE, MAX_ELEVES_PROF, MAX_INVITATIONS_ACTIVES, MAX_PROFS_ELEVE, VERSION_ACCORD_ELEVE,
  bilanPourProfesseur, lireProfilProf, matieresSuivies, normaliserCodeProf, parametresActivite, tirerCodeProf, validerActivite,
  validerAdhesion, validerClasse, validerDemandeInvitation, validerProfilProf, validerResultat
} from "../../web/professeur.js";
import { compteDeSession } from "./compte-local.js";
import { attributionDuCompte } from "./attributions.js";
import { roleContributionCompteLocal } from "./contributions.js";
import { roleRelecteurDuCompte } from "./relectures.js";
import { lireConfiguration } from "./configuration.js";
import { appelerAliasGateway } from "./llm.js";
import { SCHEMA_CAHIER, lireDemandeCahier, messageCahier, normaliserCahier, promptCahier } from "./cahier-llm.js";

export const PREFIXE = "/api/professeur/";
const TAILLE_MAX_CORPS = 64 * 1024;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const json = (donnees, statut = 200) => new Response(JSON.stringify(donnees), {
  status: statut,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const erreur = (code, statut, extra = {}) => json({ erreur: code, ...extra }, statut);
const vide = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
const maintenant = () => Math.floor(Date.now() / 1000);
const jourUtc = (instant = Date.now()) => new Date(instant).toISOString().slice(0, 10);
const lireJson = (texte, defaut = null) => { try { return JSON.parse(texte); } catch { return defaut; } };

export const estRouteProfesseur = (chemin) => chemin.startsWith(PREFIXE);

async function lireCorps(requete) {
  if (requete.method === "GET") return { corps: {} };
  const texte = await requete.text();
  if (texte.length > TAILLE_MAX_CORPS) return { reponse: erreur("corps-trop-grand", 413) };
  if (!texte) return { corps: {} };
  const corps = lireJson(texte);
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) return { reponse: erreur("corps-invalide", 400) };
  return { corps };
}

/**
 * Rôles cumulés du compte local (ADR 0034) : rôles attribués dans le back-office et rôle de sa souscription.
 * « visiteur » sans attribution ou si la table manque.
 */
const roleDuCompte = (env, compteId) => attributionDuCompte(env, "compte-local", compteId);

/** L'un des rôles cumulés donne-t-il la permission `professeur` ? Rôles effectifs (surcharges du back-office comprises). */
const rolePermetProfesseur = (env, attribution) => attribution.permissions.includes("professeur");

const profilDe = async (env, compteId) => lireProfilProf(
  await env.DB.prepare("SELECT nom_affiche, matieres, niveaux FROM professeurs_profils WHERE compte_id = ?").bind(compteId).first()
);
const classePublique = (l) => ({ id: l.id, nom: l.nom, matiere: l.matiere, niveau: l.niveau, creeLe: l.cree_le });
const compter = async (env, sql, ...valeurs) => (await env.DB.prepare(sql).bind(...valeurs).first())?.n ?? 0;

/** Matière d'une notion du catalogue (premier segment du sujet), null si la notion est inconnue. */
const matiereDe = (catalogue) => {
  const parId = new Map((catalogue?.index?.maquettes ?? []).filter((m) => !catalogue.pages || catalogue.pages[m.id])
    .map((m) => [m.id, String(m.sujet ?? "").split("/")[0] || null]));
  return (id) => parId.get(id) ?? null;
};

/**
 * Efface ce qui rattachait un élève aux activités d'un professeur (il le quitte ou en est retiré) : ses résultats et
 * les activités qui lui étaient données personnellement.
 */
const effacerLienActivites = (env, profId, eleveId) => [
  env.DB.prepare("DELETE FROM professeurs_resultats WHERE eleve_id = ? AND activite_id IN (SELECT id FROM professeurs_activites WHERE prof_id = ?)").bind(eleveId, profId),
  env.DB.prepare("DELETE FROM professeurs_activites WHERE prof_id = ? AND eleve_id = ?").bind(profId, eleveId)
];

// ---------- Côté élève (tout compte local connecté) ----------

/** Invitation encore valable pour ce code (non expirée, places restantes), avec sa classe. */
async function invitationValable(env, code) {
  const inv = await env.DB.prepare(
    "SELECT id, prof_id, classe_id, mode, expire_a, utilisations, utilisations_max FROM professeurs_invitations WHERE code_hash = ? AND expire_a > ?"
  ).bind(await sha256Hex(code), maintenant()).first();
  if (!inv || inv.utilisations >= inv.utilisations_max) return null;
  const classe = inv.classe_id ? await env.DB.prepare("SELECT * FROM professeurs_classes WHERE id = ?").bind(inv.classe_id).first() : null;
  if (inv.mode === "classe" && !classe) return null;
  const profil = await profilDe(env, inv.prof_id);
  return profil ? { inv, classe, profil } : null;
}

async function apercuInvitation(env, moi, brut) {
  const code = normaliserCodeProf(brut);
  // Même réponse pour un code mal formé, inconnu, expiré ou épuisé.
  const trouve = code ? await invitationValable(env, code) : null;
  if (!trouve) return erreur("code-invalide", 400);
  const { inv, classe, profil } = trouve;
  const deja = await env.DB.prepare("SELECT classe_id FROM professeurs_eleves WHERE prof_id = ? AND eleve_id = ?").bind(inv.prof_id, moi).first();
  return json({
    professeur: profil.nomAffiche, mode: inv.mode, matieres: classe ? [classe.matiere] : profil.matieres,
    classe: classe ? { nom: classe.nom, matiere: classe.matiere, niveau: classe.niveau } : null,
    expire: inv.expire_a, deja: !!deja, soiMeme: inv.prof_id === moi, accord: VERSION_ACCORD_ELEVE
  });
}

async function rejoindre(env, moi, corps) {
  const code = normaliserCodeProf(corps?.code);
  const trouve = code ? await invitationValable(env, code) : null;
  if (!trouve) return erreur("code-invalide", 400);
  const { inv, classe, profil } = trouve;
  if (inv.prof_id === moi) return erreur("propre-invitation", 409);
  const adhesion = validerAdhesion(corps, { validerPseudo });
  if (!adhesion.ok) return erreur(adhesion.code, 400);
  const deja = await env.DB.prepare("SELECT classe_id FROM professeurs_eleves WHERE prof_id = ? AND eleve_id = ?").bind(inv.prof_id, moi).first();
  if (!deja) {
    if ((await compter(env, "SELECT count(*) AS n FROM professeurs_eleves WHERE eleve_id = ?", moi)) >= MAX_PROFS_ELEVE) return erreur("quota-professeurs", 409);
    if ((await compter(env, "SELECT count(*) AS n FROM professeurs_eleves WHERE prof_id = ?", inv.prof_id)) >= MAX_ELEVES_PROF) return erreur("classe-complete", 409);
  }
  if (classe && deja?.classe_id !== classe.id
    && (await compter(env, "SELECT count(*) AS n FROM professeurs_eleves WHERE classe_id = ?", classe.id)) >= MAX_ELEVES_CLASSE) return erreur("classe-complete", 409);
  // Déjà suivi par ce professeur : le nouveau lien change seulement de classe (ou passe en cours particulier).
  const { meta } = await env.DB.prepare(
    "UPDATE professeurs_invitations SET utilisations = utilisations + 1 WHERE id = ? AND utilisations < utilisations_max AND expire_a > ?"
  ).bind(inv.id, maintenant()).run();
  if (!(meta?.changes > 0)) return erreur("code-invalide", 400);
  await env.DB.prepare(`INSERT INTO professeurs_eleves (prof_id, eleve_id, classe_id, pseudo, accord_version) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (prof_id, eleve_id) DO UPDATE SET classe_id = excluded.classe_id, pseudo = excluded.pseudo, accord_version = excluded.accord_version`)
    .bind(inv.prof_id, moi, classe?.id ?? null, adhesion.pseudo, VERSION_ACCORD_ELEVE).run();
  return json({
    professeur: profil.nomAffiche, mode: inv.mode, pseudo: adhesion.pseudo,
    classe: classe ? { nom: classe.nom, matiere: classe.matiere, niveau: classe.niveau } : null
  }, 201);
}

async function mesProfesseurs(env, moi) {
  const { results } = await env.DB.prepare(`SELECT e.prof_id, e.pseudo, e.rejoint_le, c.nom, c.matiere, c.niveau, p.nom_affiche, p.matieres
    FROM professeurs_eleves e LEFT JOIN professeurs_classes c ON c.id = e.classe_id LEFT JOIN professeurs_profils p ON p.compte_id = e.prof_id
    WHERE e.eleve_id = ? ORDER BY e.rejoint_le, e.rowid`).bind(moi).all();
  return json({
    professeurs: (results ?? []).map((l) => ({
      id: l.prof_id, professeur: l.nom_affiche ?? "", pseudo: l.pseudo, rejointLe: l.rejoint_le,
      classe: l.nom ? { nom: l.nom, matiere: l.matiere, niveau: l.niveau } : null,
      matieres: l.nom ? [l.matiere] : lireJson(l.matieres, [])
    }))
  });
}

async function quitter(env, moi, profId) {
  if (!(await env.DB.prepare("SELECT 1 AS ok FROM professeurs_eleves WHERE prof_id = ? AND eleve_id = ?").bind(profId, moi).first())) return erreur("introuvable", 404);
  await env.DB.batch([
    ...effacerLienActivites(env, profId, moi),
    env.DB.prepare("DELETE FROM professeurs_eleves WHERE prof_id = ? AND eleve_id = ?").bind(profId, moi)
  ]);
  if (!(await compter(env, "SELECT count(*) AS n FROM professeurs_eleves WHERE eleve_id = ?", moi))) {
    await env.DB.prepare("DELETE FROM professeurs_bilans WHERE eleve_id = ?").bind(moi).run();
  }
  return vide();
}

async function enregistrerBilan(env, moi, corps) {
  if (!(await compter(env, "SELECT count(*) AS n FROM professeurs_eleves WHERE eleve_id = ?", moi))) return erreur("aucun-professeur", 403);
  const bilan = validerBilan(corps?.bilan);
  if (!bilan) return erreur("bilan-invalide", 400);
  // Rien d'utile au professeur ne passe par les badges ou les cahiers de la famille : ils ne sont pas gardés.
  const garde = { ...bilan, badges: [], cahiers: [] };
  await env.DB.prepare(`INSERT INTO professeurs_bilans (eleve_id, bilan, maj_le) VALUES (?, ?, datetime('now'))
    ON CONFLICT (eleve_id) DO UPDATE SET bilan = excluded.bilan, maj_le = excluded.maj_le`).bind(moi, JSON.stringify(garde)).run();
  return vide();
}

// ---------- Côté professeur ----------

async function enregistrerProfil(env, moi, corps) {
  const r = validerProfilProf(corps);
  if (!r.ok) return erreur(r.code, 400);
  const { nomAffiche, matieres, niveaux } = r.profil;
  await env.DB.prepare(`INSERT INTO professeurs_profils (compte_id, nom_affiche, matieres, niveaux, maj_le) VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT (compte_id) DO UPDATE SET nom_affiche = excluded.nom_affiche, matieres = excluded.matieres, niveaux = excluded.niveaux, maj_le = excluded.maj_le`)
    .bind(moi, nomAffiche, JSON.stringify(matieres), JSON.stringify(niveaux)).run();
  return json({ profil: r.profil });
}

async function classes(env, moi) {
  const [{ results: lignes }, { results: effectifs }, { results: invitations }] = await Promise.all([
    env.DB.prepare("SELECT * FROM professeurs_classes WHERE prof_id = ? ORDER BY cree_le, rowid").bind(moi).all(),
    env.DB.prepare("SELECT classe_id, count(*) AS n FROM professeurs_eleves WHERE prof_id = ? GROUP BY classe_id").bind(moi).all(),
    env.DB.prepare(`SELECT id, classe_id, mode, expire_a, utilisations, utilisations_max, cree_le FROM professeurs_invitations
      WHERE prof_id = ? AND expire_a > ? AND utilisations < utilisations_max ORDER BY cree_le DESC, rowid DESC`).bind(moi, maintenant()).all()
  ]);
  const effectif = new Map((effectifs ?? []).map((e) => [e.classe_id ?? null, e.n]));
  return json({
    classes: (lignes ?? []).map((l) => ({ ...classePublique(l), eleves: effectif.get(l.id) ?? 0 })),
    particuliers: effectif.get(null) ?? 0,
    invitations: (invitations ?? []).map((i) => ({
      id: i.id, classeId: i.classe_id, mode: i.mode, expire: i.expire_a, utilisations: i.utilisations, max: i.utilisations_max, creeLe: i.cree_le
    })),
    limites: { classes: MAX_CLASSES, elevesParClasse: MAX_ELEVES_CLASSE, eleves: MAX_ELEVES_PROF }
  });
}

async function creerClasse(env, moi, corps) {
  const r = validerClasse(corps, await profilDe(env, moi));
  if (!r.ok) return erreur(r.code, r.code === "profil-requis" ? 409 : 400);
  if ((await compter(env, "SELECT count(*) AS n FROM professeurs_classes WHERE prof_id = ?", moi)) >= MAX_CLASSES) return erreur("quota-classes", 409);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO professeurs_classes (id, prof_id, nom, matiere, niveau) VALUES (?, ?, ?, ?, ?)")
    .bind(id, moi, r.classe.nom, r.classe.matiere, r.classe.niveau).run();
  return json({ classe: { id, ...r.classe, eleves: 0 } }, 201);
}

const classeDuProf = (env, moi, id) => env.DB.prepare("SELECT * FROM professeurs_classes WHERE id = ? AND prof_id = ?").bind(id, moi).first();

async function modifierClasse(env, moi, id, corps) {
  const ligne = await classeDuProf(env, moi, id);
  if (!ligne) return erreur("introuvable", 404);
  const r = validerClasse({ nom: corps?.nom ?? ligne.nom, matiere: corps?.matiere ?? ligne.matiere, niveau: corps?.niveau ?? ligne.niveau }, await profilDe(env, moi));
  if (!r.ok) return erreur(r.code, 400);
  await env.DB.prepare("UPDATE professeurs_classes SET nom = ?, matiere = ?, niveau = ? WHERE id = ?").bind(r.classe.nom, r.classe.matiere, r.classe.niveau, id).run();
  return json({ classe: { id, ...r.classe } });
}

async function supprimerClasse(env, moi, id) {
  if (!(await classeDuProf(env, moi, id))) return erreur("introuvable", 404);
  // Les élèves de la classe ne sont plus suivis (ils pourront rejoindre une autre classe par un nouveau lien).
  await env.DB.batch([
    env.DB.prepare("DELETE FROM professeurs_resultats WHERE activite_id IN (SELECT id FROM professeurs_activites WHERE classe_id = ?)").bind(id),
    env.DB.prepare("DELETE FROM professeurs_activites WHERE classe_id = ?").bind(id),
    env.DB.prepare("DELETE FROM professeurs_invitations WHERE classe_id = ?").bind(id),
    env.DB.prepare("DELETE FROM professeurs_eleves WHERE classe_id = ? AND prof_id = ?").bind(id, moi),
    env.DB.prepare("DELETE FROM professeurs_bilans WHERE eleve_id NOT IN (SELECT eleve_id FROM professeurs_eleves)").bind(),
    env.DB.prepare("DELETE FROM professeurs_classes WHERE id = ?").bind(id)
  ]);
  return vide();
}

async function creerInvitation(env, moi, corps) {
  const r = validerDemandeInvitation(corps);
  if (!r.ok) return erreur(r.code, 400);
  if (!(await profilDe(env, moi))) return erreur("profil-requis", 409);
  const { mode, classeId, dureeJours } = r.invitation;
  if (mode === "classe" && !(await classeDuProf(env, moi, classeId))) return erreur("introuvable", 404);
  if ((await compter(env, "SELECT count(*) AS n FROM professeurs_invitations WHERE prof_id = ? AND expire_a > ?", moi, maintenant())) >= MAX_INVITATIONS_ACTIVES) {
    return erreur("quota-invitations", 409);
  }
  const code = tirerCodeProf((n) => crypto.getRandomValues(new Uint8Array(n)));
  const id = crypto.randomUUID();
  const expire = maintenant() + dureeJours * 86400;
  const max = mode === "classe" ? MAX_ELEVES_CLASSE : 1;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM professeurs_invitations WHERE prof_id = ? AND expire_a <= ?").bind(moi, maintenant()),
    env.DB.prepare("INSERT INTO professeurs_invitations (id, code_hash, prof_id, classe_id, mode, expire_a, utilisations_max) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, await sha256Hex(code), moi, classeId, mode, expire, max)
  ]);
  return json({ id, code, mode, classeId, expire, max }, 201);
}

async function revoquerInvitation(env, moi, id) {
  const { meta } = await env.DB.prepare("DELETE FROM professeurs_invitations WHERE id = ? AND prof_id = ?").bind(id, moi).run();
  return meta?.changes > 0 ? vide() : erreur("introuvable", 404);
}

async function eleves(env, moi, catalogue) {
  const [profil, { results: lignes }, { results: lignesClasses }] = await Promise.all([
    profilDe(env, moi),
    env.DB.prepare(`SELECT e.eleve_id, e.classe_id, e.pseudo, e.rejoint_le, b.bilan, b.maj_le FROM professeurs_eleves e
      LEFT JOIN professeurs_bilans b ON b.eleve_id = e.eleve_id WHERE e.prof_id = ? ORDER BY e.pseudo COLLATE NOCASE, e.rowid`).bind(moi).all(),
    env.DB.prepare("SELECT * FROM professeurs_classes WHERE prof_id = ? ORDER BY cree_le, rowid").bind(moi).all()
  ]);
  const listeClasses = (lignesClasses ?? []).map(classePublique);
  const matiere = matiereDe(catalogue);
  return json({
    classes: listeClasses,
    eleves: (lignes ?? []).map((l) => {
      const e = { id: l.eleve_id, pseudo: l.pseudo, classeId: l.classe_id, rejointLe: l.rejoint_le };
      const bilan = l.bilan ? bilanPourProfesseur(lireJson(l.bilan), matieresSuivies(e, listeClasses, profil), matiere) : null;
      return { ...e, bilan, bilanMaj: bilan ? l.maj_le : null };
    })
  });
}

const eleveDuProf = (env, moi, id) => env.DB.prepare("SELECT eleve_id, classe_id FROM professeurs_eleves WHERE prof_id = ? AND eleve_id = ?").bind(moi, id).first();

async function deplacerEleve(env, moi, id, corps) {
  const lien = await eleveDuProf(env, moi, id);
  if (!lien) return erreur("introuvable", 404);
  const cible = corps?.classeId ? String(corps.classeId) : null;
  if (cible) {
    if (!(await classeDuProf(env, moi, cible))) return erreur("introuvable", 404);
    if (lien.classe_id !== cible && (await compter(env, "SELECT count(*) AS n FROM professeurs_eleves WHERE classe_id = ?", cible)) >= MAX_ELEVES_CLASSE) {
      return erreur("classe-complete", 409);
    }
  }
  await env.DB.prepare("UPDATE professeurs_eleves SET classe_id = ? WHERE prof_id = ? AND eleve_id = ?").bind(cible, moi, id).run();
  return json({ id, classeId: cible });
}

async function retirerEleve(env, moi, id) {
  if (!(await eleveDuProf(env, moi, id))) return erreur("introuvable", 404);
  await env.DB.batch([
    ...effacerLienActivites(env, moi, id),
    env.DB.prepare("DELETE FROM professeurs_eleves WHERE prof_id = ? AND eleve_id = ?").bind(moi, id),
    env.DB.prepare("DELETE FROM professeurs_bilans WHERE eleve_id = ? AND eleve_id NOT IN (SELECT eleve_id FROM professeurs_eleves)").bind(id)
  ]);
  return vide();
}

// ---------- Activités (ADR 0030 §9) ----------

const activitePublique = (l) => ({
  id: l.id, type: l.type, classeId: l.classe_id, eleveId: l.eleve_id, parametres: lireJson(l.parametres, {}),
  echeance: l.echeance, statut: l.statut, creeLe: l.cree_le, source: l.contenu ? "ia" : "catalogue"
});
const resultatPublic = (r) => ({
  activite: r.activite_id, eleve: r.eleve_id, reussis: r.reussis, total: r.total, meilleur: r.meilleur, tentatives: r.tentatives,
  dureeS: r.duree_s, termine: r.termine === 1, debutLe: r.debut_le, majLe: r.maj_le
});

/** Cahiers rédigés par l'IA aujourd'hui pour ce professeur (plafond : CAHIERS_GENERATIONS_JOUR). */
async function quotaCahiersProf(env, moi, iaCahier) {
  const limite = iaCahier ? lireConfiguration(env).CAHIERS_GENERATIONS_JOUR : 0;
  const ligne = await env.DB.prepare("SELECT appels FROM professeurs_consommations WHERE prof_id = ? AND jour = ?").bind(moi, jourUtc()).first();
  const utilisees = ligne?.appels ?? 0;
  return { ia: iaCahier, limite, utilisees, restantes: Math.max(0, limite - utilisees) };
}

/** Rédige le cahier par l'IA (même constructeur que « Mes cahiers », ADR 0022) ; null et la raison sinon. */
async function genererCahierProf(env, moi, catalogue, activite, { iaCahier, langue }) {
  const demande = lireDemandeCahier(catalogue, { ...activite.cahier, notions: activite.notions });
  if (!demande) return { cahier: null, raison: "demande-invalide" };
  if (!activite.cahier.ia) return { cahier: null, raison: "ia-inactive" };
  if (!iaCahier) return { cahier: null, raison: "ia-indisponible" };
  const { limite } = await quotaCahiersProf(env, moi, iaCahier);
  const { meta } = await env.DB.prepare(`INSERT INTO professeurs_consommations (prof_id, jour, appels, tokens) VALUES (?, ?, 1, 0)
    ON CONFLICT (prof_id, jour) DO UPDATE SET appels = appels + 1 WHERE appels < ?`).bind(moi, jourUtc(), limite).run();
  if (!(meta?.changes > 0)) return { cahier: null, raison: "quota" };
  let cahier = null, raison = "sortie-invalide", tokens = 0;
  try {
    const generation = await appelerAliasGateway(env, {
      system: promptCahier(langue), message: messageCahier(catalogue, demande, langue),
      schema: SCHEMA_CAHIER, maxTokens: lireConfiguration(env).MAX_TOKENS_CAHIERS, cleModele: "MODELE_CAHIERS", nomSchema: "cahier"
    });
    tokens = Number.isSafeInteger(generation?.tokensSortie) ? generation.tokensSortie : 0;
    if (generation.refus) raison = "refus";
    else if (generation.tronque) raison = "sortie-tronquee";
    else {
      const brut = normaliserCahier(generation.contenu, demande);
      if (brut.sections.length) { cahier = brut; raison = null; }
    }
  } catch {
    console.error("llm cahier professeur");
  }
  if (tokens) await env.DB.prepare("UPDATE professeurs_consommations SET tokens = tokens + ? WHERE prof_id = ? AND jour = ?").bind(tokens, moi, jourUtc()).run();
  return { cahier, raison };
}

async function creerActivite(env, moi, corps, { catalogue, iaCahier }) {
  const r = validerActivite(corps, { profil: await profilDe(env, moi), matiereDe: matiereDe(catalogue), aujourdhui: jourUtc() });
  if (!r.ok) return erreur(r.code, r.code === "profil-requis" ? 409 : 400);
  const a = r.activite;
  if (a.cible.classeId && !(await classeDuProf(env, moi, a.cible.classeId))) return erreur("introuvable", 404);
  if (a.cible.eleveId && !(await eleveDuProf(env, moi, a.cible.eleveId))) return erreur("introuvable", 404);
  if ((await compter(env, "SELECT count(*) AS n FROM professeurs_activites WHERE prof_id = ? AND statut = 'active'", moi)) >= MAX_ACTIVITES_ACTIVES) {
    return erreur("quota-activites", 409);
  }
  let contenu = null, raison = null;
  if (a.type === "cahier") {
    const g = await genererCahierProf(env, moi, catalogue, a, { iaCahier, langue: corps?.langue === "en" ? "en" : "fr" });
    contenu = g.cahier;
    raison = g.raison;
  }
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO professeurs_activites (id, prof_id, type, classe_id, eleve_id, parametres, contenu, echeance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, moi, a.type, a.cible.classeId, a.cible.eleveId, JSON.stringify(parametresActivite(a)), contenu ? JSON.stringify(contenu) : null, a.echeance).run();
  return json({
    id, type: a.type, source: contenu ? "ia" : "catalogue", raison,
    ...(a.type === "cahier" ? { quota: await quotaCahiersProf(env, moi, iaCahier) } : {})
  }, 201);
}

async function activites(env, moi, { iaCahier }) {
  const [{ results: lignes }, { results: res }] = await Promise.all([
    env.DB.prepare("SELECT * FROM professeurs_activites WHERE prof_id = ? ORDER BY cree_le DESC, rowid DESC LIMIT 200").bind(moi).all(),
    env.DB.prepare(`SELECT r.* FROM professeurs_resultats r JOIN professeurs_activites a ON a.id = r.activite_id
      JOIN professeurs_eleves e ON e.prof_id = a.prof_id AND e.eleve_id = r.eleve_id WHERE a.prof_id = ?`).bind(moi).all()
  ]);
  return json({
    activites: (lignes ?? []).map(activitePublique), resultats: (res ?? []).map(resultatPublic),
    limites: { activites: MAX_ACTIVITES_ACTIVES }, cahiersIa: await quotaCahiersProf(env, moi, iaCahier)
  });
}

async function changerActivite(env, moi, id, action) {
  if (!(await env.DB.prepare("SELECT id FROM professeurs_activites WHERE id = ? AND prof_id = ?").bind(id, moi).first())) return erreur("introuvable", 404);
  if (action === "archiver") await env.DB.prepare("UPDATE professeurs_activites SET statut = 'archivee' WHERE id = ?").bind(id).run();
  else {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM professeurs_resultats WHERE activite_id = ?").bind(id),
      env.DB.prepare("DELETE FROM professeurs_activites WHERE id = ?").bind(id)
    ]);
  }
  return vide();
}

/** Activités actives données à l'élève par ses professeurs (personnellement ou à sa classe), avec son résultat. */
async function lignesMesActivites(env, moi) {
  const { results } = await env.DB.prepare(`SELECT a.*, p.nom_affiche FROM professeurs_activites a
    JOIN professeurs_eleves e ON e.prof_id = a.prof_id AND e.eleve_id = ?
    LEFT JOIN professeurs_profils p ON p.compte_id = a.prof_id
    WHERE a.statut = 'active' AND (a.eleve_id = e.eleve_id OR (a.classe_id IS NOT NULL AND a.classe_id = e.classe_id))
    ORDER BY a.cree_le DESC, a.rowid DESC LIMIT 100`).bind(moi).all();
  return results ?? [];
}

export async function activitesPourEleve(env, moi, { inclureContenu = true } = {}) {
  const lignes = await lignesMesActivites(env, moi);
  const { results: res } = await env.DB.prepare("SELECT * FROM professeurs_resultats WHERE eleve_id = ?").bind(moi).all();
  const resultat = new Map((res ?? []).map((r) => [r.activite_id, resultatPublic(r)]));
  return {
    activites: lignes.map((l) => ({
      ...activitePublique(l), professeur: l.nom_affiche ?? "", ...(inclureContenu ? { contenu: lireJson(l.contenu, null) } : {}), resultat: resultat.get(l.id) ?? null
    }))
  };
}

async function enregistrerResultats(env, moi, corps) {
  const liste = (Array.isArray(corps?.resultats) ? corps.resultats : []).slice(0, 50).map(validerResultat).filter(Boolean);
  if (!liste.length) return erreur("resultats-invalides", 400);
  const miennes = new Map((await lignesMesActivites(env, moi)).map((l) => [l.id, l]));
  const refuses = [];
  for (const r of liste) {
    const a = miennes.get(r.activite);
    if (!a || a.type === "objectif") { refuses.push({ activite: r.activite, raison: "introuvable" }); continue; }
    const avant = await env.DB.prepare("SELECT termine FROM professeurs_resultats WHERE activite_id = ? AND eleve_id = ?").bind(a.id, moi).first();
    // Une évaluation ne se passe qu'une fois : le premier résultat terminé fait foi.
    if (a.type === "evaluation" && avant?.termine === 1) { refuses.push({ activite: a.id, raison: "deja-terminee" }); continue; }
    const termine = a.type === "cahier" ? r.total > 0 && r.reussis >= r.total : r.termine;
    const essai = a.type === "defi" && r.termine ? 1 : 0;
    await env.DB.prepare(`INSERT INTO professeurs_resultats (activite_id, eleve_id, reussis, total, meilleur, tentatives, duree_s, termine)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (activite_id, eleve_id) DO UPDATE SET reussis = excluded.reussis, total = excluded.total,
        meilleur = max(meilleur, excluded.meilleur), tentatives = tentatives + excluded.tentatives,
        duree_s = duree_s + excluded.duree_s, termine = max(termine, excluded.termine), maj_le = datetime('now')`)
      .bind(a.id, moi, r.reussis, r.total, r.termine ? r.reussis : 0, essai, r.dureeS, termine ? 1 : 0).run();
  }
  return json({ enregistres: liste.length - refuses.length, refuses });
}

/**
 * Traite une route `/api/professeur/…`.
 * @param {{ catalogue: object, autoriser?: (cle: string) => boolean, ip?: string }} options
 */
export async function gererApiProfesseur(requete, env, { catalogue, iaCahier = false, autoriser = () => true, ip = "inconnue" } = {}) {
  if (!env.DB) return erreur("professeur-indisponible", 503);
  const { pathname } = new URL(requete.url);
  const route = pathname.slice(PREFIXE.length);
  const methode = requete.method;
  const session = await compteDeSession(requete, env);
  if (!session) return erreur("non-connecte", 401);
  const moi = session.compteId;
  const { corps, reponse } = await lireCorps(requete);
  if (reponse) return reponse;
  const est = (m, r) => methode === m && route === r;
  let m;

  if (est("GET", "moi")) {
    const attribution = await roleDuCompte(env, moi);
    const professeur = rolePermetProfesseur(env, attribution);
    const role = attribution.roles[0];
    const roleRelecture = await roleRelecteurDuCompte(env, moi, "local");
    return json({
      // `id` : identifiant du compte (le sien), pour reconnaître ses propres contributions ; `contribution` : rôle de
      // contribution déduit des permissions (ADR 0023 §6 ter), null sans permission de proposer.
      // `relectureHumaine` : rôle de relecteur attribué à la main (ADR 0039), indépendant de la souscription.
      id: moi, role, roles: attribution.roles, professeur, contribution: await roleContributionCompteLocal(env, moi),
      relectureHumaine: !!roleRelecture, roleRelecture,
      profil: professeur ? await profilDe(env, moi) : null,
      professeurs: await compter(env, "SELECT count(*) AS n FROM professeurs_eleves WHERE eleve_id = ?", moi)
    });
  }
  // Côté élève. Anti force brute sur les codes (en mémoire, sans IP stockée).
  if (methode === "GET" && (m = route.match(/^invitation\/([A-Za-z0-9-]{1,20})$/))) {
    if (!autoriser(`professeur:${ip}`)) return erreur("trop-de-tentatives", 429);
    return apercuInvitation(env, moi, m[1]);
  }
  if (est("POST", "rejoindre")) {
    if (!autoriser(`professeur:${ip}`)) return erreur("trop-de-tentatives", 429);
    return rejoindre(env, moi, corps);
  }
  if (est("GET", "mes-professeurs")) return mesProfesseurs(env, moi);
  if (methode === "POST" && (m = route.match(new RegExp(`^mes-professeurs/(${UUID})/quitter$`)))) return quitter(env, moi, m[1]);
  if (est("PUT", "bilan")) return enregistrerBilan(env, moi, corps);
  if (est("GET", "mes-activites")) return json(await activitesPourEleve(env, moi));
  if (est("PUT", "resultats")) return enregistrerResultats(env, moi, corps);

  // Routes du professeur : rôle Professeur exigé (permission `professeur`).
  if (!rolePermetProfesseur(env, await roleDuCompte(env, moi))) return erreur("role-professeur-requis", 403);
  if (est("PUT", "profil")) return enregistrerProfil(env, moi, corps);
  if (est("GET", "classes")) return classes(env, moi);
  if (est("POST", "classes")) return creerClasse(env, moi, corps);
  if (methode === "POST" && (m = route.match(new RegExp(`^classes/(${UUID})/(modifier|supprimer)$`)))) {
    return m[2] === "modifier" ? modifierClasse(env, moi, m[1], corps) : supprimerClasse(env, moi, m[1]);
  }
  if (est("POST", "invitations")) return creerInvitation(env, moi, corps);
  if (methode === "POST" && (m = route.match(new RegExp(`^invitations/(${UUID})/revoquer$`)))) return revoquerInvitation(env, moi, m[1]);
  if (est("GET", "eleves")) return eleves(env, moi, catalogue);
  if (est("GET", "activites")) return activites(env, moi, { iaCahier });
  if (est("POST", "activites")) return creerActivite(env, moi, corps, { catalogue, iaCahier });
  if (methode === "POST" && (m = route.match(new RegExp(`^activites/(${UUID})/(archiver|supprimer)$`)))) return changerActivite(env, moi, m[1], m[2]);
  if (methode === "POST" && (m = route.match(new RegExp(`^eleves/(${UUID})/(deplacer|retirer)$`)))) {
    return m[2] === "deplacer" ? deplacerEleve(env, moi, m[1], corps) : retirerEleve(env, moi, m[1]);
  }
  return erreur("introuvable", 404);
}

/** Cron quotidien : liens d'invitation expirés ou épuisés ; compteurs d'IA de plus de 90 jours. */
export async function purgerProfesseur(env, instant = Date.now()) {
  if (!env.DB) return null;
  try {
    const { meta } = await env.DB.prepare("DELETE FROM professeurs_invitations WHERE expire_a <= ? OR utilisations >= utilisations_max")
      .bind(Math.floor(instant / 1000)).run();
    const conso = await env.DB.prepare("DELETE FROM professeurs_consommations WHERE jour < ?").bind(jourUtc(instant - 90 * 86400000)).run().catch(() => null);
    return { invitations: meta?.changes ?? 0, consommations: conso?.meta?.changes ?? 0 };
  } catch {
    return null;
  }
}
