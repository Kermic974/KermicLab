// Analyse comportementale des profils (ADR 0026) : compteurs de signaux par profil pseudonyme, catégorisation
// déterministe des comportements déviants et état de garde-fou. Aucun texte, aucune IP : un profil est l'empreinte
// HMAC tronquée d'un identifiant de session ou de compte ; sans cookie, l'activité est comptée sous « anonyme ».
import { jwtVerify } from "jose";
import { lireConfiguration } from "./configuration.js";

export const PROFIL_ANONYME = "anonyme";
export const ETATS = Object.freeze(["normal", "surveille", "restreint", "suspendu"]);
/** Fenêtre d'observation des signaux, en jours. */
export const FENETRE_JOURS = 7;

/** Poids d'un signal dans le score de déviance. La détresse ne pèse jamais : elle appelle de l'aide, pas une sanction. */
export const POIDS = Object.freeze({
  "injection-directe": 3, "injection-indirecte": 3, sexuel: 3, "contenu-dangereux": 2, "donnees-personnelles": 1, detresse: 0
});

/** Comportement retenu pour une catégorie de signal à partir de `seuil` occurrences sur la fenêtre. */
const COMPORTEMENTS = Object.freeze({
  "donnees-personnelles": { id: "messages-personnels", seuil: 2 },
  sexuel: { id: "contenu-sexuel", seuil: 1 },
  "contenu-dangereux": { id: "contenu-dangereux", seuil: 1 },
  detresse: { id: "detresse", seuil: 1 },
  "injection-directe": { id: "injection-directe", seuil: 1 },
  "injection-indirecte": { id: "injection-indirecte", seuil: 1 }
});
export const LISTE_COMPORTEMENTS = Object.freeze([
  ...Object.values(COMPORTEMENTS).map((c) => c.id), "consommation-elevee", "surconsommation"
]);

const jourDe = (maintenant) => new Date(maintenant).toISOString().slice(0, 10);

/**
 * Catégorise un profil à partir de ses compteurs sur la fenêtre. Fonction pure et déterministe.
 * @param {{ signaux?: Record<string, number>, requetesJourMax?: number }} compteurs
 * @param {object} config configuration effective (seuils du module « securite »)
 * @returns {{ etat: string, score: number, comportements: string[] }}
 */
export function evaluerProfil(compteurs, config) {
  const signaux = compteurs?.signaux ?? {};
  const comportements = [];
  let score = 0;
  for (const [categorie, { id, seuil }] of Object.entries(COMPORTEMENTS)) {
    const n = Number(signaux[categorie]) || 0;
    score += n * POIDS[categorie];
    if (n >= seuil) comportements.push(id);
  }
  const requetes = Number(compteurs?.requetesJourMax) || 0;
  const surconsommation = requetes >= config.SEUIL_SURCONSOMMATION;
  const elevee = requetes >= config.SEUIL_CONSO_ELEVEE;
  if (surconsommation) comportements.push("surconsommation");
  else if (elevee) comportements.push("consommation-elevee");
  // La suspension n'est jamais automatique : elle reste une décision humaine (back-office).
  const etat = surconsommation || score >= config.SEUIL_RESTRICTION ? "restreint"
    : elevee || score >= config.SEUIL_SURVEILLANCE ? "surveille" : "normal";
  return { etat, score, comportements };
}

async function empreinte(secret, valeur) {
  const cle = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(valeur));
  return [...new Uint8Array(signature)].slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const secretProfils = (env) => [env?.PROFILS_SECRET, env?.LLM_SESSION_SECRET].find((s) => typeof s === "string" && s.length >= 32);

/** Profil pseudonyme d'un compte (famille ou local) : le back-office le recalcule pour relier un compte à son état. */
export async function profilDuCompte(env, type, id) {
  const secret = secretProfils(env);
  return secret ? empreinte(secret, `profil:${type}:${id}`) : null;
}

const cookie = (requete, nom) => (requete.headers.get("cookie") || "").split(";").map((v) => v.trim())
  .find((v) => v.startsWith(`${nom}=`))?.slice(nom.length + 1);

/**
 * Profil pseudonyme de la requête : compte connecté (cookie `session`), sinon session technique de quota IA
 * (cookie signé), sinon « anonyme ». Aucune IP n'est utilisée. Ne lève jamais.
 */
export async function profilDeLaRequete(requete, env) {
  const secret = secretProfils(env);
  if (!secret) return PROFIL_ANONYME;
  try {
    const session = cookie(requete, "session");
    if (session && env.DB) {
      const ligne = await env.DB.prepare("SELECT compte_id FROM sessions WHERE id = ? AND expires_at > datetime('now')").bind(session).first();
      if (ligne?.compte_id) return await empreinte(secret, `profil:compte:${ligne.compte_id}`);
    }
  } catch { /* tables des comptes absentes : on continue avec la session technique */ }
  try {
    const jeton = cookie(requete, "__Host-kermiclab_llm");
    if (jeton && typeof env.LLM_SESSION_SECRET === "string" && env.LLM_SESSION_SECRET.length >= 32) {
      const { payload } = await jwtVerify(jeton, new TextEncoder().encode(env.LLM_SESSION_SECRET), {
        algorithms: ["HS256"], issuer: "kermiclab-llm", audience: "kermiclab-llm"
      });
      if (typeof payload.sub === "string") return await empreinte(secret, `profil:session:${payload.sub}`);
    }
  } catch { /* cookie absent, expiré ou falsifié */ }
  return PROFIL_ANONYME;
}

/** Compte une requête et ses signaux pour un profil (compteurs par jour, catégorie et module). Ne lève jamais. */
export async function enregistrerActivite(env, { profil, module, categories = [] }, maintenant = Date.now()) {
  if (!env?.DB) return;
  const jour = jourDe(maintenant);
  const sql = `INSERT INTO signaux_securite (profil, jour, categorie, module, n) VALUES (?, ?, ?, ?, 1)
    ON CONFLICT (profil, jour, categorie, module) DO UPDATE SET n = n + 1`;
  try {
    for (const categorie of ["requete", ...categories]) {
      await env.DB.prepare(sql).bind(profil, jour, categorie, module).run();
    }
  } catch { /* table absente ou D1 indisponible : aucune conséquence pour l'utilisateur */ }
}

/** Compteurs d'un profil sur la fenêtre : total par catégorie et plus forte journée de requêtes. */
export async function compteursProfil(env, profil, maintenant = Date.now()) {
  const depuis = jourDe(maintenant - (FENETRE_JOURS - 1) * 86400000);
  const { results } = await env.DB.prepare(
    "SELECT jour, categorie, sum(n) AS n FROM signaux_securite WHERE profil = ? AND jour >= ? GROUP BY jour, categorie"
  ).bind(profil, depuis).all();
  const signaux = {};
  let requetesJourMax = 0;
  for (const { categorie, n } of results ?? []) {
    if (categorie === "requete") requetesJourMax = Math.max(requetesJourMax, n);
    else signaux[categorie] = (signaux[categorie] ?? 0) + n;
  }
  return { signaux, requetesJourMax };
}

const rang = (etat) => ETATS.indexOf(etat);

/**
 * Réévalue un profil après une requête : l'état automatique ne fait que monter ; une décision d'administrateur encore
 * valide n'est jamais remplacée. Le profil « anonyme » n'a pas d'état. Ne lève jamais.
 */
export async function actualiserProfil(env, profil, maintenant = Date.now()) {
  if (!env?.DB || profil === PROFIL_ANONYME) return null;
  try {
    const evaluation = evaluerProfil(await compteursProfil(env, profil, maintenant), lireConfiguration(env));
    const actuel = await env.DB.prepare("SELECT etat, decide_par, expire_le FROM profils_securite WHERE profil = ?").bind(profil).first();
    const jour = jourDe(maintenant);
    const decisionAdmin = actuel?.decide_par === "admin" && (!actuel.expire_le || actuel.expire_le >= jour);
    if (decisionAdmin) return { ...evaluation, etat: actuel.etat };
    const precedent = actuel && (!actuel.expire_le || actuel.expire_le >= jour) ? actuel.etat : "normal";
    // Tant que la déviance dure, l'état est reconduit (fenêtre glissante) ; il ne redescend qu'à son expiration.
    if (evaluation.etat !== "normal" && rang(evaluation.etat) >= rang(precedent)) {
      await env.DB.prepare(`
        INSERT INTO profils_securite (profil, etat, motifs, decide_par, maj_le, expire_le) VALUES (?, ?, ?, 'auto', ?, ?)
        ON CONFLICT (profil) DO UPDATE SET etat = excluded.etat, motifs = excluded.motifs, decide_par = 'auto',
          maj_le = excluded.maj_le, expire_le = excluded.expire_le
      `).bind(profil, evaluation.etat, JSON.stringify(evaluation.comportements), jour, jourDe(maintenant + FENETRE_JOURS * 86400000)).run();
    }
    return evaluation;
  } catch {
    return null;
  }
}

/** État de garde-fou en vigueur pour un profil (« normal » si aucun, expiré ou illisible). */
export async function etatProfil(env, profil, maintenant = Date.now()) {
  if (!env?.DB || profil === PROFIL_ANONYME) return "normal";
  try {
    const ligne = await env.DB.prepare("SELECT etat, expire_le FROM profils_securite WHERE profil = ?").bind(profil).first();
    if (!ligne || (ligne.expire_le && ligne.expire_le < jourDe(maintenant))) return "normal";
    return ETATS.includes(ligne.etat) ? ligne.etat : "normal";
  } catch {
    return "normal";
  }
}

/** Efface les signaux plus anciens que `jours` jours et les états automatiques expirés (cron quotidien). */
export async function purgerSignaux(env, jours, maintenant = Date.now()) {
  if (!env?.DB) return { signaux: 0, profils: 0 };
  const signaux = await env.DB.prepare("DELETE FROM signaux_securite WHERE jour < ?").bind(jourDe(maintenant - jours * 86400000)).run();
  const profils = await env.DB.prepare("DELETE FROM profils_securite WHERE expire_le IS NOT NULL AND expire_le < ?").bind(jourDe(maintenant)).run();
  return { signaux: signaux?.meta?.changes ?? 0, profils: profils?.meta?.changes ?? 0 };
}
