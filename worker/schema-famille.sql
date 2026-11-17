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
  maj_le      TEXT NOT NULL DEFAULT (datetime('now')),
  groupe      TEXT                                   -- cahier donné à toute la famille : même groupe pour chaque copie
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
