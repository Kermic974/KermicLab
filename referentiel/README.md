# Contrats du référentiel S4

Les huit schémas JSON Schema 2020-12 partagent les définitions de `schemas/primitives.schema.json`. Les contrats de forme sont ceux de l’[ADR 0028](../docs/decisions/0028-adoption-contrats-s4.md). `RULE_CATALOG.csv` relie les règles de structure et d’intégrité à leurs fixtures et à leurs tests. [S5 v1.0.0](../docs/referentiel/normes/S5-v1.0.0.md), adoptée par la PR #369, consolide les responsabilités des sources et des artefacts.

Pour les vérifier, installer les dépendances puis exécuter `node --test tests/unit/referentiel-schemas.test.mjs`. Ces tests font aussi partie de `npm test`.

## Validation du corpus canonique

Déposer un objet JSON par fichier sous `referentiel/objets/`. Exécuter `npm run check:referentiel` depuis la racine. Ajouter `-- --json` après la commande npm pour obtenir le rapport machine. Les avertissements laissent un code de sortie nul. Les erreurs donnent un code de sortie 1.

Pour un corpus non vide, utiliser un clone complet disposant de `origin/main`. Les révisions publiées viennent du premier parent de main à la base commune avec HEAD. L’état de travail fournit la révision candidate. Le catalogue V0 ne fait pas partie du corpus canonique.

La commande fait partie de `npm run ci` et du workflow CI/CD. Le job affiche le JSON et conserve le rapport `validation-referentiel` en artefact, y compris en cas d’erreur. Les avertissements restent visibles sans bloquer. La vérification de la projection des fiches V0 est suivie dans #256.

## Projection vers les fiches V0

Le fichier `referentiel/projection-v0.json` active la projection pour les seules fiches publiques énumérées dans `fiches`. Sans fichier de configuration, le build et `check:pages` n’effectuent aucune projection.

- `curriculum` désigne l’ID du programme de projection.
- `notions` associe les slugs de fiche aux IDs canoniques, y compris pour les cibles des prérequis.
- `competences` associe les IDs de MicroSkill aux slugs de compétence V0.
- `fiches` associe chaque slug à ses listes ordonnées `prerequis` et `competences` lorsqu’elles sont attendues. Une liste explicite `prerequis: []` produit un champ vide. Omettre la liste si le champ doit rester absent et si aucune relation ne fournit de valeur.

Le build lit les Relations sortantes et les placements du Curriculum désigné. Les brouillons participent à la projection et les liens ou placements dépréciés sont ignorés. Les niveaux suivent l’ordre V0 et les autres listes suivent l’ordre déclaré, après conversion en slugs et dédoublonnage. Une liste déclarée doit contenir exactement les slugs calculés. Une incohérence bloque le build.

`npm run build` met à jour les champs générés. `npm run check:pages` signale les valeurs ou l’ordre obsolètes sans modifier les fiches. Le pilote #256 et les neuf lots #257 ont été qualifiés. Le [bilan S4 v0.5](../docs/referentiel/bilan-s4-v0.5.md) relie les journaux aux preuves.

## Sources ouvertes de l'Éducation nationale

`sources-ouvertes/` contient les instantanés des évaluations nationales et des programmes (data.education.gouv.fr,
Licence Ouverte) et la table compétences nationales → notions. Voir l'[ADR 0044](../docs/decisions/0044-sources-ouvertes-education.md),
le [chantier](../docs/chantiers/sources-ouvertes.md) et le [rapport généré](../docs/referentiel/sources-ouvertes.md).

## Création des lots v0.5

Voir [le guide de génération](generation-v0.5.md) et [l’inventaire public](inventaire-v0.5.json).

## Contrôle des artefacts S5

`npm run check:artefacts` vérifie le catalogue CSV, l’index `sources-normatives.json`, les fichiers cités et les fixtures nommées. `npm run check:artefacts -- --json` produit le rapport déterministe. La CI conserve `validation-artefacts.json` comme artefact. Le code de sortie vaut 1 pour un rapport en erreur et 2 pour une invocation invalide.

Les tests du référentiel vérifient que chaque preuve citée exerce le diagnostic et la sévérité déclarés. Une référence vers un scénario JavaScript utilise son nom explicite après `#`. Une référence JSON utilise le champ `name` du cas. Les références multiples sont séparées par ` | `. L’index des sources associe chaque section S4 à sa page lisible et à la décision d’adoption.
