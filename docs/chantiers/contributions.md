# Chantier : Contributions au contenu (profils Prof et Contributeur)

**Niveau actuel : 1 (scénario sans IA prêt, connexion désactivée)**

Décision : [ADR 0023](../decisions/0023-contributions-contenu-prof-contributeur.md). Dépend du chantier
[Authentification](authentification.md) (OAuth, sessions, domaine API).

## État au 2026-11-07

| Élément | État |
|---|---|
| Règles partagées `web/contributions.js` (rôles, champs éditables, validation, transitions, diff) | Fait, testé (`tests/unit/contributions.test.mjs`) |
| API Worker `/api/contributions` (`worker/src/contributions.js`), issue `contribution-validee` à la validation | Fait, testé (`tests/unit/contributions-worker.test.mjs`) |
| Schéma : `comptes.role` contraint, table `contributions` (`worker/schema-comptes.sql`) | Présent, non appliqué en production |
| Interface `#contributions` : formulaire contributeur, « Mes contributions », tableau de bord prof | Fait, masqué tant que `connexionActive = false` |
| Démonstration `?demo=contributions` (rôles contributeur et prof simulés) | Fait, testé (`tests/e2e/contributions.test.mjs`) |
| Contenus des notions pour le formulaire (`dist/contenus/`) | Générés par `npm run build` |

## Plan

| Étape | Contenu | Statut |
|---|---|---|
| 1 | Scénario sans IA : rôles, proposition, relecture à quatre yeux, tableau de bord, issue de suivi, démo | Fait (PR en attente) |
| 2 | Valider l'ADR 0023 et la charte du contributeur ; créer le label `contribution-validee` | Actions manuelles 35–37 |
| 3 | Activation avec les comptes (ADR 0017) : schéma D1, attribution des premiers rôles, test du parcours réel | À faire |
| 4 | Avec IA : pré-relecture par un agent et PR d'intégration préparée automatiquement, validation humaine conservée | Backlog |
| 5 | Notifications aux auteurs, historique des décisions, rôles par matière, attribution des rôles dans l'interface | Backlog |

## Intégrer une contribution validée (processus)

1. Partir de l'issue `contribution-validee` (texte actuel, texte proposé, chemin du champ).
2. Branche `contribution/<notion>` ; appliquer le texte dans `catalogue/<notion>/contenu.json` (ou le dépôt privé),
   monter `version` dans `fiche.md`, `npm run ci`.
3. PR → validation du CODEOWNER → fusion → déploiement.
4. Dans le tableau de bord, « Marquer intégrée » ; fermer l'issue.
