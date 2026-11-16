# Autorité normative et décisions gelées pour l'implémentation

## Baseline
- S1 : vision et périmètre produit.
- S2 : sémantique Notion, MicroSkill, Skill.
- S3.1 : vocabulaire, orientation et matrice des Relations.
- S3.2 : Curriculum, Stage, Domain, CurriculumMapping et rôles.
- S4.1 : identifiants et namespaces.
- S4.2 v1.1.2 : cycle, versions, dépréciation, replacedBy.
- S4.3 à S4.8 : contrats spécialisés, sous corrections de l'audit v1.1.1.

## Décisions non négociables
- Huit contrats canoniques, ni plus ni moins.
- Cycle : `draft -> review -> validated -> deprecated`.
- `active` et `retired` sont invalides.
- `id` = identité ; `version` = révision positive et croissante.
- `curriculumVersion` = version institutionnelle, distincte de `version`.
- Knowledge Core, Knowledge Graph, Curriculum Graph et CurriculumMapping sont séparés.
- Données apprenant exclues de S4.
- `projectionKey = object + curriculum + stage + domain|null + role`.
- `version` n'appartient pas à `projectionKey`.
- `provenance` est un objet structuré avec `type`, jamais une simple chaîne.
- Chaque contrat porteur fixe explicitement la cardinalité de `evidence`.
- Relations symétriques canonicalisées par comparaison ASCII déterministe des IDs.

## Corrections documentaires à refléter dans le code
1. Ancien cycle retiré.
2. Unicité CurriculumMapping sans `version`.
3. Provenance structurée.
4. Cardinalité d'evidence explicite par contrat.
