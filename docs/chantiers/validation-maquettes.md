# Chantier : Validation des maquettes

**Niveau actuel : 0 (validation 100 % humaine)**

Processus (voir AGENTS.md §6) : issue `maquette-manquante` → branche → maquette candidate (agent, Sonnet 5.5) → `npm run ci` (routage des questions d'exemple, contrôle de sécurité des pages, rendu mobile) → PR → revue IA → **validation du CODEOWNER** → fusion → déploiement.

Prochaines étapes :
- Niveau 1 : tests Playwright génériques exécutés sur chaque maquette du catalogue privé (onglets, mobile, absence d'erreur console).
- Niveau 2 : grille de relecture pédagogique (exactitude, progression collège → lycée, adaptation à tous les âges).

## Catalogue de géographie : mondialisation

Les huit notions publiques ajoutées le 2026-11-01 suivent le gabarit commun, avec niveaux collège → lycée,
exercices corrigés et références dans leurs fiches. Les tests vérifient le routage, les repères sensibles,
les calculs, les indices après erreur et le rendu mobile ; ils ne remplacent pas la relecture géographique humaine.
La validation pédagogique du CODEOWNER reste à faire : voir l'action 22 dans [les actions manuelles](../actions-manuelles.md).
