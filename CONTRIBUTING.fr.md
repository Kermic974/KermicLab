# Contribuer

*[English version](CONTRIBUTING.md)*

Merci de votre aide ! Kermiclab s'adresse à des apprenants dès 7 ans : chaque contribution doit convenir à tous les âges.

1. Lire [AGENTS.md](AGENTS.md) (conventions, contrat des pages, règles de sécurité) — il s'applique aussi aux humains.
2. Ouvrir ou choisir une issue (`good first issue`, `help wanted`, `maquette-manquante`).
3. Créer une branche depuis `main`, faire des changements ciblés, lancer `npm run ci`.
4. Ouvrir une pull request avec le modèle. CI, CodeQL, revue des dépendances, scan des secrets et revue de
   sécurité par IA s'exécutent automatiquement ; la validation du CODEOWNER est obligatoire avant fusion.

Règles :

- Aucun secret, aucune donnée personnelle, aucun script externe ni appel réseau dans les pages HTML.
- Aucun texte d'interface en dur : ajouter les clés dans chaque `web/i18n/*.json`.
- Toute nouvelle dépendance demande un court ADR dans `docs/decisions/`.
- Commits signés sur `main`.

Failles de sécurité : voir [SECURITY.md](SECURITY.md) — jamais dans une issue publique.
