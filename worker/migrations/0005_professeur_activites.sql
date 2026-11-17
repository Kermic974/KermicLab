-- Migration 0005 : activités du professeur et résultats des élèves (ADR 0030 §9). Uniquement des CREATE … IF NOT EXISTS.
-- Schéma de référence : worker/schema-professeur.sql.

-- Activités données par un professeur (ADR 0030 §9) : défi, évaluation, cahier ou objectif, pour un élève
-- (eleve_id) ou toute une classe (classe_id). `parametres` : notions du catalogue, nombre de questions, réglages du
-- cahier, objectif, libellé court du professeur (JSON borné par web/professeur.js). `contenu` : cahier rédigé par
-- l'IA, validé et modéré (null : construit à partir du catalogue).
CREATE TABLE IF NOT EXISTS professeurs_activites (
  id          TEXT PRIMARY KEY,
  prof_id     TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('defi', 'evaluation', 'cahier', 'objectif')),
  classe_id   TEXT,
  eleve_id    TEXT,
  parametres  TEXT NOT NULL,
  contenu     TEXT,
  echeance    TEXT,
  statut      TEXT NOT NULL DEFAULT 'active' CHECK (statut IN ('active', 'archivee')),
  cree_le     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_professeurs_activites_prof ON professeurs_activites (prof_id);
CREATE INDEX IF NOT EXISTS idx_professeurs_activites_classe ON professeurs_activites (classe_id);
CREATE INDEX IF NOT EXISTS idx_professeurs_activites_eleve ON professeurs_activites (eleve_id);

-- Résultat d'un élève à une activité, envoyé par son appareil : compteurs seulement (aucune réponse, aucun texte).
CREATE TABLE IF NOT EXISTS professeurs_resultats (
  activite_id  TEXT NOT NULL,
  eleve_id     TEXT NOT NULL,
  reussis      INTEGER NOT NULL DEFAULT 0,
  total        INTEGER NOT NULL DEFAULT 0,
  meilleur     INTEGER NOT NULL DEFAULT 0,
  tentatives   INTEGER NOT NULL DEFAULT 0,
  duree_s      INTEGER NOT NULL DEFAULT 0,
  termine      INTEGER NOT NULL DEFAULT 0,
  debut_le     TEXT NOT NULL DEFAULT (datetime('now')),
  maj_le       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (activite_id, eleve_id)
);
CREATE INDEX IF NOT EXISTS idx_professeurs_resultats_eleve ON professeurs_resultats (eleve_id);

-- Cahiers rédigés par l'IA pour un professeur : compteur par jour (quota CAHIERS_GENERATIONS_JOUR), jamais de texte.
CREATE TABLE IF NOT EXISTS professeurs_consommations (
  prof_id  TEXT NOT NULL,
  jour     TEXT NOT NULL,
  appels   INTEGER NOT NULL DEFAULT 0,
  tokens   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (prof_id, jour)
);
