# Plan d'exécution recommandé

## Lot 0 - Qualification sans mutation
- Capturer commit, branche, runtime, gestionnaire de paquets.
- Inventorier scripts, workflows, schémas, données, tests et build.
- Exécuter les contrôles existants.
- Produire `audit-gap.md` et matrice keep/adapt/migrate/retire.

## Lot 1 - Fondation commune
- Centraliser patterns d'IDs, statuts, version, provenance/evidence.
- Choisir JSON Schema draft selon l'existant, sans migration gratuite de stack.
- Ajouter Rule IDs stables.

## Lot 2 - Huit JSON Schemas
Implémenter ou adapter les huit contrats. Aucun contrôle interobjet ne doit être faussement déclaré couvert par le seul JSON Schema.

## Lot 3 - Fixtures locales
Pour chaque contrat : valid, invalid et variantes de cycle/version.

## Lot 4 - Validateur niveau 3
Index des objets, résolution des références, types, namespaces, statuts et appartenances.

## Lot 5 - Validateur niveau 4
Unicités, historique, transitions, graphes, cycles, cardinalités, projectionKey, secondes sources de vérité détectables.

## Lot 6 - Rapport et CLI
Sortie déterministe humaine + JSON. Code de sortie non nul si ERROR.

## Lot 7 - CI
Ajouter les gates S4 sans supprimer silencieusement les contrôles existants. Démontrer un cas négatif qui fait échouer la CI.

## Lot 8 - Migration pilote
Choisir un corpus représentatif, migrer avec journal, vérifier application et rollback.

## Lot 9 - Migration incrémentale
Étendre par lots cohérents après qualification du pilote.
