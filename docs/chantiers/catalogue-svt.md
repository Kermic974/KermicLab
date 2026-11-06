# Chantier : catalogue de SVT (programme complet)

**Niveau actuel : 24 fiches en ligne (doublons de collège réconciliés) ; les 23 notions des vagues 1 à 3 (collège → terminale) sont fusionnées et déployées (PR #76, #77, #78 et correctif de routage #79)**

Objectif : couvrir le programme de sciences de la vie et de la Terre du collège (cycle 4) à la terminale (spécialité), une notion par
page. Même méthode que les maths et la physique-chimie : gabarit commun (ADR 0011), une PR par vague, relecture humaine de
l'exactitude, contrôles automatiques (contenu validé, questions routées, pages sûres, chaque exercice résolu par un test navigateur).
Les notions ont un `sujet` en `svt/…` : la barre de navigation du chat leur consacre un onglet. Statuts : `en ligne` / `PR ouverte` / `à faire`.

## Vague 1 — collège

| Notion (`id`) | Niveaux couverts | Statut |
|---|---|---|
| `la-cellule` | 6e → seconde (eucaryotes, procaryotes) | en ligne |
| `nutrition-et-digestion` | 5e → seconde (microbiote) | en ligne |
| `respiration-et-circulation` | 5e → seconde (débit cardiaque) | en ligne |
| `photosynthese` | 6e → première (équation bilan) | en ligne |
| `reproduction-humaine` | 4e → 3e | en ligne |
| `genetique-et-heredite` | 3e → seconde (mutations) | en ligne |
| `systeme-immunitaire` (microbes, vaccination) | 3e | en ligne |
| `ecosystemes-et-biodiversite` | 6e → seconde | en ligne |
| `seismes-et-volcans` (tectonique des plaques) | 4e → première (points chauds) | en ligne |

## Vague 2 — seconde et première

| Notion | Statut |
|---|---|
| `metabolisme-et-enzymes` | en ligne |
| `adn-et-division-cellulaire` (réplication, mitose) | en ligne |
| `expression-genetique` (transcription, synthèse des protéines) | en ligne |
| `mutations-et-variabilite` | en ligne |
| `structure-de-la-terre` (croûte, manteau, ondes sismiques) | en ligne |
| `systeme-nerveux` (neurones, réflexes, synapses) | en ligne |
| `agrosystemes-et-sols` | en ligne |

## Vague 3 — terminale (spécialité)

| Notion | Statut |
|---|---|
| `evolution-et-selection-naturelle` | en ligne |
| `meiose-et-brassage-genetique` | en ligne |
| `immunite-adaptative` | en ligne |
| `climat-et-effet-de-serre` | en ligne |
| `histoire-de-la-terre-et-datation` | en ligne |
| `glycemie-et-diabete` | en ligne |
| `contraction-musculaire` | en ligne |

## Points d'attention

- **Mots-clés** : éviter les mots courants ambigus (« sol », « règles », « traduction », « base ») et les termes déjà pris par une autre matière
  (« hérédité » en maths désigne l'étape de la récurrence ; « datation au carbone 14 » est en physique-chimie).
- **Public mineur** : les notions de santé et de reproduction restent strictement scientifiques et renvoient vers un adulte de confiance
  ou un professionnel de santé.
- **Exemples locaux** : le Piton de la Fournaise (La Réunion) illustre le volcanisme effusif et les points chauds.

## Fiches de collège ajoutées en parallèle (réconciliées)

Huit fiches avaient été ajoutées hors des vagues ci-dessus. Le CODEOWNER a tranché le 6 novembre 2026 (lot S2 du
plan des PR des labs, `docs/plan-pr-labs.md`) : on garde la notion la plus complète (4 à 5 niveaux, 5 exercices, défi en
3 étapes), on y reprend les mots-clés, les questions d'exemple et les exercices non redondants de la fiche courte, puis on
supprime celle-ci. Les exercices repris sont ajoutés **à la fin** de la liste, pour ne pas décaler les étoiles déjà gagnées.

| Fiche supprimée | Notion conservée | Exercices repris |
|---|---|---|
| `cellule` | `la-cellule` (v1.1.0) | être unicellulaire ; rôle de la membrane |
| `ecosystemes` | `ecosystemes-et-biodiversite` (v1.1.0) | composantes d'un écosystème ; sens de la flèche d'une chaîne |
| `biodiversite` | `ecosystemes-et-biodiversite` (v1.1.0) | échelles de biodiversité ; richesse spécifique ; pollinisateurs |
| `genetique-adn` | `genetique-et-heredite` (v1.1.0) | chromosome ; allèle ; caractère dépendant des gènes et du milieu |
| `nutrition-digestion` | `nutrition-et-digestion` (v1.1.0) | rôle des enzymes ; aliment ou nutriment |
| `volcanisme` | `seismes-et-volcans` (v1.1.0) | lave ; magma explosif ; surveillance d'un volcan |
| `tectonique-plaques` | `seismes-et-volcans` (v1.1.0) | dorsale océanique ; subduction |

`evolution` (collège) et `evolution-et-selection-naturelle` (terminale) restent deux pages complémentaires : depuis la
PR #79, les questions générales sur l'évolution vont au collège, celles sur la spéciation et la dérive génétique à la
terminale. De même, « gamètes » seul renvoie vers `reproduction-humaine` et la méiose garde « formation des gamètes ».

Le catalogue SVT compte désormais **24 fiches** : les 23 notions des vagues et `evolution`.

## Labs interactifs

Les priorités d'interaction (cellule schématique, puis réseau trophique et modèles de transmission) et les critères de relecture sont
décrits dans [le plan des labs des autres matières](labs-autres-matieres.md). Les doublons sont résolus : le lab cellule (V1) part de `la-cellule`.
