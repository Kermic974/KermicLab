-- Migration 0006 : contributions au contenu des comptes locaux (ADR 0023 §6 ter). Uniquement des CREATE … IF NOT EXISTS.
-- Mêmes colonnes que `contributions` (comptes OAuth), sans clé étrangère vers `comptes` : l'auteur et le relecteur sont
-- des comptes locaux (`comptes_locaux.id`), effacés avec le compte (worker/src/contributions.js).
-- Schéma de référence : worker/schema-compte-local.sql.
CREATE TABLE IF NOT EXISTS contributions_locales (
  id              TEXT PRIMARY KEY,
  auteur_id       TEXT NOT NULL,             -- compte local auteur
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
  relecteur_id    TEXT,                      -- compte local relecteur (NULL après sa suppression)
  commentaire     TEXT,                      -- commentaire du relecteur
  issue_numero    INTEGER,                   -- issue GitHub « contribution-validee »
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_contributions_locales_statut ON contributions_locales (statut, created_at);
CREATE INDEX IF NOT EXISTS idx_contributions_locales_auteur ON contributions_locales (auteur_id, statut);
