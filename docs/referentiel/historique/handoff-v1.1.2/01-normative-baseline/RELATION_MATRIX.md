# Matrice normative des Relations

| Relation | N->N | N->M | M->M | M->S | S->S |
|---|---:|---:|---:|---:|---:|
| teaches | non | oui | non | non | non |
| contributesTo | non | non | non | oui | non |
| requires | oui | non | oui | non | oui |
| supports | oui | non | oui | non | oui |
| extends | oui | non | oui | non | oui |
| relatedTo | oui | non | oui | non | oui |
| equivalentTo | oui | non | oui | non | oui |

N = Notion, M = MicroSkill, S = Skill.

Contraintes : source != target ; doublons interdits ; `requires` et `extends` acycliques ; `relatedTo` et `equivalentTo` symétriques et stockées une seule fois ; canonicalisation ASCII source < target ; cycle `supports` suspect = WARNING ; equivalentTo durable entre objets validated = WARNING.
