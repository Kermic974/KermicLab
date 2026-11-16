-- Back-office (ADR 0026). À appliquer sur la base D1 `kermiclab-kpi` par la migration 0002.
-- Aucune IP, aucun e-mail, aucun texte de requête : seulement des réglages, des compteurs agrégés et des catégories.

-- Rôles : les rôles système sont déclarés dans le code (worker/src/roles.js) ; une ligne ici les surcharge ou
-- ajoute un rôle personnalisé. `permissions` : liste JSON d'identifiants du registre des permissions.
CREATE TABLE IF NOT EXISTS roles (
  id           TEXT PRIMARY KEY,
  libelle      TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  permissions  TEXT NOT NULL DEFAULT '[]',
  maj_le       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Rôle et niveau de souscription d'un compte (compte famille ou compte local). Sans ligne : rôle par défaut.
CREATE TABLE IF NOT EXISTS attributions_roles (
  type_compte  TEXT NOT NULL CHECK (type_compte IN ('compte', 'compte-local')),
  compte_id    TEXT NOT NULL,
  role_id      TEXT NOT NULL,
  niveau       TEXT NOT NULL DEFAULT 'gratuit',
  maj_le       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (type_compte, compte_id)
);

-- Stratégie d'accès d'une fonctionnalité : ouverte à tous, réservée à des rôles ou niveaux, ou fermée.
-- Sans ligne : « tous ». Appliquée seulement quand CONTROLE_ACCES_ACTIF vaut true (false pendant la bêta).
CREATE TABLE IF NOT EXISTS strategies_acces (
  fonctionnalite  TEXT PRIMARY KEY,
  mode            TEXT NOT NULL DEFAULT 'tous' CHECK (mode IN ('tous', 'roles', 'personne')),
  roles           TEXT NOT NULL DEFAULT '[]',
  niveaux         TEXT NOT NULL DEFAULT '[]',
  maj_le          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Réglages modifiables à chaud : paramètres du registre (`param:<CLÉ>`), charte graphique (`theme`),
-- niveaux de souscription (`niveaux`). Valeurs validées et bornées par le Worker avant écriture.
CREATE TABLE IF NOT EXISTS reglages (
  cle     TEXT PRIMARY KEY,
  valeur  TEXT NOT NULL,
  maj_le  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Journal d'audit du back-office : qui a fait quoi, sur quelle cible. Jamais le contenu modifié.
CREATE TABLE IF NOT EXISTS journal_admin (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  horodatage  TEXT NOT NULL DEFAULT (datetime('now')),
  acteur      TEXT NOT NULL,
  action      TEXT NOT NULL,
  cible       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_journal_admin_horodatage ON journal_admin (horodatage);

-- Télémétrie des appels aux modèles, agrégée à l'heure : aucun identifiant de session, de profil ou de requête.
CREATE TABLE IF NOT EXISTS telemetrie_llm (
  heure              TEXT NOT NULL,             -- AAAA-MM-JJTHH (UTC)
  module             TEXT NOT NULL,
  fournisseur        TEXT NOT NULL,
  modele             TEXT NOT NULL,
  statut             TEXT NOT NULL,             -- ok | refus | tronque | erreur
  appels             INTEGER NOT NULL DEFAULT 0,
  tokens_entree      INTEGER NOT NULL DEFAULT 0,
  tokens_sortie      INTEGER NOT NULL DEFAULT 0,
  duree_ms           INTEGER NOT NULL DEFAULT 0,
  pseudonymisations  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (heure, module, fournisseur, modele, statut)
);

-- Signaux de sécurité : compteurs par profil pseudonyme, jour, catégorie et module. Jamais de texte.
-- `profil` : empreinte HMAC tronquée d'un identifiant de session ou de compte, ou « anonyme ».
CREATE TABLE IF NOT EXISTS signaux_securite (
  profil     TEXT NOT NULL,
  jour       TEXT NOT NULL,                     -- AAAA-MM-JJ (UTC)
  categorie  TEXT NOT NULL,
  module     TEXT NOT NULL,
  n          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (profil, jour, categorie, module)
);
CREATE INDEX IF NOT EXISTS idx_signaux_securite_jour ON signaux_securite (jour);

-- État de sécurité d'un profil pseudonyme : décidé par les règles (auto) ou par un administrateur.
CREATE TABLE IF NOT EXISTS profils_securite (
  profil      TEXT PRIMARY KEY,
  etat        TEXT NOT NULL DEFAULT 'normal' CHECK (etat IN ('normal', 'surveille', 'restreint', 'suspendu')),
  motifs      TEXT NOT NULL DEFAULT '[]',
  decide_par  TEXT NOT NULL DEFAULT 'auto' CHECK (decide_par IN ('auto', 'admin')),
  maj_le      TEXT NOT NULL DEFAULT (date('now')),
  expire_le   TEXT
);

-- Gestion des contenus : état de publication à chaud d'un contenu du catalogue (masqué, mis en avant).
CREATE TABLE IF NOT EXISTS contenus_etats (
  id        TEXT PRIMARY KEY,
  en_ligne  INTEGER NOT NULL DEFAULT 1 CHECK (en_ligne IN (0, 1)),
  en_avant  INTEGER NOT NULL DEFAULT 0 CHECK (en_avant IN (0, 1)),
  maj_le    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Brouillons éditoriaux rédigés dans le back-office (articles, parcours, propositions de cours, de lab ou de jeu).
-- Texte destiné à publication, sans donnée personnelle (filtrée par le Worker), comme les contributions (ADR 0023).
CREATE TABLE IF NOT EXISTS contenus_brouillons (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('blog', 'cours', 'parcours', 'lab', 'jeu')),
  titre         TEXT NOT NULL,
  corps         TEXT NOT NULL DEFAULT '',
  statut        TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'propose', 'publie', 'archive')),
  issue_numero  INTEGER,
  cree_le       TEXT NOT NULL DEFAULT (datetime('now')),
  maj_le        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contenus_brouillons_type ON contenus_brouillons (type, statut);
