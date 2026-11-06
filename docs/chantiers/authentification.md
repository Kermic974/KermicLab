# Chantier : Authentification (OAuth) et comptes famille

**Niveau actuel : 1 (fondations en préparation, connexion désactivée)**

Décision du propriétaire (2026-11-01) : chantier OAuth mis en backlog. Reprise le 2026-11-06 pour préparer l'interface :
**un compte parent est nécessaire pour créer un compte enfant ; à défaut, l'enfant utilise un profil local.**
Parcours cible : [ADR 0017](../decisions/0017-parcours-comptes-famille.md). Modèle de données : [ADR 0010](../decisions/0010-comptes-parent-eleves.md).
Profil local : [ADR 0012](../decisions/0012-tableau-de-bord-pseudo-cookie.md).

## État au 2026-11-06

| Élément | État |
|---|---|
| Profil local (pseudo, progression sur l'appareil) | En ligne (ADR 0012) |
| Worker : `/auth/login`, `/auth/callback`, `/auth/me`, `/auth/logout` (Google, Microsoft, PKCE, `state`) | Présent, non utilisé |
| Worker : `/api/eleves` (GET, POST, DELETE), `/api/progres` (GET, POST) | PR ouverte : validation (règles partagées avec l'interface), consentement versionné obligatoire et enregistré, plafond de 6 profils, 401 sans session, 503 si les tables manquent, progression bornée et écrite en une requête groupée |
| Schéma `worker/schema-comptes.sql` | Présent, non appliqué en production ; `eleves` gagne `consentement_version` et `consentement_at` (NOT NULL) |
| Interface : Espace famille `#famille`, type de profil, formulaire enfant avec consentement | PR ouverte (remplace les dialogues provisoires « Mon compte » et « Consentement ») ; masquée tant que `connexionActive = false` |

## Constats de l'audit

1. `web/app.js` appelle `/auth/me` à chaque visite, même quand la connexion est désactivée.
2. Les dialogues provisoires ont leurs textes en dur dans `web/index.html` (hors `web/i18n/`) et demandent le prénom par `prompt()`,
   avec une tranche d'âge fixée à `11-13`.
3. `POST /api/eleves` accepte n'importe quel prénom, sans consentement ni plafond ; aucune suppression de profil.
4. `oauth_states.browser_binding` est `NOT NULL` dans le schéma mais n'est pas renseigné par `worker/src/auth/oauth.js` : la connexion
   échouerait à la première tentative.
5. Le cookie `session` est posé par `kermic.workers.dev` alors que le site est sur `kermiclab.online` : cookie tiers, bloqué par une
   partie des navigateurs. L'API doit être servie sur un sous-domaine du site avant l'activation.
6. Aucun test unitaire ne couvre `worker/src/auth/`.

## Plan

| Étape | Contenu | Statut |
|---|---|---|
| 1 | ADR 0017, ce plan, actions manuelles | PR ouverte |
| 2 | Interface : `web/comptes.js` (logique pure), Espace famille `#famille`, bloc « Type de profil », formulaire enfant et consentement, i18n, `/auth/me` seulement si `connexionActive` | PR ouverte |
| 3 | Worker : validation et consentement de `/api/eleves`, `DELETE /api/eleves/:id`, plafond de 6 profils, tests | PR ouverte (`worker/src/comptes.js`, `tests/unit/comptes-worker.test.mjs`) |
| 4 | Liaison navigateur OAuth (`browser_binding`), `prompt=login` pour revenir à l'Espace famille depuis le mode enfant, tests | À faire |
| 5 | Domaine API même site, application du schéma D1, secrets OAuth, page de confidentialité, activation | Actions manuelles |
| 6 | Phase D : code d'appairage d'un appareil enfant, tableau de bord parent, export | Backlog |

## Prérequis humains avant l'activation

- Valider les ADR 0010 et 0017.
- RGPD niveau 1 et texte de consentement parental (`docs/chantiers/rgpd.md`) — **point de contrôle humain / juridique**.
- Inscrire les applications OAuth (Google, Microsoft) et déposer les secrets en Cloudflare Secrets.
- Servir l'API sur un sous-domaine de `kermiclab.online`.
