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
-- (AES-GCM) avec une clé qui ne quitte pas l'appareil. Mise à jour au jour près (pas de corrélation fine avec les
-- sessions).
CREATE TABLE IF NOT EXISTS donnees_pseudonymes (
  pseudonyme  TEXT PRIMARY KEY,
  jeton_hash  TEXT NOT NULL,
  version     INTEGER NOT NULL CHECK (version >= 1),
  iv          TEXT NOT NULL,
  chiffre     TEXT NOT NULL,
  maj_le      TEXT NOT NULL DEFAULT (date('now'))
);
