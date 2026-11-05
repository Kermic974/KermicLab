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
