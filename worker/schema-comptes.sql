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

-- Journal de relecture humaine (ADR 0039). Append-only : voir les déclencheurs.
-- Le lien (relecteur_id) est l'identifiant anonymisé du compte ; il devient NULL à la suppression du compte.
CREATE TABLE IF NOT EXISTS relectures_humaines (
  id              TEXT PRIMARY KEY,
  relecteur_id    TEXT,
  origine         TEXT NOT NULL CHECK (origine IN ('oauth', 'local')),
  role            TEXT NOT NULL CHECK (length(role) BETWEEN 2 AND 32 AND role GLOB '[a-z]*' AND role NOT GLOB '*[^a-z0-9-]*'),
  code_relecteur  TEXT NOT NULL,
  notion_id       TEXT NOT NULL,
  notion_version  TEXT NOT NULL,
  empreinte       TEXT NOT NULL,
  grille          TEXT NOT NULL CHECK (grille IN ('v1', 'jeux-v1')),
  criteres        TEXT NOT NULL,
  decision        TEXT NOT NULL CHECK (decision IN ('conforme', 'a_corriger')),
  commentaire     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_relectures_humaines_notion ON relectures_humaines (notion_id, created_at);
CREATE INDEX IF NOT EXISTS idx_relectures_humaines_relecteur ON relectures_humaines (relecteur_id, origine);

CREATE TRIGGER IF NOT EXISTS relectures_humaines_append_only_update
BEFORE UPDATE ON relectures_humaines
WHEN NOT (
  OLD.relecteur_id IS NOT NULL AND NEW.relecteur_id IS NULL
  AND NEW.id = OLD.id AND NEW.origine = OLD.origine AND NEW.role = OLD.role
  AND NEW.code_relecteur = OLD.code_relecteur AND NEW.notion_id = OLD.notion_id
  AND NEW.notion_version = OLD.notion_version AND NEW.empreinte = OLD.empreinte
  AND NEW.grille = OLD.grille AND NEW.criteres = OLD.criteres AND NEW.decision = OLD.decision
  AND NEW.commentaire IS OLD.commentaire AND NEW.created_at = OLD.created_at
)
BEGIN
  SELECT RAISE(ABORT, 'journal-append-only');
END;

CREATE TRIGGER IF NOT EXISTS relectures_humaines_append_only_delete
BEFORE DELETE ON relectures_humaines
BEGIN
  SELECT RAISE(ABORT, 'journal-append-only');
END;
