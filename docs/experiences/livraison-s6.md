# Livraison S6 — PR liées

Suivi : [#384](https://github.com/Kermic974/KermicLab/issues/384). Contrat : [S6 v1.0.0 proposé](../referentiel/normes/S6-v1.0.0.md). Point de départ : [audit du réel](audit-s6.md).

Toutes les PR ciblent `main`. Chaque description contient le suivi, la dépendance précédente, le périmètre du diff, les preuves et le retour arrière. La PR 01 doit être adoptée avant l’implémentation technique ; les suivantes sont préparées après fusion de leur dépendance. Avant chaque revue : synchroniser avec `origin/main`, vérifier base et diff, puis `npm run ci`. Les fusions relèvent du propriétaire (AGENTS.md).

| PR | Dépend de | Livrable | Acceptation particulière |
| --- | --- | --- | --- |
| 01 | — | Adoption Notion/Git, ADR 0033, audit, matrice et suivi | Contrats lisibles, décisions explicites, aucune prétention d’implémentation |
| 02 | 01 | Schémas JSON Schema 2020-12 et fixtures | Contrat commun, onze types, source/composition, variantes, refus des propriétés inconnues et états S7–9 |
| 03 | 02 | `check:experiences`, historique, S5, rapports et CI | Références/cycles/versions, PASS/ERROR/WARNING, preuve de chaque règle, rapport conservé en échec |
| 04 | 03 | Compléments S4 jeux/lab nécessaires | Cibles sourcées en review, pas de placement inventé, compatibilité des projections contrôlée |
| 05 | 04 | Adaptateurs, ancres, mapping événements, manifeste, export build et pilote | Huit notions, 2048, échecs et lab ; rendu et consommateurs inchangés, build idempotent |
| 06 | 05 | Mathématiques : 33 notions restantes | Journal de lot, unités couvertes, omissions justifiées, projection et événements compatibles |
| 07 | 06 | Physique-chimie : 22 restantes | Idem, dont alternatives aux figures |
| 08 | 07 | SVT : 23 restantes | Idem |
| 09 | 08 | Histoire : 15 restantes | Idem, prérequis V0 récents examinés |
| 10 | 09 | Géographie : 17 | Idem |
| 11 | 10 | Français : 9 restantes | Idem |
| 12 | 11 | EMC : 12 | Idem |
| 13 | 12 | SES : 10 | Idem |
| 14 | 13 | Philosophie : 16 restantes | Idem |
| 15 | 14 | Sept jeux restants | Académies, tâches paramétriques, règles préparées, aucun état individuel dans S6 |
| 16 | 15 | Contrôle de fermeture et qualification | Couverture 174 fiches + lab, inventaire actualisé, CI Windows/Ubuntu, production, Notion et bilan |

Le pilote comprend `pythagore`, `fractions`, `trigo-cercle`, `antiquite`, `acides-et-bases`, `adn-et-division-cellulaire`, `analyse-texte`, `liberte-philosophie`, les jeux `2048`, `echecs` et le lab `systeme-solaire`. Les lots 06–14 couvrent les 157 notions restantes. Les nombres sont ceux de l’inventaire initial ; une arrivée sur main impose un complément explicite au manifeste final.

## Vérification par livraison

Les PR techniques exécutent les tests de leurs nouveaux contrats et `npm run ci` au complet : lint, build, contrôles des pages, S4, S5, tests unitaires et Playwright 1.63.0 avec Node 22. Les preuves incluent la stabilité des identifiants après réordonnancement, le refus d’un changement source sans version, les bases périmées et conflits de variantes, les cycles et les diagnostics d’accessibilité gradués. Les rapports et la couverture sont conservés en CI. Les règles et tests évoluent ensemble, sans déclarer une règle implémentée avec une simple description.

Chaque lot compare les pages, les métadonnées V0, les événements, la recommandation et le cahier de vacances. Les modifications de sources déclenchent les règles de version existantes d’AGENTS.md §6 ter ; une modification uniquement d’ancres reste technique, mais le contrôleur de version doit pouvoir le constater explicitement. Aucun contournement global des contrôles de contenu n’est admis.

## Retour arrière et fermeture

Les lots ajoutent des définitions et références sans supprimer leurs sources. Le retour arrière consiste à revert la PR du lot, son manifeste et ses mappings dans le même changement, puis refaire build et contrôles ; si des consommateurs dépendent de ses nouvelles versions, les revert en ordre inverse ou livrer une correction cohérente. Conserver les IDs historiques et les données locales. Une régression du pilote permet de désactiver son export S6 via une PR tout en gardant les pages existantes.

La clôture exige le bilan des avertissements encore ouverts (sans promotion automatique), les exclusions relues, les familles à zéro, deux builds identiques, les tests de production des pages et de l’index S6 après déploiement, et le statut Notion lié à la révision livrée. Une PR ouverte ou fusionnée seule ne vaut pas livraison vérifiée.
