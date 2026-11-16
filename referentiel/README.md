# Contrats du référentiel S4

Les huit schémas JSON Schema 2020-12 partagent les définitions de `schemas/primitives.schema.json`. Les contrats de forme sont ceux de l’[ADR 0028](../docs/decisions/0028-adoption-contrats-s4.md). `RULE_CATALOG.csv` relie les règles de niveau 2 à leurs fixtures et à leurs tests.

Pour les vérifier, installer les dépendances puis exécuter `node --test tests/unit/referentiel-schemas.test.mjs`. Ces tests font aussi partie de `npm test`.

Les références existantes, le cycle de vie entre versions et l’intégrité du graphe relèvent des niveaux suivants. Cela inclut la matrice Notion/MicroSkill/Skill des Relations, la canonicalisation des liens symétriques, les cycles, les liens requis pour valider une MicroSkill ou une Skill, la cohérence des hiérarchies curriculaires et l’unicité des placements indépendamment de leur version.
