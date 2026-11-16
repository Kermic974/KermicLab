# KermicLab - Livraison de relais pour agent de coding

Version de livraison : **1.1.2-handoff**  
Baseline documentaire : **audit S4 v1.1.1 + S4.2 v1.1.2**

## Mission
Mettre à niveau le dépôt KermicLab existant vers les contrats canoniques S4 sans repartir de zéro, sans migration massive prématurée et sans régression silencieuse.

## Ordre de lecture obligatoire
1. `AGENT_INSTRUCTIONS.md`
2. `../01-normative-baseline/AUTHORITY_AND_DECISIONS.md`
3. `../01-normative-baseline/S4_CANONICAL_CONTRACTS.md`
4. `../01-normative-baseline/VALIDATION_RULES.md`
5. `../02-implementation-plan/EXECUTION_PLAN.md`
6. `../05-checklists/DEFINITION_OF_DONE.md`

## Principe directeur
- Auditer avant de modifier.
- Classer chaque structure existante : `keep`, `adapt`, `migrate`, `retire`.
- Préserver les capacités et tests existants.
- Ne jamais présenter une validation documentaire comme une preuve technique.
- Ne jamais corriger silencieusement des données invalides.

## Première sortie attendue de l'agent
Un rapport d'audit du dépôt, sans refactor massif, contenant : inventaire, matrice d'écart, risques, dépendances, commandes vérifiées, proposition de lots et premier PR plan.
