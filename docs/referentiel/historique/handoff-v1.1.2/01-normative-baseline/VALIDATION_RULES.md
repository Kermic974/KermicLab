# Validation S4

## Quatre niveaux
1. Syntaxe JSON et formats primitifs.
2. JSON Schema et contrat local.
3. Intégrité référentielle.
4. Intégrité globale, graphe et historique.

## Verdict
- 0 ERROR, 0 WARNING : PASS.
- 0 ERROR, au moins 1 WARNING : PASS avec avertissements.
- au moins 1 ERROR : FAIL.

## Rapport minimal
`rule`, `severity`, `message`, `objectId` si disponible, `location` si disponible.

## Contrôles globaux prioritaires
Unicité et non-réutilisation des IDs ; progression des versions ; transitions ; replacedBy ; existence/statut des références ; matrice Relation ; doublons ; canonicalisation ; cycles ; cardinalités Knowledge Core ; hiérarchies Stage/Domain ; cohérence CurriculumMapping ; provenance/evidence ; exclusion des données apprenant ; absence de seconde source de vérité.

## Déterminisme
Les règles bloquantes ne dépendent pas d'une appréciation non déterministe d'une IA. Atomicité, qualité d'une preuve et rupture sémantique peuvent nécessiter une revue éditoriale distincte.
