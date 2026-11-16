# Prompts par phase

## Audit
Inspecte le dépôt et remplis les templates `REPOSITORY_GAP_MATRIX.md` et `PR_PLAN.md`. Exécute les commandes existantes et rapporte les sorties utiles.

## Schémas
Implémente/adapte les huit schémas en réutilisant les primitives communes. Ajoute des fixtures locales ciblées. Distingue explicitement ce qui reste au validateur global.

## Validateur
Implémente les quatre niveaux, des Rule IDs stables, un rapport déterministe et des codes de sortie adaptés. Ajoute des tests multi-objets et historiques.

## CI
Raccorde la validation à la CI existante. Prouve qu'un corpus invalide échoue et qu'un corpus valide passe avec conservation des WARNING.

## Migration pilote
Choisis un lot représentatif après audit, fournis mapping avant/après, journal de migration, tests de non-régression et rollback.
