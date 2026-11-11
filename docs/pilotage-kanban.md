<!-- AUTO-GENERATED: do not edit by hand; run node scripts/synchroniser-kanban.mjs -->
# Kanban de pilotage KermicLab

> **Source de vérité :** issues et labels GitHub de [Kermic974/KermicLab](https://github.com/Kermic974/KermicLab/issues).
> **Généré le :** 2026-11-11T07:12:36.816Z (UTC) · **Ouvertes :** 0 · **Fermées :** 0.
> Les horizons sont des priorités, pas des statuts d'avancement. Le statut reste « à qualifier » tant qu'aucun label `statut:*` ou `status:*` n'est défini sur l'issue.

## Synthèse

| Colonne | Issues ouvertes |
|---|---:|
| À faire maintenant | 0 |
| À faire ensuite | 0 |
| Sous condition | 0 |
| Plus tard | 0 |
| À classer | 0 |
| **Total** | **0** |

## Tableau Kanban

### À faire maintenant — 0

_Priorité immédiate._

_Aucune issue._


### À faire ensuite — 0

_Après les prérequis._

_Aucune issue._


### Sous condition — 0

_Budget, validation ou prérequis à lever._

_Aucune issue._


### Plus tard — 0

_Évolutions différées._

_Aucune issue._


### À classer — 0

_Aucune issue._

## Issues terminées

_Aucune issue fermée._


## Règles de synchronisation

1. Les labels `horizon:maintenant`, `horizon:ensuite`, `horizon:sous-condition` et `horizon:plus-tard` déterminent la colonne.
2. Une issue sans label d'horizon apparaît dans **À classer**.
3. Les issues ouvertes et fermées sont récupérées depuis l'API GitHub ; les pull requests sont exclues.
4. Le statut d'avancement n'est jamais déduit de l'horizon. Pour afficher un statut, utiliser un label `statut:backlog`, `statut:pret`, `statut:en-cours`, `statut:en-revue` ou `statut:termine`.
5. Les responsables, jalons et dépendances affichés sont ceux présents dans les métadonnées GitHub au moment de la génération.
6. La synchronisation est en lecture seule : elle ne modifie ni les issues, ni leurs labels, ni le tableau GitHub Projects global.

## Mise à jour manuelle

```bash
GH_TOKEN=... node scripts/synchroniser-kanban.mjs
```

Le workflow **Synchronisation du Kanban** régénère ce document chaque semaine et à chaque changement d'issue. Il ouvre ou actualise une PR de synchronisation ; aucune fusion automatique n'est effectuée.
