// Espace famille des comptes locaux (ADR 0029). Routes `/api/famille/…`, session porteuse du compte local (ADR 0024).
//
// - Un compte « parent » est un compte local dont le rôle (back-office, ADR 0026) donne la permission `famille`.
// - Un compte solo invite son parent par un code à usage unique (48 h) ; le parent le saisit avec le prénom affiché, la
//   tranche d'âge et son consentement : le compte devient enfant sans rien perdre (sa progression reste sur l'appareil
//   et dans sa synchronisation chiffrée). Le parent peut aussi créer directement un compte enfant.
// - L'appareil de l'enfant envoie un bilan clair et borné (web/famille.js) : compteurs et identifiants du catalogue.
// - Le parent génère des cahiers (même constructeur que « Mes cahiers », ADR 0022) et les assigne ; l'enfant passe un
//   questionnaire de calibrage avant de commencer.
// - Consommations d'IA : compteurs par compte, jour et module, pour les membres d'une famille seulement.
// Toute règle est vérifiée ici : masquer une action dans l'interface ne suffit jamais.
import { validerPseudo } from "../../web/profil.js";
import { TRANCHES_AGE, VERSION_CONSENTEMENT } from "../../web/comptes.js";
import { sha256Hex, validerIdentifiant, validerMotDePasse } from "../../web/compte-local.js";
import {
  DUREE_INVITATION_S, MAX_ENFANTS_FAMILLE, MODULES_CONSOMMATION, lireCalibrage, normaliserCode, tirerCode, validerBilan, validerProfilEnfant
} from "../../web/famille.js";
import { compteDeSession, effacerCompteLocal, inscrireCompte, motDePasseDuCompte, remplacerMotDePasse } from "./compte-local.js";
import { instructionsEffacementFamille } from "./famille-donnees.js";
import { listerRoles, ROLES_SYSTEME } from "./roles.js";
import { lireConfiguration } from "./configuration.js";
import { appelerAliasGateway } from "./llm.js";
import { SCHEMA_CAHIER, lireDemandeCahier, messageCahier, normaliserCahier, promptCahier } from "./cahier-llm.js";
import { MATIERES_PROF, parametresActivite, validerActivite, validerResultat } from "../../web/professeur.js";

export const PREFIXE = "/api/famille/";
const TAILLE_MAX_CORPS = 64 * 1024;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** Fenêtre des consommations affichées au parent. */
export const JOURS_CONSOMMATIONS = 30;

const json = (donnees, statut = 200) => new Response(JSON.stringify(donnees), {
  status: statut,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const erreur = (code, statut, extra = {}) => json({ erreur: code, ...extra }, statut);
const maintenant = () => Math.floor(Date.now() / 1000);
const jourUtc = (instant = Date.now()) => new Date(instant).toISOString().slice(0, 10);
const lireJson = (texte, defaut = null) => { try { return JSON.parse(texte); } catch { return defaut; } };

export const estRouteFamille = (chemin) => chemin.startsWith(PREFIXE);

async function lireCorps(requete) {
  if (requete.method === "GET") return { corps: {} };
  const texte = await requete.text();
  if (texte.length > TAILLE_MAX_CORPS) return { reponse: erreur("corps-trop-grand", 413) };
  if (!texte) return { corps: {} };
  const corps = lireJson(texte);
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) return { reponse: erreur("corps-invalide", 400) };
  return { corps };
}

/** Rôle attribué au compte local (back-office) ; « visiteur » sans attribution ou si la table manque. */
async function roleDuCompte(env, compteId) {
  try {
    const a = await env.DB.prepare("SELECT role_id FROM attributions_roles WHERE type_compte = 'compte-local' AND compte_id = ?").bind(compteId).first();
    return a?.role_id ?? "visiteur";
  } catch {
    return "visiteur";
  }
}

/** Le rôle donne-t-il la permission `famille` ? Rôles effectifs (surcharges du back-office comprises). */
async function rolePermetFamille(env, role) {
  let permissions;
  try { permissions = (await listerRoles(env)).find((r) => r.id === role)?.permissions; } catch { permissions = ROLES_SYSTEME[role]?.permissions; }
  return (permissions ?? []).includes("famille");
}

const lienEnfant = (env, enfantId) => env.DB.prepare(
  "SELECT enfant_id, parent_id, prenom, tranche_age, origine, lie_le FROM familles_liens WHERE enfant_id = ?"
).bind(enfantId).first();
const nombreEnfants = async (env, parentId) => (await env.DB.prepare("SELECT count(*) AS n FROM familles_liens WHERE parent_id = ?").bind(parentId).first())?.n ?? 0;

/** Situation du compte dans une famille : parent possible, enfant rattaché, invitation en cours. */
async function situation(env, compteId) {
  const [role, lien, enfants, invitation] = await Promise.all([
    roleDuCompte(env, compteId), lienEnfant(env, compteId), nombreEnfants(env, compteId),
    env.DB.prepare("SELECT expire_a FROM familles_invitations WHERE enfant_id = ? AND expire_a > ?").bind(compteId, maintenant()).first()
  ]);
  const parent = !lien && await rolePermetFamille(env, role);
  return { role, parent, lien, enfants, invitation };
}

/** Un compte membre d'une famille (parent avec au moins un enfant, ou enfant rattaché) ? */
export async function membreFamille(env, compteId) {
  return !!(await env.DB.prepare("SELECT 1 AS ok FROM familles_liens WHERE enfant_id = ? OR parent_id = ? LIMIT 1").bind(compteId, compteId).first());
}

/**
 * Compte une consommation d'IA (appel et tokens générés) pour un membre d'une famille. Compteurs seulement ; rien
 * n'est noté pour un compte solo.
 */
export async function noterConsommation(env, compteId, module, { appels = 1, tokens = 0 } = {}, instant = Date.now()) {
  if (!MODULES_CONSOMMATION.includes(module) || !(await membreFamille(env, compteId))) return false;
  const t = Number.isSafeInteger(tokens) && tokens > 0 ? tokens : 0;
  await env.DB.prepare(`INSERT INTO familles_consommations (compte_id, jour, module, appels, tokens) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (compte_id, jour, module) DO UPDATE SET appels = appels + excluded.appels, tokens = tokens + excluded.tokens`)
    .bind(compteId, jourUtc(instant), module, appels, t).run();
  return true;
}

/** Consommation d'IA d'une requête portant une session de compte local (en-tête Authorization), sinon rien. */
export async function noterConsommationDeRequete(requete, env, module, mesure) {
  if (!env.DB || !/^Bearer /.test(requete.headers.get("authorization") || "")) return false;
  try {
    const session = await compteDeSession(requete, env);
    return session ? await noterConsommation(env, session.compteId, module, mesure) : false;
  } catch {
    return false; // tables absentes : la consommation n'est simplement pas comptée
  }
}

// ---------- Côté enfant (et compte solo) ----------

async function creerInvitation(env, compteId) {
  const s = await situation(env, compteId);
  if (s.lien) return erreur("deja-en-famille", 409);
  if (s.enfants > 0) return erreur("compte-parent", 409);
  const code = tirerCode((n) => crypto.getRandomValues(new Uint8Array(n)));
  const expire = maintenant() + DUREE_INVITATION_S;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM familles_invitations WHERE enfant_id = ? OR expire_a <= ?").bind(compteId, maintenant()),
    env.DB.prepare("INSERT INTO familles_invitations (code_hash, enfant_id, expire_a) VALUES (?, ?, ?)").bind(await sha256Hex(code), compteId, expire)
  ]);
  return json({ code, expire }, 201);
}

async function enregistrerBilan(env, compteId, corps) {
  if (!(await lienEnfant(env, compteId))) return erreur("pas-en-famille", 403);
  const bilan = validerBilan(corps?.bilan);
  if (!bilan) return erreur("bilan-invalide", 400);
  await env.DB.prepare(`INSERT INTO familles_bilans (enfant_id, bilan, maj_le) VALUES (?, ?, datetime('now'))
    ON CONFLICT (enfant_id) DO UPDATE SET bilan = excluded.bilan, maj_le = excluded.maj_le`).bind(compteId, JSON.stringify(bilan)).run();
  // L'avancement des cahiers assignés suit le bilan : un seul envoi par l'appareil de l'enfant.
  for (const c of bilan.cahiers) {
    await env.DB.prepare(`UPDATE familles_cahiers SET reussis = ?, total = ?, maj_le = datetime('now'),
      statut = CASE WHEN statut = 'archive' THEN statut WHEN ? > 0 AND ? >= ? THEN 'termine' ELSE statut END
      WHERE id = ? AND enfant_id = ? AND statut <> 'assigne'`).bind(c.reussis, c.total, c.total, c.reussis, c.total, c.famille, compteId).run();
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

const cahierPublic = (l, { contenu = false } = {}) => ({
  id: l.id, statut: l.statut, creeLe: l.cree_le, majLe: l.maj_le, reussis: l.reussis, total: l.total,
  demande: lireJson(l.demande, {}), calibrage: lireJson(l.calibrage, null),
  titre: lireJson(l.cahier, null)?.titre || null,
  ...(contenu ? { cahier: lireJson(l.cahier, null) } : {})
});

async function mesCahiers(env, compteId) {
  if (!(await lienEnfant(env, compteId))) return json({ cahiers: [] });
  const { results } = await env.DB.prepare(
    "SELECT * FROM familles_cahiers WHERE enfant_id = ? AND statut <> 'archive' ORDER BY cree_le DESC LIMIT 20"
  ).bind(compteId).all();
  return json({ cahiers: (results ?? []).map((l) => cahierPublic(l, { contenu: true })) });
}

async function calibrerCahier(env, compteId, id, corps) {
  const ligne = await env.DB.prepare("SELECT demande, statut FROM familles_cahiers WHERE id = ? AND enfant_id = ?").bind(id, compteId).first();
  if (!ligne) return erreur("introuvable", 404);
  if (ligne.statut !== "assigne") return erreur("deja-calibre", 409);
  const notions = lireJson(ligne.demande, {}).notions ?? [];
  const calibrage = lireCalibrage(corps?.resultats, notions);
  await env.DB.prepare("UPDATE familles_cahiers SET calibrage = ?, statut = 'en-cours', maj_le = datetime('now') WHERE id = ? AND enfant_id = ?")
    .bind(JSON.stringify(calibrage), id, compteId).run();
  return json({ calibrage });
}

// ---------- Côté parent ----------

async function exigerParent(env, compteId) {
  const s = await situation(env, compteId);
  return s.parent ? { s } : { reponse: erreur(s.lien ? "compte-enfant" : "role-parent-requis", 403) };
}

async function enfantDuParent(env, parentId, enfantId) {
  const lien = await lienEnfant(env, enfantId);
  return lien && lien.parent_id === parentId ? lien : null;
}

const regleProfil = { validerPrenom: validerPseudo, tranches: TRANCHES_AGE, versionConsentement: VERSION_CONSENTEMENT };

async function rattacher(env, parentId, enfantId, profil, origine) {
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO familles_liens (enfant_id, parent_id, prenom, tranche_age, consentement_version, origine)
      VALUES (?, ?, ?, ?, ?, ?)`).bind(enfantId, parentId, profil.prenom, profil.tranche, VERSION_CONSENTEMENT, origine),
    env.DB.prepare("DELETE FROM familles_invitations WHERE enfant_id = ?").bind(enfantId)
  ]);
}

async function rejoindre(env, parentId, corps) {
  if ((await nombreEnfants(env, parentId)) >= MAX_ENFANTS_FAMILLE) return erreur("quota-enfants", 409);
  const code = normaliserCode(corps?.code);
  if (!code) return erreur("code-invalide", 400);
  const profil = validerProfilEnfant(corps, regleProfil);
  if (!profil.ok) return erreur(profil.code, 400);
  const invitation = await env.DB.prepare("SELECT enfant_id FROM familles_invitations WHERE code_hash = ? AND expire_a > ?")
    .bind(await sha256Hex(code), maintenant()).first();
  // Même réponse pour un code inconnu, expiré ou déjà utilisé.
  if (!invitation) return erreur("code-invalide", 400);
  if (invitation.enfant_id === parentId) return erreur("code-invalide", 400);
  if (await lienEnfant(env, invitation.enfant_id)) return erreur("deja-en-famille", 409);
  if ((await nombreEnfants(env, invitation.enfant_id)) > 0) return erreur("compte-parent", 409);
  await rattacher(env, parentId, invitation.enfant_id, profil, "invitation");
  return json({ id: invitation.enfant_id, prenom: profil.prenom }, 201);
}

async function creerEnfant(env, parentId, corps) {
  if ((await nombreEnfants(env, parentId)) >= MAX_ENFANTS_FAMILLE) return erreur("quota-enfants", 409);
  const profil = validerProfilEnfant(corps, regleProfil);
  if (!profil.ok) return erreur(profil.code, 400);
  const id = validerIdentifiant(corps?.identifiant);
  if (!id.ok) return erreur(`identifiant-${id.erreur}`, 400);
  if (typeof corps?.motDePasse !== "string") return erreur("mot-de-passe-court", 400);
  const inscrit = await inscrireCompte(env, id.identifiant, corps.motDePasse);
  if (!inscrit.ok) return erreur(inscrit.code, inscrit.statut);
  await rattacher(env, parentId, inscrit.id, profil, "creation");
  return json({ id: inscrit.id, prenom: profil.prenom, identifiant: id.identifiant }, 201);
}

async function modifierEnfant(env, parentId, enfantId, corps) {
  const lien = await enfantDuParent(env, parentId, enfantId);
  if (!lien) return erreur("introuvable", 404);
  const profil = validerProfilEnfant({ prenom: corps?.prenom ?? lien.prenom, trancheAge: corps?.trancheAge ?? lien.tranche_age }, { ...regleProfil, consentementRequis: false });
  if (!profil.ok) return erreur(profil.code, 400);
  await env.DB.prepare("UPDATE familles_liens SET prenom = ?, tranche_age = ? WHERE enfant_id = ?").bind(profil.prenom, profil.tranche, enfantId).run();
  return json({ id: enfantId, prenom: profil.prenom, trancheAge: profil.tranche });
}

/** Actions sensibles : le mot de passe du parent est redemandé (une session ouverte ne suffit pas). */
async function reauthentifier(env, parentId, corps) {
  return motDePasseDuCompte(env, parentId, corps?.motDePasseParent);
}

async function nouveauMotDePasse(env, parentId, enfantId, corps) {
  if (!(await enfantDuParent(env, parentId, enfantId))) return erreur("introuvable", 404);
  if (!(await reauthentifier(env, parentId, corps))) return erreur("reauthentification", 401);
  // L'identifiant de l'enfant n'est pas connu du serveur : la règle « sans l'identifiant » est vérifiée par l'interface.
  const m = validerMotDePasse(corps?.motDePasse);
  if (!m.ok) return erreur(`mot-de-passe-${m.erreur}`, 400);
  await remplacerMotDePasse(env, enfantId, corps.motDePasse);
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

async function detacherEnfant(env, parentId, enfantId) {
  if (!(await enfantDuParent(env, parentId, enfantId))) return erreur("introuvable", 404);
  // Le compte de l'enfant redevient solo : liens, bilan, cahiers assignés et consommations sont effacés.
  await env.DB.batch(instructionsEffacementFamille(env, enfantId));
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

async function supprimerEnfant(env, parentId, enfantId, corps) {
  if (!(await enfantDuParent(env, parentId, enfantId))) return erreur("introuvable", 404);
  if (!(await reauthentifier(env, parentId, corps))) return erreur("reauthentification", 401);
  await effacerCompteLocal(env, enfantId);
  await env.DB.prepare("DELETE FROM attributions_roles WHERE type_compte = 'compte-local' AND compte_id = ?").bind(enfantId).run().catch(() => {});
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

async function tableau(env, parentId, { quotaCahiers }) {
  const [{ results: liens }, { results: bilans }, { results: cahiers }] = await Promise.all([
    env.DB.prepare("SELECT enfant_id, prenom, tranche_age, origine, lie_le FROM familles_liens WHERE parent_id = ? ORDER BY lie_le, rowid").bind(parentId).all(),
    env.DB.prepare("SELECT b.enfant_id, b.bilan, b.maj_le FROM familles_bilans b JOIN familles_liens l ON l.enfant_id = b.enfant_id WHERE l.parent_id = ?").bind(parentId).all(),
    env.DB.prepare("SELECT * FROM familles_cahiers WHERE parent_id = ? AND statut <> 'archive' ORDER BY cree_le DESC LIMIT 100").bind(parentId).all()
  ]);
  const bilanDe = new Map((bilans ?? []).map((b) => [b.enfant_id, { bilan: validerBilan(lireJson(b.bilan)), maj: b.maj_le }]));
  const enfants = (liens ?? []).map((l) => ({
    id: l.enfant_id, prenom: l.prenom, trancheAge: l.tranche_age, origine: l.origine, lieLe: l.lie_le,
    bilan: bilanDe.get(l.enfant_id)?.bilan ?? null, bilanMaj: bilanDe.get(l.enfant_id)?.maj ?? null,
    cahiers: (cahiers ?? []).filter((c) => c.enfant_id === l.enfant_id).map((c) => cahierPublic(c))
  }));
  const depuis = jourUtc(Date.now() - (JOURS_CONSOMMATIONS - 1) * 86400000);
  const membres = [parentId, ...enfants.map((e) => e.id)];
  const { results: conso } = await env.DB.prepare(
    `SELECT compte_id AS compte, jour, module, appels, tokens FROM familles_consommations
     WHERE jour >= ? AND compte_id IN (${membres.map(() => "?").join(", ")}) ORDER BY jour`
  ).bind(depuis, ...membres).all();
  const { activites, resultats } = await activitesDuParent(env, parentId);
  return json({
    parent: parentId, enfants, maxEnfants: MAX_ENFANTS_FAMILLE,
    activites, resultats, limites: { activites: MAX_ACTIVITES_FAMILLE },
    consommations: { depuis, jours: JOURS_CONSOMMATIONS, lignes: conso ?? [] },
    cahiersIa: quotaCahiers
  });
}

/** Générations de cahiers par l'IA pour la famille aujourd'hui (plafond : CAHIERS_GENERATIONS_JOUR par parent). */
async function quotaCahiersFamille(env, parentId, iaCahier) {
  const limite = iaCahier ? lireConfiguration(env).CAHIERS_GENERATIONS_JOUR : 0;
  const ligne = await env.DB.prepare("SELECT appels FROM familles_consommations WHERE compte_id = ? AND jour = ? AND module = 'cahier-famille'")
    .bind(parentId, jourUtc()).first();
  const utilisees = ligne?.appels ?? 0;
  return { ia: iaCahier, limite, utilisees, restantes: Math.max(0, limite - utilisees) };
}

/** Réserve une génération (compteur incrémenté seulement sous le plafond) ; false si le quota est atteint. */
async function reserverCahierFamille(env, parentId, limite) {
  const { meta } = await env.DB.prepare(`INSERT INTO familles_consommations (compte_id, jour, module, appels, tokens) VALUES (?, ?, 'cahier-famille', 1, 0)
    ON CONFLICT (compte_id, jour, module) DO UPDATE SET appels = appels + 1 WHERE appels < ?`).bind(parentId, jourUtc(), limite).run();
  return (meta?.changes ?? 0) > 0;
}

async function assignerCahier(env, parentId, corps, { catalogue, iaCahier }) {
  // Un enfant, ou toute la famille (corps.famille === true) : une seule génération, une copie par enfant.
  let enfants;
  if (corps?.famille === true) {
    const { results } = await env.DB.prepare("SELECT enfant_id FROM familles_liens WHERE parent_id = ?").bind(parentId).all();
    enfants = (results ?? []).map((l) => l.enfant_id);
    if (!enfants.length) return erreur("aucun-enfant", 409);
  } else {
    const enfantId = String(corps?.enfantId ?? "");
    if (!(await enfantDuParent(env, parentId, enfantId))) return erreur("introuvable", 404);
    enfants = [enfantId];
  }
  for (const enfantId of enfants) {
    const actifs = await env.DB.prepare("SELECT count(*) AS n FROM familles_cahiers WHERE enfant_id = ? AND statut IN ('assigne', 'en-cours')").bind(enfantId).first();
    if ((actifs?.n ?? 0) >= 10) return erreur("trop-de-cahiers", 409);
  }
  const demande = lireDemandeCahier(catalogue, corps);
  if (!demande) return erreur("demande-invalide", 400);
  const langue = corps?.langue === "en" ? "en" : "fr";
  const resumeDemande = {
    type: demande.type, longueur: demande.longueur, univers: demande.univers, objectif: demande.objectif, langue,
    notions: demande.maquettes.map((m) => m.id)
  };
  let cahier = null, raison = "ia-inactive", tokens = 0;
  if (corps?.utiliserLlm === true) {
    const quota = await quotaCahiersFamille(env, parentId, iaCahier);
    if (!iaCahier) raison = "ia-indisponible";
    else if (!(await reserverCahierFamille(env, parentId, quota.limite))) raison = "quota";
    else {
      const config = lireConfiguration(env);
      try {
        const generation = await appelerAliasGateway(env, {
          system: promptCahier(langue), message: messageCahier(catalogue, demande, langue),
          schema: SCHEMA_CAHIER, maxTokens: config.MAX_TOKENS_CAHIERS, cleModele: "MODELE_CAHIERS", nomSchema: "cahier"
        });
        tokens = Number.isSafeInteger(generation?.tokensSortie) ? generation.tokensSortie : 0;
        if (generation.refus) raison = "refus";
        else if (generation.tronque) raison = "sortie-tronquee";
        else {
          const brut = normaliserCahier(generation.contenu, demande);
          if (brut.sections.length) { cahier = brut; raison = null; } else raison = "sortie-invalide";
        }
      } catch {
        raison = "sortie-invalide";
        console.error("llm cahier famille");
      }
      if (tokens) {
        await env.DB.prepare("UPDATE familles_consommations SET tokens = tokens + ? WHERE compte_id = ? AND jour = ? AND module = 'cahier-famille'")
          .bind(tokens, parentId, jourUtc()).run();
      }
    }
  }
  const groupe = enfants.length > 1 || corps?.famille === true ? crypto.randomUUID() : null;
  const ids = enfants.map(() => crypto.randomUUID());
  await env.DB.batch(enfants.map((enfantId, i) => env.DB.prepare("INSERT INTO familles_cahiers (id, parent_id, enfant_id, demande, cahier, groupe) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(ids[i], parentId, enfantId, JSON.stringify(resumeDemande), cahier ? JSON.stringify(cahier) : null, groupe)));
  return json({ id: ids[0], ids, groupe, source: cahier ? "ia" : "catalogue", raison, quota: await quotaCahiersFamille(env, parentId, iaCahier) }, 201);
}

async function changerCahier(env, parentId, id, action) {
  const ligne = await env.DB.prepare("SELECT id FROM familles_cahiers WHERE id = ? AND parent_id = ?").bind(id, parentId).first();
  if (!ligne) return erreur("introuvable", 404);
  if (action === "supprimer") await env.DB.prepare("DELETE FROM familles_cahiers WHERE id = ?").bind(id).run();
  else await env.DB.prepare("UPDATE familles_cahiers SET statut = 'archive', maj_le = datetime('now') WHERE id = ?").bind(id).run();
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

// ---------- Activités de la famille (ADR 0029 §8) ----------
// Défis, évaluations (5 à 40 questions) et objectifs, pour un enfant ou toute la famille. Mêmes règles et même moteur
// que les activités d'un professeur (web/professeur.js) : le parent n'est pas limité à des matières.

/** Activités en cours au plus par parent. */
export const MAX_ACTIVITES_FAMILLE = 60;
export const TYPES_ACTIVITE_FAMILLE = Object.freeze(["defi", "evaluation", "objectif"]);
/** Cible « toute la famille » : la cible d'une classe dans le moteur commun. */
export const CIBLE_FAMILLE = "famille";
const PROFIL_PARENT = Object.freeze({ matieres: MATIERES_PROF });

const matiereDuCatalogue = (catalogue) => {
  const parId = new Map((catalogue?.index?.maquettes ?? []).filter((m) => !catalogue.pages || catalogue.pages[m.id])
    .map((m) => [m.id, String(m.sujet ?? "").split("/")[0] || null]));
  return (id) => parId.get(id) ?? null;
};

/** Demande d'activité du parent, validée : cible `{ famille: true }` ou `{ enfantId }`. */
export function validerActiviteFamille(corps, { catalogue, aujourdhui }) {
  if (!TYPES_ACTIVITE_FAMILLE.includes(corps?.type)) return { ok: false, code: "type-invalide" };
  const toute = corps?.cible?.famille === true;
  const enfantId = !toute && corps?.cible?.enfantId ? String(corps.cible.enfantId) : null;
  const cible = toute ? { classeId: CIBLE_FAMILLE } : enfantId ? { eleveId: enfantId } : {};
  return validerActivite({ ...corps, cible }, { profil: PROFIL_PARENT, matiereDe: matiereDuCatalogue(catalogue), aujourdhui });
}

const activiteFamillePublique = (l) => ({
  id: l.id, type: l.type, enfantId: l.enfant_id, famille: !l.enfant_id,
  // Champs du moteur commun : la famille joue le rôle d'une classe.
  classeId: l.enfant_id ? null : CIBLE_FAMILLE, eleveId: l.enfant_id,
  parametres: lireJson(l.parametres, {}), echeance: l.echeance, statut: l.statut, creeLe: l.cree_le
});
const resultatFamillePublic = (r) => ({
  activite: r.activite_id, eleve: r.enfant_id, reussis: r.reussis, total: r.total, meilleur: r.meilleur, tentatives: r.tentatives,
  dureeS: r.duree_s, termine: r.termine === 1, debutLe: r.debut_le, majLe: r.maj_le
});

async function creerActiviteFamille(env, parentId, corps, { catalogue }) {
  const v = validerActiviteFamille(corps, { catalogue, aujourdhui: jourUtc() });
  if (!v.ok) return erreur(v.code, 400);
  const a = v.activite;
  if (a.cible.eleveId && !(await enfantDuParent(env, parentId, a.cible.eleveId))) return erreur("introuvable", 404);
  if (!a.cible.eleveId && (await nombreEnfants(env, parentId)) === 0) return erreur("aucun-enfant", 409);
  const actives = await env.DB.prepare("SELECT count(*) AS n FROM familles_activites WHERE parent_id = ? AND statut = 'active'").bind(parentId).first();
  if ((actives?.n ?? 0) >= MAX_ACTIVITES_FAMILLE) return erreur("quota-activites", 409);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO familles_activites (id, parent_id, type, enfant_id, parametres, echeance) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, parentId, a.type, a.cible.eleveId, JSON.stringify(parametresActivite(a)), a.echeance).run();
  return json({ id }, 201);
}

/** Activités du parent et résultats de ses enfants (pour le tableau de bord). */
async function activitesDuParent(env, parentId) {
  const [{ results: lignes }, { results: res }] = await Promise.all([
    env.DB.prepare("SELECT * FROM familles_activites WHERE parent_id = ? ORDER BY cree_le DESC, rowid DESC LIMIT 200").bind(parentId).all(),
    env.DB.prepare(`SELECT r.* FROM familles_resultats r JOIN familles_activites a ON a.id = r.activite_id
      WHERE a.parent_id = ? AND r.enfant_id IN (SELECT enfant_id FROM familles_liens WHERE parent_id = ?)`).bind(parentId, parentId).all()
  ]);
  return { activites: (lignes ?? []).map(activiteFamillePublique), resultats: (res ?? []).map(resultatFamillePublic) };
}

async function changerActiviteFamille(env, parentId, id, action) {
  if (!(await env.DB.prepare("SELECT id FROM familles_activites WHERE id = ? AND parent_id = ?").bind(id, parentId).first())) return erreur("introuvable", 404);
  if (action === "archiver") await env.DB.prepare("UPDATE familles_activites SET statut = 'archivee' WHERE id = ?").bind(id).run();
  else {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM familles_resultats WHERE activite_id = ?").bind(id),
      env.DB.prepare("DELETE FROM familles_activites WHERE id = ?").bind(id)
    ]);
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

/** Activités actives d'un enfant : les siennes et celles de toute sa famille. */
async function lignesActivitesEnfant(env, enfantId) {
  const lien = await lienEnfant(env, enfantId);
  if (!lien) return [];
  const { results } = await env.DB.prepare(`SELECT * FROM familles_activites WHERE parent_id = ? AND statut = 'active'
    AND (enfant_id = ? OR enfant_id IS NULL) ORDER BY cree_le DESC, rowid DESC LIMIT 100`).bind(lien.parent_id, enfantId).all();
  return results ?? [];
}

async function mesActivitesFamille(env, enfantId) {
  const lignes = await lignesActivitesEnfant(env, enfantId);
  const { results: res } = await env.DB.prepare("SELECT * FROM familles_resultats WHERE enfant_id = ?").bind(enfantId).all();
  const resultat = new Map((res ?? []).map((r) => [r.activite_id, resultatFamillePublic(r)]));
  return json({ activites: lignes.map((l) => ({ ...activiteFamillePublique(l), resultat: resultat.get(l.id) ?? null })) });
}

async function enregistrerResultatsFamille(env, enfantId, corps) {
  const liste = (Array.isArray(corps?.resultats) ? corps.resultats : []).slice(0, 50).map(validerResultat).filter(Boolean);
  if (!liste.length) return erreur("resultats-invalides", 400);
  const miennes = new Map((await lignesActivitesEnfant(env, enfantId)).map((l) => [l.id, l]));
  const refuses = [];
  for (const r of liste) {
    const a = miennes.get(r.activite);
    if (!a || a.type === "objectif") { refuses.push({ activite: r.activite, raison: "introuvable" }); continue; }
    const avant = await env.DB.prepare("SELECT termine FROM familles_resultats WHERE activite_id = ? AND enfant_id = ?").bind(a.id, enfantId).first();
    // Une évaluation ne se passe qu'une fois : le premier résultat terminé fait foi.
    if (a.type === "evaluation" && avant?.termine === 1) { refuses.push({ activite: a.id, raison: "deja-terminee" }); continue; }
    await env.DB.prepare(`INSERT INTO familles_resultats (activite_id, enfant_id, reussis, total, meilleur, tentatives, duree_s, termine)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (activite_id, enfant_id) DO UPDATE SET reussis = excluded.reussis, total = excluded.total,
        meilleur = max(meilleur, excluded.meilleur), tentatives = tentatives + excluded.tentatives,
        duree_s = duree_s + excluded.duree_s, termine = max(termine, excluded.termine), maj_le = datetime('now')`)
      .bind(a.id, enfantId, r.reussis, r.total, r.termine ? r.reussis : 0, a.type === "defi" && r.termine ? 1 : 0, r.dureeS, r.termine ? 1 : 0).run();
  }
  return json({ enregistres: liste.length - refuses.length, refuses });
}

/**
 * Traite une route `/api/famille/…`.
 * @param {{ catalogue: object, iaCahier?: boolean, autoriser?: (cle: string) => boolean, ip?: string }} options
 */
export async function gererApiFamille(requete, env, { catalogue, iaCahier = false, autoriser = () => true, ip = "inconnue" } = {}) {
  if (!env.DB) return erreur("famille-indisponible", 503);
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
    const s = await situation(env, moi);
    return json({
      role: s.role, parent: s.parent, enfants: s.enfants,
      enfant: s.lien ? { prenom: s.lien.prenom, trancheAge: s.lien.tranche_age, lieLe: s.lien.lie_le } : null,
      invitation: s.invitation ? { expire: s.invitation.expire_a } : null
    });
  }
  if (est("POST", "invitation")) return creerInvitation(env, moi);
  if (est("POST", "invitation/annuler")) {
    await env.DB.prepare("DELETE FROM familles_invitations WHERE enfant_id = ?").bind(moi).run();
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  }
  if (est("PUT", "bilan")) return enregistrerBilan(env, moi, corps);
  if (est("GET", "mes-cahiers")) return mesCahiers(env, moi);
  if (methode === "POST" && (m = route.match(new RegExp(`^mes-cahiers/(${UUID})/calibrage$`)))) return calibrerCahier(env, moi, m[1], corps);
  if (est("GET", "mes-activites")) return mesActivitesFamille(env, moi);
  if (est("PUT", "resultats")) return enregistrerResultatsFamille(env, moi, corps);

  // Routes du parent.
  const { reponse: refus } = await exigerParent(env, moi);
  if (refus) return refus;
  if (est("GET", "tableau")) return tableau(env, moi, { quotaCahiers: await quotaCahiersFamille(env, moi, iaCahier) });
  if (est("POST", "rejoindre")) {
    // Anti force brute sur les codes (en mémoire, sans IP stockée).
    if (!autoriser(`famille:${ip}`)) return erreur("trop-de-tentatives", 429);
    return rejoindre(env, moi, corps);
  }
  if (est("POST", "enfants")) {
    if (!autoriser(`famille:${ip}`)) return erreur("trop-de-tentatives", 429);
    return creerEnfant(env, moi, corps);
  }
  if (methode === "POST" && (m = route.match(new RegExp(`^enfants/(${UUID})/(modifier|mot-de-passe|detacher|supprimer)$`)))) {
    const [, id, action] = m;
    if (action === "modifier") return modifierEnfant(env, moi, id, corps);
    if (action === "mot-de-passe") return nouveauMotDePasse(env, moi, id, corps);
    if (action === "detacher") return detacherEnfant(env, moi, id);
    return supprimerEnfant(env, moi, id, corps);
  }
  if (est("POST", "cahiers")) return assignerCahier(env, moi, corps, { catalogue, iaCahier });
  if (est("POST", "activites")) return creerActiviteFamille(env, moi, corps, { catalogue });
  if (methode === "POST" && (m = route.match(new RegExp(`^activites/(${UUID})/(archiver|supprimer)$`)))) return changerActiviteFamille(env, moi, m[1], m[2]);
  if (methode === "POST" && (m = route.match(new RegExp(`^cahiers/(${UUID})/(archiver|supprimer)$`)))) return changerCahier(env, moi, m[1], m[2]);
  return erreur("introuvable", 404);
}

/** Cron quotidien : invitations expirées et consommations au-delà de la fenêtre affichée (compteurs seulement). */
export async function purgerFamille(env, instant = Date.now()) {
  if (!env.DB) return null;
  try {
    const [invitations, consommations] = await env.DB.batch([
      env.DB.prepare("DELETE FROM familles_invitations WHERE expire_a <= ?").bind(Math.floor(instant / 1000)),
      env.DB.prepare("DELETE FROM familles_consommations WHERE jour < ?").bind(jourUtc(instant - 90 * 86400000))
    ]);
    return { invitations: invitations?.meta?.changes ?? 0, consommations: consommations?.meta?.changes ?? 0 };
  } catch {
    return null;
  }
}
