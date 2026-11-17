-- Espace famille des comptes locaux (ADR 0029). Schéma de référence des tests ; appliqué en production par la
-- migration 0003_famille.sql. Aucune IP, aucun identifiant en clair, aucun texte saisi librement par l'enfant.

-- Lien parent → enfant : deux comptes locaux. Le prénom (ou surnom) et la tranche d'âge sont choisis par le parent ;
-- le consentement parental est obligatoire et versionné. Un compte enfant n'a qu'un parent.
CREATE TABLE IF NOT EXISTS familles_liens (
  enfant_id             TEXT PRIMARY KEY,
  parent_id             TEXT NOT NULL,
  prenom                TEXT NOT NULL,
  tranche_age           TEXT NOT NULL,
  consentement_version  TEXT NOT NULL,
  consentement_le       TEXT NOT NULL DEFAULT (date('now')),
  origine               TEXT NOT NULL CHECK (origine IN ('invitation', 'creation')),
  lie_le                TEXT NOT NULL DEFAULT (date('now'))
);
CREATE INDEX IF NOT EXISTS idx_familles_liens_parent ON familles_liens (parent_id);

-- Invitation envoyée par un compte solo à son parent : seule l'empreinte SHA-256 du code est gardée, 48 h au plus.
CREATE TABLE IF NOT EXISTS familles_invitations (
  code_hash  TEXT PRIMARY KEY,
  enfant_id  TEXT NOT NULL UNIQUE,
  expire_a   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_familles_invitations_expiration ON familles_invitations (expire_a);

-- Bilan de progression de l'enfant, envoyé par son appareil : compteurs, dates au jour près et identifiants du
-- catalogue (JSON borné par web/famille.js). Remplacé à chaque envoi ; effacé avec le lien.
CREATE TABLE IF NOT EXISTS familles_bilans (
  enfant_id  TEXT PRIMARY KEY,
  bilan      TEXT NOT NULL,
  maj_le     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cahiers générés par le parent et assignés à un enfant. `demande` : type, notions du catalogue, longueur, univers,
-- objectif. `cahier` : contenu rédigé par l'IA, validé et modéré (null : cahier construit à partir du catalogue seul).
-- `calibrage` : notions acquises ou à travailler selon le questionnaire de l'enfant ; `avancement` : exercices réussis.
CREATE TABLE IF NOT EXISTS familles_cahiers (
  id          TEXT PRIMARY KEY,
  parent_id   TEXT NOT NULL,
  enfant_id   TEXT NOT NULL,
  demande     TEXT NOT NULL,
  cahier      TEXT,
  statut      TEXT NOT NULL DEFAULT 'assigne' CHECK (statut IN ('assigne', 'en-cours', 'termine', 'archive')),
  calibrage   TEXT,
  reussis     INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL DEFAULT 0,
  cree_le     TEXT NOT NULL DEFAULT (datetime('now')),
  maj_le      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_familles_cahiers_enfant ON familles_cahiers (enfant_id);
CREATE INDEX IF NOT EXISTS idx_familles_cahiers_parent ON familles_cahiers (parent_id);

-- Consommations d'IA des membres d'une famille : compteurs par compte, jour et module. Jamais de texte.
CREATE TABLE IF NOT EXISTS familles_consommations (
  compte_id  TEXT NOT NULL,
  jour       TEXT NOT NULL,
  module     TEXT NOT NULL,
  appels     INTEGER NOT NULL DEFAULT 0,
  tokens     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (compte_id, jour, module)
);
CREATE INDEX IF NOT EXISTS idx_familles_consommations_jour ON familles_consommations (jour);
