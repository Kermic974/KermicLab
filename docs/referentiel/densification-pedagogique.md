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

## Technologie (matière sans objets canoniques)

Première matière dont **aucun** objet canonique n'existait. 14 notions (cycles 2 à lycée) reçoivent notion, Skill, **80 MicroSkills** observables (4 à 5 par notion avec les 4 notions externes), **18 relations `requires`** (celles déjà déclarées dans les fiches, désormais canoniques et justifiées) et **22 CurriculumMappings** (niveaux inchangés). 13 fiches sont projetées : leurs `prerequis` et `niveaux` restent identiques, leurs `competences` génériques `*-comprendre/-appliquer` sont remplacées par les MicroSkills explicites.

Pour que les prérequis existants restent exprimables, quatre notions **cibles d'autres matières** reçoivent des objets (sans projection de leur fiche, leurs prérequis restant déclarés dans la fiche en attendant leur matière) : `algorithmes-programmation-cm`, `algorithmique-et-scratch-c4`, `algorithmique-python-l` (mathématiques) et `numerique-et-donnees-c4` (EMC). La notion de cycle 2 `objets-electriques-et-materiaux-c2` a ses objets mais n'est pas projetée (pas de code d'étape `cycle-2` dans le schéma).

Contrôles : `check:referentiel` PASS (0 erreur, 0 avertissement), `build`, `check:pages` et `npm test` passent.

## Anglais, arts plastiques, musique et EPS (matières sans objets canoniques)

Même méthode que la technologie. **35 notions** (anglais 14, arts plastiques 7, musique 7, EPS 7) reçoivent notion, Skill, **144 MicroSkills** observables (4 à 5 par notion), **36 `requires`** (ceux déjà déclarés dans les fiches, désormais canoniques et justifiés) et **40 CurriculumMappings**. 30 fiches sont projetées : leurs `prerequis`, `niveaux` et `classes` sont **identiques** (vérifié fiche par fiche), seules leurs compétences génériques `*-comprendre/-appliquer` sont remplacées. Les 5 notions de cycle 2 (`anglais-bonjour-c2`, `anglais-famille-et-animaux-c2`, `arts-couleurs-et-formes-c2`, `musique-sons-et-chansons-c2`, `eps-bouger-et-jouer-c2`) ont leurs objets sans placement ni projection (pas de code d'étape `cycle-2`).

Chaque matière forme une chaîne continue du cycle 2 (ou 3) au lycée : par exemple `anglais-bonjour-c2` → `anglais-se-presenter-cm` → `anglais-se-presenter-6e` → `anglais-routine-et-habiletes-6e` → `anglais-5e-c4` → `anglais-4e-c4` → `anglais-3e-c4` → `anglais-grammaire-et-temps-l`. Aucun nouveau lien n'a été inventé : les chaînes déclarées dans les fiches étaient déjà continues.

Contrôles : `check:referentiel` PASS (0 erreur, 0 avertissement), `build`, `check:pages`, lint et `npm test` (926 tests) passent.

## Bilan des matières désormais canoniques

Avec la technologie, les 14 matières hors mathématiques de référence ont des objets S4. Total des MicroSkills ajoutées sur la branche : 80 (technologie et cibles) + 144 = 224.

## Notions ajoutées depuis la V0 (cycles 2 à 4 et lycée)

Dernier lot : les **259 notions** du catalogue qui n'avaient pas d'objets canoniques (hors jeux), dans les matières déjà traitées : mathématiques 75, français 48, histoire 34, SVT 27, physique-chimie 23, géographie 23, EMC 23, SES 4, philosophie 2. Elles reçoivent notion, Skill, **1 041 MicroSkills** observables (3 à 5 par notion), **365 `requires`** et **232 CurriculumMappings**. Avec les lots précédents, **toutes les notions des matières du catalogue (hors jeux) sont canoniques**.

- **Projection** : 214 fiches sont projetées ; leurs `prerequis`, `niveaux` et `classes` sont **identiques** (vérifié fiche par fiche), seules leurs compétences génériques sont remplacées. Les 45 notions de cycle 2 ont leurs objets sans placement ni projection (pas de code d'étape `cycle-2` dans le schéma `stage`).
- **Prérequis** : les 365 `requires` reprennent exactement les prérequis déjà déclarés dans les fiches. Leur justification (`rationale`) est **générée** (« Prérequis déclaré dans la fiche : A précède B dans la progression du programme (lien à relire) ») : elle atteste l'origine du lien, pas une analyse pédagogique propre ; elle est à enrichir à la relecture.
- **Skills** : le libellé de chaque Skill est générique (« Mobiliser les acquis de « titre » ») ; les MicroSkills portent la granularité utile.
- **Compétences par niveau** : quand une compétence existait déjà (au même libellé) pour une autre notion, elle est qualifiée par le niveau (« au cycle 3 (CM) », « en 6e », « au cycle 2 », « au cycle 4 », « au lycée ») pour garder des identifiants uniques.
- **Statuts** : objets en `draft` (version 1), à relire avant `review`.

Contrôles : `check:referentiel` PASS (0 erreur, 0 avertissement), `build`, `check:pages`, lint et `npm test` (926 tests) passent.

## Liens depuis les notions V0 vers les cycles précédents (processus S4)

Qualification des propositions de `propositions-liens-cycles-2-3-4.md` : **102 `requires`** créés sur 86 notions de la V0 (en `draft`, justification propre à chaque source), les autres écartés et documentés dans `relations-a-revoir.md`. Les prérequis déclarés passent de **550 à 652**. Comparaison de la recommandation sur 477 scénarios (une notion maîtrisée à la fois) : **35 recommandations changent**, toutes expliquées par les nouveaux prérequis. `niveaux`, `classes` et compétences des fiches sont inchangés ; seuls les `prerequis` des 82 fiches concernées évoluent. Deux tests d'attendus ont été mis à jour (`proportionnalite` et `equations` ont de nouveaux prérequis).
## Cycle 2 et dernières projections (ADR 0038)

Le schéma `stage` admet désormais `cycle-2` ([ADR 0038](../decisions/0038-etape-cycle-2-referentiel.md)). Le Stage `stage.mathematiques.cycle-2` est créé, **51 CurriculumMappings** sont ajoutés pour les notions de cycle 2, et **55 fiches** supplémentaires sont projetées : les 51 notions de cycle 2 et les 4 notions cibles d'autres matières créées avec la technologie (leurs 4 prérequis manquants sont ajoutés). **Toutes les fiches du catalogue hors jeux sont maintenant projetées depuis le corpus canonique** ; aucune compétence générique ne subsiste. Les valeurs de `prerequis`, `niveaux` et `classes` restent identiques (vérifié fiche par fiche).

