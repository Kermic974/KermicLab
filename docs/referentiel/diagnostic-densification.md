# Diagnostic de densification du référentiel (audit, avant toute modification)

Audit en lecture seule du corpus canonique `referentiel/objets/**/*.json` (les 165 notions de la V0 ; Curriculum et Stages exclus du décompte). Les mathématiques servent de référence de qualité. Rapport généré par script, reproductible.

## Modèle actuel (ce qui permet déjà de tout représenter)

- **Notion** (`notion.<discipline>.<slug>`) ← relation `teaches` → **MicroSkill** (`microskill.…`) ; chaque MicroSkill `contributesTo` une **Skill** (une Skill par Notion).
- Prérequis = relation `requires` (Notion → Notion) ; le build projette `requires` vers `prerequis` des fiches, `teaches` vers `competences`, et les CurriculumMappings vers `niveaux`.
- Le schéma `relation` expose déjà `requires`, `supports`, `extends`, `relatedTo`, `equivalentTo` : **aucune évolution du modèle n'est nécessaire** pour exprimer un lien « notion liée » qui n'est pas un prérequis (`relatedTo`), notamment en philosophie. `rationale` est obligatoire dès qu'un `requires` est `validated`.
- Tous les objets sont au statut `review` (version 2), provenance `editorial` ou `legacy-v0`.
- La projection (`referentiel/projection-v0.json`) associe les IDs de MicroSkill à des slugs de compétence : remplacer des MicroSkills `action-N` impose de mettre à jour cette configuration et les fiches projetées (`npm run build`).

## Tableau comparatif

| Discipline | Notions | MicroSkills | MicroSkills/notion | MicroSkills génériques `action-N` | `requires` | Notions sans prérequis | Isolées | Profondeur max | Composantes | Cycle |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| mathematiques | 36 | 146 | 4.1 | 0 | 39 | 10 | 2 | 6 | 3 | non |
| physique-chimie | 23 | 46 | 2.0 | 46 | 4 | 19 | 16 | 1 | 19 | non |
| svt | 24 | 48 | 2.0 | 48 | 3 | 21 | 18 | 1 | 21 | non |
| histoire | 16 | 32 | 2.0 | 32 | 0 | 16 | 16 | 0 | 16 | non |
| geographie | 17 | 34 | 2.0 | 34 | 0 | 17 | 17 | 0 | 17 | non |
| francais | 10 | 20 | 2.0 | 20 | 0 | 10 | 10 | 0 | 10 | non |
| emc | 12 | 24 | 2.0 | 24 | 0 | 12 | 12 | 0 | 12 | non |
| ses | 10 | 20 | 2.0 | 20 | 0 | 10 | 10 | 0 | 10 | non |
| philosophie | 17 | 34 | 2.0 | 34 | 0 | 17 | 17 | 0 | 17 | non |

(Isolée : ni prérequis sortant ni notion qui l'exige. Composantes : composantes connexes du graphe `requires`.)

## Constats

1. **Compétences** : dans les 8 disciplines hors mathématiques, **100 % des notions** (129) n'ont que 2 MicroSkills génériques `*-action-1` / `*-action-2` ; les mathématiques en ont 3 à 5 par notion (moyenne 4,1), toutes explicites.
2. **Prérequis** : histoire, géographie, français, EMC, SES et philosophie n'ont **aucun** `requires` (graphe entièrement déconnecté) ; physique-chimie en a 4 et SVT 3 ; les mathématiques en ont 39 (profondeur 6, 3 composantes, 2 notions isolées).
3. **Intégrité** : aucun cycle, aucune relation vers un objet inexistant, aucun ID orphelin détecté dans l'état actuel.
4. **Périmètre** : le corpus canonique ne couvre que les 165 notions de la V0 ; les 312 notions ajoutées depuis (cycle 2, cycle 3, cycle 4, lycée) n'ont pas d'objets canoniques (c'est le sens des propositions de liens S4 déjà rédigées).

## Plan proposé (à valider avant implémentation)

1. **Lot par discipline**, dans cet ordre de risque croissant : physique-chimie, SVT, SES, EMC, géographie, français, histoire, philosophie. Pour chaque lot : remplacement des MicroSkills `action-N` par 3 à 6 MicroSkills observables (« verbe d'action + objet précis »), relations `requires` argumentées, mise à jour de `projection-v0.json`, `npm run build`, journal `docs/referentiel/v0.5-<discipline>-densification.md`.
2. **Sources** : programmes officiels référencés dans le dépôt et fiches `catalogue/<slug>/` ; chaque lien est classé attesté, proposition pédagogique ou incertain. Les liens incertains vont dans `docs/referentiel/relations-a-revoir.md` et ne sont pas créés.
3. **Prudence disciplinaire** : histoire (chronologie ≠ prérequis, liens créés seulement si la compréhension mobilise la notion antérieure), philosophie (`relatedTo` plutôt que `requires`), français (compétences linguistiques et analytiques, pas de dépendances entre genres).
4. **Validation** après chaque lot : `npm run check:referentiel`, `-- --json`, `npm run build`, `npm run check:pages`, `npm test`, plus comparaison avant/après de la recommandation et du cahier de vacances.
5. **Statuts** : objets créés en `review` (comme le corpus actuel), jamais `validated` sans relecture humaine ; version entière supérieure pour tout objet modifié.

## Décisions à prendre avant de commencer

- **Branche et PR** : la branche de session porte déjà la PR #402 (catalogue du lycée). Pour ne pas mélanger deux chantiers, je recommande de créer une branche dédiée à la densification (et sa propre PR), ou d'attendre la fusion de #402.
- **Périmètre du premier lot** : valider l'ordre ci-dessus ou choisir une discipline pilote.
