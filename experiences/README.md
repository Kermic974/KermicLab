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

## Étapes encore à livrer

La PR 03 ajoute les diagnostics S6, références et cycles, historique, invariants des variantes, sélection déterministe, revue/accessibilité et rapports S5/CI. Elle distingue structure valide, références résolues et expérience publiable. Les noms F-CORE-VALID, F-REF-ERROR, F-LAYER-ERROR, F-ANSWER-ERROR, F-VARIANT-WARNING, F-ACCESS-REVIEW, F-LAB-VALID et F-EVIDENCE-WARNING sont réservés aux scénarios métier de ce validateur, pas assimilés à une simple validation JSON Schema.

Les PR 04–16 ajoutent les cibles manquantes, adaptateurs des sources actuelles, identifiants persistants, correspondances des événements, corpus et manifeste de compatibilité historique, export public puis qualification. Cette PR ne crée aucun objet publié, aucune commande `check:experiences`, aucun manifeste ni route d’apprenant. Les champs de revue ne doivent être renseignés que par une personne compétente sur une version précise ; un test ou un PASS ne les remplit pas.
