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
