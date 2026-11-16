# ADR 0028 — Adoption des contrats du référentiel S4

**Statut : en attente de revue et de fusion.** D1 à D8 ont été approuvées pour le pilote public le 17 novembre 2026. Les choix complémentaires sur l’historique, les niveaux de validation et la projection restent à préciser. [#243](https://github.com/Kermic974/KermicLab/issues/243)

## Contexte

Les fiches du catalogue fournissent actuellement les métadonnées V0 au Worker, à la recommandation et au cahier de vacances. [S4](https://app.notion.com/p/41a0c40cec288177b682c2f5a06dbf3c) et [S5](https://app.notion.com/p/41a0c40cec28810d9d6cda3a622c249f) décrivent la cible et la projection. Les exports binaires de Notion et la reconstruction lisible ont une provenance différente. L’audit de référence est dans [audit-gap.md](../referentiel/audit-gap.md).

## Décisions approuvées

| Décision | Choix approuvé pour le pilote |
| --- | --- |
| D1 — Sources | Versionner les textes normatifs lisibles dans `docs/referentiel/normes/`, avec leur version et leur provenance. Pour une règle dont l’original reste illisible, identifier dans l’ADR la décision approuvée qui fait foi. |
| D2 — Source canonique | Stocker les objets JSON dans `referentiel/`. Le build projette `prerequis`, `niveaux` et `competences` sur les fiches migrées. `check:pages` compare la projection sans modifier la fiche. |
| D3 — Outil | Utiliser JSON Schema 2020-12 et Ajv comme dépendance de développement pour la structure. Utiliser JavaScript pour les références, les graphes et l’historique. Relier les diagnostics à des identifiants de règle stables. |
| D4 — Contrats | Appliquer le contrat et les exemples ci-dessous. |
| D5 — Niveau des prérequis | Signaler un prérequis plus avancé par un WARNING éditorial dans S4. Conserver le contrôle V0 pendant la transition. |
| D6 — Périmètre | Piloter sur le catalogue public, avec fermeture transitive des références. |
| D7 — Tickets antérieurs | Garder #179 et #180 clos comme références des comportements V0 à préserver. |
| D8 — Vocabulaire | « Fiche » désigne la page du catalogue et « Notion » l’objet canonique. |

### D4 — Contrat approuvé pour le pilote public

Ces décisions ont été validées le 17 novembre 2026. Elles fixent les valeurs manquantes pour le pilote à partir des contraintes documentées dans [S4.7](https://app.notion.com/p/41a0c40cec2881ea9aa6f8e6dc356460), [#245](https://github.com/Kermic974/KermicLab/issues/245) et [#249](https://github.com/Kermic974/KermicLab/issues/249).

| Contrat | `provenance` | `evidence` | Autre règle D4 |
| --- | --- | --- | --- |
| Notion | Facultative | Facultative | — |
| MicroSkill | Facultative | Facultative | — |
| Skill | Facultative | Facultative | — |
| Relation | Facultative | Facultative | ID `relation.<discipline>.<slug-stable>` |
| Curriculum | Facultative | Facultative | `jurisdiction` vaut `FR` pour le pilote |
| Stage | Facultative | Facultative | `stageType` vaut `cycle` ou `grade` selon le code |
| Domain | Facultative | Facultative | — |
| CurriculumMapping | Obligatoire | Facultative | ID `curriculum-mapping.<discipline>.<slug-stable>` |

- `provenance` est un objet fermé avec les champs obligatoires `type` et `ref`. Les types admis sont `official`, `editorial` et `legacy-v0`. `ref` est une chaîne non vide qui identifie la source documentaire.
- `evidence`, si présent, est un tableau d’au moins un objet fermé. Chaque objet exige `ref` et `excerpt`, deux chaînes non vides. La référence localise la source et l’extrait justifie l’assertion. Les données apprenant sont exclues.
- Le champ `code` du Stage précise le niveau. `cycle-3` et `cycle-4` correspondent à `cycle`. `seconde`, `premiere` et `terminale` correspondent à `grade`.
- Les segments `discipline` et `slug-stable` respectent les primitives de S4.1. Le slug est attribué à la création puis conservé entre révisions. L’unicité métier d’une Relation ou d’un placement est contrôlée séparément.

Exemples destinés aux fixtures :

| Règle | Accepté | Rejeté |
| --- | --- | --- |
| Provenance | `{"type":"legacy-v0","ref":"catalogue/fractions/fiche.md"}` | `"catalogue/fractions/fiche.md"`, type inconnu ou référence vide |
| Présence de la provenance | Omission sur une Notion | Omission sur un CurriculumMapping |
| Preuve | `[{"ref":"source-exemple#fractions","excerpt":"Comparer deux fractions de même dénominateur."}]` | Objet seul, tableau vide, extrait vide ou entrée avec données apprenant |
| Juridiction | `FR` | `DE` pour le pilote |
| Étape | `cycle-4` avec `cycle` ou `seconde` avec `grade` | `cycle-4` avec `grade` |
| ID Relation | `relation.mathematiques.fractions-prerequis` | `relation.mathematiques` |
| ID CurriculumMapping | `curriculum-mapping.mathematiques.fractions-cycle-4` | `stage.mathematiques.fractions-cycle-4` comme ID de mapping |

### Historique et projection

Proposer Git comme source de révisions. Tester sur une base et une tête connues avec un historique disponible en CI. Le WARNING pour une cible devenue `deprecated` exige une preuve que la référence existait avant la dépréciation. Confirmer le traitement d’un historique indisponible et d’une révision qui conserve son statut. Fixer aussi le découpage des niveaux 1 et 2 avant de figer les fixtures. [#251](https://github.com/Kermic974/KermicLab/issues/251) · [#254](https://github.com/Kermic974/KermicLab/issues/254)

Pour la projection V0, proposer une correspondance explicite entre IDs canoniques et slugs, un Curriculum désigné, le rejet des correspondances ambiguës, le dédoublonnage après conversion et la conservation de l’ordre V0 du pilote. Comparer la recommandation et le cahier de vacances avant et après. [#256](https://github.com/Kermic974/KermicLab/issues/256)

## Passage au lot technique

Finaliser les règles complémentaires ci-dessus, puis fusionner cet ADR après revue humaine et clôturer #243. Enchaîner primitives et schémas (#245–#249), validateurs et rapport (#250–#254), contrôle CI (#255), projection et pilote (#256), puis extension par discipline (#257).
