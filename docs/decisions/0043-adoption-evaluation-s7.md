# ADR 0043 — Proposition d'adoption du contrat d'évaluation S7

- Date : 2026-11-24.
- Statut : **proposé** ; aucune validation pédagogique ou humaine n'est attestée par sa rédaction.
- Contrat : [S7 v1.0.0](../referentiel/normes/S7-v1.0.0.md).
- Sources : [Notion S7](https://app.notion.com/p/41a0c40cec288152964dd5ab41c7c0de), [relevé](../evaluation/sources-notion-s7-s10.json), [audit](../evaluation/audit-s7-s10.md).

## Contexte et autorité

Les huit pages S7 sont préparatoires et laissent ouverts identité, critères, soumissions, correction, score et conservation. Le pont v1 ne conserve pas les informations nécessaires pour en déduire de vraies tentatives. Le propriétaire adopte explicitement la présente proposition et sa norme par la revue/fusion de la PR correspondante. Un test vert ne prend pas cette décision et n'atteste aucune revue de contenu.

## Décisions soumises à adoption

| Décision | Proposition concrète | Alternative écartée et impact |
| --- | --- | --- |
| D7-1 — Autorités | Définition d'évaluation indépendante et versionnée, liée à l'identité/révision exacte d'une expérience S6 ; S7 porte les résultats locaux, S8 seul porte la maîtrise durable | Réutiliser un score de jeu ou une relation contributesTo comme maîtrise serait une confusion d'autorité |
| D7-2 — Tentative | Occurrence d'une unité évaluée ; observations ordonnées et soumissions distinctes ; retry technique idempotent ; reprise technique sur la même tentative, recommencer explicitement crée une nouvelle tentative | Ne pas assimiler chaque clic ni chaque livraison réseau à une tentative |
| D7-3 — Cibles | Critères vers MicroSkill ou Skill explicitement évaluée, exactes et justifiées ; Notion seulement contexte ; aucune propagation de score via le graphe | Pas d'attribution automatique de toutes les cibles disponibles à chaque exercice |
| D7-4 — Correction | Modes déterministe, assisté et humain ; pas de résultat final assisté avant confirmation ; réponse absente/vide/partielle/abandon explicités ; aucune formule universelle de score | Absence n'est pas zéro ; aides sans pénalité implicite ; pas de pseudo-diagnostic sans indice |
| D7-5 — Limitation des données | Entrée de réponse en mémoire seulement ; pas de réponse brute, texte libre, identité de compte ou horodatage précis dans les enregistrements S7 et fixtures ; date au jour, ordre explicite | Un rejeu réel sans réponse conservée n'est pas promis. La limite de reproductibilité doit être visible et la correction vérifiée sur fixtures synthétiques |
| D7-6 — Provenance et confiance | Conserver version du modèle, méthode, critères, expérience et cibles, source des faits, mode local/client/humain ; toute révision ajoute une décision liée, sans écrasement | Un événement client ne devient pas une correction certifiée serveur. Les résultats historiques V0 incomplets ne sont pas enrichis par invention |
| D7-7 — Feedback | Motifs préparés versionnés, observation source explicite, zéro/une/plusieurs correspondances déclarées ; feedback et remédiation référencés en S6, jamais réputés consommés | Une réponse incorrecte seule ne démontre pas une cause d'erreur ; une suggestion n'est pas une observation |
| D7-8 — Livraison | Schémas fermés, validateurs/histoire/rapports S5, fixtures synthétiques, parité avec les corrections réelles puis branchement public compatible ; gates humains distincts des gates techniques | Ni zéro objet valide ni une bibliothèque isolée ne valent livraison S7. S8, S9 et S10 sont livrés ensuite, chacun avec sa propre adoption |

## Conséquences et réexamen

Aucune modification de données apprenant, stockage, transport ou navigation dans cette PR d'adoption. Le contrat technique détaillé sera soumis avec les schémas après adoption ; il doit satisfaire toutes les règles de la norme, sans ajouter de collecte. La qualification S7 sur corpus réel est liée à la migration S6 (#384). Un besoin de réponse persistée, d'horaire précis, d'agrégation de maîtrise, de nouvelle identité ou de nouvelle synchronisation réouvre l'autorité S8/S9 et cette décision avant activation.

S8 devra fermer ses propres politiques avec exemples reproductibles ; S9 devra auditer les responsabilités réelles et qualifier l'exécution ; S10 devra vérifier les protections et mécanismes de publication effectifs. Le présent ADR ne les adopte pas à l'avance.

Retour arrière : retirer la proposition avant adoption ; après implémentation, désactiver le nouveau branchement par PR cohérente sans effacer le pont v1 ni les faits historiques. Aucune fusion automatique.

English summary: proposed S7 authority, attempt semantics, explicit targets, correction modes, minimised data and honest replay limits. Human adoption is required; this ADR does not adopt S8–S10 or attest S7 delivery.
