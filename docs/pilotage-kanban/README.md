# Kanban de pilotage synchronisé

Le document [pilotage-kanban.md](./pilotage-kanban.md) est la vue consolidée des issues du dépôt.

- Générateur : [scripts/synchroniser-kanban.mjs](../../scripts/synchroniser-kanban.mjs)
- Workflow : [Synchronisation du Kanban](../../.github/workflows/synchronisation-kanban.yml)
- Source : labels d'horizon et métadonnées des issues GitHub.
- Cadence : chaque lundi à 01:20 UTC, ainsi qu'à chaque changement d'issue.
- Mode opératoire : le workflow ouvre/actualise une PR ; une personne la relit et la fusionne.
- Sécurité : lecture seule sur les issues ; pas de mutation du tableau GitHub Projects global.

Les horizons représentent la priorité stratégique. Les statuts d'avancement doivent être gérés séparément avec des labels `statut:*`.
