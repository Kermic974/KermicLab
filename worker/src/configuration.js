// Configuration centralisée du Worker (ADR 0019) : un seul registre déclare, module par module, les paramètres
// réglables (alias de modèles, budgets de tokens min–max, quotas, skills). Les valeurs viennent de
// `worker/wrangler.toml` [vars] ; toute valeur absente, invalide ou hors bornes est ramenée au défaut ou bornée.
// Aucun secret ici : les secrets (clés, jetons) ne sont jamais lus ni exposés par ce module.

/** Modules fonctionnels, dans l'ordre d'affichage de l'écran Configuration. */
export const MODULES = Object.freeze(["general", "tuteur", "defi"]);

/**
 * Skills LLM : une consigne système versionnée par module, activable séparément via `SKILLS_ACTIFS`.
 * Leur description sert de « harness » dans les métadonnées de fin de réponse.
 */
export const SKILLS = Object.freeze({
  tuteur: Object.freeze({ module: "tuteur", version: "1.0.0", prompt: "tuteur-catalogue-v1", perimetre: "catalogue-kermiclab" }),
  "cadrage-idee": Object.freeze({ module: "tuteur", version: "1.0.0", prompt: "cadrage-idee-v1", perimetre: "boite-a-idees" }),
  "defi-express": Object.freeze({ module: "defi", version: "1.0.0", prompt: "defi-express-v1", perimetre: "catalogue-kermiclab" })
});

const ALIAS_VALIDE = /^[A-Za-z0-9@][A-Za-z0-9@/._:-]{0,99}$/;

/**
 * Registre des paramètres. `type` : booleen, entier (bornes `min`/`max`), alias (identifiant de modèle ou alias
 * AI Gateway), liste (identifiants séparés par des virgules, parmi `valeurs`).
 */
export const PARAMETRES = Object.freeze([
  { cle: "LLM_ACTIF", module: "general", type: "booleen", defaut: false },
  { cle: "SKILLS_ACTIFS", module: "general", type: "liste", defaut: Object.keys(SKILLS), valeurs: Object.keys(SKILLS) },
  { cle: "TAILLE_MAX_MESSAGE", module: "general", type: "entier", defaut: 500, min: 50, max: 2000 },
  { cle: "LIMITE_PAR_MINUTE", module: "general", type: "entier", defaut: 20, min: 1, max: 120 },
  { cle: "MODELE_WORKERS_AI", module: "tuteur", type: "alias", defaut: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  { cle: "MODELE_CHAT", module: "tuteur", type: "alias", defaut: "claude-haiku-5-5" },
  { cle: "LIMITE_TOKENS_SESSION", module: "tuteur", type: "entier", defaut: 1000, min: 200, max: 4000 },
  { cle: "MAX_TOKENS_APPEL", module: "tuteur", type: "entier", defaut: 500, min: 100, max: 1000 },
  { cle: "MODELE_DEFI", module: "defi", type: "alias", defaut: "custom/haiku" },
  { cle: "DEFI_GENERATIONS_JOUR", module: "defi", type: "entier", defaut: 3, min: 0, max: 10 },
  { cle: "MAX_TOKENS_DEFI", module: "defi", type: "entier", defaut: 1500, min: 500, max: 3000 }
].map((p) => Object.freeze(p)));

const PAR_CLE = new Map(PARAMETRES.map((p) => [p.cle, p]));

/** Valeur par défaut d'un paramètre du registre. */
export function defaut(cle) {
  const p = PAR_CLE.get(cle);
  if (!p) throw new Error(`paramètre inconnu : ${cle}`);
  return p.defaut;
}

function interpreter(p, brut) {
  const absent = brut === undefined || brut === null || String(brut).trim() === "";
  if (absent) return p.defaut;
  const texte = String(brut).trim();
  switch (p.type) {
    case "booleen":
      return texte === "true";
    case "entier": {
      const n = Number(texte);
      return Number.isInteger(n) ? Math.max(p.min, Math.min(p.max, n)) : p.defaut;
    }
    case "alias":
      return ALIAS_VALIDE.test(texte) ? texte : p.defaut;
    case "liste":
      return [...new Set(texte.split(",").map((v) => v.trim()).filter((v) => p.valeurs.includes(v)))];
    default:
      return p.defaut;
  }
}

/** Configuration effective (valeurs interprétées et bornées) pour un `env` de Worker. */
export function lireConfiguration(env = {}) {
  const config = {};
  for (const p of PARAMETRES) config[p.cle] = interpreter(p, env?.[p.cle]);
  // Un appel ne peut jamais réserver plus que le budget de la session.
  config.MAX_TOKENS_APPEL = Math.min(config.MAX_TOKENS_APPEL, config.LIMITE_TOKENS_SESSION);
  return Object.freeze(config);
}

export const parametre = (env, cle) => {
  if (!PAR_CLE.has(cle)) throw new Error(`paramètre inconnu : ${cle}`);
  return lireConfiguration(env)[cle];
};

export const skillActif = (env, id) => Object.hasOwn(SKILLS, id) && lireConfiguration(env).SKILLS_ACTIFS.includes(id);

/** Métadonnées de harness d'un skill (forme historique des réponses : nom, version, prompt, périmètre, accès). */
export function harnessSkill(id) {
  const s = SKILLS[id];
  if (!s) throw new Error(`skill inconnu : ${id}`);
  return Object.freeze({ nom: "KermicLab", version: s.version, prompt: s.prompt, perimetre: s.perimetre, acces: "gratuit-provisoire" });
}

/**
 * Vue publique (non secrète) servie par `/api/llm/status` et affichée dans l'écran Configuration :
 * pour chaque module, ses paramètres (valeur effective, défaut, bornes) et ses skills (actif ou non).
 */
export function configurationPublique(env = {}) {
  const config = lireConfiguration(env);
  return {
    modules: MODULES.map((id) => ({
      id,
      parametres: PARAMETRES.filter((p) => p.module === id).map((p) => ({
        cle: p.cle, type: p.type, valeur: config[p.cle], defaut: p.defaut,
        ...(p.type === "entier" ? { min: p.min, max: p.cle === "MAX_TOKENS_APPEL" ? Math.min(p.max, config.LIMITE_TOKENS_SESSION) : p.max } : {})
      })),
      skills: Object.entries(SKILLS).filter(([, s]) => s.module === id).map(([skill, s]) => ({
        id: skill, prompt: s.prompt, version: s.version, actif: config.LLM_ACTIF && config.SKILLS_ACTIFS.includes(skill)
      }))
    }))
  };
}
