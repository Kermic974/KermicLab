# Stratégie de branches, commits et PR

- Une PR = un objectif borné.
- Ne pas mélanger schémas, migration massive, refactor UI et changement produit.
- Commits atomiques et réversibles.
- Chaque PR technique cite les Rule IDs concernés.
- Inclure commandes et résultats réels.
- Inclure impact données, compatibilité, migration et rollback.
- Refuser le merge si tests existants régressent ou si une fixture négative passe.

Ordre recommandé : audit -> primitives communes -> schémas par famille -> fixtures -> validation référentielle -> validation globale -> CLI/report -> CI -> pilote.
