# Les huit contrats canoniques S4

## Knowledge Core
### notion.schema.json
Obligatoires : `id`, `type=notion`, `label`, `status`, `version`.
### micro-skill.schema.json
Obligatoires : `id`, `type=microskill`, `label`, `status`, `version`.
Gate globale : une MicroSkill validated est ciblée par au moins une Relation `teaches` validée depuis une Notion validée.
### skill.schema.json
Obligatoires : `id`, `type=skill`, `label`, `status`, `version`.
Gate globale : une Skill validated reçoit au moins une Relation `contributesTo` validée depuis une MicroSkill validée.

## Knowledge Graph
### relation.schema.json
Obligatoires : `id`, `type`, `source`, `target`, `status`, `version`.
Types : `teaches`, `contributesTo`, `requires`, `supports`, `extends`, `relatedTo`, `equivalentTo`.
`rationale` obligatoire avant validated pour `requires`, `extends`, `equivalentTo`.

## Curriculum Graph
### curriculum.schema.json
Obligatoires : `id`, `type=curriculum`, `jurisdiction`, `authority`, `title`, `curriculumVersion`, `status`, `version`.
### stage.schema.json
Obligatoires : `id`, `type=stage`, `curriculum`, `stageType`, `code`, `label`, `status`, `version`.
### domain.schema.json
Obligatoires : `id`, `type=domain`, `curriculum`, `label`, `status`, `version`.

## Interface curriculaire
### curriculum-mapping.schema.json
Obligatoires : `id`, `type=curriculum-mapping`, `object`, `curriculum`, `stage`, `role`, `status`, `version`, `provenance`.
`domain` facultatif.
Rôles : `introduced`, `reinforced`, `consolidated`, `deepened`, `mobilized`.

## Fermeture
Tous les contrats et structures embarquées sont fermés par défaut avec `additionalProperties: false`.
