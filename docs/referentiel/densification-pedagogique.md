# Densification pédagogique du référentiel (journal)

Voir le [diagnostic](diagnostic-densification.md) et les [relations à revoir](relations-a-revoir.md). Détail de la physique-chimie : [journal pilote](v0.5-physique-chimie-densification.md).

## Méthode

- Source : `referentiel/objets/v0.5/<discipline>/` (corpus canonique) ; `referentiel/projection-v0.json` est mis à jour pour rester cohérent, puis `npm run build` régénère `competences` et `prerequis` des fiches.
- Compétences : les MicroSkills génériques `*-action-1/2` sont remplacées par 3 à 6 MicroSkills « verbe d'action + objet précis », tirées des sections et exercices de chaque fiche (les libellés déjà observables sont conservés).
- Prérequis : `requires` seulement si la compréhension de la notion cible mobilise réellement la notion source (justification dans `rationale`) ; liens d'étude non ordonnés en `relatedTo` ; liens incertains non créés, listés dans `relations-a-revoir.md`.
- Statuts : nouveaux objets en `draft` (version 1). Les anciens objets génériques, au statut `review`, sont supprimés (S4 n'autorise que `validated → deprecated`) ; aucun identifiant n'est réutilisé.
- Sources : provenance `editorial` (fiches du dépôt). Aucune relation n'est présentée comme attestée par un texte officiel : ce sont des **propositions pédagogiques** à relire.

## Résultats

| Discipline | MicroSkills nouvelles | `requires` ajoutés | `relatedTo` ajoutés |
|---|---:|---:|---:|
| Physique-chimie | 103 | 17 | 0 |
| SVT | 116 | 18 | 0 |
| SES | 41 | 8 | 0 |
| EMC | 48 | 10 | 6 |
| Géographie | 82 | 9 | 3 |
| Français | 49 | 5 | 3 |
| Histoire | 76 | 14 | 2 |
| Philosophie | 69 | 0 | 14 |
| **Total** | **584** | **81** | **28** |

Les guardes existants du build (un prérequis ne commence pas dans une classe plus avancée) ont refusé deux liens EMC ; ils sont exprimés en `relatedTo`.

## Contrôles

`npm run check:referentiel` (PASS, 0 erreur, 0 avertissement, aussi en `--json`), `npm run build`, `npm run check:pages` et `npm test` (926 tests) passent.

## Limites et actions humaines

- Les 312 notions ajoutées depuis la V0 (cycles 2 à 4 et lycée) n'ont pas d'objets canoniques ; leurs liens restent à qualifier par le processus S4.
- Relecture humaine de la pertinence des compétences et des prérequis avant de passer les objets de `draft` à `review` puis `validated`.
