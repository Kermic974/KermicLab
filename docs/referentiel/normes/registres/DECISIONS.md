# Réponses aux points ouverts

> **Décision finale du 2026-11-09** : toutes les réponses **PROPOSÉE** ci-dessous sont **acceptées** et normatives pour 1.2.0 ; les réponses **HORS PÉRIMÈTRE S4** sont confirmées (`../DECISION_FINALE_1.2.0.md` §2 et §3). Les décisions de dépôt correspondantes sont dans l'ADR 0026.

Chaque point ouvert de l'audit de pré-implémentation (2026-11-09) et des retours S42 sur la proposition Copilot reçoit une réponse :

- **PROPOSÉE** : valeur [P], section qui la porte ;
- **HORS PÉRIMÈTRE S4** : relève d'un ADR du dépôt ou du produit ;
- **OUVERTE** : reste dans `OPEN.md`.

## Audit du dépôt

| ID | Question | Réponse | Où |
|---|---|---|---|
| OPEN-001 | Textes normatifs primaires | **OUVERTE** : seuls des textes reconstruits sont fournis ici | `OPEN.md` OPEN-C01 |
| OPEN-002 | Emplacement canonique dans le dépôt | **HORS PÉRIMÈTRE S4** ; profil de sérialisation non normatif proposé | S4.8 annexe A |
| OPEN-003 | Outil de validation, draft JSON Schema | **HORS PÉRIMÈTRE S4** (ADR du dépôt). Contrainte S4 : niveaux 1-2 seulement par schéma | S4.8 §1 |
| OPEN-004 | Cardinalité d'`evidence` | **PROPOSÉE** : toujours un tableau ; Relation 0..20 ; CurriculumMapping 1..20 dès `validated` ; interdit ailleurs | S4.7 §3 |
| OPEN-005 | Champs de `provenance` | **PROPOSÉE** : 4 types, champs conditionnels, obligatoire sur Curriculum et CurriculumMapping | S4.7 §2 |
| OPEN-006 | `stageType`, hiérarchies | **PROPOSÉE** : `cycle`, `classe` ; `parent` facultatif (classe → cycle) ; `order` ; Domain avec `parent` facultatif | S4.5 §2-3 |
| OPEN-007 | Patterns d'ID hors Knowledge Core | **PROPOSÉE** : patterns par namespace ; IDs de Relation et de Mapping opaques + clé sémantique | S4.1 §3 ; S4.4 §2 ; S4.6 §2 |
| OPEN-008 | Éditions de Curriculum | **PROPOSÉE** : un Curriculum par édition ; `curriculumVersion` = édition ; nouvelle édition = nouvel `id` | S4.5 §1 |
| OPEN-009 | Règle « prérequis plus avancé que la notion » du dépôt | **HORS PÉRIMÈTRE S4** : contrôle V0 du produit. Contrainte S4 : ne jamais en déduire ni en interdire une Relation `requires` | S3.1-9 ; S3.2-1 |
| OPEN-010 | Corpus privé `maquettes-catalogue` | **HORS PÉRIMÈTRE S4** (dépôt) | — |
| OPEN-011 | Lien page ↔ Notion | **HORS PÉRIMÈTRE S4** (produit). Contrainte S4 : l'identité S4 ne dépend d'aucune page | S1 §5, S1-5 |
| OPEN-012 | Version de page SemVer ↔ `version` S4 | **HORS PÉRIMÈTRE S4** : indépendantes | S1-5 |
| OPEN-013 | Atomicité, frontière MicroSkill / Skill | **PROPOSÉE** : guide éditorial non bloquant ; WARNING si une Skill n'a qu'une contribution | S2 §3-4 ; `S4-KC-007` |
| OPEN-014 | Vocabulaire `<discipline>` | **PROPOSÉE** : liste fermée de 9 disciplines | S4.1 §4 |
| OPEN-015 | Conditions de `review → validated` | **PROPOSÉE** : gates par contrat ; relecture humaine = revue de PR | S4.2 §7 |
| OPEN-016 | Source de l'historique | **PROPOSÉE** : comparaison révision de base / révision candidate | S4.2 §3 |
| OPEN-017 | « notion » page contre Notion S4 | **PROPOSÉE** : « fiche » ou « page » pour la page produit ; « Notion » (majuscule) pour l'objet S4 | S1 §5 |
| OPEN-018 | Pilotage GitHub (#165, #179, #180) | **HORS PÉRIMÈTRE S4** | — |
| OPEN-019 | Déclaration de la version de spécification | **PROPOSÉE** : manifeste de corpus `specificationVersion` | S4.8 §2 |
| OPEN-021 | « Namespace compatible » | **PROPOSÉE** : même namespace ; WARNING si la discipline change | S4.2 §6 |
| OPEN-022 | Références selon le statut | **PROPOSÉE** : matrice source × cible | S4.2 §5 |
| OPEN-023 | « `equivalentTo` durable » | **PROPOSÉE** : Relation `validated` entre deux objets `validated` | S4.4 §5 |
| OPEN-024 | `niveau` de navigation | **HORS PÉRIMÈTRE S4** (produit) | — |
| DOC-12 | Verdicts du rapport | **PROPOSÉE** : `PASS`, `PASS_WITH_WARNINGS`, `FAIL` ; gabarit `PASS\|FAIL` [OBSOLETE] | S4.8 §3 |
| DOC-17 | Hiérarchies sans champ `parent` | **PROPOSÉE** : `parent` facultatif sur Stage et Domain | S4.5 |

## Proposition S4.2 v1.1.2 (Copilot)

| Réf. | Réponse | Où |
|---|---|---|
| S42-01 | Règle « depuis `validated`, cible `validated` » conservée (omission, pas conflit) | S4.2 §5 |
| S42-02 | `deprecated` terminal et figé | S4.2 §2 ; `S4-LIFE-005` |
| S42-03 | `version = 1` à la création, +1 exactement | S4.2 §4 |
| S42-04 | Un changement de statut seul incrémente `version` | S4.2 §4.4 |
| S42-05 | « par défaut » retiré | S4.6 §2.3 |
| S42-06 | Namespace compatible = même namespace | S4.2 §6 |
| S42-07 | Révision de base / révision candidate | S4.2 §3 |
| S42-08 | Rule IDs et fixtures reliées | S4.2 §10 ; `fixtures-normatives/` |
| S42-09 | Gate détaillée | `GATES.md` |
