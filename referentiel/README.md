# Contrats du référentiel S4

Les huit schémas JSON Schema 2020-12 partagent les définitions de `schemas/primitives.schema.json`. Les contrats de forme sont ceux de l’[ADR 0028](../docs/decisions/0028-adoption-contrats-s4.md). `RULE_CATALOG.csv` relie les règles de niveau 2 à leurs fixtures et à leurs tests.

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

`npm run build` met à jour les champs générés. `npm run check:pages` signale les valeurs ou l’ordre obsolètes sans modifier les fiches. La migration du corpus pilote et la qualification des résultats des consommateurs restent suivies dans #256.

## Création des lots v0.5

Voir [le guide de génération](generation-v0.5.md) et [l’inventaire public](inventaire-v0.5.json).
