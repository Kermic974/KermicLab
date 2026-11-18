-- Migration 0009 : rôles cumulatifs et changements de souscription (ADR 0034). Ajouts seulement.
-- 1. `attributions_roles.roles` : liste JSON des rôles attribués à la main (cumulatifs). Vide : `role_id` seul, comme
--    avant ; `role_id` reste le premier rôle de la liste, lu par la version précédente du Worker.
-- 2. `souscriptions_changements` : historique des changements de niveau demandés par le compte (paiement à venir ;
--    pendant la phase de développement, le paiement est considéré comme acquis : `paiement = 'dev'`).
-- Schéma de référence : worker/schema-backoffice.sql.
ALTER TABLE attributions_roles ADD COLUMN roles TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS souscriptions_changements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type_compte  TEXT NOT NULL CHECK (type_compte IN ('compte', 'compte-local')),
  compte_id    TEXT NOT NULL,
  de           TEXT NOT NULL,
  vers         TEXT NOT NULL,
  paiement     TEXT NOT NULL CHECK (paiement IN ('dev', 'gratuit', 'paye')),
  change_le    TEXT NOT NULL DEFAULT (date('now'))
);
CREATE INDEX IF NOT EXISTS idx_souscriptions_changements_compte ON souscriptions_changements (type_compte, compte_id);
