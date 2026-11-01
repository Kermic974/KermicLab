-- Compte parent
CREATE TABLE IF NOT EXISTS comptes (
  id              TEXT PRIMARY KEY,
  email_hash      TEXT NOT NULL UNIQUE,
  role            TEXT NOT NULL DEFAULT 'parent',
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
  browser_binding TEXT,
  expires_at      TEXT NOT NULL
);
