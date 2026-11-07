-- Migration 0001 : schéma initial (état de production au 2026-11-07), réunion de worker/schema.sql,
-- worker/schema-comptes.sql et worker/schema-compte-local.sql. Uniquement des CREATE … IF NOT EXISTS : sans effet
-- sur les tables déjà présentes, donc sûre sur la base de production existante (aucune donnée modifiée).

-- ===== worker/schema.sql =====
-- KPI anonymes Kermiclab (Cloudflare D1). Aucune IP ni texte de message.
CREATE TABLE IF NOT EXISTS evenements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  horodatage TEXT NOT NULL DEFAULT (datetime('now')),
  type TEXT NOT NULL,
  maquette_id TEXT,
  sujet TEXT,
  langue TEXT,
  routage TEXT,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_evenements_type ON evenements (type, horodatage);

-- Quota technique anonyme : identifiant aléatoire, contexte publié, aucun message ni IP.
CREATE TABLE IF NOT EXISTS sessions_llm (
  id TEXT PRIMARY KEY,
  expire_a INTEGER NOT NULL,
  maquette_id TEXT NOT NULL,
  tokens_factures INTEGER NOT NULL DEFAULT 0 CHECK (tokens_factures BETWEEN 0 AND 1000),
  en_cours INTEGER NOT NULL DEFAULT 0 CHECK (en_cours IN (0, 1)),
  reservation INTEGER NOT NULL DEFAULT 0 CHECK (reservation BETWEEN 0 AND 500)
);
CREATE INDEX IF NOT EXISTS idx_sessions_llm_expiration ON sessions_llm (expire_a);

-- Quota du défi express généré par l'IA (ADR 0018) : générations par session de 24 h, sans aucun texte.
CREATE TABLE IF NOT EXISTS defis_llm (
  session_id TEXT PRIMARY KEY,
  expire_a INTEGER NOT NULL,
  generations INTEGER NOT NULL DEFAULT 0 CHECK (generations BETWEEN 0 AND 10),
  en_cours INTEGER NOT NULL DEFAULT 0 CHECK (en_cours IN (0, 1))
);
CREATE INDEX IF NOT EXISTS idx_defis_llm_expiration ON defis_llm (expire_a);

-- Quota du constructeur de cahiers enrichi par l'IA : générations par session de 24 h, sans aucun texte.
CREATE TABLE IF NOT EXISTS cahiers_llm (
  session_id TEXT PRIMARY KEY,
  expire_a INTEGER NOT NULL,
  generations INTEGER NOT NULL DEFAULT 0 CHECK (generations BETWEEN 0 AND 5),
  en_cours INTEGER NOT NULL DEFAULT 0 CHECK (en_cours IN (0, 1))
);
CREATE INDEX IF NOT EXISTS idx_cahiers_llm_expiration ON cahiers_llm (expire_a);

-- ===== worker/schema-comptes.sql =====
-- Compte (parent par défaut ; contributeur, prof et admin attribués par le propriétaire, ADR 0023)
CREATE TABLE IF NOT EXISTS comptes (
  id              TEXT PRIMARY KEY,
  email_hash      TEXT NOT NULL UNIQUE,
  role            TEXT NOT NULL DEFAULT 'parent' CHECK (role IN ('parent', 'contributeur', 'prof', 'admin')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at   TEXT,
  consent_at      TEXT,
  consent_version TEXT
);

-- Liaison providers
CREATE TABLE IF NOT EXISTS auth_providers (
  compte_id       TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  provider_sub    TEXT NOT NULL,
  PRIMARY KEY (provider, provider_sub)
);

-- Profils élèves
CREATE TABLE IF NOT EXISTS eleves (
  id              TEXT PRIMARY KEY,
  parent_id       TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  prenom_affiche  TEXT NOT NULL,
  age_tranche     TEXT,
  langue          TEXT NOT NULL DEFAULT 'fr',
  consentement_version TEXT NOT NULL,      -- texte de consentement accepté par le parent (ADR 0017)
  consentement_at TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Progression
CREATE TABLE IF NOT EXISTS progres (
  eleve_id     TEXT NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  notion_id    TEXT NOT NULL,
  score        INTEGER,
  etoiles      INTEGER,
  completed_at TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (eleve_id, notion_id)
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  compte_id   TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

-- États OAuth temporaires (state + PKCE + liaison navigateur anti-CSRF)
CREATE TABLE IF NOT EXISTS oauth_states (
  state           TEXT PRIMARY KEY,
  provider        TEXT NOT NULL,
  code_verifier   TEXT NOT NULL,
  browser_binding TEXT NOT NULL,
  expires_at      TEXT NOT NULL
);

-- Contributions au contenu des notions (ADR 0023) : propositions de comptes contributeur ou prof, relues par un prof.
-- Texte pédagogique destiné à publication (jamais un message de chat) ; aucune donnée personnelle (filtrée par le Worker).
CREATE TABLE IF NOT EXISTS contributions (
  id              TEXT PRIMARY KEY,
  auteur_id       TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  notion_id       TEXT NOT NULL,
  notion_version  TEXT NOT NULL,
  chemin          TEXT NOT NULL,             -- champ du contenu.json, ex. niveaux.1.paragraphes.0
  nature          TEXT NOT NULL CHECK (nature IN ('modification', 'ajout')),
  type            TEXT NOT NULL,             -- correction | clarification | exemple | orthographe | autre
  texte_actuel    TEXT NOT NULL,             -- texte du champ au moment de la proposition
  texte_propose   TEXT NOT NULL,
  motif           TEXT NOT NULL,
  charte_version  TEXT NOT NULL,             -- charte du contributeur acceptée
  statut          TEXT NOT NULL DEFAULT 'proposee'
                  CHECK (statut IN ('proposee', 'a_reviser', 'validee', 'refusee', 'retiree', 'integree')),
  relecteur_id    TEXT REFERENCES comptes(id) ON DELETE SET NULL,
  commentaire     TEXT,                      -- commentaire du relecteur
  issue_numero    INTEGER,                   -- issue GitHub « contribution-validee »
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_contributions_statut ON contributions (statut, created_at);
CREATE INDEX IF NOT EXISTS idx_contributions_auteur ON contributions (auteur_id, statut);

-- ===== worker/schema-compte-local.sql =====
-- Compte local et synchronisation pseudonymisée (ADR 0024). À appliquer sur la base D1 `kermiclab-kpi` :
--   cd worker && npx wrangler d1 execute kermiclab-kpi --remote --file=schema-compte-local.sql
-- Aucune IP, aucun email, aucun identifiant en clair, aucun horodatage précis.

-- Identifiants de connexion : empreinte HMAC de l'identifiant (secret COMPTES_LOCAUX_SECRET) et mot de passe haché
-- (PBKDF2-SHA256 salé, après un HMAC du même secret). Date de création au jour près.
CREATE TABLE IF NOT EXISTS comptes_locaux (
  id                TEXT PRIMARY KEY,
  identifiant_hmac  TEXT NOT NULL UNIQUE,
  mdp_sel           TEXT NOT NULL,
  mdp_hash          TEXT NOT NULL,
  mdp_iterations    INTEGER NOT NULL,
  echecs            INTEGER NOT NULL DEFAULT 0,
  bloque_jusqua     INTEGER NOT NULL DEFAULT 0,
  cree_le           TEXT NOT NULL DEFAULT (date('now'))
);

-- Sessions de synchronisation (jeton porteur, 12 h). Seule l'empreinte SHA-256 du jeton est gardée.
CREATE TABLE IF NOT EXISTS sessions_locales (
  jeton_hash  TEXT PRIMARY KEY,
  compte_id   TEXT NOT NULL REFERENCES comptes_locaux(id) ON DELETE CASCADE,
  expire_a    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_locales_compte ON sessions_locales (compte_id);
CREATE INDEX IF NOT EXISTS idx_sessions_locales_expiration ON sessions_locales (expire_a);

-- Données synchronisées, pseudonymisées : AUCUNE colonne ne relie une ligne à un compte. Le pseudonyme et le jeton
-- d'écriture sont dérivés, dans le navigateur, d'une phrase secrète jamais transmise ; le contenu est chiffré
-- (AES-GCM) avec une clé qui ne quitte pas l'appareil. Dates au jour près (pas de corrélation fine avec les sessions).
-- Conservation (ADR 0024) : une ligne ni lue ni écrite depuis 365 jours (`vu_le`) est effacée par le cron quotidien.
CREATE TABLE IF NOT EXISTS donnees_pseudonymes (
  pseudonyme  TEXT PRIMARY KEY,
  jeton_hash  TEXT NOT NULL,
  version     INTEGER NOT NULL CHECK (version >= 1),
  iv          TEXT NOT NULL,
  chiffre     TEXT NOT NULL,
  maj_le      TEXT NOT NULL DEFAULT (date('now')),
  vu_le       TEXT NOT NULL DEFAULT (date('now'))
);
CREATE INDEX IF NOT EXISTS idx_donnees_pseudonymes_vu ON donnees_pseudonymes (vu_le);
