# CLAUDE.md

Toutes les instructions du projet sont dans **[AGENTS.md](AGENTS.md)** : lis-le en premier et suis-le.

Spécificités Claude Code :

- Avant de rendre la main, lance `npm run ci` (Chromium et Playwright sont préinstallés dans les sessions cloud : ne pas lancer `playwright install`).
- Pour toute modification de code appelant l'API Claude, utilise le SDK `@anthropic-ai/sdk` déjà présent et les modèles indiqués dans AGENTS.md §4.
- Applique le protocole des actions manuelles (AGENTS.md §8) avec un bloc **ACTION MANUELLE REQUISE** dans le chat.
- Utilise le MCP GitHub pour les issues et pull requests ; ne crée une PR que si le propriétaire le demande.
