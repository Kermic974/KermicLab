# S4 — Synthèse des contrats canoniques

| Section | Version | Statut |
|---|---|---|
| S4 (synthèse) | 1.2.0 | synthèse, sans autorité propre |

## 1. Les huit contrats [B]

| Famille | Contrat | Namespace | Section d'autorité |
|---|---|---|---|
| Knowledge Core | Notion | `notion` | S4.3 |
| Knowledge Core | MicroSkill | `microskill` | S4.3 |
| Knowledge Core | Skill | `skill` | S4.3 |
| Knowledge Graph | Relation | `relation` | S4.4 |
| Curriculum Graph | Curriculum | `curriculum` | S4.5 |
| Curriculum Graph | Stage | `stage` | S4.5 |
| Curriculum Graph | Domain | `domain` | S4.5 |
| Interface curriculaire | CurriculumMapping | `curriculum-mapping` | S4.6 |

Ni plus, ni moins. **[B]** `provenance` et `evidence` sont des **structures embarquées** (S4.7), pas une 9e famille.

## 2. Sections transversales

| Section | Sujet |
|---|---|
| S4.1 | identifiants, namespaces, disciplines |
| S4.2 | cycle de vie, versions, références, `replacedBy` (autorité transversale [B]) |
| S4.7 | provenance et evidence |
| S4.8 | validation en 4 niveaux, rapport, verdict |

## 3. Champs communs [B] / [P]

| Champ | Présent sur | Type | Règle |
|---|---|---|---|
| `id` | les 8 | chaîne | S4.1 |
| `type` | les 8 | chaîne | constante du contrat ; **pour Relation, type de relation** (S4.4) |
| `status` | les 8 | énumération | S4.2 |
| `version` | les 8 | entier ≥ 1 | S4.2 |
| `replacedBy` | les 8, facultatif | ID | S4.2 |

**[P]** Le contrat d'un objet est déterminé par le **namespace de son `id`**, jamais par `type`. Raison : pour une Relation, `type` porte le type de relation (`requires`…), alors qu'il porte le nom du contrat pour les 7 autres. Cette asymétrie vient de la baseline [B] ; la règle [P] la rend sans ambiguïté.

## 4. Fermeture [B]

Tous les contrats et toutes les structures embarquées sont **fermés** : une propriété non déclarée est une ERROR (`S4-SEP-002`).

## 5. Ce que S4 n'est pas

- Pas un format de page, d'URL ou d'interface (S1-5).
- Pas un stockage de données apprenant.
- Pas une architecture de dépôt : l'emplacement des fichiers, l'outil de validation et l'intégration CI relèvent des ADR du dépôt. L'annexe de S4.8 propose un profil de sérialisation **non normatif**.
