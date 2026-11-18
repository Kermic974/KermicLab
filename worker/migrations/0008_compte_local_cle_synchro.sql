-- Migration 0008 : compte local (ADR 0024 §2 bis et §3 bis). Ajouts seulement.
-- 1. Mot de passe provisoire donné par le back-office : le compte doit le changer avant tout autre usage.
-- 2. Boîtes d'appairage : transfert chiffré de bout en bout de la clé de synchronisation vers un autre appareil.
-- Schéma de référence : worker/schema-compte-local.sql.
ALTER TABLE comptes_locaux ADD COLUMN mdp_provisoire INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS appairages (
  boite       TEXT PRIMARY KEY,
  compte_id   TEXT NOT NULL UNIQUE,
  jeton_hash  TEXT NOT NULL,
  iv          TEXT NOT NULL,
  chiffre     TEXT NOT NULL,
  expire_a    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_appairages_expiration ON appairages (expire_a);
