# ADR 0026 — Référentiel canonique S4 : intégration dans le dépôt

- Date : 2026-11-09 — Statut : **accepté** (validé par le propriétaire le 2026-11-09)
- Feuille de route : phase 1, épique [#165](https://github.com/Kermic974/KermicLab/issues/165) ; issues [#243](https://github.com/Kermic974/KermicLab/issues/243) à [#257](https://github.com/Kermic974/KermicLab/issues/257)
- Normes : [baseline 1.2.0](../referentiel/normes/README.md) et [décision finale](../referentiel/normes/DECISION_FINALE_1.2.0.md)
- Audit : [pré-implémentation du 2026-11-09](../referentiel/audit-pre-implementation-2026-11-09.md)

## Contexte

La baseline normative S4 1.2.0 définit un référentiel pédagogique canonique de 8 contrats (Notion, MicroSkill, Skill,
Relation, Curriculum, Stage, Domain, CurriculumMapping), validé en 4 niveaux. Elle a été adoptée le 2026-11-09. Elle
déclare **hors de son périmètre** l'emplacement des fichiers, l'outil de validation, le lien avec les pages du produit
et le pilotage GitHub. Ces décisions reviennent au dépôt : c'est l'objet de cet ADR.

L'audit du 2026-11-09 a établi les contraintes du dépôt :

- aucun artefact S4 n'existe ; le référentiel actuel (« V0 ») est le front matter de `catalogue/<id>/fiche.md`
  (`niveaux`, `prerequis`, `competences`), renseigné pour les 36 fiches de mathématiques ;
- plus de dix contrôles reposent sur le slug de page `^[a-z0-9-]+$` : routes du Worker, progression, événements
  (ADR 0025), trophées, contributions (ADR 0023), table D1 `progres` ;
- la `version` SemVer des fiches porte la version du contenu vu par l'élève (AGENTS.md §6 ter) ; les relectures, les
  contributions et les événements en dépendent ;
- `verifierGraphePrerequis` (`scripts/lib/catalogue.mjs`) bloque le build quand un prérequis commence à un niveau plus
  avancé que la notion qui en dépend. S4 interdit ce couplage entre `requires` et curriculum (S3.1-9, S3.2-1).

## Décision

### 1. Emplacement

Le référentiel canonique vit dans **`referentiel/`**, à la racine du dépôt :

- un objet par fichier `referentiel/<namespace>/<id>.json` ;
- un manifeste de corpus `referentiel/corpus.json` (`specificationVersion`, S4.8 §2) ;
- JSON indenté de 2 espaces, clés dans l'ordre du contrat, fin de ligne LF (profil de sérialisation, S4.8 annexe A).

Les normes restent dans `docs/referentiel/normes/` (documentation, lecture seule hors révision de la baseline).

### 2. Outil de validation

Un **validateur maison, sans dépendance**, en JavaScript ES modules, comme le reste du dépôt (ADR 0002). Aucune
dépendance n'est ajoutée : un JSON Schema reste une description lisible, mais le validateur applique lui-même les
niveaux 1 et 2, et les niveaux 3 et 4 de toute façon (S4.8 §1). Les 111 fixtures normatives deviennent ses tests.
Ajouter une bibliothèque de validation exigerait un nouvel ADR.

### 3. Lien entre pages et Notions

Le **slug de page ne change pas**. Il reste l'identité du produit : URL `/maquettes/:id`, progression, événements,
contributions, D1. L'identifiant S4 (`notion.<discipline>.<chemin>`) est une identité distincte (invariant S1-5).

Le lien se fait par une **table de correspondance** dédiée, versionnée dans `referentiel/`, qui relie chaque page aux
Notions qu'elle enseigne. Elle appartient au produit, pas à S4 : ce n'est pas un 9e contrat. Son format sera fixé
dans la PR de projection (étape 5).

### 4. Versions

La **SemVer des fiches ne change pas**. La `version` S4 (entier, +1 par révision) est indépendante : une modification
d'objet canonique n'impose pas de nouvelle version de page, et réciproquement.

### 5. Règle de niveau des prérequis

La règle « un prérequis ne commence pas après la notion qui en dépend » devient un **avertissement** du build, au lieu
d'une erreur bloquante. Elle reste utile à la relecture éditoriale, mais elle ne doit pas empêcher un graphe `requires`
conforme à S4. Les autres contrôles du graphe (prérequis inconnu, jeu, cycle) restent bloquants. Ce changement se fait
à l'étape 5, avec ses tests.

### 6. Périmètre du pilote

Le pilote porte sur le **catalogue public seul** : `trigo-cercle`, `pythagore`, `fractions`, `proportionnalite`. Le
dépôt privé `maquettes-catalogue` reste hors périmètre jusqu'à une décision ultérieure.

### 7. Pilotage

- L'épique #165 est rouverte : la phase 1 reprend avec le référentiel S4.
- Les issues #244 (audit) et #256 (projection et pilote) sont corrigées : elles prévoyaient de remplacer l'identifiant
  et la version des pages, ce que les décisions 3 et 4 excluent.

### 8. Étapes

Une PR par étape, chacune avec `npm run ci` vert et sans retirer aucun contrôle existant :

| Étape | Contenu | Effet sur la V0 |
|---|---|---|
| 1 | Normes 1.2.0, décision finale, audit, cet ADR | aucun |
| 2 | Primitives, 8 schémas descriptifs, fixtures reprises des normes | aucun (non branchés au build) |
| 3 | Validateur niveaux 1 à 4, rapport déterministe, `npm run check:referentiel` | aucun |
| 4 | Gate S4 ajoutée à `npm run ci` et à la CI ; démonstration d'un échec | ajout seul |
| 5 | Table de correspondance, projection S4 → V0 en mode miroir (comparaison sans écriture), règle de niveau en avertissement | règle de niveau assouplie |
| 6 | Pilote : 4 notions migrées en `draft`, journal avant/après, rôles curriculaires choisis par un humain | aucun si la parité est vérifiée |

## Conséquences

- Aucune nouvelle ressource Cloudflare : le référentiel est validé au build et en CI, jamais au runtime. D1 reste
  réservée aux données éphémères et apprenant.
- Pendant la transition, `fiche.md` reste la source des champs V0. Le mode miroir signale tout écart avec la projection
  S4 sans rien modifier. La fiche ne devient une projection générée qu'après une décision écrite, une fois la parité
  vérifiée.
- Les 129 notions sans données V0 de référentiel relèvent d'un travail éditorial, pas d'une migration.
- Points restant ouverts dans la baseline (OPEN-C01, C03, C04, C05) : non bloquants.

## Retour arrière

Étapes 1 à 4 : suppression des fichiers ajoutés ou retrait de la commande dans `npm run ci`. Étape 5 : revert de la PR
(la règle de niveau redevient bloquante). Étape 6 : suppression des objets pilotes ; aucune page ni donnée apprenant
n'est touchée.

- English summary: the S4 canonical referential (baseline 1.2.0) lives in `referentiel/` as one JSON file per object,
  validated by an in-house, dependency-free validator that runs at build and CI time only. Page slugs and SemVer page
  versions stay unchanged; a product-side mapping table links pages to S4 Notions. The prerequisite-level rule becomes a
  warning. The pilot covers four public topics. Work proceeds in six PRs, each keeping `npm run ci` green.
