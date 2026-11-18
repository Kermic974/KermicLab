# Qualification S5 v1.0.0

La norme a été adoptée dans la PR #369. La PR #374 ajoute le contrôle du catalogue CSV et l’index des sources. Les tests de couverture relient chaque diagnostic à sa fixture nommée et à sa sévérité.

## Reproductibilité Windows

Environnement local Node 22.23.5, dépendances verrouillées et catalogue public. Le lint, le build et le contrôle des 174 pages passent. Après synchronisation avec `main` dans `ed22646`, les 776 tests unitaires passent, dont l’historique Git avec chemin long et le rejet d’un dépôt incomplet. L’inventaire UX est identique aux sources et son registre est vérifié.

Les conversions de fichiers utilisent `fileURLToPath`. La lecture de l’historique utilise `git -c core.longpaths=true` pour chaque commande. Les tests de régression exécutent les mêmes contrôles sur Ubuntu en CI.

Les fichiers texte versionnés utilisent LF. Le fichier `.gitattributes` rend cette convention explicite pour les checkouts Windows et Linux, afin que les empreintes de sources UX soient reproductibles indépendamment de la configuration globale Git.

Le rapport canonique complet sur Windows est PASS, avec zéro erreur et zéro avertissement. Deux builds successifs de la base intégrée produisent exactement les mêmes 733 fichiers du catalogue, du site et du Worker, avec un diff vide sur les pages du catalogue et `index.html`. Le serveur navigateur normalise ses chemins avant de vérifier leur appartenance au dossier servi. Les 11 tests ciblés des jeux concernés passent.

La suite navigateur complète de Windows sur le code intégré de `ed22646` compte 537 tests, dont 536 réussis, zéro échec et un test ignoré lié à l’absence du catalogue privé. Les contrôles UX et la navigation des jeux sont inclus dans cette exécution.

## Preuves de conformité

| Exigence | Preuve |
| --- | --- |
| S5.1 — Sources et responsabilités | Norme adoptée dans #369, index des sources et guide du référentiel |
| S5.2 — Projection V0 | Tests de projection, journaux des neuf lots S4 et contrôle des 165 fiches publiques |
| S5.3 — Catalogue et preuves | Contrôle CSV et tests vérifiant chaque couple fixture–diagnostic et sa sévérité dans #374 |
| S5.4 — Rapports et reproductibilité | Rapports CI conservés, qualification Windows et build idempotent décrits ci-dessus |
| S5.5 — Qualification et sortie | CI Ubuntu, retour arrière et contrôle de production consignés ci-dessous |

La [CI Ubuntu du code intégré](https://github.com/Kermic974/KermicLab/actions/runs/44234557425) est verte. Les artefacts `validation-artefacts`, `validation-referentiel`, `build` et `captures` sont conservés. L’application inverse du diff de cette intégration restitue exactement l’arbre de `main` à `483e83d`.

Le [déploiement du validateur à 483e83d](https://github.com/Kermic974/KermicLab/actions/runs/44232855897) et son test de fumée ont réussi. Les niveaux et prérequis des 165 fiches concordent avec `/api/catalogue`.

La [page S5 dans Notion](https://app.notion.com/p/41a0c40cec28810d9d6cda3a622c249f) centralise les révisions adoptées et le suivi de la qualification de production après fusion de l’intégration #377.
