-- Migration 0010 : journal de relecture humaine (ADR 0039). Ajout seulement.
-- Une ligne par confirmation. Les corrections sont de nouvelles lignes : un déclencheur interdit UPDATE et DELETE,
-- sauf l'effacement du lien vers le compte (relecteur_id mis à NULL), qui n'est pas réversible vers la personne.
-- Schéma de référence : worker/schema-comptes.sql.
CREATE TABLE IF NOT EXISTS relectures_humaines (
  id              TEXT PRIMARY KEY,
  relecteur_id    TEXT,                      -- id anonymisé du compte ; NULL après suppression du compte
  origine         TEXT NOT NULL CHECK (origine IN ('oauth', 'local')),
  role            TEXT NOT NULL CHECK (length(role) BETWEEN 2 AND 32 AND role GLOB '[a-z]*' AND role NOT GLOB '*[^a-z0-9-]*'),
  code_relecteur  TEXT NOT NULL,             -- code court affiché ; non réversible seul vers la personne
  notion_id       TEXT NOT NULL,
  notion_version  TEXT NOT NULL,             -- version du catalogue, lue par le Worker
  empreinte       TEXT NOT NULL,             -- SHA-256 du contenu pédagogique, calculée par le Worker
  grille          TEXT NOT NULL CHECK (grille IN ('v1', 'jeux-v1')),
  criteres        TEXT NOT NULL,             -- critères cochés, JSON, dans l'ordre de la grille
  decision        TEXT NOT NULL CHECK (decision IN ('conforme', 'a_corriger')),
  commentaire     TEXT,                      -- facultatif, filtré contre les données personnelles
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
