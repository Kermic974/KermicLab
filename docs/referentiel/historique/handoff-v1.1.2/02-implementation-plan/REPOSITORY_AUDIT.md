# Protocole d'audit du dépôt

## Inventaire
Inspecter si présents : `.github`, `catalogue`, `gabarit`, `Sample`, `scripts`, `src`, `tests`, `versions`, `web`, `worker`, `package.json`, lockfile, `SPEC.md`, `ARCHITECTURE.md`, `SECURITY.md`.

## Pour chaque structure
- Chemin et propriétaire logique.
- Sémantique réelle.
- Source de vérité ou vue dérivée.
- Contrat S4 cible.
- Écart : conforme, partiel, incompatible.
- Décision : keep, adapt, migrate, retire.
- Risque : faible, moyen, élevé.
- Tests existants.
- Plan de migration et rollback.

## Recherches obligatoires
Ancien statut `active|retired`; IDs avec classe/cycle/niveau ; relations imbriquées dans les nœuds ; données apprenant dans le canonique ; mappings dont l'unicité inclut version ; provenance chaîne ; evidence polymorphe ; références cassées ; cycles ; secrets et logs CI.
