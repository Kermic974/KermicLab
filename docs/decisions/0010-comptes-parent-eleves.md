# ADR 0010 — Comptes parent, profils élèves et progression

- Date : 2026-11-01 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : sortie progressive du mode zéro budget (ADR 0006). Activation prévue de Claude, puis des comptes pour sauvegarder la progression. Public mineur (7–77 ans, avec focus collège). Besoin d’un modèle de données prêt avant d’écrire du code d’auth.
- Décision :

## Principes

1. **Pas de compte enfant autonome** au démarrage. Un parent (ou responsable légal) crée et gère un ou plusieurs profils élèves.
2. **Consentement parental explicite** avant toute création de profil pour un mineur de moins de 15 ans (majorité numérique en France). Point de contrôle humain / juridique (chantier RGPD).
3. **Séparation stricte** entre :
   - KPI anonymes (`evenements`, ADR 0007 / chantier KPI) — aucune clé vers un compte ou un élève ;
   - données identifiantes minimales (compte parent + profils + progression).
4. **Minimisation** : pas d’IP, pas de texte de chat lié à l’identité, email parent stocké de façon minimale (hash + éventuellement secret chiffré côté Worker).
5. **Effacement** : suppression d’un compte parent cascade les profils élèves et leurs progrès (droit à l’oubli simple).

## Schéma cible (Cloudflare D1)

Tables nouvelles (base à confirmer : même D1 `kermiclab-kpi` avec préfixe logique, ou D1 dédiée `kermiclab-comptes` si isolation renforcée).

```sql
-- Compte du responsable (parent, enseignant, admin)
CREATE TABLE comptes (
  id            TEXT PRIMARY KEY,          -- UUID
  email_hash    TEXT NOT NULL UNIQUE,      -- hash de l’email (pas l’email en clair)
  role          TEXT NOT NULL,             -- 'parent' | 'pro' | 'admin'
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT,
  consent_at    TEXT,                     -- horodatage du consentement parental (si applicable)
  consent_version TEXT                    -- version du texte de consentement accepté
);

-- Profil élève (pas de login autonome en phase 1)
CREATE TABLE eleves (
  id              TEXT PRIMARY KEY,
  parent_id       TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  prenom_affiche  TEXT NOT NULL,          -- prénom ou surnom affiché, pas de nom de famille
  age_tranche     TEXT,                   -- ex. '8-10', '11-13', '14-15' (pas de date de naissance exacte)
  langue          TEXT NOT NULL DEFAULT 'fr',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_eleves_parent ON eleves (parent_id);

-- Progression pédagogique
CREATE TABLE progres (
  eleve_id     TEXT NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  notion_id    TEXT NOT NULL,             -- id de maquette ou de notion catalogue
  score        INTEGER,                   -- 0–100 si applicable
  etoiles      INTEGER,                   -- 0–3
  completed_at TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (eleve_id, notion_id)
);
```

## Ce qui reste hors base identifiant

- Table `evenements` (KPI) : **inchangée**, toujours anonyme.
- Scores / langue / onglet en localStorage : restent le défaut pour les visiteurs non connectés ; synchronisation vers `progres` uniquement si un profil élève est actif.
- Bouton « Se connecter » : reste masqué (`CONFIG.connexionActive = false`) jusqu’à la phase C (auth).

## Auth (phase ultérieure, hors scope de cet ADR)

Provider à trancher plus tard (Cloudflare Access, magic link Worker, ou tiers type Clerk). Cet ADR ne choisit pas le fournisseur ; il impose seulement que l’identifiant stable côté D1 soit `comptes.id` et que l’email ne soit jamais journalisé en clair dans les KPI.

## Phases d’implémentation

| Phase | Contenu | Débloque |
|-------|---------|----------|
| **A** | Activer `ANTHROPIC_API_KEY` (plafond) — hors schéma comptes | Chat intelligent + issues auto |
| **B** | Observabilité / limites prod | Stabilité |
| **C** | Auth parent + tables `comptes` / `eleves` / `progres` + consentement | Progression sauvegardée |
| **D** | Tableau de bord parent, multi-profils, exports | Valeur parent |

## Conséquences

- Nouvel agent / zone de responsabilité **Données** (schéma, migrations, rétention) et **Sécurité** (auth, consentement, secrets) à refléter dans `AGENTS.md` lors de l’implémentation.
- Chantier `docs/chantiers/rgpd.md` : passer au niveau 1 (registre des traitements, sous-traitants, consentement parental) avant la phase C.
- Action manuelle juridique (consentement < 15 ans) déjà listée dans `docs/actions-manuelles.md` — reste un point de contrôle humain obligatoire.
- Aucun changement de code runtime dans cet ADR ; schéma et principes seulement.

## Révision

À valider par le propriétaire avant toute migration D1 ou activation du bouton « Se connecter ».
