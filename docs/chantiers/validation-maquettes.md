# Chantier : Validation des maquettes

**Niveau actuel : 0 (validation 100 % humaine)**

Processus (voir AGENTS.md §6) : issue `maquette-manquante` → branche → maquette candidate (agent, Sonnet 5.5) → `npm run ci` (routage des questions d'exemple, contrôle de sécurité des pages, rendu mobile) → PR → revue IA → **validation du CODEOWNER** → fusion → déploiement.

Prochaines étapes :
- Niveau 1 : tests Playwright génériques exécutés sur chaque maquette du catalogue privé (onglets, mobile, absence d'erreur console).
- Niveau 2 : grille de relecture pédagogique (exactitude, progression collège → lycée, adaptation à tous les âges).
