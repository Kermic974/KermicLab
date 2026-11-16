# Document de décision final  
## Baseline normative KermicLab 1.2.0

**Date** : 2026-11-09  
**Statut** : **DÉCISION FINALE**  
**Sources** :  
- Baseline conservatrice Copilot `1.2.0-rc` (règles établies [B] + liste des OPEN)  
- Baseline propositive Claude `1.2.0-rc-Claude` (propositions [P] pour fermer les OPEN)  

**Objectif** : fermer les points ouverts bloquants afin de permettre l’implémentation du modèle de données S4 (v0) et son orchestration par Claude vers le MVP en run.

---

## 1. Principes retenus

| Règle | Décision |
|-------|----------|
| **[B]** | Conservées sans modification (règles déjà établies dans la baseline v1.1.2 et l’audit). |
| **[P]** | **Acceptées** (propositions Claude). Elles deviennent normatives pour 1.2.0. |
| **HORS PÉRIMÈTRE S4** | Confirmées. Ces sujets relèvent du produit ou d’un ADR du dépôt. |
| **Décisions humaines restantes** | OPEN-C01, OPEN-C03, OPEN-C04, OPEN-C05 (aucun ne bloque l’implémentation). |

**Décision générale** : l’ensemble des propositions [P] de Claude énumérées dans le présent document est accepté et devient normatif pour la baseline 1.2.0, sous réserve d’une éventuelle contradiction ultérieure avec un texte primaire de rang supérieur (OPEN-C01).

OPEN-C02 est **RÉSOLUE**.

---

## 2. Décisions sur les points ouverts

| ID | Question | Décision finale | Origine |
|----|----------|-----------------|---------|
| OPEN-001 | Textes primaires | **OUVERTE** (OPEN-C01) | Claude |
| OPEN-002 | Emplacement canonique dans le dépôt | **HORS PÉRIMÈTRE S4** | Claude |
| OPEN-003 | Outil de validation / JSON Schema | **HORS PÉRIMÈTRE S4** | Claude |
| OPEN-004 | Cardinalité `evidence` | **ACCEPTÉE [P]** — toujours un tableau ; Relation 0..20 ; CurriculumMapping 1..20 dès `validated` ; interdit ailleurs | Claude S4.7 §3 |
| OPEN-005 | Champs `provenance` | **ACCEPTÉE [P]** — 4 types, champs conditionnels, obligatoire sur Curriculum et CurriculumMapping | Claude S4.7 §2 |
| OPEN-006 | `stageType`, hiérarchies, parent | **ACCEPTÉE [P]** — `cycle` / `classe` ; `parent` facultatif (classe → cycle) ; `order` ; Domain avec `parent` facultatif | Claude S4.5 §2-3 |
| OPEN-007 | Patterns d’ID hors Knowledge Core | **ACCEPTÉE [P]** — patterns par namespace ; IDs Relation et Mapping opaques + clé sémantique | Claude S4.1 / S4.4 / S4.6 |
| OPEN-008 | Éditions de Curriculum | **ACCEPTÉE [P]** — un Curriculum par édition ; `curriculumVersion` = édition ; nouvelle édition = nouvel `id` | Claude S4.5 §1 |
| OPEN-009 | Règle « prérequis plus avancé » | **HORS PÉRIMÈTRE S4** | Claude |
| OPEN-010 | Corpus privé maquettes-catalogue | **HORS PÉRIMÈTRE S4** | Claude |
| OPEN-011 | Lien page ↔ Notion | **HORS PÉRIMÈTRE S4** | Claude |
| OPEN-012 | SemVer page ↔ `version` S4 | **HORS PÉRIMÈTRE S4** | Claude |
| OPEN-013 | Atomicité MicroSkill / Skill | **ACCEPTÉE [P]** — guide éditorial non bloquant ; WARNING si une Skill n’a qu’une contribution | Claude S2 + S4-KC-007 |
| OPEN-014 | Vocabulaire discipline | **ACCEPTÉE [P]** — liste fermée de 9 disciplines | Claude S4.1 §4 |
| OPEN-015 | Gates `review → validated` | **ACCEPTÉE [P]** — gates par contrat ; relecture humaine = revue de PR | Claude S4.2 §7 |
| OPEN-016 | Source de l’historique | **ACCEPTÉE [P]** — comparaison révision de base / révision candidate | Claude S4.2 §3 |
| OPEN-017 | « notion » page vs Notion S4 | **ACCEPTÉE [P]** — « fiche » / « page » pour le produit ; « Notion » pour l’objet S4 | Claude S1 §5 |
| OPEN-018 | Pilotage GitHub | **HORS PÉRIMÈTRE S4** | Claude |
| OPEN-019 | Version de spécification | **ACCEPTÉE [P]** — manifeste de corpus `specificationVersion` | Claude S4.8 §2 |
| OPEN-021 | Namespace compatible | **ACCEPTÉE [P]** — même namespace ; WARNING si la discipline change | Claude S4.2 §6 |
| OPEN-022 | Références selon statut | **ACCEPTÉE [P]** — matrice source × cible | Claude S4.2 §5 |
| OPEN-023 | `equivalentTo` durable | **ACCEPTÉE [P]** — Relation `validated` entre deux objets `validated` | Claude S4.4 §5 |
| OPEN-024 | `niveau` de navigation | **HORS PÉRIMÈTRE S4** | Claude |
| DOC-12 | Verdicts du rapport | **ACCEPTÉE [P]** — `PASS`, `PASS_WITH_WARNINGS`, `FAIL` | Claude S4.8 §3 |
| DOC-17 | Hiérarchies sans `parent` | **ACCEPTÉE [P]** — `parent` facultatif sur Stage et Domain | Claude S4.5 |

---

## 3. Décisions sur les points S42 (S4.2)

| Réf. | Décision finale |
|------|-----------------|
| S42-01 | Conservée : depuis `validated` → cible `validated` |
| S42-02 | `deprecated` terminal et figé |
| S42-03 | `version = 1` à la création, +1 exactement |
| S42-04 | Un changement de statut seul incrémente `version` |
| S42-05 | « par défaut » retiré |
| S42-06 | Namespace compatible = même namespace |
| S42-07 | Révision de base / révision candidate |
| S42-08 | Rule IDs et fixtures reliées |
| S42-09 | Gate détaillée |

---

## 4. Points restant ouverts (aucun ne bloque l’implémentation)

| ID | Question | Position retenue / recommandation | Statut |
|----|----------|-----------------------------------|--------|
| OPEN-C01 | Textes primaires confirment-ils les reconstructions ? | Option A : verser les textes primaires. Risque accepté qu’un texte ultérieur rende une [P] obsolète (correction ciblée via Rule IDs stables). | **OUVERT** |
| OPEN-C02 | Acceptation des [P] | **RÉSOLUE** — L’ensemble des propositions [P] énumérées dans le présent document est accepté et devient normatif pour la baseline 1.2.0, sous réserve d’une éventuelle contradiction ultérieure avec un texte primaire de rang supérieur (OPEN-C01). | **RÉSOLUE** |
| OPEN-C03 | Sens exact de `supports` et `extends` | Définitions éditoriales conservées (aucun effet sur les contrôles). | **OUVERT** |
| OPEN-C04 | Liste des disciplines | Partir sur les 9 disciplines recommandées. | **OUVERT** (faible) |
| OPEN-C05 | Codes de Stage français fermés ? | Commencer avec le format libre actuel. Une liste fermée pourra s’ajouter ensuite sans rien casser. | **OUVERT** |

---

## 5. Règles [B] non négociables

- Ordre d’autorité : S1 > S2 > S3.1 > S3.2 > S4.2 > S4 spécialisées > audit > synthèses.
- `projectionKey = object + curriculum + stage + domain|null + role` (sans `version`).
- Cycle de vie : `draft` → `review` → `validated` → `deprecated`.
- `version` entier positif strictement croissant pour un même `id`.
- `provenance` = objet structuré (jamais une chaîne).
- Exactement 8 contrats canoniques.
- Séparation stricte : référentiel canonique / données apprenant / représentations produit (invariant S1-5).

---

## 6. Suite des actions

1. Claude orchestre la génération du modèle de données S4 v0 :
   - Fusion des champs [B] + [P] acceptées.
   - Production des JSON Schemas + fixtures normatives.
   - Mapping des projections vers les pages/fiches du MVP en run (respect de S1-5).
2. Décisions côté dépôt (emplacement canonique, outil de validation, CI) à prendre en parallèle (hors périmètre S4).
3. Publication de la baseline **1.2.0** une fois les gates documentaires fermées. Les OPEN-C restants peuvent être clos ultérieurement sans bloquer.

**Conclusion** : OPEN-C02 est résolue. L’ensemble des [P] est accepté. La baseline est déterministe et prête pour l’implémentation du modèle de données S4 v0. Aucun des points restants ouverts ne bloque.
