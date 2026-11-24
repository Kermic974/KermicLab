# Expériences pédagogiques S6

Contrat adopté par la [PR #385](https://github.com/Kermic974/KermicLab/pull/385), révision `8eb022e92405def7cc80cd05d5b92beca86c3cf6` : [S6 v1.0.0](../docs/referentiel/normes/S6-v1.0.0.md), [ADR 0033](../docs/decisions/0033-adoption-contrats-s6.md). Suivi [#384](https://github.com/Kermic974/KermicLab/issues/384), PR 02/16.

## Livré à cette étape

Treize documents JSON Schema 2020-12 : primitives, contrat commun et onze contrats spécialisés. Le chargeur `scripts/lib/experiences-structure.mjs` utilise Ajv 8 déjà verrouillé, en mode strict (sauf le contrôle de compilation `strictRequired`, car les propriétés requises sont définies via `allOf`). Les exigences `required` restent exécutées. Les propriétés non déclarées sont rejetées dans les objets complets et dans les structures imbriquées. Le contrat des cibles est référencé depuis les primitives S4, sans copie ni élargissement de S4.

Les types sont `explanation`, `example`, `exercise`, `quiz`, `guided-activity`, `visualization`, `manipulation`, `lab`, `mission`, `remediation`, `deepening-resource`. Les champs communs, les types de tâche et les invariants métier sont décrits dans la norme. Les propriétés sérialisées précisées ici sont des références aux contenus existants, jamais une seconde copie de leur texte.

| Propriété | Forme |
| --- | --- |
| `sources` | Liste de `{path, anchor, format}` ; formats `catalogue-json`, `html`, `module-data` |
| `components`, `variantOf` | Respectivement liste et objet `{id, version}` ; version entière positive |
| `provenance` | `{type, references, migration?}` ; type `editorial` ou `legacy-v0`, références documentaires locales `{path, anchor}` |
| `provenance.migration` | Obligatoire et réservé à `legacy-v0` : `{slug, revision, sourcePaths}` ; révision Git complète |
| `task` | Pour exercise : `{format, prompt, expected, hints?, feedback?, actions?, parameters?}` ; références de source, format `qcm`, `number` ou `action` |
| `task.actions`, `task.parameters` | Réservés à action ; actions obligatoires, paramètres facultatifs |
| `actions`, `constraints` | Pour manipulation : références obligatoires aux actions et contraintes préparées |
| `parameters`, `interactions`, `limits` | Pour lab : références obligatoires au modèle pédagogique existant |
| `successCriteria` | Pour mission : liste non vide de références aux critères préparés |
| `rationale` | Pour remediation : motif éditorial non vide |
| `accessibility` | `{modalities, alternatives, review?}` ; une alternative lie `{modality, source}` ; revue référencée par `{path, anchor}` |
| `review` | `{source, date, version, scope}` ; source documentaire, date ISO, version exacte, portée content/targets/accessibility |
| `applicability`, `priority` | Réservés aux variantes, conjointement avec variantOf ; axes autorisés par S6.7, priorité entière non négative |

Les sources doivent être relatives au dépôt. La structure interdit traversée, URL, lecteur Windows, antislash, préfixe privé et format incompatible avec le chemin. Les unités utilisent une ancre explicite, pas un index de tableau. Le contrôle de la présence réelle, de l’unicité et du contenu de l’ancre relève du validateur et des adaptateurs suivants. Pour un exercice JSON, la même unité source peut porter consigne et réponse préparée : l’adaptateur interprète leurs champs selon le format de tâche ; aucun texte de réponse d’élève n’est accepté.

Les fixtures sont **synthétiques** : elles prouvent la forme des contrats, sans prétendre que leurs ancres existent ou qu’une personne les a relues. `tests/fixtures/experiences/structures-valides.json` contient les bases nommées ; `structures-refusees.json` décrit les mutations refusées et le mot-clé JSON Schema attendu. Les tests vérifient aussi l’étanchéité avec les huit contrats S4.

```sh
node --test tests/unit/experiences-schemas.test.mjs
```

## Validateur et rapports — PR 03

La commande vérifie les définitions, leurs cibles S4, les références versionnées, la matrice de composition, les cycles et les variantes. Elle ne crée aucun objet et ne promeut aucun statut. Les 22 diagnostics S6 sont indexés avec leur section normative et leur preuve exécutée dans `referentiel/RULE_CATALOG.csv`. Les scénarios F-CORE-VALID, F-REF-ERROR, F-LAYER-ERROR, F-ANSWER-ERROR, F-VARIANT-WARNING, F-ACCESS-REVIEW, F-LAB-VALID et F-EVIDENCE-WARNING sont couverts par les tests métier.

```sh
npm run check:experiences
npm run --silent check:experiences -- --json
```

Le rapport contient `specificationVersion`, `verdict`, `errors`, `warnings`, `objects` et `issues`. Verdicts : ERROR si une erreur existe, WARNING s’il ne reste que des avertissements, PASS sinon. Sorties : 1 pour une erreur, 2 pour une invocation invalide, 0 sinon. Les diagnostics sont dédoublonnés et triés par emplacement, règle, sévérité puis message. La CI conserve `validation-experiences.json`, même en échec ; `npm run ci` inclut ce contrôle. `objects: 0` indique explicitement l’absence de migration : un PASS sur un corpus vide n’atteste aucune couverture publique.

Les références `catalogue-json` résolvent un champ `experienceId` persistant et unique dans l’arbre JSON. Le lecteur ne déduit pas l’identité d’un index. La tâche réutilise le contrôle du gabarit pour qcm/nombre ; action attend une consigne, une liste déclarative `actions` et des `successCriteria` préparés. Les lecteurs refusent les données individuelles et les valeurs exécutables. Les champs de revue ne doivent être renseignés que par une personne compétente sur une version précise ; les tests créent leurs attestations synthétiques uniquement dans leurs dépôts temporaires.

Les formats HTML et module-data exigent des adaptateurs internes explicites, qui seront livrés avec le pilote. À cette étape ils sont refusés, sans lecture approximative ni exécution des scripts des pages. Les contrôles de sources utilisent le chemin réel pour empêcher une sortie du dépôt et résolvent les sections des documents de provenance et de revue. Une alternative référencée mais absente est toujours une erreur ; une revue manquante ou une accessibilité à compléter avertit en draft/review et bloque validated.

L’historique requiert un clone complet et `origin/main`. Les objets sont identifiés indépendamment des chemins ; la lecture par lots et le cache des blobs conservent les mêmes états Git que la lecture objet par objet. Pour S6, les commits touchant `catalogue/`, `Sample/lab/` et `src/pedagogy/` sont aussi examinés : un changement de source sans révision S6 reste détecté même s’il est ensuite restauré. Les empreintes conservent l’ordre pédagogique et normalisent CRLF/LF et l’ordre des clés JSON. La sélection de variantes retient la priorité maximale, refuse ses égalités et revient à la base sans contexte applicable ; elle reste une fonction pure, hors du parcours apprenant.

## Étapes encore à livrer

Les étapes suivantes ajoutent les cibles manquantes, adaptateurs des sources actuelles, identifiants persistants, correspondances des événements, corpus, manifeste de compatibilité historique et export public, puis qualification. Le manifeste vérifiera en particulier les statuts autorisés à la publication : le contrôle de cohérence d’une définition ne suffit pas à l’autoriser. Aucun manifeste, index public S6 ou route d’apprenant n’est créé par la PR 03. La fermeture devra intégrer les arrivées sur main depuis l’inventaire initial, qui reste un relevé historique.
