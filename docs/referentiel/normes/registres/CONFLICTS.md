# Conflits et obsolescences

| ID | Ancienne règle | Source ancienne | Nouvelle règle | Source nouvelle | Statut |
|---|---|---|---|---|---|
| CF-01 | Statuts `active`, `retired` | ancien cycle (avant v1.1.1) | `draft`, `review`, `validated`, `deprecated` | S4.2 v1.1.2 ; audit v1.1.1 correction 1 | **OBSOLETE** (certain) |
| CF-02 | Unicité des CurriculumMappings incluant `version` | avant v1.1.1 | `projectionKey` sans `version` | S3.2 / S4.6 v1.1.2 ; audit v1.1.1 correction 2 | **OBSOLETE** (certain) |
| CF-03 | `provenance: "editorial"` (chaîne) | avant v1.1.1 | objet avec `type` | audit v1.1.1 correction 3 | **OBSOLETE** (certain) |
| CF-04 | Cardinalité d'`evidence` implicite ou polymorphe | avant v1.1.1 | cardinalité explicite par contrat ; forme tableau [P] | audit v1.1.1 correction 4 ; S4.7 | **OBSOLETE** (certain) / forme [P] |
| CF-05 | Verdict `PASS\|FAIL` | handoff `04-templates/VALIDATION_REPORT.json` | 3 verdicts | handoff `VALIDATION_RULES.md` ; S4.8 §3 | **OBSOLETE** : le gabarit cède devant la règle |
| CF-06 | « Nouvelle référence vers `deprecated` interdite », seule règle | S4.2 v1.1.2 (Copilot) §4 | + « depuis `validated`, cible `validated` » | handoff `IDENTIFIERS_AND_LIFECYCLE.md` | **résolu** : omission, les deux règles s'appliquent |
| CF-07 | Hiérarchies Stage/Domain exigées, sans champ `parent` | handoff `VALIDATION_RULES.md` ↔ `S4_CANONICAL_CONTRACTS.md` | `parent` facultatif | S4.5 [P] | **résolu par proposition** |
| CF-08 | `type` = nom du contrat (7 contrats), mais type de relation (Relation) | handoff `S4_CANONICAL_CONTRACTS.md` | contrat déterminé par le namespace de l'`id` | S4 synthèse §3 [P] | **résolu par proposition** (asymétrie conservée) |
| CF-09 | CurriculumMapping rangé sous « Projection » | présentation du notebook | « Interface curriculaire » | handoff | nommage ; « Interface curriculaire » retenu |
| CF-10 | Sigles « S0, S1, S2 » des lots du plan des Labs | dépôt (`docs/plan-pr-labs.md`) | S0–S4 = sections normatives | ce paquet | **CONFLICT de nommage** : à renommer dans le dépôt (ex. « L0, L1, L2 ») |
| CF-11 | « notion » = page du catalogue | dépôt (ADR 0011) | Notion = objet S4 | S2 | **CONFLICT de vocabulaire** : proposition dans `DECISIONS.md` OPEN-017 |
| CF-12 | « Requiert par défaut une nouvelle identité » | S4.2 v1.1.2 (Copilot) §6 | « sans exception » | S4.6 §2.3 [P] | **résolu par proposition** |
