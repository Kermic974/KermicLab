# Bilan de la migration S4 v0.5

L’[inventaire v0.5](../../referentiel/inventaire-v0.5.json) couvre 165 fiches publiques dans neuf disciplines. Le [générateur](../../referentiel/generation-v0.5.md) produit les objets canoniques en brouillon et projette vers les fiches les niveaux, prérequis et compétences selon le contrat V0. Les 36 fiches de mathématiques ont pu réutiliser leurs métadonnées V0 existantes.

| Discipline | Fiches | Journal du lot | PR |
| --- | ---: | --- | --- |
| Mathématiques | 36 | [Journal](v0.5-mathematiques.md) | [#349](https://github.com/Kermic974/KermicLab/pull/349) |
| Physique-chimie | 23 | [Journal](v0.5-physique-chimie.md) | [#350](https://github.com/Kermic974/KermicLab/pull/350) |
| SVT | 24 | [Journal](v0.5-svt.md) | [#353](https://github.com/Kermic974/KermicLab/pull/353) |
| Histoire | 16 | [Journal](v0.5-histoire.md) | [#359](https://github.com/Kermic974/KermicLab/pull/359) |
| Géographie | 17 | [Journal](v0.5-geographie.md) | [#360](https://github.com/Kermic974/KermicLab/pull/360) |
| Français | 10 | [Journal](v0.5-francais.md) | [#361](https://github.com/Kermic974/KermicLab/pull/361) |
| EMC | 12 | [Journal](v0.5-emc.md) | [#362](https://github.com/Kermic974/KermicLab/pull/362) |
| SES | 10 | [Journal](v0.5-ses.md) | [#363](https://github.com/Kermic974/KermicLab/pull/363) |
| Philosophie | 17 | [Journal](v0.5-philosophie.md) | [#364](https://github.com/Kermic974/KermicLab/pull/364) |

## Qualification

- Sur le commit de fusion `8b85f2f`, l’audit de couverture retrouve 165 fiches, 1 873 objets canoniques en brouillon et zéro projection obsolète. La validation S4 de la CI a réussi.
- Le déploiement Cloudflare et son test de fumée sont passés sur le même commit. Les niveaux et prérequis des 165 fiches correspondent au catalogue public. [CI de qualification](https://github.com/Kermic974/KermicLab/actions/runs/44124939785)

- Les journaux documentent la comparaison des recommandations et des parcours du cahier de vacances avant et après chaque lot. Les descriptions des PR consignent les retours arrière vérifiés.
- L’audit des diffs de chaque lot confirme que les fiches modifiées appartiennent à l’inventaire disciplinaire. Les fichiers `contenu.json` et les fiches de jeu sont hors périmètre.
- Le contrôle de production compare les niveaux et prérequis de chaque fiche avec une même réponse de `/api/catalogue`. Les compétences sont contrôlées dans les fiches du dépôt et dans la projection, car le catalogue public expose les niveaux et les prérequis.

La relecture pédagogique des sources, des niveaux et des justifications des placements se poursuit à partir des journaux. Les objets canoniques restent au statut `draft` jusqu’aux décisions de validation. [Suivi de la relecture #366](https://github.com/Kermic974/KermicLab/issues/366)
