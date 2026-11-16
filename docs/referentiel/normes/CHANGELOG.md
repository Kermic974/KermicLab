# Journal des changements

## 1.2.0 — 2026-11-09 (adoptée)

- Décision finale du propriétaire (`DECISION_FINALE_1.2.0.md`) : toutes les propositions [P] de `1.2.0-rc-Claude` sont acceptées et deviennent normatives ; les règles [B] sont confirmées ; OPEN-C02 est résolue.
- Statut des sections : 🟠 PROPOSITION → 🟢 ADOPTÉE. Aucune règle modifiée par rapport à `1.2.0-rc-Claude`.
- Positions retenues sans bloquer : 9 disciplines (OPEN-C04) ; codes de Stage au format libre (OPEN-C05).
- Structure : dossier `normes/` renommé `sections/` ; `DECISION_FINALE_1.2.0.md` ajouté ; historique des sources dans `../historique/`.

## 1.2.0-rc-Claude — 2026-11-09 (proposition)

### Sections

| Section | Avant (v1.1.2) | Après (1.2.0-rc-Claude) | Raison |
|---|---|---|---|
| S4.1 | patterns d'ID donnés pour le Knowledge Core seulement | patterns pour les 8 namespaces ; liste fermée des disciplines ; longueur maximale | OPEN-007, OPEN-014 |
| S4.2 | S4.2 v1.1.2 (Copilot), 9 imprécisions | état `deprecated` terminal ; version initiale 1 ; +1 à chaque révision, statut compris ; transitions évaluées entre révision de base et révision candidate ; matrice des références par statut ; namespace compatible = même namespace | S42-01 à S42-09, OPEN-021, OPEN-022 |
| S4.3 | 5 champs obligatoires par contrat | `label` localisé (`fr` obligatoire), `description` facultative ; gates `teaches` et `contributesTo` ; atomicité = guide éditorial non bloquant | OPEN-013 |
| S4.4 | 7 types, matrice, `rationale` | ID opaque + clé `relationKey` ; changement de `type`, `source` ou `target` = nouvel ID ; « `equivalentTo` durable » = Relation `validated` entre deux objets `validated` | OPEN-007, OPEN-023 |
| S4.5 | champs obligatoires seulement | `jurisdiction` ISO 3166-1 alpha-2 ; un Curriculum par édition institutionnelle ; `stageType` ∈ {`cycle`, `classe`} ; `parent` facultatif sur Stage et Domain ; `order` | OPEN-006, OPEN-008, DOC-17 |
| S4.6 | `projectionKey` sans version (v1.1.2) | unicité sur tous les statuts ; champs de la clé immuables ; `evidence` ≥ 1 avant `validated` | S42-05, OPEN-004 |
| S4.7 | provenance objet avec `type` ; evidence « fixée par contrat » | structure fermée de `provenance` (4 types) ; `evidence` toujours tableau, porté par Relation et CurriculumMapping seulement | OPEN-004, OPEN-005 |
| S4.8 | 4 niveaux, 3 verdicts | 3 verdicts `PASS`, `PASS_WITH_WARNINGS`, `FAIL` ; rapport trié ; version de spécification déclarée par le corpus ; JSON sans clés dupliquées ; priorité entre règles ; objet porteur des issues de groupe | DOC-12, OPEN-019 |

### Registres

- `RULE_CATALOG.csv` : 92 règles avec Rule ID (48 [B], 41 [P], 3 [D]) ; le gabarit v1.1.2 était vide.
- `DECISIONS.md` : une réponse par point ouvert de l'audit et par point S42.
- Fixtures normatives : 111 cas, chacun relié à ses Rule IDs ; 87 règles sur 92 exercées (les 5 autres sont justifiées dans `fixtures-normatives/README.md`).

## 1.1.2 — mise à niveau documentaire

- S3.2 et S4.6 : `projectionKey = object + curriculum + stage + domain|null + role`, sans `version`.
- S4.2 : cycle `draft → review → validated → deprecated` ; `active` et `retired` non canoniques.

## 1.1.1 — audit transversal S4.1 → S4.8

Quatre corrections : ancien cycle retiré ; unicité des CurriculumMappings sans `version` ; provenance structurée ; cardinalité d'`evidence` explicite par contrat.
