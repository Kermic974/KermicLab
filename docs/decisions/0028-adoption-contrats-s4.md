# ADR 0028 — Adoption des contrats du référentiel S4

**Statut : proposé.** Décisions D1 à D8 à valider par le propriétaire dans [#243](https://github.com/Kermic974/KermicLab/issues/243).

## Contexte

Les fiches du catalogue fournissent actuellement les métadonnées V0 au Worker, à la recommandation et au cahier de vacances. [S4](https://app.notion.com/p/41a0c40cec288177b682c2f5a06dbf3c) et [S5](https://app.notion.com/p/41a0c40cec28810d9d6cda3a622c249f) décrivent la cible et la projection. Les exports binaires de Notion et la reconstruction lisible ont une provenance différente. L’audit de référence est dans [audit-gap.md](../referentiel/audit-gap.md).

## Propositions à valider

| Décision | Proposition | À consigner avant fusion |
| --- | --- | --- |
| D1 — Sources | Versionner les textes lisibles avec version et lien d’origine dans `docs/referentiel/normes/`. | Inventaire des sources faisant foi et règles approuvées explicitement si le texte d’origine reste indisponible. |
| D2 — Source canonique | Stocker les objets JSON dans `referentiel/`. Le build projette `prerequis`, `niveaux` et `competences` sur les fiches migrées. `check:pages` compare la projection sans modifier la fiche. | Valider l’emplacement et la responsabilité de chaque artefact. |
| D3 — Outil | JSON Schema 2020-12 et Ajv en dépendance de développement. JavaScript pour références, graphes et historique. | Valider le choix et rattacher les diagnostics de structure aux identifiants stables de règles. |
| D4 — Contrats | Compléter la table ci-dessous à partir des textes D1 ou d’un arbitrage explicite. | Valeurs, champs et cardinalités par contrat. Un exemple accepté et un exemple rejeté par forme. |
| D5 — Niveau des prérequis | Signaler le prérequis plus avancé comme WARNING éditorial dans S4. Conserver le contrôle V0 pendant la transition. | Valider la sévérité et documenter les cas de transition. |
| D6 — Périmètre | Piloter sur le catalogue public, avec fermeture transitive des références. | Décider quand intégrer le catalogue privé et comment vérifier sa compatibilité. |
| D7 — Tickets antérieurs | Garder #179 et #180 clos comme références des comportements V0 déjà livrés. | Confirmer leur rôle dans les critères de non-régression du pilote. |
| D8 — Vocabulaire | « Fiche » désigne la page du catalogue et « Notion » l’objet canonique. | Confirmer la terminologie dans le guide de contribution. |

### D4 — Table de décision

| Contrat | Provenance et preuve à confirmer | Autres décisions |
| --- | --- | --- |
| Notion | Présence, variantes de provenance et cardinalité des preuves | — |
| MicroSkill | Présence, variantes de provenance et cardinalité des preuves | — |
| Skill | Présence, variantes de provenance et cardinalité des preuves | — |
| Relation | Présence, variantes de provenance et cardinalité des preuves | Format d’ID exact |
| Curriculum | Présence, variantes de provenance et cardinalité des preuves | Valeurs de `jurisdiction` |
| Stage | Présence, variantes de provenance et cardinalité des preuves | Valeurs de `stageType` |
| Domain | Présence, variantes de provenance et cardinalité des preuves | — |
| CurriculumMapping | Provenance structurée requise selon #249. Confirmer variantes, champs et cardinalité des preuves. | Format d’ID exact |

Points d’appui documentés : une provenance sous forme de chaîne est rejetée et une provenance valide est structurée avec `type`. La preuve doit suivre une structure unique. Les valeurs et bornes exactes restent à retrouver dans S4.7 ou à approuver. [S4.7](https://app.notion.com/p/41a0c40cec2881ea9aa6f8e6dc356460) · [#245](https://github.com/Kermic974/KermicLab/issues/245) · [#249](https://github.com/Kermic974/KermicLab/issues/249)

### Historique et projection

Proposer Git comme source de révisions. Tester sur une base et une tête connues avec un historique disponible en CI. Le WARNING pour une cible devenue `deprecated` exige une preuve que la référence existait avant la dépréciation. Confirmer le traitement d’un historique indisponible et d’une révision qui conserve son statut. Fixer aussi le découpage des niveaux 1 et 2 avant de figer les fixtures. [#251](https://github.com/Kermic974/KermicLab/issues/251) · [#254](https://github.com/Kermic974/KermicLab/issues/254)

Pour la projection V0, proposer une correspondance explicite entre IDs canoniques et slugs, un Curriculum désigné, le rejet des correspondances ambiguës, le dédoublonnage après conversion et la conservation de l’ordre V0 du pilote. Comparer la recommandation et le cahier de vacances avant et après. [#256](https://github.com/Kermic974/KermicLab/issues/256)

## Passage au lot technique

Fusionner cet ADR après arbitrage et revue humaine, puis clôturer #243. Enchaîner primitives et schémas (#245–#249), validateurs et rapport (#250–#254), contrôle CI (#255), projection et pilote (#256), puis extension par discipline (#257).
