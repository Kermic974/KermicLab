# Évaluation S7

Contrat [S7 v1.0.0](../docs/referentiel/normes/S7-v1.0.0.md), adopté par [#428](https://github.com/Kermic974/KermicLab/pull/428) / ADR 0043. Suivi : [#427](https://github.com/Kermic974/KermicLab/issues/427), lot S7-B.

## Portée de ce lot

Neuf documents JSON Schema 2020-12 : primitives, définition, tentative, observation, soumission, décision, clôture, journal et registre des méthodes. Ajv 8 vérifie les objets fermés, cardinalités et champs conditionnels ; `strictRequired: false` autorise uniquement les propriétés requises déclarées par une composition `allOf`, pas les propriétés inconnues. Le contrat des références S4 et S6 est réutilisé, sans copie de leurs taxonomies.

Le correcteur et le journal sont des modules purs, sans stockage ni réseau, copiables avec le site mais **non branchés sur les écrans ou les événements dans S7-B**. Les définitions publiques vont dans `evaluations/objets/`. Aucun journal apprenant ne doit être versionné dans ce dépôt ; les occurrences ci-dessous sont seulement des contrats d'application et leurs exemples de test sont synthétiques. Les politiques de maîtrise et la persistance restent sous S8/S9.

Les fichiers `schemas/` et le [contrat technique](../docs/evaluation/contrats-s7.md) précisent les identités et limites. La commande ne crée aucun objet et n'attribue aucune validation pédagogique :

```sh
npm run check:evaluations
npm run check:evaluations -- --json
node --test "tests/unit/evaluations-*.test.mjs"
```

Le code de sortie est 0 pour PASS/WARNING, 1 pour ERROR et 2 pour une invocation invalide. Le rapport est déterministe, avec règle, sévérité, emplacement et message sans saisie personnelle. La CI conserve `validation-evaluations.json` même en cas d'échec. Les 17 règles enregistrées dans S5 possèdent des preuves de diagnostic et de sévérité effectivement exécutées ; les propriétés de minimisation et d'absence de malus sont aussi vérifiées par schéma et tests du correcteur.

## Méthodes et histoire

`methodes.json` fixe quatre méthodes initiales : catalogue-qcm, catalogue-number, human-review et assisted-review, version 1. Elles sont implémentées par `web/evaluation-correction-v1.js`, dont le SHA-256 normalisé en LF est figé. Le journal et le validateur importent directement cette version. Une correction du module exige une nouvelle version conservant l'ancienne implémentation et un branchement explicite, pas la réécriture de v1. Une méthode peut être dépréciée ; son entrée historique n'est ni effacée ni réactivée sous la même version. Les modifications de source et de registre sont contrôlées dans Git.

Les définitions commencent en draft, sans extension implicite de la dérogation historique S6. Un changement de définition, source ou méthode exige une version supérieure. Les références d'expérience, cible et relation de contribution sont exactes. La dépréciation n'empêche pas l'audit d'une révision historique disponible. Une définition active ne contourne pas une dépréciation courante ; une publication avec une expérience review exige une autorisation S6 explicite et qualifiée.

## Suite et limites

S7-C doit réutiliser le correcteur dans les producteurs réels, fournir les expériences/ancres/mappings du pilote S6, respecter le pont v1, produire des observations qualifiées et couvrir les autres unités publiques. Les ressources non évaluables sont classées explicitement. Le comportement des saisies invalides/non finies, des aides, du clavier, des feedbacks et des pages manuelles doit être qualifié dans cette intégration ; le test du correcteur contre les réponses JSON préparées ne le remplace pas.

S7-D doit établir le bilan de couverture, les revues humaines, le build reproductible et les preuves du déploiement/production. Un PASS avec zéro définition ne clôture aucun de ces lots. Les agrégats V0 ne deviennent pas des tentatives reconstituées et ne reçoivent pas une maîtrise MicroSkill par défaut.

English summary: closed S7 schemas, a version-pinned pure correction/journal kernel and a read-only validator. No learner data is stored here and no existing page is connected yet; public integration and production qualification remain required.
