// Configuration centralisée du Worker (ADR 0019) : un seul registre déclare, module par module, les paramètres
// réglables (alias de modèles, budgets de tokens min–max, quotas, skills). Les valeurs viennent de
// `worker/wrangler.toml` [vars] ; toute valeur absente, invalide ou hors bornes est ramenée au défaut ou bornée.
// Aucun secret ici : les secrets (clés, jetons) ne sont jamais lus ni exposés par ce module.

/** Modules fonctionnels, dans l'ordre d'affichage de l'écran Configuration. */
export const MODULES = Object.freeze(["general", "tuteur", "defi", "cahiers"]);
/** Modules réservés au back-office (ADR 0026) : jamais exposés par `/api/llm/status`. */
export const MODULES_ADMIN = Object.freeze(["acces", "securite", "assistant"]);
/** Taille maximale des instructions complémentaires d'un harness (caractères). */
export const TAILLE_MAX_INSTRUCTIONS = 2000;

/**
 * Skills LLM : une consigne système versionnée par module, activable séparément via `SKILLS_ACTIFS`.
 * Leur description sert de « harness » dans les métadonnées de fin de réponse.
 */
export const SKILLS = Object.freeze({
  tuteur: Object.freeze({ module: "tuteur", version: "1.0.0", prompt: "tuteur-catalogue-v1", perimetre: "catalogue-kermiclab" }),
  "cadrage-idee": Object.freeze({ module: "tuteur", version: "1.0.0", prompt: "cadrage-idee-v1", perimetre: "boite-a-idees" }),
  "defi-express": Object.freeze({ module: "defi", version: "1.1.0", prompt: "defi-express-v2", perimetre: "catalogue-kermiclab" }),
  "constructeur-cahier": Object.freeze({ module: "cahiers", version: "2.0.0", prompt: "constructeur-cahier-v2", perimetre: "catalogue-kermiclab" })
});

const ALIAS_VALIDE = /^[A-Za-z0-9@][A-Za-z0-9@/._:-]{0,99}$/;

/**
 * Registre des paramètres. `type` : booleen, entier (bornes `min`/`max`), alias (identifiant de modèle ou alias
 * AI Gateway), liste (identifiants séparés par des virgules, parmi `valeurs`), texte (texte libre du serveur, borné
 * à `max` caractères). `prive` : réservé au back-office, absent de la vue publique.
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
  { cle: "MAX_TOKENS_DEFI", module: "defi", type: "entier", defaut: 1500, min: 500, max: 3000 },
  // Mes cahiers : alias AI Gateway Sonnet 5.5, budget de sortie large (plafond de 128 000 tokens du modèle).
  { cle: "MODELE_CAHIERS", module: "cahiers", type: "alias", defaut: "custom/sonnet-5-5" },
  { cle: "CAHIERS_GENERATIONS_JOUR", module: "cahiers", type: "entier", defaut: 2, min: 0, max: 5 },
  { cle: "MAX_TOKENS_CAHIERS", module: "cahiers", type: "entier", defaut: 100000, min: 1000, max: 128000 },
  // Instructions complémentaires des harness (ADR 0026) : ajoutées après le socle de sécurité, qui reste dans le code.
  { cle: "INSTRUCTIONS_TUTEUR", module: "tuteur", type: "texte", defaut: "", max: TAILLE_MAX_INSTRUCTIONS, prive: true },
  { cle: "INSTRUCTIONS_CADRAGE", module: "tuteur", type: "texte", defaut: "", max: TAILLE_MAX_INSTRUCTIONS, prive: true },
  { cle: "INSTRUCTIONS_DEFI", module: "defi", type: "texte", defaut: "", max: TAILLE_MAX_INSTRUCTIONS, prive: true },
  { cle: "INSTRUCTIONS_CAHIERS", module: "cahiers", type: "texte", defaut: "", max: TAILLE_MAX_INSTRUCTIONS, prive: true },
  // Rôles et stratégies d'accès (ADR 0026) : préparés, non appliqués pendant la bêta.
  { cle: "CONTROLE_ACCES_ACTIF", module: "acces", type: "booleen", defaut: false, prive: true },
  // Phase de développement (ADR 0034) : un compte change de souscription depuis « Mon compte » sans paiement (paiement
  // considéré comme acquis), offres « en projet » comprises. À passer à false à l'ouverture du paiement.
  { cle: "SOUSCRIPTIONS_LIBRE_CHOIX", module: "acces", type: "booleen", defaut: true, prive: true },
  // Garde-fous comportementaux (ADR 0026) : observation seule tant que GARDE_FOUS_ACTIFS vaut false.
  { cle: "GARDE_FOUS_ACTIFS", module: "securite", type: "booleen", defaut: false, prive: true },
  { cle: "SEUIL_SURVEILLANCE", module: "securite", type: "entier", defaut: 3, min: 1, max: 50, prive: true },
  { cle: "SEUIL_RESTRICTION", module: "securite", type: "entier", defaut: 9, min: 2, max: 200, prive: true },
  { cle: "SEUIL_CONSO_ELEVEE", module: "securite", type: "entier", defaut: 100, min: 10, max: 2000, prive: true },
  { cle: "SEUIL_SURCONSOMMATION", module: "securite", type: "entier", defaut: 300, min: 20, max: 5000, prive: true },
  { cle: "CONSERVATION_SIGNAUX_JOURS", module: "securite", type: "entier", defaut: 30, min: 7, max: 90, prive: true },
  { cle: "CONSERVATION_TELEMETRIE_JOURS", module: "securite", type: "entier", defaut: 90, min: 7, max: 365, prive: true },
  // Assistant IA de l'écran Utilisateurs (ADR 0035) : propose des actions sur un compte, l'administrateur les applique.
  { cle: "ASSISTANT_UTILISATEURS_ACTIF", module: "assistant", type: "booleen", defaut: true, prive: true },
  { cle: "MODELE_ASSISTANT", module: "assistant", type: "alias", defaut: "custom/haiku", prive: true },
  { cle: "MAX_TOKENS_ASSISTANT", module: "assistant", type: "entier", defaut: 2000, min: 500, max: 4000, prive: true }
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
    case "texte":
      // Caractères de contrôle retirés (sauf saut de ligne et tabulation), longueur bornée.
      return texte.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, p.max);
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
  // La restriction ne peut pas arriver avant la surveillance, ni la surconsommation avant la consommation élevée.
  config.SEUIL_RESTRICTION = Math.max(config.SEUIL_RESTRICTION, config.SEUIL_SURVEILLANCE);
  config.SEUIL_SURCONSOMMATION = Math.max(config.SEUIL_SURCONSOMMATION, config.SEUIL_CONSO_ELEVEE);
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
  return vueConfiguration(env, MODULES, (p) => !p.prive);
}

/** Vue complète du back-office (ADR 0026) : tous les modules, paramètres privés compris. Jamais de secret. */
export function configurationAdmin(env = {}) {
  return vueConfiguration(env, [...MODULES, ...MODULES_ADMIN], () => true);
}

/** Paramètre du registre (ou `undefined`) et valeur interprétée d'une saisie : sert à valider un réglage à chaud. */
export const parametreDuRegistre = (cle) => PAR_CLE.get(cle);
export const interpreterValeur = (cle, brut) => interpreter(PAR_CLE.get(cle), brut);

function vueConfiguration(env, modules, garder) {
  const config = lireConfiguration(env);
  return {
    modules: modules.map((id) => ({
      id,
      parametres: PARAMETRES.filter((p) => p.module === id && garder(p)).map((p) => ({
        cle: p.cle, type: p.type, valeur: config[p.cle], defaut: p.defaut,
        ...(p.type === "entier" ? { min: p.min, max: p.cle === "MAX_TOKENS_APPEL" ? Math.min(p.max, config.LIMITE_TOKENS_SESSION) : p.max } : {}),
        ...(p.type === "texte" ? { max: p.max } : {}),
        ...(p.type === "liste" ? { valeurs: p.valeurs } : {})
      })),
      skills: Object.entries(SKILLS).filter(([, s]) => s.module === id).map(([skill, s]) => ({
        id: skill, prompt: s.prompt, version: s.version, actif: config.LLM_ACTIF && config.SKILLS_ACTIFS.includes(skill)
      }))
    }))
  };
}
