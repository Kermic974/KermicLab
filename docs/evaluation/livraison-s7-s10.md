# Livrer S7 puis S8 puis S9 puis S10

Objectif utilisateur du 24 novembre 2026. Suivi : [#427](https://github.com/Kermic974/KermicLab/issues/427). Sources : [relevé des 36 pages](sources-notion-s7-s10.json), [audit du dépôt](audit-s7-s10.md). Toutes les PR ciblent `main`, citent leur dépendance fusionnée et sont soumises au CODEOWNER après contrôle du diff et `npm run ci`. Le propriétaire adopte les décisions et fusionne ; les agents ne s'auto-approuvent pas.

## Chaîne et conditions d'ouverture

| Lot | Dépendance | Livrable et acceptation |
| --- | --- | --- |
| S7-A | S4/S5 et contrats S6 sur main | Proposition [ADR 0043](../decisions/0043-adoption-evaluation-s7.md), norme S7, audit, règles S7-01 à S7-20 ; adoption humaine avant contrats techniques |
| S7-B | S7-A fusionné | Schémas fermés des définitions/tentatives/observations/décisions ; histoire, correcteur déterministe, modes assisté/humain ; fixtures pour chaque règle, validateur/rapports S5/CI |
| S7-C | S7-B et pilote S6 disponibles | Brancher les producteurs et consommateurs réels : gabarit, cercle, jeux et lab ; cibles réellement évaluées, versions/ancres exactes ; pont v1 conservé, limites V0 explicites ; couvrir tout le périmètre public S6 |
| S7-D | S7-C | Bilan complet de couverture, ressources non évaluables classées, revue pédagogique/humaine, parité/clavier/mobile, deux builds identiques, déploiement et vérification de production ; clôture S7 |
| S8-A | **S7 livré et vérifié** | Fermer les décisions des huit pages avec exemples : catégories/finalités, journal, modèle MicroSkill, agrégation Skill, progression, répétition, recommandation, recalcul, rétention/accès ; adoption humaine |
| S8-B | S8-A | Contrats/journal/projections et moteurs versionnés ; preuve des absences, contradictions, obsolescence et recalcul ; aucun poids implicite sur contributesTo |
| S8-C | S8-B | Intégration des données et écrans actuels, migration non destructive V0, accès/import/export/effacement, revue et production ; clôture S8 |
| S9-A | **S8 livré et vérifié** | Matrice réelle responsabilité→entrée→sortie→autorité→accès ; décisions d'exécution, messages/erreurs, compatibilité, cache et migration après audit ; adoption humaine |
| S9-B | S9-A | Résolution exacte, rendu, orchestration S7/S8, transport/idempotence/permissions, cache reconstruisible et migration ; preuve pour chaque composant audité |
| S9-C | S9-B | Qualification de bout en bout S6→S9, pannes/retries/doublons/messages retardés/rollback, revue et production ; clôture S9 |
| S10-A | **S9 livré et vérifié** | Audit effectif rôles/rulesets/approbations/CI/releases/canaux ; décisions de contribution, revue, IA, publication et changements normatifs ; adoption humaine |
| S10-B | S10-A | Gates et registres exécutables, preuves au SHA testé, manifeste et publication, dépréciation/migration/rollback ; aucune exception transformée en PASS |
| S10-C | S10-B | Scénarios de refus, publication et retour arrière, audit transversal S1–S10 et vérification distribuée ; clôture S10 et objectif |

Ce sont des lots vérifiables, pas une limite artificielle au nombre de PR : scinder un lot si nécessaire en conservant les dépendances et l'intégralité des exigences. Ne pas lancer une série aval avant qualification de la précédente. Les contrats techniques ne se limitent pas au vocabulaire conceptuel : ils devront fermer cardinalités, identités, transitions, bornes et erreurs avec fixtures, sans contredire le contrat adopté.

## Dépendance S6

Le suivi [#384](https://github.com/Kermic974/KermicLab/issues/384) reste ouvert. #426 adopte les cibles et l'annexe de migration ; elle n'exporte pas les expériences. S7-A et les fixtures synthétiques S7-B peuvent avancer sur les contrats S6 adoptés. Le pilote, les ancres et mappings S6 sont requis avant S7-C ; l'ensemble du périmètre S6 doit être qualifié pour clôturer S7. Une dépendance manquante est traitée explicitement dans son chantier, sans prétendre que le nouveau moteur suffit à livrer le corpus.

## Preuve de livraison pour chaque série

La revue établit une matrice sous-page/règle→artefact→test→résultat→révision. Chaque exigence a une preuve directe ou reste ouverte. La CI doit porter sur le SHA final ; un changement après son exécution réouvre les vérifications concernées. Les contrôles de format, de sémantique, d'exécution et les revues humaines gardent des résultats distincts. Les données de test sont synthétiques ; aucune réponse brute ou identité d'élève n'est introduite dans le référentiel, les fixtures ou les journaux.

La production est vérifiée sur le SHA déployé, pas sur un statut de PR : résolution exacte, correction/feedback S7, états/explications S8, transport/reprise/accès S9, publication et retour arrière S10 selon la série. Les formats antérieurs continuent à être lus ou migrés avec preuve, sans reconstruire de faits absents. L'historique, les données locales et les sources normatives sont conservés ; un retrait nécessite une PR cohérente et une vérification des consommateurs.

## État au relevé

S7-A proposé. S7-B à S10-C planifiés. Aucune série n'est déclarée livrée par la création du suivi, de ce plan ou de la norme proposée. Les politiques S8–S10 non adoptées restent explicitement ouvertes dans leurs pages source.

English summary: deliver and verify S7, then S8, S9 and S10. Each series has adoption, implementation and production evidence; S6 migration remains an explicit prerequisite for public S7 integration.
