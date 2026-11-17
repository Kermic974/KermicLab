# Contrats du référentiel S4

Les huit schémas JSON Schema 2020-12 partagent les définitions de `schemas/primitives.schema.json`. Les contrats de forme sont ceux de l’[ADR 0028](../docs/decisions/0028-adoption-contrats-s4.md). `RULE_CATALOG.csv` relie les règles de niveau 2 à leurs fixtures et à leurs tests.

Pour les vérifier, installer les dépendances puis exécuter `node --test tests/unit/referentiel-schemas.test.mjs`. Ces tests font aussi partie de `npm test`.

## Validation du corpus canonique

Déposer un objet JSON par fichier sous `referentiel/objets/`. Exécuter `npm run check:referentiel` depuis la racine. Ajouter `-- --json` après la commande npm pour obtenir le rapport machine. Les avertissements laissent un code de sortie nul. Les erreurs donnent un code de sortie 1.

Pour un corpus non vide, utiliser un clone complet disposant de `origin/main`. Les révisions publiées viennent du premier parent de main à la base commune avec HEAD. L’état de travail fournit la révision candidate. Le catalogue V0 ne fait pas partie du corpus canonique.

La commande est disponible séparément. Son ajout comme contrôle obligatoire en CI et le contrôle de projection des fiches V0 sont suivis dans #255 et #256.
