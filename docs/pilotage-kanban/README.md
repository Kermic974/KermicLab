# Kanban de pilotage synchronisé

Le document [pilotage-kanban.md](../pilotage-kanban.md) est la vue Markdown consolidée. Le fichier [pilotage-kanban.html](../pilotage-kanban.html) est sa version visuelle autonome, ouvrable directement dans un navigateur, y compris hors ligne.

- Générateur : [scripts/synchroniser-kanban.mjs](../../scripts/synchroniser-kanban.mjs) (produit les versions Markdown et HTML)
- Workflow : [Synchronisation du Kanban](../../.github/workflows/synchronisation-kanban.yml)
- Source : labels d'horizon et métadonnées des issues GitHub.
- Cadence : chaque lundi à 01:20 UTC, ainsi qu'à chaque changement d'issue.
- Mode opératoire : le workflow ouvre/actualise une PR ; une personne la relit et la fusionne.
- Sécurité : lecture seule sur les issues (`issues: read` sur le jeton du workflow) ; pas de mutation du tableau GitHub Projects global. Sans `issues: read`, l'API ne renvoie que les pull requests et la vue générée est vide.

Les horizons représentent la priorité stratégique. Les statuts d'avancement doivent être gérés séparément avec des labels `statut:*`.
