# ADR 0028 — Adoption des contrats du référentiel S4

**Statut : en attente de revue et de fusion.** D1 à D8 ont été approuvées pour le pilote public le 17 novembre 2026. Les règles complémentaires sur l’historique, les niveaux de validation et la projection sont également approuvées. [#243](https://github.com/Kermic974/KermicLab/issues/243)

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

## Règles complémentaires approuvées

### Historique Git

Identifier les objets par leur ID canonique, indépendamment du chemin du fichier. Utiliser l’historique de `main` pour les révisions publiées et comparer l’état candidat au dernier état de `main` dont il dérive. Une modification du contenu canonique exige une version strictement supérieure. Une révision peut conserver son statut. Les autres changements de statut suivent S4.2.

Une référence vers une cible `deprecated` reçoit un WARNING historique lorsque Git montre qu’elle existait avant la dépréciation et qu’elle n’a pas été supprimée puis recréée. Une référence ajoutée dans le même changement que la dépréciation ou après reçoit un ERROR. Si l’historique nécessaire est indisponible, le contrôle émet un ERROR dédié. Les fixtures couvrent ces cas et la conservation du statut avec incrément de version. [#251](https://github.com/Kermic974/KermicLab/issues/251)

### Niveaux 1 et 2

Le niveau 1 vérifie la lecture des fichiers canoniques et la syntaxe JSON. En cas d’échec, émettre un diagnostic et poursuivre sur les autres fichiers. Le niveau 2 sélectionne le schéma de l’objet et le valide avec Ajv, y compris les champs obligatoires, les types, les formats d’ID, les valeurs autorisées et les cardinalités. Les objets rejetés à ce niveau ne servent pas aux contrôles des références et du graphe. Prévoir une fixture JSON tronquée et une fixture JSON syntaxiquement valide mais non conforme au schéma. [#254](https://github.com/Kermic974/KermicLab/issues/254)

### Projection V0

La configuration de migration relie le slug de chaque fiche migrée à son ID canonique, désigne un seul Curriculum de projection et associe les MicroSkills aux slugs de compétence V0. Elle fixe aussi l’ordre de référence des prérequis et des compétences.

Pour les fiches migrées, le build dérive `prerequis` des Relations `requires` sortantes, `competences` des Relations `teaches` sortantes et `niveaux` des codes de Stage des CurriculumMappings du Curriculum désigné. Le pilote inclut les objets et liens en `draft`. Une correspondance manquante ou ambiguë bloque la génération. Après conversion et dédoublonnage, les niveaux suivent l’ordre scolaire V0 et les prérequis et compétences suivent leurs ordres de référence. `check:pages` compare la projection attendue à la fiche, y compris l’ordre des listes et la distinction entre champ absent et liste vide. Le pilote vérifie que la recommandation et le cahier de vacances donnent les mêmes résultats avant et après migration. [#256](https://github.com/Kermic974/KermicLab/issues/256)

## Passage au lot technique

Fusionner cet ADR après revue humaine et CI verte, puis clôturer #243. Enchaîner primitives et schémas (#245–#249), validateurs et rapport (#250–#254), contrôle CI (#255), projection et pilote (#256), puis extension par discipline (#257).
