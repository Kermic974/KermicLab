# Index d'autorité

## Ordre d'autorité [B]

En cas de contradiction, le rang le plus petit l'emporte. La date seule ne décide pas.

| Rang | Texte | Domaine d'autorité |
|---|---|---|
| 1 | S1 | vision, périmètre, invariants produit |
| 2 | S2 | sémantique Notion, MicroSkill, Skill |
| 3 | S3.1 | Relations : vocabulaire, orientation, matrice |
| 4 | S3.2 | Curriculum, Stage, Domain, CurriculumMapping, rôles |
| 5 | S4.2 v1.1.2 | cycle de vie, versions, dépréciation, `replacedBy` (prime sur toute autre page S4 sur ces sujets) |
| 6 | S4.1, S4.3 à S4.8 | contrats spécialisés |
| 7 | Audit transversal S4.1 → S4.8 v1.1.1 | corrections |
| 8 | Synthèses S3, S4 | aucune autorité propre |
| 9 | Handoff v1.1.2 | résumé, quand le texte primaire manque |
| — | Pilotage (S0 roadmap, issues, présentations, plans, ADR du dépôt) | ne modifie jamais une règle normative |

## Textes de ce paquet

| Fichier | Rôle |
|---|---|
| `DECISION_FINALE_1.2.0.md` | décision du propriétaire : adoption de 1.2.0 ; acte de pilotage qui fixe le statut des propositions, sans réécrire de règle |
| `../historique/` | sources de 1.2.0 (handoff v1.1.2, proposition S4.2 v1.1.2) ; historiques, sans autorité propre |


| Fichier | Section | Version | Statut | Origine |
|---|---|---|---|---|
| `sections/S1_vision_perimetre.md` | S1 | 1.2.0 | 🟢 ADOPTÉE | reconstruit (notebook, `AGENTS.md`), texte primaire non fourni |
| `sections/S2_notion_microskill_skill.md` | S2 | 1.2.0 | 🟢 ADOPTÉE | reconstruit (notebook, handoff) |
| `sections/S3.1_knowledge_graph_relations.md` | S3.1 | 1.2.0 | 🟢 ADOPTÉE | reconstruit (handoff `RELATION_MATRIX`) |
| `sections/S3.2_curriculum_graph.md` | S3.2 | 1.2.0 | 🟢 ADOPTÉE | reconstruit + mise à niveau v1.1.2 (`projectionKey`) |
| `sections/S3_synthese.md` | S3 | 1.2.0 | synthèse | — |
| `sections/S4_synthese.md` | S4 | 1.2.0 | synthèse | — |
| `sections/S4.1_identifiants_namespaces.md` | S4.1 | 1.2.0 | 🟢 ADOPTÉE | handoff + propositions (patterns non KC) |
| `sections/S4.2_cycle_de_vie_versionnement.md` | S4.2 | 1.2.0 | 🟢 ADOPTÉE | S4.2 v1.1.2 (Copilot) + réponses S42-01 à S42-09 |
| `sections/S4.3_knowledge_core.md` | S4.3 (numéro [P]) | 1.2.0 | 🟢 ADOPTÉE | handoff + propositions |
| `sections/S4.4_relation.md` | S4.4 (numéro [P]) | 1.2.0 | 🟢 ADOPTÉE | handoff + propositions |
| `sections/S4.5_curriculum_stage_domain.md` | S4.5 (numéro [P]) | 1.2.0 | 🟢 ADOPTÉE | handoff + propositions |
| `sections/S4.6_curriculum_mapping.md` | S4.6 | 1.2.0 | 🟢 ADOPTÉE | handoff + S4.2 v1.1.2 §6 + propositions |
| `sections/S4.7_provenance_evidence.md` | S4.7 (numéro [P]) | 1.2.0 | 🟢 ADOPTÉE | propositions (valeurs absentes de la baseline) |
| `sections/S4.8_validation_rapport.md` | S4.8 (numéro [P]) | 1.2.0 | 🟢 ADOPTÉE | handoff `VALIDATION_RULES` + propositions |
| — | Audit v1.1.1 | — | **non fourni** | ses 4 corrections sont reprises dans S4.2, S4.6 et S4.7 |
| — | S0 roadmap | — | **non fourni**, hors autorité | — |

## Règle de remplacement

Quand un texte primaire sera versé dans le dépôt, il remplacera la section reconstruite correspondante. Chaque règle [P] en contradiction avec lui sera marquée `OBSOLETE` dans `registres/CONFLICTS.md`. Chaque règle [P] qu'il confirme passera en [B].
