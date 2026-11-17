-- Migration 0006 : activités des parents et résultats des enfants, cahiers assignés à toute la famille (ADR 0029 §8).
-- Ajouts seulement. Schéma de référence : worker/schema-famille.sql.

-- Activités données par un parent (ADR 0029 §8) : défi, évaluation (5 à 40 questions) ou objectif, pour un enfant
-- (enfant_id) ou toute la famille (enfant_id NULL : enfants présents et futurs). `parametres` : notions du catalogue,
-- nombre de questions, objectif, libellé court du parent (JSON borné par web/professeur.js, mêmes règles qu'un professeur).
CREATE TABLE IF NOT EXISTS familles_activites (
  id          TEXT PRIMARY KEY,
  parent_id   TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('defi', 'evaluation', 'objectif')),
  enfant_id   TEXT,
  parametres  TEXT NOT NULL,
  echeance    TEXT,
  statut      TEXT NOT NULL DEFAULT 'active' CHECK (statut IN ('active', 'archivee')),
  cree_le     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_familles_activites_parent ON familles_activites (parent_id);
CREATE INDEX IF NOT EXISTS idx_familles_activites_enfant ON familles_activites (enfant_id);

-- Résultat d'un enfant à une activité, envoyé par son appareil : compteurs seulement (aucune réponse, aucun texte).
CREATE TABLE IF NOT EXISTS familles_resultats (
  activite_id  TEXT NOT NULL,
  enfant_id    TEXT NOT NULL,
  reussis      INTEGER NOT NULL DEFAULT 0,
  total        INTEGER NOT NULL DEFAULT 0,
  meilleur     INTEGER NOT NULL DEFAULT 0,
  tentatives   INTEGER NOT NULL DEFAULT 0,
  duree_s      INTEGER NOT NULL DEFAULT 0,
  termine      INTEGER NOT NULL DEFAULT 0,
  debut_le     TEXT NOT NULL DEFAULT (datetime('now')),
  maj_le       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (activite_id, enfant_id)
);
CREATE INDEX IF NOT EXISTS idx_familles_resultats_enfant ON familles_resultats (enfant_id);

-- Cahier assigné à toute la famille : même groupe pour les copies de chaque enfant (ADR 0029 §8).
ALTER TABLE familles_cahiers ADD COLUMN groupe TEXT;
