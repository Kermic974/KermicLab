# ADR 0002 — JavaScript ES modules sans framework ni compilation

- Date : 2026-10-31 — Statut : accepté
- Décision : Worker et chat en JavaScript natif ; tests avec `node:test` ; une seule dépendance d'exécution (`@anthropic-ai/sdk`). Playwright est installé par la CI uniquement.
- Raisons : surface d'attaque minimale (dépôt destiné à devenir public), lisibilité par tout agent, pas d'étape de build fragile.
