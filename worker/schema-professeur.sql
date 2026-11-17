-- Expérience Professeur (ADR 0030). Schéma de référence des tests ; appliqué en production par la migration
-- 0004_professeur.sql. Aucune IP, aucun identifiant en clair, aucun texte libre de l'élève hors de son pseudo.

-- Profil du professeur : nom affiché aux élèves (choisi par le professeur, adulte), matières et niveaux enseignés
-- (listes fermées, JSON).
CREATE TABLE IF NOT EXISTS professeurs_profils (
  compte_id    TEXT PRIMARY KEY,
  nom_affiche  TEXT NOT NULL,
  matieres     TEXT NOT NULL,
  niveaux      TEXT NOT NULL,
  maj_le       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Classes du professeur : nom court, une matière et un niveau de son profil.
CREATE TABLE IF NOT EXISTS professeurs_classes (
  id        TEXT PRIMARY KEY,
  prof_id   TEXT NOT NULL,
  nom       TEXT NOT NULL,
  matiere   TEXT NOT NULL,
  niveau    TEXT NOT NULL,
  cree_le   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_professeurs_classes_prof ON professeurs_classes (prof_id);

-- Liens d'invitation : seule l'empreinte SHA-256 du code est gardée. Classe : utilisable par plusieurs élèves jusqu'à
-- l'expiration ; cours particulier : usage unique. 30 jours au plus.
CREATE TABLE IF NOT EXISTS professeurs_invitations (
  id                TEXT PRIMARY KEY,
  code_hash         TEXT NOT NULL UNIQUE,
  prof_id           TEXT NOT NULL,
  classe_id         TEXT,
  mode              TEXT NOT NULL CHECK (mode IN ('classe', 'particulier')),
  expire_a          INTEGER NOT NULL,
  utilisations_max  INTEGER NOT NULL,
  utilisations      INTEGER NOT NULL DEFAULT 0,
  cree_le           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_professeurs_invitations_prof ON professeurs_invitations (prof_id);
CREATE INDEX IF NOT EXISTS idx_professeurs_invitations_expiration ON professeurs_invitations (expire_a);

-- Élèves affiliés : un lien par professeur et par élève, dans une classe ou en cours particulier (classe_id nul).
-- Le pseudo est choisi par l'élève ; son accord au partage de la progression est versionné.
CREATE TABLE IF NOT EXISTS professeurs_eleves (
  prof_id         TEXT NOT NULL,
  eleve_id        TEXT NOT NULL,
  classe_id       TEXT,
  pseudo          TEXT NOT NULL,
  accord_version  TEXT NOT NULL,
  rejoint_le      TEXT NOT NULL DEFAULT (date('now')),
  PRIMARY KEY (prof_id, eleve_id)
);
CREATE INDEX IF NOT EXISTS idx_professeurs_eleves_eleve ON professeurs_eleves (eleve_id);
CREATE INDEX IF NOT EXISTS idx_professeurs_eleves_classe ON professeurs_eleves (classe_id);

-- Bilan de progression de l'élève pour ses professeurs : même format borné que le bilan famille (compteurs, dates au
-- jour près, identifiants du catalogue). Remplacé à chaque envoi ; effacé quand l'élève n'a plus de professeur.
CREATE TABLE IF NOT EXISTS professeurs_bilans (
  eleve_id  TEXT PRIMARY KEY,
  bilan     TEXT NOT NULL,
  maj_le    TEXT NOT NULL DEFAULT (datetime('now'))
);

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
