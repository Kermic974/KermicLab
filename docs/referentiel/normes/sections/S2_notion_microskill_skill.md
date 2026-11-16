# S2 — Modèle canonique Notion ↔ MicroSkill ↔ Skill

| Section | Version | Statut | Dépend de |
|---|---|---|---|
| S2 | 1.2.0 | 🟢 ADOPTÉE (reconstruite) | S1 |

## 1. Les trois nœuds

| Nœud | Rôle | Origine |
|---|---|---|
| **Notion** | ce qu'il faut comprendre ou connaître (concept, théorème, définition, fait) | [B] |
| **MicroSkill** | capacité **atomique**, observable ou évaluable ; unité de diagnostic | [B] |
| **Skill** | mobilisation composée de plusieurs MicroSkills dans une situation | [B] |

```text
Notion ──teaches──▶ MicroSkill ──contributesTo──▶ Skill
```

## 2. Règles sémantiques

| # | Règle | Origine |
|---|---|---|
| S2-1 | Une Notion enseigne une MicroSkill par une Relation `teaches` ; une MicroSkill contribue à une Skill par une Relation `contributesTo`. | [B] |
| S2-2 | Les liens entre nœuds sont des **objets Relation** externalisés, jamais des propriétés des nœuds. | [B] |
| S2-3 | Un lien dérivable (transitivité, curriculum) ne devient pas une autorité éditoriale. | [B] |
| S2-4 | Une MicroSkill `validated` est enseignée par au moins une Notion `validated` (Relation `teaches` `validated`). | [B] |
| S2-5 | Une Skill `validated` reçoit au moins une contribution d'une MicroSkill `validated` (Relation `contributesTo` `validated`). | [B] |
| S2-6 | Une MicroSkill peut être enseignée par plusieurs Notions et contribuer à plusieurs Skills. | [D] (aucune limite supérieure dans la baseline) |

## 3. Atomicité d'une MicroSkill [P]

L'atomicité relève du **jugement pédagogique**. Elle n'est donc jamais une règle bloquante (S1-3). Guide éditorial de relecture, non bloquant :

1. Une seule action observable (verbe), un seul objet, éventuellement une condition (« calculer la longueur de l'hypoténuse d'un triangle rectangle connaissant les deux autres côtés »).
2. Évaluable par un item court, avec une réponse correcte ou incorrecte.
3. Pas de conjonction de deux capacités (« calculer *et* justifier » → deux MicroSkills).
4. Indépendante du niveau scolaire : le niveau est porté par un CurriculumMapping, jamais par la MicroSkill.

## 4. Frontière MicroSkill / Skill [P]

Une Skill mobilise **au moins deux** MicroSkills distinctes dans une situation. Une capacité qui n'en mobilise qu'une est une MicroSkill. **[P]** Ce critère est vérifiable : une Skill `validated` qui ne reçoit qu'une seule contribution produit un WARNING (`S4-KC-006`).
