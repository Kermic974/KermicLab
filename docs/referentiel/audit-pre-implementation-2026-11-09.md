# KermicLab — Audit de pré-implémentation S4

| | |
|---|---|
| Date | 2026-11-09 |
| Dépôt | `Kermic974/KermicLab`, `main` = `74cc105` (« Merge pull request #242 »), branche d'audit `claude/charming-cannon-lhpwuv` identique à `main` |
| Environnement | Node 22.23.4, npm 10.9.9, Python 3, Chromium + Playwright préinstallés |
| Nature | Analyse et rapport uniquement. Aucun fichier du dépôt, aucune issue, aucun workflow n'a été modifié pendant l'audit (`git status --porcelain` vide après exécution de la CI). |

## Légende des marqueurs

| Marqueur | Sens |
|---|---|
| **[FACT-SPEC]** | Établi par la baseline normative **telle que résumée par le paquet handoff v1.1.2** (fichier et section cités). Les textes primaires S1–S4.8 ne sont pas disponibles (voir §2) : un FACT-SPEC est donc un fait *déclaré normatif par le handoff*, pas vérifié contre le texte source. |
| **[FACT-REPO]** | Observé dans le dépôt ou par exécution d'une commande (fichier, ligne ou commande cités). |
| **[DERIVED]** | Conclusion directe des faits précédents. |
| **[PROPOSAL]** | Recommandation. Ce n'est pas une règle. |
| **[OPEN]** | Question non tranchée, décision humaine requise. |
| **[CONFLICT]** | Contradiction entre deux sources. |
| **[OBSOLETE]** | Information remplacée par une source plus récente ou plus autoritaire. |
| **UNKNOWN** | Non établissable avec les moyens de l'audit. |

Abréviations des sources : `HO/` = paquet handoff `kermiclab-agent-handoff-v1.1.2/` ; `NB` = présentation HTML du notebook fournie par le propriétaire ; `HTML-C` = présentation complétée produite dans cette session ; `DOC-PLAN` = document Claude Docs « Plan d'intégration du handoff S4 v1.1.2 ».

---

## 1. Executive Summary

1. **[FACT-REPO]** Le dépôt ne contient **aucun artefact S4** : pas de JSON Schema, pas de MicroSkill, Skill, Relation, Curriculum, Stage, Domain ni CurriculumMapping, pas de `status`, `provenance`, `evidence`, `replacedBy`, `curriculumVersion` ni `projectionKey` (recherche exhaustive, §5). Le référentiel réel est le front matter YAML de `catalogue/<id>/fiche.md`, validé par `scripts/lib/catalogue.mjs`.
2. **[FACT-REPO]** Le produit V0 est sain : `npm run lint`, `build` et `check:pages` passent ; 522/522 tests unitaires ; 507/509 tests navigateur (1 saut : catalogue privé). Le seul échec vient de l'environnement d'audit : un test UX exige l'historique git complet, absent d'un clone superficiel (§11, GAP-019). `npm run ci` sort donc en code 1 localement. Les 54 tests de l'application du cercle (`pages.yml`) passent.
3. **[FACT-REPO]** Le référentiel V0 ne couvre que **36 fiches sur 174, toutes en mathématiques** : 39 arcs de prérequis, 146 compétences toutes distinctes (aucune n'est partagée entre deux fiches), 36 listes `niveaux`. Les 129 autres notions n'ont rien à migrer : leur passage à S4 sera de la **création éditoriale**, pas une migration.
4. **[FACT-REPO] → [DERIVED]** Au moins 10 points du code (routes du Worker, progression, événements, contributions, trophées, table D1 `progres`) valident l'identifiant de page avec `^[a-z0-9-]+$` (sans point). Ils comparent aussi la `version` SemVer de la fiche. Remplacer le slug par `notion.<discipline>.<chemin>`, ou la SemVer par un entier, **casserait les URL, la progression des élèves et les contributions**. L'identité S4 doit donc être **découplée** de l'identité de page. Cela **contredit** la décision « migrate » portée par `DOC-PLAN`, `HTML-C` et l'issue #244 **[CONFLICT]**.
5. **[FACT-SPEC]** La baseline impose des règles précises (cycle `draft → review → validated → deprecated`, `projectionKey` sans `version`, provenance objet). **[OPEN]** En revanche, elle **ne fixe pas** plusieurs valeurs indispensables aux schémas : cardinalité de `evidence`, champs de `provenance`, `stageType`, `jurisdiction`, patterns d'ID de Relation et de CurriculumMapping, identification des éditions de Curriculum. Ces valeurs sont peut-être dans S4.3–S4.8, **absents du corpus**.
6. **Verdict** : NO-GO pour coder les schémas aujourd'hui. GO pour une seule action documentaire : verser et indexer les textes normatifs (§25), puis trancher les décisions ouvertes dans un ADR.

---

## 2. Corpus analysé

| Source | Disponible | Nature | Remarque |
|---|---|---|---|
| S1, S2, S3.1, S3.2, S3 synthèse, S4 synthèse, S4.1–S4.8 | **Non** | normatif (déclaré) | Seulement résumés dans `HO/01-normative-baseline/*` |
| Audit transversal S4.1 → S4.8 v1.1.1 | **Non** | normatif correctif (déclaré) | Résumé : `HO/01-normative-baseline/AUTHORITY_AND_DECISIONS.md` § « Corrections documentaires » |
| S4.2 v1.1.2 | **Non** (résumé seulement) | normatif | `HO/01-normative-baseline/IDENTIFIERS_AND_LIFECYCLE.md` |
| S0 Roadmap (notebook) | **Non** | pilotage | Distincte de la roadmap du dépôt |
| Paquet handoff v1.1.2 (18 fichiers, `MANIFEST.json` vérifié, 0 écart d'empreinte) | Oui | synthèse normative + pilotage | Source normative de cet audit, par défaut |
| `NB` (présentation du notebook) | Oui | communication / synthèse | Non normative |
| `HTML-C` (présentation complétée) | Oui | analyse + propositions | Non normative, auditée au §13 |
| `DOC-PLAN` + issues #243–#257 | Oui | pilotage / propositions | Créés le 2026-11-09 |
| Dépôt (`74cc105`), 863 fichiers lintés | Oui | implémentation | Catalogue privé `maquettes-catalogue` **absent localement** : son contenu est UNKNOWN |
| GitHub (issues #165, #173, #179, #180, sous-issues) | Oui, en lecture | pilotage | Paramètres de protection de branche **non lisibles** : UNKNOWN |

**[DERIVED]** Toute affirmation sur le contenu de S4.3 à S4.8 au-delà du résumé est UNKNOWN.

---

## 3. Ordre d'autorité documentaire

**[FACT-SPEC]** `HO/00-start-here/AGENT_INSTRUCTIONS.md` §4 : *S1 > S2 (nœuds) > S3.1 (Relations) > S3.2 (curriculum) > page S4 spécialisée > audit v1.1.1 > synthèse ; S4.2 v1.1.2 autoritaire pour cycle de vie et versionnement.*

| Rang | Document | Catégorie | Domaine d'autorité | Disponible |
|---|---|---|---|---|
| 1 | S1 | normatif | vision, périmètre, invariants produit | non |
| 2 | S2 | normatif | sémantique Notion / MicroSkill / Skill | non |
| 3 | S3.1 | normatif | vocabulaire, orientation, matrice des Relations | non |
| 4 | S3.2 | normatif | Curriculum, Stage, Domain, CurriculumMapping, rôles | non |
| 5 | S4.2 v1.1.2 | normatif, **prime sur S4.x pour cycle et versions** | statuts, versions, dépréciation, `replacedBy` | non (résumé) |
| 5 | S4.1, S4.3–S4.8 | normatif spécialisé | identifiants, contrats, validation (S4.8 présumé) | non |
| 6 | Audit v1.1.1 | correctif normatif | 4 corrections (ancien cycle, unicité sans version, provenance structurée, cardinalité evidence) | non (résumé) |
| 7 | S3 synthèse, S4 synthèse | synthèse | aucune autorité propre | non |
| 8 | Paquet handoff v1.1.2 | synthèse + pilotage | **référence de fait**, faute des textes primaires | oui |
| — | S0 Roadmap | pilotage | ordre des travaux, jamais une règle | non |
| — | `AGENTS.md`, ADR **acceptés** | normatif **d'ingénierie du dépôt** | conventions, sécurité, dépendances, données personnelles | oui |
| — | ADR **proposés** (0010, 0011, 0013, 0015, 0017, 0020, 0021, 0024) | propositions | aucune tant que non acceptés | oui |
| — | `SPEC.md`, `ARCHITECTURE.md` | normatif **de l'application du cercle seulement** | trigoLab (`src/`) ; ce ne sont ni S1 ni l'architecture de la plateforme | oui |
| — | `NB`, `HTML-C`, `DOC-PLAN`, issues #243–#257 | communication / propositions | aucune | oui |

**[DERIVED]** Deux ordres d'autorité coexistent et ne se recouvrent pas. Le premier est le **modèle pédagogique** (S1 → S4, hors dépôt). Le second est l'**ingénierie du dépôt** (`AGENTS.md` et ADR acceptés). Un conflit entre les deux, par exemple une dépendance Ajv exigée par S4 face à `AGENTS.md` §4, qui impose un ADR pour toute dépendance, n'est pas arbitrable par la date : il demande une décision explicite **[OPEN-003]**.

**[CONFLICT]** Les sigles « S0, S1, S2 » désignent déjà des **lots du plan des Labs** dans le dépôt (`docs/plan-pr-labs.md` l.28-30, `CHANGELOG.md` l.68 et 71, `web/feuille-de-route.html` l.172). Collision de nommage avec S0–S4 **[DOC-05]**.

---

## 4. Baseline normative reconstruite

| Sujet | Autorité | Règle retenue | Statut | Conflits historiques |
|---|---|---|---|---|
| Familles canoniques | S4 via `HO/…/AUTHORITY_AND_DECISIONS.md` « Décisions non négociables » | Exactement 8 contrats : notion, micro-skill, skill, relation, curriculum, stage, domain, curriculum-mapping | [FACT-SPEC] | `NB` range curriculum-mapping sous « Projection », `HO/S4_CANONICAL_CONTRACTS.md` sous « Interface curriculaire » : nommage seulement [DOC-13] |
| Structures embarquées | `HO/S4_CANONICAL_CONTRACTS.md` « Fermeture » ; `NB` §03 | provenance et evidence sont embarquées, pas une 9e famille ; tout est fermé (`additionalProperties: false`) | [FACT-SPEC] | — |
| Namespaces | S4.1 via `HO/IDENTIFIERS_AND_LIFECYCLE.md` | `notion`, `microskill`, `skill`, `relation`, `curriculum`, `stage`, `domain`, `curriculum-mapping` | [FACT-SPEC] | — |
| Identifiants | idem | ≥ 3 segments `.` ; ASCII minuscule, chiffres, tirets internes ; ni espace, accent, `_`, segment vide, `--`, tiret terminal ; Knowledge Core = `<ns>.<discipline>.<semantic-path>` ; aucun positionnement curriculaire dans l'ID ; l'ID ne crée aucune relation | [FACT-SPEC] | Pattern des IDs de Relation, Curriculum, Stage, Domain, CurriculumMapping : **non donné** [OPEN-007] |
| Statuts | S4.2 v1.1.2 | `draft`, `review`, `validated`, `deprecated` ; `active` et `retired` invalides | [FACT-SPEC] | Ancien cycle retiré par l'audit v1.1.1, correction 1 : `active`/`retired` sont [OBSOLETE] |
| Transitions | S4.2 v1.1.2 | `draft→review`, `review→draft`, `review→validated`, `validated→deprecated` ; rien d'autre | [FACT-SPEC] | — |
| `version` | S4.2 v1.1.2 | entier positif, strictement croissant ; pas de réécriture silencieuse ; rupture sémantique = nouvel ID + version 1 | [FACT-SPEC] | Dépôt : `version` SemVer de fiche, sens différent [CONFLICT, §5.2] |
| `curriculumVersion` | `HO/AUTHORITY_AND_DECISIONS.md` | version institutionnelle, distincte de `version` | [FACT-SPEC] | Format **non donné** [OPEN-008] |
| `replacedBy` | S4.2 v1.1.2 | seulement sur `deprecated` ; cible existante, distincte, `validated`, même type, namespace compatible ; chaîne acyclique | [FACT-SPEC] | « namespace compatible » non défini au-delà de « même type » [OPEN-021] |
| Nouvelles références | `HO/IDENTIFIERS_AND_LIFECYCLE.md` « Références » | depuis un objet `validated`, ne cibler qu'un objet `validated` | [FACT-SPEC] | Règle pour les objets `draft` et `review` non dite [OPEN-022] |
| Références historiques | idem | vers une cible devenue `deprecated` : résoluble, WARNING | [FACT-SPEC] | — |
| Knowledge Core | `HO/S4_CANONICAL_CONTRACTS.md` | Notion, MicroSkill, Skill : `id`, `type`, `label`, `status`, `version` obligatoires. Gate globale : MicroSkill `validated` ciblée par ≥ 1 `teaches` validée depuis une Notion validée ; Skill `validated` reçoit ≥ 1 `contributesTo` validée depuis une MicroSkill validée | [FACT-SPEC] | Champs facultatifs non listés (description, discipline…) : UNKNOWN |
| Relations | S3.1 via `HO/RELATION_MATRIX.md` | 7 types ; matrice N/M/S ; `source ≠ target` ; doublons interdits ; `requires`/`extends` acycliques ; `relatedTo`/`equivalentTo` symétriques, stockées une fois, canonicalisées par ordre ASCII `source < target` ; cycle `supports` = WARNING ; `equivalentTo` durable entre `validated` = WARNING ; `rationale` requis avant `validated` pour `requires`, `extends`, `equivalentTo` | [FACT-SPEC] | « durable » non défini [OPEN-023] |
| Interdits de dérivation | `HO/AGENT_INSTRUCTIONS.md` §3 | ne pas déduire `requires`, `extends`, `relatedTo` du curriculum ; pas de Relation stockée dans les nœuds | [FACT-SPEC] | Dépôt : `verifierGraphePrerequis` couple prérequis et niveau [CONFLICT, GAP-006] |
| Curriculum Graph | `HO/S4_CANONICAL_CONTRACTS.md` | Curriculum (`jurisdiction`, `authority`, `title`, `curriculumVersion`), Stage (`curriculum`, `stageType`, `code`, `label`), Domain (`curriculum`, `label`) | [FACT-SPEC] | Valeurs de `stageType` et `jurisdiction`, existence de `parent` sur Stage et Domain **non données**, alors que `HO/VALIDATION_RULES.md` cite des « hiérarchies Stage/Domain » [OPEN-006] |
| CurriculumMapping | idem | `object`, `curriculum`, `stage`, `role`, `status`, `version`, `provenance` obligatoires ; `domain` facultatif ; 5 rôles | [FACT-SPEC] | — |
| `projectionKey` | `HO/AUTHORITY_AND_DECISIONS.md` | `object + curriculum + stage + domain\|null + role`, **sans** `version` | [FACT-SPEC] | Audit v1.1.1, correction 2 : toute unicité incluant `version` est [OBSOLETE] |
| `provenance` | idem | objet structuré avec `type`, jamais une chaîne | [FACT-SPEC] | `provenance: "editorial"` [OBSOLETE] (correction 3) ; autres champs et valeurs de `type` **non donnés** [OPEN-005] |
| `evidence` | idem | chaque « contrat porteur » fixe explicitement sa cardinalité ; pas de polymorphisme ambigu (`HO/05-checklists/DEFINITION_OF_DONE.md`) | [FACT-SPEC] | Liste des contrats porteurs et cardinalités **non données** [OPEN-004] |
| Validation | `HO/VALIDATION_RULES.md` | 4 niveaux : syntaxe, schéma, référentiel, global | [FACT-SPEC] | — |
| Verdict | idem | 0E/0W = PASS ; 0E/≥1W = PASS avec avertissements ; ≥1E = FAIL | [FACT-SPEC] | `HO/04-templates/VALIDATION_REPORT.json` n'autorise que `PASS\|FAIL` [CONFLICT, DOC-12] |
| Rapport | idem | `rule`, `severity`, `message`, `objectId?`, `location?` ; déterministe ; règles bloquantes jamais confiées à une IA | [FACT-SPEC] | `RULE_CATALOG.csv` vide [DOC-11] |
| ERROR / WARNING | idem + `HO/RELATION_MATRIX.md` | ERROR bloque, WARNING visible et conservé | [FACT-SPEC] | — |
| Fixtures | `HO/DEFINITION_OF_DONE.md` ; `HO/02-implementation-plan/EXECUTION_PLAN.md` Lot 3 | positives, négatives, WARNING, variantes de cycle et de version, par contrat | [FACT-SPEC] (pilotage) | — |
| Données apprenant | `HO/AUTHORITY_AND_DECISIONS.md` | exclues de S4 | [FACT-SPEC] | Dépôt : progression locale ou pseudonymisée, hors catalogue : conforme |
| Version du contrat / schéma | `HO/04-templates/VALIDATION_REPORT.json` | `specificationVersion: "1.1.2"` dans le rapport | [FACT-SPEC] (gabarit) | Déclaration de version sur chaque objet ou schéma : non dite [OPEN-019] |

---

## 5. État réel du dépôt (vérifications normatives obligatoires)

### 5.1 Cycle de vie

- **[FACT-REPO]** Aucun champ de statut de cycle de vie dans `catalogue/*/fiche.md` (clés observées : `id, titre, resume, sujet, version, date, langues, onglets, mots-cles, questions, niveau, niveaux, prerequis, competences, duree`, plus `relue*` possibles).
- **[FACT-REPO]** Les mots `draft`, `review` et `validated` comme statuts : 0 occurrence (`validated` n'apparaît que dans le texte anglais de `docs/decisions/0018`). `deprecated` : 0.
- **[FACT-REPO]** Occurrences de `active` et `retired` (`retired` : 0) :

| Fichier | Occurrence | Classification |
|---|---|---|
| `web/app.js` (l.124, 469-478, 771, 1771, 2666-2674) | clés `…:active`, variables, classe CSS `serie-active` | hors sujet : pas un statut canonique |
| `web/temps-actif.js`, `tests/unit/temps-actif.test.mjs` | « temps actif » | hors sujet |
| `worker/src/contributions.js` l.45, `tests/unit/worker.test.mjs` l.534 | « mention active » | hors sujet |
| `.github/workflows/setup-cloudflare.yml` l.39 | statut d'API Cloudflare `"active"` | hors sujet (externe) |
| `README.md`, `web/i18n/*.json`, `web/style.css`, `web/confidentialite.html` | prose, CSS | hors sujet |

**[DERIVED]** Rien à migrer et aucun remplacement à faire : le dépôt n'a jamais porté l'ancien cycle. **[DERIVED]** Le seul indicateur de qualité existant est la relecture humaine (`relue`, `relue-version`, `relue-grille`, `scripts/lib/catalogue.mjs` `lireRelecture`), renseignée pour **0 fiche sur 174** (sortie de `npm run build`). La correspondance entre relecture et statut S4 est à décider **[OPEN-015]**.

### 5.2 Versionnement

| Dimension | Où dans le dépôt | Forme | Sens | Équivalent S4 |
|---|---|---|---|---|
| ID de page | `fiche.md` `id` = nom du dossier (vérifié, `catalogue.mjs`) | slug `^[a-z0-9]+(-[a-z0-9]+)*$` | identité **de page** | ≠ `Notion.id` |
| Version de page | `fiche.md` `version`, `kermiclab-meta.version` | SemVer (155 × `1.0.0`, 18 × `1.1.0`, 1 × `1.2.0`) | révision du **contenu vu par l'élève** (`AGENTS.md` §6 ter) | ≠ S4 `version` (entier, révision de l'**objet canonique**) |
| Version relue | `relue-version` | SemVer ≤ `version` | traçabilité de relecture | aucun |
| Version de contribution | D1 `contributions.notion_version` (`worker/migrations/0001_schema_initial.sql` l.115) | texte SemVer | base de la proposition | aucun |
| Version plateforme | `package.json` `0.0.1` + `CHANGELOG.md` | SemVer | release | aucun |
| Version du cercle | `src/ui/main.js` `VERSION`, `versions/vX.Y/` | SemVer | application autonome | aucun |
| Version de contrat d'événements | `v: 1` (ADR 0025) | entier | protocole | analogue de « version de contrat » |
| Version de ligne D1 | `donnees_pseudonymes.version INTEGER ≥ 1` (l.169) | entier | concurrence optimiste | aucun |
| `curriculumVersion` | absent | — | — | absent |

**[FACT-REPO]** `scripts/verifier-versions.mjs` (appelé par `npm run lint`) vérifie, par rapport à `origin/main`, que la version d'une notion ne recule jamais et qu'un contenu modifié change de version. C'est l'**analogue V0** de la règle S4 « versions strictement croissantes ».

**[CONFLICT]** `DOC-PLAN`, `HTML-C` §12 et l'issue #244 classent `version` SemVer en « migrate → entier ». Or la SemVer porte un sens produit reconnu (`AGENTS.md` §6 ter) et a des consommateurs : contributions, relecture, métadonnées de page, événements ADR 0025 (champ `version`). **[DERIVED]** La version d'objet S4 doit coexister avec la version de page, pas la remplacer. **[PROPOSAL]** Reclasser en KEEP (version de page) + ADD (version d'objet S4). **[OPEN-012]** Faut-il lier les deux, par exemple incrémenter la version S4 de la Notion quand la sémantique change ?

### 5.3 CurriculumMapping

- **[FACT-REPO]** Aucun objet de ce type. L'équivalent implicite est `niveaux` (liste ordonnée sans doublon, validée par `lireReferentiel`) sur 36 fiches. Il n'a ni rôle, ni curriculum, ni domaine, ni provenance, ni version.
- **[DERIVED]** Doublons de `projectionKey` impossibles aujourd'hui (liste sans doublon). Ils deviendront possibles après migration, si un humain attribue deux rôles à une même paire objet/stage : c'est autorisé, puisque `role` fait partie de la clé.
- **[DERIVED]** La migration de `niveaux` exige des décisions humaines par paire (notion, stage) : `role` parmi 5, curriculum de référence, éventuel domaine. Le handoff interdit la conversion automatique de données ambiguës (`HO/AGENT_INSTRUCTIONS.md` §3). 36 fiches × 1 à 4 niveaux = **70 paires** à qualifier (somme des tailles observées).
- **[FACT-REPO]** `version` n'intervient dans aucune clé d'unicité existante. Il n'y a rien d'[OBSOLETE] à retirer.

### 5.4 Provenance

- **[FACT-REPO]** Aucune propriété `provenance` dans les données. Seule occurrence : le mot dans un texte pédagogique (`catalogue/monde-depuis-1990/contenu.json` l.100).
- **[DERIVED]** Aucune forme chaîne historique à migrer. Le schéma pourra naître directement en forme objet.
- **[OPEN-005]** Champs de l'objet (au-delà de `type`), vocabulaire de `type`, contrats qui portent `provenance` hors CurriculumMapping.

### 5.5 Evidence

| Contrat | Forme actuelle | Forme normative déterminable ? | Décision requise |
|---|---|---|---|
| notion | absente | non : « contrat porteur » non identifié | oui [OPEN-004] |
| micro-skill | absente | non | oui |
| skill | absente | non | oui |
| relation | absente | non (`rationale` est distinct d'`evidence`) | oui |
| curriculum | absente | non | oui |
| stage | absente | non | oui |
| domain | absente | non | oui |
| curriculum-mapping | absente | non | oui |

**[FACT-SPEC]** Une seule forme pour tous les contrats n'est pas exigée. Chaque contrat porteur fixe la sienne. **[DERIVED]** Aucune cardinalité n'est déterminable depuis le corpus disponible.

### 5.6 Curriculum

- **[FACT-REPO]** Aucun objet Curriculum. Les niveaux `cycle-3`, `cycle-4`, `seconde`, `premiere`, `terminale` (`NIVEAUX_SCOLAIRES`, `catalogue.mjs`) ne nomment aucun programme ni édition (BO, année).
- **[FACT-REPO]** Trois vocabulaires de niveau coexistent :
  1. `niveau` (rangement de navigation : `college|seconde|premiere|terminale`, 165 fiches) ;
  2. `niveaux` (référentiel : cycles et classes, 36 fiches) ;
  3. `contenu.json` → `niveaux[].niveau` (paliers d'explication en texte libre : « pour démarrer », « 4e », « seconde », « première »).

  Cohérence `niveau ∈ niveaux` : 36/36 aujourd'hui, **non vérifiée** par le code.
- **[OPEN-008]** Distinguer deux éditions institutionnelles : par `Curriculum.id` (une édition = un ID), par `curriculumVersion` sur un même ID, ou les deux. Non déterminé par le handoff. Pas de convention inventée ici.
- **[OPEN-006]** Un cycle et une classe sont-ils deux `stageType` reliés par `parent` ? Cible « Cycle 1 → Terminale » (`NB` §Vision) contre `cycle-3` minimum dans le dépôt.

---

## 6. Architecture actuelle et inventaire des zones

| Zone | Rôle actuel | Source ou dérivé | Producteurs → consommateurs | Tests | Compatibilité S4 | Risque si modifiée | Décision |
|---|---|---|---|---|---|---|---|
| `catalogue/<id>/fiche.md` | métadonnées de page + référentiel V0 | **source** | humains, agents → `chargerCatalogue` | `catalogue`, `referentiel`, `graphe-prerequis`, matières | partielle | élevé (build, routage, pages) | **ADAPT** : champs référentiel à terme projetés ; le reste KEEP |
| `catalogue/<id>/contenu.json` (164) | contenu pédagogique | source | → `scripts/lib/gabarit.mjs` → `page.html` | `gabarit`, `indices-gradues`, e2e | hors Knowledge Core | moyen | **KEEP** |
| `catalogue/<id>/page.html` | page autonome | dérivé (164) / source (10 : 9 jeux + `trigo-cercle`) | build → Worker, check:pages | `contrat-pages` e2e | hors périmètre | élevé (CSP) | **DERIVED** / KEEP |
| `catalogue-prive/` | vraies maquettes, dépôt privé | source externe | CI (`CATALOGUE_TOKEN`) | idem | UNKNOWN | UNKNOWN | **UNKNOWN** [OPEN-010] |
| `scripts/lib/catalogue.mjs` | parseur YAML maison, validation V0, graphe, CSP | outil | → build, check:pages, tests | 3 fichiers de test | partielle (L1-L4 V0) | élevé | **ADAPT** (règle de niveau, GAP-006) |
| `scripts/build.mjs` | index Worker, `dist/`, contenus, trophées | outil | → `worker/src/generated/`, `dist/` | `site`, e2e | point d'insertion de la projection | élevé | **ADAPT** (plus tard) |
| `scripts/lint.mjs`, `verifier-versions.mjs` | syntaxe JS et JSON, i18n, secrets, versions | outil | CI | `version`, `versions` | L1 partiel | faible | **KEEP** |
| `scripts/check-pages.mjs` | sécurité et fraîcheur des pages | outil | CI | e2e | modèle du contrôle de projection | faible | **KEEP** (réutiliser le mécanisme « obsolète ») |
| `worker/src/generated/` | `CATALOGUE` embarqué | **dérivé** (gitignored) | build → Worker | `worker`, `routage` | consommateur de la projection | moyen | **DERIVED** |
| `worker/src/*.js` | API, routage, LLM, comptes | code | → web | ~25 fichiers de test | consomme slug + `niveaux` + `prerequis` | élevé | **KEEP** |
| `worker/migrations/`, `schema*.sql` | D1 (14 tables) | source du schéma | CI → D1 | `migrations` | données apprenant hors S4 | élevé | **KEEP** (S4 hors D1) |
| `web/` | chat, accueil, recommandation, cahier, progression | code | build → Pages | unitaires + e2e | consomme la V0 | élevé | **KEEP** |
| `gabarit/` | moteur des pages, modules partagés, événements | code | build → pages | `gabarit`, `evenements*` | hors S4 | moyen | **KEEP** |
| `src/`, `index.html`, `versions/`, `SPEC.md`, `ARCHITECTURE.md` | application autonome du cercle | source / archive | `pages.yml` | 54 tests `.test.js` | hors S4 | faible | **KEEP** |
| `Sample/lab/` | maquettes d'exemples de labs | historique | aucun consommateur trouvé | aucun | hors S4 | faible | **UNKNOWN** (archive ?) |
| `enrichir.py` (racine) | script ponctuel | UNKNOWN | aucun consommateur trouvé | aucun | — | faible | **UNKNOWN** |
| `docs/` | ADR, chantiers, projets, actions manuelles | documentation | humains | `projets.test.mjs`, `roadmap.test.mjs` | dette (§15) | faible | **ADAPT** (doc) |
| `.github/` | 11 workflows, labels, projets, gabarits | CI | — | `grille-pr`, `projets`, `roadmap`, `sarif` | aucune gate S4 | élevé | **ADAPT** (ajout seul) |
| `package.json` | 2 dépendances, wrangler en dev | config | — | `version` | une dépendance S4 éventuelle → ADR | moyen | **KEEP** |
| `.env.example`, `.gitignore`, `.gitleaks.toml` | config, secrets | config | — | gitleaks CI | neutre | faible | **KEEP** (DOC-09 mineur) |

---

## 7. Modèle de données actuel par famille S4

| Objet S4 | Existant (fichier, format, champs) | Identifiant | Relations | Statut / version / provenance / evidence | Consommateurs | Tests | Écart | Gravité | Décision |
|---|---|---|---|---|---|---|---|---|---|
| **Notion** | page du catalogue : `fiche.md` (YAML maison) ; `titre` ≈ `label` | slug de page | `prerequis` imbriqués | aucun statut ; SemVer de page ; ni provenance ni evidence | Worker, web, D1, événements | nombreux | pas d'objet canonique ; ID et version de sens différent | P1 | **ADAPT** : créer l'objet S4 lié à la page par une correspondance [OPEN-011] |
| **MicroSkill** | `competences` de `fiche.md` : 146 identifiants slug, tous distincts, 36 fiches, **aucun consommateur** hors `catalogue.mjs` (non publiés par `listeCatalogue`) | slug local à la fiche | implicite (fiche → compétence) | aucun | aucun | `referentiel` (format) | pas d'objet ; granularité inconnue | P2 | **MIGRATE** après décision de granularité [OPEN-013] |
| **Skill** | absent | — | — | — | — | — | absent | P2 | création |
| **Relation** | `prerequis` (39 arcs, N→N) ; `competences` (≈ `teaches` implicite) | aucun | imbriquées dans le nœud | aucun ; pas de `rationale` | recommandation, cahier, Worker | `graphe-prerequis` | seconde source de vérité **au sens S4** une fois la Relation créée | P1 | **MIGRATE** (`requires` en `draft`, sans `rationale`) |
| **Curriculum** | absent ; programme implicite | — | — | — | — | — | absent | P1 | création [OPEN-008] |
| **Stage** | constantes `NIVEAUX_SCOLAIRES` (`catalogue.mjs`) | valeur d'énumération | — | — | cahier, recommandation | `referentiel` | pas d'objet ; `stageType` inconnu | P1 | **MIGRATE** [OPEN-006] |
| **Domain** | absent ; le 2e segment de `sujet` (`mathematiques/trigonometrie`) ressemble à un thème, non institutionnel | — | — | — | — | — | absent | P2 | création, sans dériver de `sujet` sans décision |
| **CurriculumMapping** | `niveaux` (70 paires) + `niveau` | — | implicite | aucun rôle ni provenance | cahier, recommandation, Worker | `cahier-vacances`, `recommandation` | rôle absent | P1 | **MIGRATE** avec rôle humain |

---

## 8. Sources de vérité actuelles

| Information | Source A | Source B | Autorité actuelle | Autorité cible | Action |
|---|---|---|---|---|---|
| Identité de page | nom du dossier | `fiche.id`, `kermiclab-meta.id` | dossier = `fiche.id` (égalité vérifiée) ; meta vérifiée | inchangée | KEEP |
| Identité de Notion | — | — | absente | `Notion.id` S4 | créer + correspondance slug [OPEN-011] |
| Libellé | `fiche.titre` | `kermiclab-meta.titre` (10 pages manuelles) | `fiche.titre` ; égalité **non vérifiée** (10/10 égales aujourd'hui) | `Notion.label` + projection | [PROPOSAL] vérifier ou projeter |
| Prérequis | `fiche.prerequis` | index généré, `/api/catalogue` | `fiche.md` | Relation `requires` | projection de S4 → V0 [PROPOSAL] |
| Notion → MicroSkill | `fiche.competences` | — | `fiche.md` | Relation `teaches` | MIGRATE |
| MicroSkill → Skill | — | — | absente | Relation `contributesTo` | création |
| Appartenance curriculaire | `fiche.niveaux` | — | `fiche.md` | CurriculumMapping | MIGRATE |
| Niveau scolaire (navigation) | `fiche.niveau` | `fiche.niveaux` ; `contenu.json` `niveaux[].niveau` | 3 représentations indépendantes, **non synchronisées par le code** | `niveau` [PROPOSAL : dérivé du premier Stage] | [OPEN-024] |
| Ordre institutionnel | ordre de `NIVEAUX_SCOLAIRES` | ordre de `niveaux` | code | Stage (ordre ou parent) | [OPEN-006] |
| Progression | localStorage (slug) | D1 `progres` (comptes, ADR 0017 proposé) ; `donnees_pseudonymes` | navigateur | hors S4 (exclusion) | KEEP |
| Génération des pages | `contenu.json` + gabarit | `page.html` committée | `contenu.json` (fraîcheur vérifiée par `check:pages` et `git diff`) | inchangée | KEEP |
| Index du catalogue | `fiche.md` | `worker/src/generated/catalogue*.{js,json}` | `fiche.md` ; l'index est **dérivé** | idem + S4 | DERIVED |
| Version de page | `fiche.version` | `kermiclab-meta.version` | fiche (égalité vérifiée) | inchangée | KEEP |

**[DERIVED]** Aujourd'hui, il n'y a pas de seconde source de vérité **non contrôlée** pour les prérequis : `fiche.md` est seule. Elle en deviendra une dès qu'une Relation S4 existera, sauf si la fiche devient une projection contrôlée **[PROPOSAL]**.

---

## 9. Pipeline actuel

```text
INPUTS          catalogue/*/fiche.md, contenu.json, page.html (+ catalogue-prive/ si CATALOGUE_TOKEN)
   ↓            web/, gabarit/, src/, package.json
TRANSFORM       scripts/build.mjs → chargerCatalogue() :
                  lireFrontMatter (YAML maison) → champs obligatoires, id = dossier, niveau,
                  lireReferentiel (prerequis/competences/niveaux/duree), lireRelecture,
                  genererPage(contenu.json) → appliquerCsp → inclureModules → preparerPageServie
VALIDATIONS     bloquantes (exception → build en échec) : champs, formats, id en double,
                  langue fr, meta = fiche, graphe (inconnu, jeu, niveau, cycle)
                lint : JS --check, JSON.parse, i18n, secrets, versions vs origin/main
                check:pages : CSP, ressources, réseau, meta, onglets, fraîcheur
INDEX / BUILD   worker/src/generated/catalogue.js (+ catalogue-index.json),
                dist/ (web, contenus/, trophees.json, config.json, _headers, cercle/)
API / WORKER    worker/src/index.js : listeCatalogue (id, titre, version, niveau, matiere, resume,
                niveaux?, prerequis?), routerLocal, /maquettes/:id
WEB / UI        recommandation.js, cahier-vacances.js, app.js (navigation par niveau, défis, cahiers)
```

**[FACT-REPO]** La validation du graphe a lieu **dans le build** (`chargerCatalogue`, fin de fonction), donc aussi dans `check:pages` et dans le test `graphe-prerequis`.

**[FACT-REPO]** `competences` et `duree` entrent dans `index.maquettes` mais `listeCatalogue` ne les publie pas.

**Pipeline cible S4 [PROPOSAL, aucune preuve d'existence]** :

```text
S4 objects → L1-L2 (schémas) → L3-L4 (validateur global) → rapport
         → projection V0 (+ contrôle de fraîcheur) → pipeline actuel inchangé
```

---

## 10. CI/CD

| Gate | Existe | Commande | Bloquante | Couverture S4 | Action |
|---|---|---|---|---|---|
| Lint JS / JSON / i18n / secrets / versions | oui | `npm run lint` (`ci.yml` job `verifier`) | oui (échec du job) | L1 partiel (JSON syntaxe, pas les objets S4) | KEEP |
| Build + validation V0 + graphe | oui | `npm run build` | oui | L2 « contrat local V0 », L3 (prérequis résolus), L4 (cycles, unicité d'ID) **pour la V0 seulement** | ADAPT (GAP-006) |
| Contrôle des pages | oui | `npm run check:pages` | oui | — | KEEP |
| Fraîcheur des pages générées | oui | `git diff --exit-code -- catalogue/ index.html` | oui | modèle du contrôle de projection | KEEP |
| Tests unitaires | oui | `npm test` (66 fichiers) | oui | — | KEEP |
| Tests navigateur | oui | `npm run test:e2e` (23 fichiers + outil) | oui | — | KEEP |
| Application du cercle | oui | `pages.yml` | oui | — | KEEP |
| CodeQL | oui | `codeql.yml` | oui sur PR | — | KEEP |
| Dépendances | oui | `npm audit --audit-level=high` (`securite-pr.yml`) | oui | — | KEEP |
| Secrets | oui | Gitleaks 8.24.0 | oui | — | KEEP |
| Grille de relecture PR | oui | `relecture-pr.yml` | oui sur PR | — | KEEP |
| Revue IA | oui | `revue-ia.yml` (si clé) | non garantie | — | KEEP |
| Déploiement | oui | `ci.yml` job `deployer` (`needs: verifier`) : instantané → D1 → Worker → secrets → Pages → fumée → retour arrière | sur `main` | — | KEEP |
| JSON Schema (L2 S4) | **non** | — | — | 0 | créer |
| Intégrité référentielle S4 (L3) | **non** | — | — | 0 | créer |
| Intégrité globale S4 (L4) | **non** | — | — | 0 | créer |
| Rapport S4 déterministe | **non** | — | — | 0 | créer |
| Protection de `main` (contrôles requis) | **UNKNOWN** | `scripts/configurer-github.sh` | — | — | vérifier [CONFLICT DOC-01] |

**[DERIVED]** Le dépôt n'apporte **aucune preuve S4** aux niveaux 1 à 4. Il apporte des preuves **V0 analogues** : JSON valide, champs de fiche, résolution et cycles des prérequis, unicité des IDs de page, non-recul des versions.

---

## 11. Tests et validation

**Exécution réelle (2026-11-09)** :

| Commande | Résultat |
|---|---|
| `npm ci`, `npm ci --prefix worker` | OK, 0 vulnérabilité |
| `npm run lint` | `Lint OK (863 fichiers, 2 langues)` |
| `npm run build` | OK ; « prérequis renseignés pour 36 notion(s) sur 165 » ; « Relecture : 0 notion(s) relue(s) sur 165 » ; « 0 jeu(x) relu(s) sur 9 » |
| `npm run check:pages` | `Pages OK (174 sources, 174 publiées)` |
| `npm test` | **522 tests, 522 pass, 0 fail** |
| `npm run test:e2e` | **509 tests : 507 pass, 1 fail, 1 skip** ; `npm run ci` sort en **code 1** (durée totale 6 min 20 s) |

- **Échec** : `tests/e2e/ux.test.mjs:16`, « l'inventaire UX correspond exactement aux sources publiques actuelles ». Erreur : `git diff … ebd2599e… -- src` → `fatal: bad object`. **[FACT-REPO]** Le clone d'audit est superficiel (`git rev-parse --is-shallow-repository` = `true`, 195 commits) et ne contient pas le commit `ebd2599e…` référencé par `docs/ux/suivi.json` l.23. **[FACT-REPO]** La CI clone l'historique complet (`ci.yml` l.25 `fetch-depth: 0`). **[DERIVED]** L'échec est **environnemental** : il ne signale pas de défaut du code, mais la commande documentée `npm run ci` n'est **pas reproductible dans un clone superficiel** (GAP-019).
- **Saut** : `contrat : avec CATALOGUE_TOKEN, le catalogue privé est présent et testé` (pas de jeton localement).
- Le résultat de la CI GitHub sur `74cc105` n'a pas été consulté : UNKNOWN depuis cet audit.
| `python3 scripts/build-standalone.py --check` | `index.html à jour avec src/` |
| `node --test "tests/**/*.test.js"` | 54 pass, 0 fail |
| `python3 scripts/check_html.py` | valide |
| `git status --porcelain` après exécution | vide (aucune mutation) |

Limite : sans `catalogue-prive/`, le corpus privé n'est ni chargé ni validé localement (UNKNOWN).

**JSON Schemas, validateurs, fixtures S4** : aucun.

| Règle normative | Test existant | Fixture existante | CI | Couverture |
|---|---|---|---|---|
| Cycle `requires` | `graphe-prerequis.test.mjs` (cycles avec chemin) sur `prerequis` V0 | objets en ligne dans le test | oui | **analogue V0** |
| Cycle `extends` | — | — | — | 0 |
| Doublons de Relation | `lireReferentiel` : doublon dans une liste `prerequis` | `referentiel.test.mjs` | oui | analogue partiel |
| Symétrie `relatedTo`/`equivalentTo` | — | — | — | 0 |
| Canonicalisation ASCII | — | — | — | 0 |
| `source ≠ target` | « une notion ne peut pas être son propre prérequis » | `referentiel.test.mjs` | oui | analogue V0 |
| Matrice N/M/S | prérequis ≠ jeu | `graphe-prerequis` | oui | très partiel |
| Cardinalité MicroSkill (`teaches`) | `competences` non vide si présent | `referentiel` | oui | sans rapport avec la gate |
| Cardinalité Skill (`contributesTo`) | — | — | — | 0 |
| `Stage.parent` / `Domain.parent` | — | — | — | 0 (règle elle-même OPEN) |
| `replacedBy` | — | — | — | 0 |
| Progression de `version` | `verifier-versions.mjs` (SemVer de page vs `origin/main`) | `versions.test.mjs` | oui (lint) | analogue V0 |
| Références `deprecated` | — | — | — | 0 |
| `projectionKey` | `niveaux` sans doublon | `referentiel` | oui | analogue faible |
| Statuts et transitions | — | — | — | 0 |
| Fermeture des contrats | front matter : ligne inconnue refusée, mais **clés inconnues acceptées** | — | — | 0 |
| Exclusion des données apprenant | revue d'architecture (D1 séparé), aucun test dédié | — | — | implicite |
| Rapport déterministe, Rule IDs | — | — | — | 0 |

---

## 12. Matrice S4 ↔ dépôt (synthèse)

| Exigence S4 | Dépôt | État |
|---|---|---|
| 8 contrats | 0 | absent |
| IDs S4 | slugs de page | incompatible, à découpler [DERIVED] |
| Cycle de vie | absent | absent (pas d'ancien cycle) |
| `version` entière | SemVer de page | sens différent [CONFLICT] |
| Relations externalisées | imbriquées dans `fiche.md` | incompatible |
| Curriculum Graph | constantes | absent |
| CurriculumMapping + rôles | `niveaux` sans rôle | partiel |
| Provenance / evidence | absents | absent |
| Validation 4 niveaux S4 | analogues V0 | absent |
| CI S4 | infrastructure prête | absent |
| Données apprenant hors canonique | oui | conforme |
| Pas de `requires` déduit du curriculum | règle de niveau dans `verifierGraphePrerequis` | **non conforme** (GAP-006) |

---

## 13. Analyse de la présentation HTML (`HTML-C`)

| § | Affirmation ou proposition | Verdict | Justification |
|---|---|---|---|
| Vision | « Cycle 1 → Terminale », public 7–77 ans | PARTIALLY CONFIRMED | `AGENTS.md` §1 confirme 7–77 ans ; le dépôt ne connaît que `cycle-3`+ ; « Cycle 1 » vient de `NB` (cible) |
| 01 | 174 fiches, 164 `contenu.json`, 25 ADR, 11 workflows, répartition par matière | CONFIRMED | §7, `stats` d'audit |
| 01 | « 90 fichiers de tests » | PARTIALLY CONFIRMED | 66 unitaires + 24 fichiers e2e, dont un outil (`outils.mjs`) ; plus 8 fichiers `.test.js` du cercle |
| 02 | Routage à deux étages, zéro token, relances fermées | CONFIRMED | ADR 0003, ADR 0016, `worker/src/index.js` |
| 03 | Pages, Worker, D1 (14 tables), R2, Workers AI, Gateway, cron 02:17 | CONFIRMED | `worker/wrangler.toml`, `0001_schema_initial.sql`, `index.js` `scheduled` |
| 04 | Modèles, quotas, Gateway obligatoire | CONFIRMED | `wrangler.toml` `[vars]`, ADR 0016/0018/0022 |
| 05 | Données stockées / jamais stockées | CONFIRMED | `AGENTS.md` §4, ADR 0007, ADR 0024 (**proposé**) |
| 06 | Pipeline CI et déploiement réversible | CONFIRMED | `ci.yml`, `docs/deployer.md` |
| 06 | « Reste à faire : protection de `main` (#173, #174) » | **OBSOLETE / CONFLICT** | #173 fermée par la PR #211 et #174 fermée, alors que `docs/actions-manuelles.md` action 8 dit « à faire » ; état réel UNKNOWN |
| 07–11 | Modèle S4, graphes, 8 contrats, cycle, 4 niveaux | CONFIRMED (au sens FACT-SPEC) | `HO/01-normative-baseline` |
| 12 | « S4 canonique, V0 projetée » | **PROPOSAL** | Ne découle d'aucune règle normative. C'est une recommandation de `DOC-PLAN` (D2 non tranchée) |
| 12 | Répertoire `referentiel/` | **PROPOSAL** | [OPEN-002] |
| 12 | `referentiel/*.json → build → fiche/index → Worker/Web` | **PROPOSAL / UNVERIFIED** | Aucune trace dans le dépôt |
| 12 | Tableau : `id` slug → **migrate** ; `version` SemVer → **migrate** | **CONFLICT** | Le découplage est nécessaire (§5.2, GAP-002, GAP-003) |
| 12 | 36 fiches avec `niveaux`, `prerequis`, `competences` ; jeux et `contenu.json` keep | CONFIRMED | §7 |
| 12 | « Côté Cloudflare : rien à ajouter ; D1 jamais pour le référentiel » | **PROPOSAL** | Raisonnable (exclusion des données apprenant, build statique) ; aucune décision |
| 13 | « Production Cloudflare en ligne » | UNVERIFIED | Non vérifiable depuis l'audit (pas d'appel au test de fumée) |
| 13 | Handoff : « 18 fichiers intègres », valeurs manquantes | CONFIRMED | `MANIFEST.json` |
| 14 | 15 issues #243–#257, labels, chemin critique | CONFIRMED (existence) / PROPOSAL (contenu) | Les corps d'issue portent des propositions (D2, D5 « recommandé ») |
| 15 | Points d'attention (collision « notion », couplage niveau, dépôt privé, #165 fermée) | CONFIRMED | §5, §15 |
| 16 | Roadmap : priorités 1–9 | CONFIRMED | `docs/projets.md` (mais DOC-02, DOC-03) |
| 16 | « Migration progressive », « gate sans rien retirer » | PROPOSAL alignée sur `HO/02-implementation-plan/PR_STRATEGY.md` | — |

---

## 14. Registre des écarts

| ID | Zone | Existant | Cible | Écart | Gravité | Décision | Risque | Dépendances |
|---|---|---|---|---|---|---|---|---|
| GAP-001 | Normes | résumés handoff | textes S1–S4.8 + audit v1.1.1 consultables | textes primaires absents | **P0** | verser + indexer | décisions inventées | — |
| GAP-002 | Identité | slug de page | `notion.<discipline>.<path>` | sens différent ; ≥ 10 validateurs slug (Worker l.749, `web/progression.js` l.27, `evenements.js`, `trophees.js`, `contributions.js`, `cahier-vacances.js`, `worker/src/comptes.js`, `gabarit/jeux/evenements.js`, D1 `progres.notion_id`) | **P0** | découpler + correspondance [OPEN-011] | perte de progression, URL cassées | GAP-001 |
| GAP-003 | Version | SemVer de page | entier par objet | sens différent | **P1** | coexistence [OPEN-012] | contributions et relectures cassées | GAP-001 |
| GAP-004 | Valeurs normatives | — | evidence, provenance, stageType, jurisdiction, patterns d'ID, éditions | non définies | **P0** | ADR 0026 | schémas faux | GAP-001 |
| GAP-005 | Contrats | 0 | 8 schémas fermés + primitives | absents | P1 | créer, isolés de la V0 | faible si isolés | GAP-004, OPEN-003 |
| GAP-006 | Graphe V0 | prérequis plus avancé que la notion = **ERROR bloquante** (`verifierGraphePrerequis`) | aucun couplage `requires`/curriculum | non-conformité | P1 | rétrograder ou déplacer [OPEN-009] | régression du contrôle éditorial | ADR 0026 |
| GAP-007 | Relations | imbriquées | objets Relation | seconde source à venir | P1 | projection contrôlée [PROPOSAL] | divergence | GAP-005, GAP-010 |
| GAP-008 | MicroSkill | 146 slugs non partagés, non consommés | objets réutilisables | granularité inconnue | P2 | revue éditoriale [OPEN-013] | doublons sémantiques | GAP-005 |
| GAP-009 | Curriculum | constantes | Curriculum, Stage, Domain | absents | P1 | créer après décisions | — | GAP-004 |
| GAP-010 | Compatibilité | — | projection S4 → V0 + contrôle de fraîcheur | absente | P1 | créer avant toute migration | régression du cahier ou de la recommandation | GAP-005..009 |
| GAP-011 | Validateur | analogues V0 | L3/L4 + rapport + Rule IDs | absent | P1 | créer | faux PASS | GAP-005 |
| GAP-012 | CI | aucune gate S4 | gate ajoutée sans retrait | absente | P1 | créer | aucune si ajout seul | GAP-011 |
| GAP-013 | Niveaux | 3 vocabulaires non synchronisés | Stage + projection | incohérence possible | P2 | [OPEN-024] | affichage incohérent | GAP-009 |
| GAP-014 | Front matter | clés inconnues acceptées | contrats fermés | ouvert | P3 | à traiter avec la projection | coquilles silencieuses | GAP-010 |
| GAP-015 | Corpus privé | inconnu | dans ou hors périmètre | UNKNOWN | P1 | [OPEN-010] | migration partielle | — |
| GAP-016 | Couverture | référentiel = 36 fiches de maths | toutes disciplines | 129 notions sans données | P2 | création éditoriale, pas migration | charge humaine | GAP-010 |
| GAP-017 | Relecture et statut | 0 fiche relue | `validated` exige une revue | lien non défini | P2 | [OPEN-015] | tout reste `draft` | ADR 0026 |
| GAP-018 | Protection de `main` | UNKNOWN | contrôles requis | non vérifié | P1 | vérifier dans Settings | fusion sans CI | — |
| GAP-019 | Reproductibilité de la CI | `tests/e2e/ux.test.mjs` exige un commit ancien (`docs/ux/suivi.json`) ; échoue dans un clone superficiel | `npm run ci` reproductible pour tout agent | dépend de la profondeur du clone | P3 | documenter `git fetch --unshallow`, ou un saut explicite si l'objet est absent | faux rouge pour les agents cloud | — |

---

## 15. Dette documentaire

| ID | Incohérence | Sources | Type |
|---|---|---|---|
| DOC-01 | Action 8 « Protéger `main` » marquée « à faire », alors que #173 est fermée par la PR #211 | `docs/actions-manuelles.md` l.147 ↔ GitHub #173 | CONFLICT |
| DOC-02 | « Tâches à démarrer maintenant » liste #173, #174, #179, #180, #181, toutes fermées | `docs/projets.md` l.34-38 | OBSOLETE |
| DOC-03 | Phase 1 « Livrée » et épique #165 fermée, alors que 15 sous-issues S4 sont ouvertes (2026-11-09) | `web/feuille-de-route.html` l.302 ↔ #165 | CONFLICT |
| DOC-04 | « au-delà des 5 notions pilotes », alors que 36 fiches sont renseignées | `web/feuille-de-route.html` l.306 ↔ build | OBSOLETE |
| DOC-05 | Sigles S0/S1/S2 des lots Labs contre S0–S4 du notebook | `docs/plan-pr-labs.md`, `CHANGELOG.md`, roadmap | CONFLICT (nommage) |
| DOC-06 | « notion » = page (ADR 0011) contre Notion = objet S4 | ADR 0011 ↔ handoff | CONFLICT (vocabulaire, D8) |
| DOC-07 | `niveaux` = niveaux scolaires (`fiche.md`) contre paliers d'explication (`contenu.json`) | `docs/gabarit.md` | ambiguïté |
| DOC-08 | `ARCHITECTURE.md` et `SPEC.md` ne décrivent que l'application du cercle ; aucune architecture de la plateforme | racine | lacune |
| DOC-09 | `MAX_TOKENS_DEFI=1500` contre `2000` | `.env.example` ↔ `worker/wrangler.toml` | CONFLICT mineur |
| DOC-10 | Liens vers `Kermic974/trigoLab` (ancien nom) | corps de #165, `CHANGELOG.md` l.27 | OBSOLETE mineur |
| DOC-11 | `RULE_CATALOG.csv` vide ; textes S1–S4.8 cités mais absents | handoff | lacune |
| DOC-12 | Rapport `verdict: "PASS\|FAIL"` contre 3 verdicts | `HO/04-templates/VALIDATION_REPORT.json` ↔ `HO/01-normative-baseline/VALIDATION_RULES.md` | CONFLICT interne au handoff |
| DOC-13 | CurriculumMapping rangé sous « Projection » contre « Interface curriculaire » | `NB` ↔ `HO/S4_CANONICAL_CONTRACTS.md` | nommage |
| DOC-14 | ADR 0011, 0015, 0020, 0021 « proposés » mais implémentés et utilisés en production | `docs/decisions/` | statut incohérent |
| DOC-15 | `HTML-C` : « protection de `main` à faire » | `HTML-C` §06 | OBSOLETE |
| DOC-16 | `DOC-PLAN`, `HTML-C` et #244 : « id et version → migrate » | ↔ §5.2 | CONFLICT |
| DOC-17 | « Hiérarchies Stage/Domain » exigées, sans champ `parent` dans les contrats | `HO/VALIDATION_RULES.md` ↔ `HO/S4_CANONICAL_CONTRACTS.md` | CONFLICT interne au handoff |

---

## 16. Décisions ouvertes

Format abrégé : Q = question ; P = pourquoi ouverte ; A/B = options et impacts ; R = recommandation ; H = décision humaine requise.

**OPEN-001 — Textes normatifs (D1).** Q : verser S1–S4.8 et l'audit v1.1.1 dans le dépôt ? P : absents du corpus. A : versés en lecture seule (`docs/referentiel/normes/`) → autorité vérifiable, OPEN-004 à 008 peut-être résolues par lecture. B : handoff seul → toutes les valeurs manquantes devront être inventées par ADR. R : A. H : **OUI**.

**OPEN-002 — Emplacement et format canoniques (D2).** Q : où vivent les objets S4 ? P : aucune règle. A : dossier dédié, un fichier JSON par objet → schémas directs, diff lisibles. B : générés depuis `fiche.md` → S4 devient une projection, contraire à son rôle canonique. R : A [PROPOSAL]. H : OUI.

**OPEN-003 — Outil de validation (D3).** Q : Ajv ou validateur maison ; quel draft JSON Schema ? P : `AGENTS.md` §4 exige un ADR par dépendance ; le dépôt n'a que 2 dépendances. A : Ajv → couverture complète de JSON Schema, une dépendance. B : maison → zéro dépendance, couverture limitée au sous-ensemble utilisé. R : à décider après un inventaire des mots-clés nécessaires. H : OUI.

**OPEN-004 — Evidence.** Q : quels contrats portent `evidence`, avec quelle cardinalité et quelle structure ? P : non donné. A : lire S4.x (OPEN-001). B : fixer par ADR. R : A d'abord. H : OUI.

**OPEN-005 — Provenance.** Q : champs et vocabulaire de `type` ; contrats porteurs. Mêmes options. H : OUI.

**OPEN-006 — Stage et Domain.** Q : valeurs de `stageType` ; cycle et classe = deux types avec `parent` ? Présence de `parent` (DOC-17) ? Cycles 1 et 2 ? H : OUI.

**OPEN-007 — Patterns d'ID** de Relation, Curriculum, Stage, Domain, CurriculumMapping (dérivés du contenu, ou opaques). Impact : unicité et canonicalisation. H : OUI.

**OPEN-008 — Éditions de Curriculum.** Q : une édition = un `id`, ou `curriculumVersion` sur un même `id` ? A : un ID par édition → mappings non ambigus, plus d'objets. B : `curriculumVersion` → l'unicité doit inclure `curriculumVersion` sans `version` ; règle à écrire. H : OUI.

**OPEN-009 — Règle de niveau des prérequis (D5).** A : supprimer. B : WARNING éditorial hors S4. R : B (le couplage reste utile éditorialement, il ne doit pas bloquer). H : OUI.

**OPEN-010 — Corpus privé (D6).** Q : `maquettes-catalogue` dans le périmètre ? P : contenu UNKNOWN. H : OUI.

**OPEN-011 — Correspondance page ↔ Notion.** Q : où stocker le lien slug ↔ `Notion.id` ? Une page peut-elle porter plusieurs Notions ? A : champ dans l'objet Notion → S4 connaît le produit. B : champ dans `fiche.md` → la V0 référence S4. C : table de correspondance dédiée. R : à décider. Le seul invariant [DERIVED] : le slug reste l'identité de page. H : OUI.

**OPEN-012 — Version de page et version d'objet.** Q : lien entre SemVer de page et `version` S4 ? A : indépendantes. B : règle de couplage. H : OUI.

**OPEN-013 — Granularité des compétences.** Q : les 146 `competences` deviennent-elles des MicroSkills, des Skills ou rien ? Fusionner les quasi-doublons ? P : jugement pédagogique (non déterministe). H : OUI.

**OPEN-014 — Segment discipline.** Q : vocabulaire fermé (`mathematiques`, `physique-chimie`…), repris du premier segment de `sujet` ? H : OUI (faible).

**OPEN-015 — Statut des notions publiées.** Q : une page publiée mais non relue est-elle `draft` ? Le passage à `validated` exige-t-il `relue` ? H : OUI.

**OPEN-016 — Source de l'historique** pour L4 (non-réutilisation des IDs, versions croissantes) : historique git contre registre versionné. H : NON (choix technique), mais il doit figurer dans l'ADR.

**OPEN-017 — Vocabulaire (D8).** Q : comment distinguer la page « notion » de l'objet Notion ? H : OUI.

**OPEN-018 — Pilotage (D7).** Q : rouvrir #165 ou créer une épique S4 ; sort de #179 et #180 ; phase de roadmap. H : OUI.

**OPEN-019 — Version de contrat.** Q : comment un objet ou un schéma déclare-t-il la version de spécification ? H : OUI.

**OPEN-021 — « Namespace compatible »** pour `replacedBy` : est-ce plus large que « même type » ? H : OUI (lecture S4.2).

**OPEN-022 — Références sortantes des objets `draft` et `review`** : peuvent-elles cibler un objet `draft` ? H : OUI (lecture S4.x).

**OPEN-023 — « `equivalentTo` durable »** : définition opérationnelle (durée, nombre de versions ?). H : OUI.

**OPEN-024 — `niveau` de navigation** : le dériver du premier Stage, ou le garder libre ? H : OUI (faible).

---

## 17. Risques

| Risque | Probabilité | Impact | Atténuation |
|---|---|---|---|
| Changer l'identité de page | moyenne (le plan actuel le propose) | **critique** : progression, URL, D1, contributions | découpler (OPEN-011), tests e2e existants |
| Coder les schémas sur des valeurs inventées | élevée sans OPEN-001 | élevé : refonte des schémas et fixtures | OPEN-001 puis ADR |
| Seconde source de vérité pendant la transition | élevée | moyen | projection + contrôle de fraîcheur avant migration |
| Régression de la recommandation ou du cahier | moyenne | élevé | tests de parité avant/après (`recommandation`, `cahier-vacances`) |
| Corpus privé non migré ou cassé | UNKNOWN | élevé | OPEN-010 ; CI avec `CATALOGUE_TOKEN` |
| Faux PASS (JSON Schema présenté comme couvrant L3/L4) | moyenne | élevé | Rule IDs par niveau, fixtures négatives obligatoires |
| Protection de `main` absente | UNKNOWN | élevé | vérification humaine |
| Dépendance non justifiée | faible | moyen | ADR (OPEN-003) |
| Charge éditoriale sous-estimée (129 notions, 70 rôles, 146 compétences) | élevée | moyen | migration incrémentale par discipline |

---

## 18. Capacités à préserver

| Capacité | Dépendance actuelle | Risque S4 | Protection nécessaire |
|---|---|---|---|
| Routage déterministe | `index.maquettes` (id, motsCles, questions) | faible | `routage.test.mjs` |
| Service des pages `/maquettes/:id` | slug `[a-z0-9-]+` | **élevé** si l'ID change | `worker.test.mjs`, e2e `contrat-pages` |
| Navigation par niveau | `niveau` | moyen | e2e `notions`, `ux` |
| Recommandation | `niveaux[0]`, `prerequis` (`web/recommandation.js`) | élevé | `recommandation.test.mjs` + parité |
| Cahier de vacances | `niveaux`, `prerequis` (`web/cahier-vacances.js`) | élevé | `cahier-vacances.test.mjs` + parité |
| Graphe des prérequis | `verifierGraphePrerequis` | moyen | `graphe-prerequis.test.mjs` |
| Progression, trophées, événements | slug + SemVer | **élevé** | `progression*`, `trophees*`, `evenements*` |
| Contributions (ADR 0023) | `notion_id` slug + `notion_version` SemVer | **élevé** | `contributions*` |
| Relecture | `relue-version` SemVer | moyen | `relecture.test.mjs` |
| Versions (§6 ter) | SemVer + `origin/main` | moyen | `versions.test.mjs` |
| Pages générées et CSP | `contenu.json`, `fiche` | faible | `check:pages`, `git diff` |
| Déploiement réversible | build | faible | `deploiement.test.mjs` |
| Application du cercle | `src/` | nul | `pages.yml` |

---

## 19. Architecture cible proposée [PROPOSAL]

Rien de ce qui suit n'est normatif. Tout dépend de l'ADR 0026.

1. **Couche canonique S4** : un dossier dédié (OPEN-002), un objet par fichier JSON, 8 schémas fermés reposant sur des primitives communes. Elle n'est lue que par le build et la CI, jamais par le Worker au runtime.
2. **Validateur** : L1–L4 appliqués aux objets S4, Rule IDs `S4-…`, rapport JSON conforme à `VALIDATION_REPORT.json` corrigé (DOC-12), sortie triée.
3. **Correspondance** : le slug de page reste l'identité produit ; un lien explicite slug ↔ `Notion.id` (OPEN-011).
4. **Projection** : S4 → `prerequis`, `niveaux`, `competences` de la V0. Elle tourne d'abord en **mode miroir** : comparaison sans écriture, écarts listés. Puis elle devient générée, avec un contrôle de fraîcheur (modèle de `check:pages`).
5. **Infrastructure Cloudflare** : inchangée (aucune ressource nouvelle) ; D1 reste réservée aux données éphémères et apprenant.
6. **Règle de niveau** : sortie de la validation bloquante, conservée en WARNING éditorial (OPEN-009).

---

## 20. Plan de convergence

| Phase | Contenu | Prérequis | Réversibilité | Impact V0 |
|---|---|---|---|---|
| **A — Corpus et décisions** | Verser les textes normatifs ; ADR 0026 (OPEN-001 à 024) ; corriger DOC-01 à 17 ; décider du pilotage (#165) | — | totale (docs) | nul |
| **B — Socle contractuel isolé** | Primitives, 8 schémas, fixtures positives, négatives et WARNING ; **non branchés au build** | A | totale (dossier ajouté) | nul |
| **C — Validateur** | L3 puis L4 (historique, graphe, curriculum), rapport, commande dédiée, sur les fixtures seules | B | totale | nul |
| **D — Gate CI** | Commande ajoutée à `npm run ci` et `ci.yml` sur les fixtures et un corpus S4 vide ; démonstration d'un échec | C | retrait d'une ligne | ajout seul |
| **E — Compatibilité** | Correspondance slug ↔ Notion ; projection en mode miroir sur les 36 fiches ; règle de niveau en WARNING | D, OPEN-009/011 | totale | GAP-006 modifié |
| **F — Pilote** | 4 notions (`trigo-cercle`, `pythagore`, `fractions`, `proportionnalite`) en `draft`, journal de migration, rôles humains ; projection miroir sans écart | E | suppression des objets pilotes | nul si parité |
| **G — Extension** | 32 autres fiches de maths, puis création éditoriale par discipline | F | par lot | nul si parité |
| **H — Retrait contrôlé** | Champs référentiel de `fiche.md` générés (fin du mode miroir) ; documentation mise à jour | G complet + décision | revert de PR | contrôlé |

---

## 21. Plan GitHub / PR

Ce plan ne modifie aucune issue existante. Il propose de les ajuster.

| ID | Titre | But | Prérequis | Fichiers probables | Règles S4 | Tests | Acceptation | Risque | Rollback | Issue existante |
|---|---|---|---|---|---|---|---|---|---|---|
| L0 | Verser et indexer les textes normatifs | autorité vérifiable | — | `docs/referentiel/normes/*`, index | toutes | lint | §25 | faible | revert | **nouvelle** (pré-#243) |
| L1 | ADR 0026 : décisions S4 | fermer OPEN-001 à 024 | L0 | `docs/decisions/0026-*.md` | toutes | lint | chaque OPEN porte une décision | faible | revert | #243 |
| L2 | Dette documentaire | DOC-01 à 17 | — | `docs/*.md`, roadmap, `.env.example` | — | `projets`, `roadmap` | registre DOC vide ou justifié | faible | revert | **nouvelle** |
| L3 | Rapport d'audit versionné | figer ce rapport dans le dépôt | L1 | `docs/referentiel/audit-gap.md` | — | lint | relu par le propriétaire | faible | revert | #244 (**à corriger** : retirer « migrate » sur `id` et `version`) |
| L4 | Primitives + Rule IDs | socle | L1 | dossier S4, catalogue des règles | IDs, statut, version, provenance, evidence | fixtures | `active` et `retired` rejetés | faible | suppression | #245 |
| L5–L8 | Schémas (4 PR parallélisables) | contrats | L4 | schémas + fixtures | contrats | fixtures | chaque négative échoue avec son Rule ID | faible | suppression | #246–#249 |
| L9 | Validateur L3 | références | L5–L8 | validateur | références | multi-objets | ERROR et WARNING attendus | faible | suppression | #250 |
| L10–L12 | Validateur L4 | global | L9 | idem | historique, graphe, curriculum | historiques, graphes | règles §11 couvertes | moyen | suppression | #251–#253 |
| L13 | Rapport + commande | sortie déterministe | L10–L12 | script, `package.json` | rapport | double exécution identique | code ≠ 0 si ERROR | faible | revert | #254 |
| L14 | Gate CI | preuve | L13 | `package.json` `ci`, `ci.yml` | — | PR de démonstration | fixture invalide → CI rouge | moyen | retrait d'une ligne | #255 |
| L15 | Correspondance + projection miroir + règle de niveau WARNING | compatibilité | L14, OPEN-009/011 | `scripts/lib/catalogue.mjs`, nouveau module | séparation des sources de vérité | parité recommandation et cahier | 0 écart sur les 36 fiches | moyen | revert | **scinder #256** |
| L16 | Pilote 4 notions | preuve de migration | L15 | objets S4 pilotes | toutes | parité | 0 régression de `npm run ci` | moyen | suppression | #256 (partie pilote) |
| L17+ | Extension par discipline | — | L16 | — | — | — | — | — | — | #257 |

Chaque PR : un seul objectif, cite ses Rule IDs, et donne les commandes exécutées avec leurs résultats réels (`HO/02-implementation-plan/PR_STRATEGY.md`).

---

## 22. Matrice de traçabilité

| Règle | SPEC | RULE ID | SCHEMA | FIXTURE | VALIDATOR | TEST | CI | MIGRATION |
|---|---|---|---|---|---|---|---|---|
| Statuts autorisés | S4.2 v1.1.2 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | n/a (aucun statut existant) |
| Transitions | S4.2 v1.1.2 | ✗ | n/a | ✗ | ✗ | ✗ | ✗ | n/a |
| Version entière croissante | S4.2 | ✗ | ✗ | ✗ | ✗ (analogue V0 : `verifier-versions.mjs`) | analogue V0 | lint | OPEN-012 |
| Pattern d'ID | S4.1 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | OPEN-011 |
| Unicité et non-réutilisation des IDs | S4.2 | ✗ | n/a | ✗ | analogue V0 (id en double) | analogue | build | — |
| `replacedBy` | S4.2 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | n/a |
| Contrats fermés | S4 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | — |
| Matrice des Relations | S3.1 | ✗ | ✗ | ✗ | partiel (prérequis ≠ jeu) | partiel | build | — |
| Cycles `requires` | S3.1 | ✗ | n/a | analogue | analogue V0 | `graphe-prerequis` | build | 39 arcs |
| Cycles `extends` | S3.1 | ✗ | n/a | ✗ | ✗ | ✗ | ✗ | aucun existant |
| Symétrie et canonicalisation | S3.1 | ✗ | n/a | ✗ | ✗ | ✗ | ✗ | aucun existant |
| `rationale` avant `validated` | S4 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | 39 `requires` sans rationale → `draft` |
| Gates `teaches` / `contributesTo` | S4 | ✗ | n/a | ✗ | ✗ | ✗ | ✗ | 146 compétences, OPEN-013 |
| Hiérarchies Stage/Domain | S3.2 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | OPEN-006 |
| `projectionKey` sans version | S4 + audit v1.1.1 | ✗ | n/a | ✗ | ✗ | ✗ | ✗ | 70 paires |
| Provenance objet | S4 + audit v1.1.1 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | OPEN-005 |
| Cardinalité d'evidence | S4 + audit v1.1.1 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | OPEN-004 |
| Exclusion des données apprenant | S4 | ✗ | n/a | ✗ | ✗ | implicite | ✗ | conforme |
| Pas de `requires` déduit du curriculum | handoff §3 | ✗ | n/a | ✗ | **violé** (règle de niveau) | test contraire | build | GAP-006 |
| Verdict et rapport | `VALIDATION_RULES` | ✗ | n/a | n/a | ✗ | ✗ | ✗ | DOC-12 |

---

## 23. Préparation par domaine

| Domaine | État | Justification |
|---|---|---|
| Documentation | **NOT READY** | textes normatifs absents (GAP-001), 23 OPEN, 17 DOC |
| Contrats | **NOT READY** | valeurs manquantes (GAP-004) ; 0 schéma |
| Données | **PARTIAL** | V0 propre et validée (build vert), mais 36/174 renseignées, aucun rôle ni provenance |
| Validation | **PARTIAL** (V0) / **NOT READY** (S4) | analogues L1–L4 sur la V0 ; 0 règle S4 |
| Tests | **READY** (V0) / **NOT READY** (S4) | 522 unitaires, 507/509 e2e (1 échec dû au clone superficiel, GAP-019), 54 cercle ; 0 fixture S4 |
| CI | **PARTIAL** | infrastructure robuste et extensible ; aucune gate S4 ; protection de `main` UNKNOWN |
| Migration | **NOT READY** | correspondance d'identité non décidée (GAP-002) ; projection absente |
| Sécurité | **PARTIAL** | Gitleaks, CodeQL, `npm audit`, CSP vérifiés en CI ; protection de branche UNKNOWN |
| Non-régression | **READY** pour les consommateurs V0 | tests directs de la recommandation, du cahier, du graphe, des versions et des pages |

---

## 24. GO / NO-GO

| Décision | Verdict | Conditions |
|---|---|---|
| Gel documentaire | **NO-GO** aujourd'hui → GO quand… | OPEN-001 résolu (textes versés ou renoncement explicite), ADR 0026 accepté, DOC-12 et DOC-17 tranchées |
| JSON Schemas | **NO-GO** | ADR 0026 fixant evidence, provenance, stageType, jurisdiction, patterns d'ID, éditions, outil et draft |
| Validateur | **NO-GO** | schémas fusionnés ; OPEN-016, 021, 022, 023 décidées |
| Modification de la CI | **NO-GO** pour S4 | validateur + rapport déterministe ; protection de `main` vérifiée ; l'ajout ne retire aucun contrôle |
| Migration pilote | **NO-GO** | OPEN-009/011/012/013/015 décidées ; projection miroir à 0 écart ; tests de parité |
| Migration globale | **NO-GO** | pilote qualifié ; OPEN-010 décidée ; charge éditoriale planifiée |
| Retrait des anciennes structures | **NO-GO** | migration globale terminée, projection générée stable sur plusieurs releases, décision écrite |

---

## 25. Prochaine action unique recommandée

**Action** : verser dans le dépôt, en lecture seule, les textes normatifs S1, S2, S3.1, S3.2, S4.1 à S4.8 (dont S4.2 v1.1.2) et l'audit transversal v1.1.1. Les accompagner d'un **index d'autorité** : pour chaque texte, sa version, sa date, son rang, son domaine, son statut (normatif, synthèse, obsolète) et son empreinte SHA-256. **[PROPOSAL]**

**Pourquoi celle-ci en premier** :

- **[DERIVED]** 13 des 23 décisions ouvertes (OPEN-001 à 008, 012, 019, 021 à 023), et en partie OPEN-015, ne sont « ouvertes » que parce que les textes primaires manquent. Les trancher par ADR sans eux reviendrait à inventer la norme, ce que la mission interdit (« ne jamais combler une ambiguïté normative par une préférence personnelle »).
- **[FACT-SPEC]** L'ordre d'autorité (`HO/00-start-here/AGENT_INSTRUCTIONS.md` §4) n'est applicable que si les documents qu'il classe sont consultables (GAP-001, P0).
- **[FACT-SPEC]** « Chaque contrat porteur fixe explicitement la cardinalité de evidence » (`HO/01-normative-baseline/AUTHORITY_AND_DECISIONS.md`) : cette valeur est dans les contrats S4.x, pas dans le résumé.
- **[FACT-REPO]** `AGENTS.md` §1 (« tout le pilotage est en Markdown dans ce dépôt », agnostique de l'agent) : un agent Claude Code ou Copilot ne peut appliquer que ce qui est versionné.
- **[DERIVED]** L'action ne touche ni le code, ni les données, ni la CI. Le risque est nul, le retour arrière se fait par un revert. Elle débloque directement l'ADR 0026 (#243).

**Fichiers concernés** [PROPOSAL, emplacement soumis à confirmation] :

- `docs/referentiel/normes/` : un fichier Markdown par texte.
- `docs/referentiel/normes/README.md` : l'index d'autorité.
- Éventuellement `docs/referentiel/normes/MANIFEST.json` : les empreintes.

**Critère objectif de fin** :

1. Chaque document listé au §3 est présent ou explicitement déclaré « non disponible » dans l'index, avec la raison.
2. L'index donne, pour chaque texte, rang, domaine, version, statut et empreinte. Une commande (`sha256sum`) les vérifie.
3. Chaque OPEN de la §16 est requalifiée dans l'index en « résolue par <texte §> » ou « reste ouverte ». L'ADR 0026 peut alors citer une section pour chaque valeur normative.
4. Le job `verifier` de `ci.yml` reste vert sur la PR : le lint valide le JSON ajouté et vérifie l'absence de secrets. Aucun autre fichier n'est modifié.

*Cette action n'a pas été commencée.*
