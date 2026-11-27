# Audit préalable S7 → S8 → S9 → S10

Relevé du 24 novembre 2026, dépôt public à `0a12f6ac5269461ea7b93e3bc834be6235f9898a`. Les [36 pages Notion relevées](sources-notion-s7-s10.json) comprennent quatre index et 32 sous-pages. Leur statut est une proposition, pas une autorité déjà adoptée. Ce relevé contient uniquement de la documentation, sans données apprenant.

## Résultat de l'audit

S4/S5 et les contrats structurels/validateurs S6 sont présents. L'adoption des cibles et du périmètre S6 est fusionnée par [#426](https://github.com/Kermic974/KermicLab/pull/426). La migration S6 des expériences, le manifeste et l'export restent à livrer selon [#384](https://github.com/Kermic974/KermicLab/issues/384). Une définition d'évaluation S7 peut être préparée avec des fixtures synthétiques, mais sa qualification sur les expériences publiques exige ces artefacts S6 réels. Il ne faut pas déclarer S6 ou S7 livrés sur la seule réussite du validateur avec zéro expérience.

| Source réelle | Constat vérifiable | Traitement proposé | Preuve nécessaire avant livraison |
| --- | --- | --- | --- |
| `gabarit/moteur.js`, `scripts/lib/gabarit.mjs` | Correction QCM/nombre, aides et motifs d'erreur préparés ; validation de contenu séparée du comportement navigateur | adapt : extraire/réutiliser la correction déterministe sous version, sans seconde règle divergente | Parité des bonnes/mauvaises réponses, fractions, tolérances, aides et erreurs typiques |
| `gabarit/jeux/evenements.js` | Pont v1 : demarre/indice/reponse/termine ; booléen de correction et compteur d'essai ; pas de réponse brute, modèle S7 ou tentative stable | keep pour compatibilité ; adapter explicitement les nouveaux producteurs | Messages anciens inchangés, nouveaux contrats fermés, rejeu/doublon/interruption |
| `web/evenements.js` | L'agrégat par notion écrase la version vue ; réussite, indice et compteurs ne conservent ni chaque observation ni ses critères d'origine | keep comme état historique V0 ; ne pas reconstruire de fausses tentatives S7 | Import limité et marqué non reproductible ; mêmes données exportées avant/après |
| `web/evenements.js` (`maitriseNotion`) | Estimation par notion, avec révisions à 7/30/90 jours ; ne représente pas une maîtrise MicroSkill versionnée | adapt en S8 après adoption de sa politique ; conserver le sens V0 | Séparation V0/nouveau, preuves par cible, contradictions/absence, recalcul |
| `gabarit/jeux/progression.js` | Cartes Leitner à 1/2/4/8/16 jours et progression ludique | keep ; réconcilier les responsabilités S8 avant de changer la planification | Aucune double échéance concurrente, pause, date, priorité et charge |
| `web/recommandation.js` | Choix déterministe d'une prochaine notion : révision due puis prérequis acquis, matière/niveau/ordre catalogue | adapt après politique S8 ; pas de promotion en règle canonique implicite | Candidats, refus, motif, version et absence de boucle ; graphe inchangé |
| `web/fichier-progression.js`, `web/compte-local.js` | Import/export de progression et synchronisation du compte local existants | adapt : schéma borné et migration non destructive selon S8/S9 ; ne pas ouvrir de nouveau transport dans S7 | Aller-retour, ancien format, corruption, effacement, compte désactivé, aucun champ excessif |
| `worker/src/compte-local.js`, `worker/src/professeur-donnees.js`, `worker/src/famille-donnees.js` | Responsabilités d'accès et données existantes distinctes du référentiel | audit/adapt en S9, selon contrats S8 adoptés | Matrice acteur/opération/donnée, refus d'accès et minimisation |
| `scripts/build.mjs`, `scripts/check-experiences.mjs`, `scripts/check-artefacts.mjs` | Chaîne de génération et contrôles S4/S6/S5 ; absence de contrôles S7 spécifiques | adapt progressivement ; chaque nouvelle règle a une preuve positive et négative | Rapports liés au SHA testé, validation avant export, build reproductible |
| `.github/CODEOWNERS`, `AGENTS.md` | Propriétaire `@kermic974`, validation humaine et CI verte requises | keep ; ne pas en déduire la configuration distante des protections | Audit des rulesets/permissions avant de déclarer S10 conforme |
| `.github/workflows/ci.yml`, `.github/workflows/publication.yml` | Déclenchements/commandes et publication décrits par les fichiers ; un fichier ne prouve pas une exécution ni un déploiement | audit en S10, conserver les gates existantes | Exécution réelle, artefact distribué et SHA/source, vérification en production |

Ces constats ne qualifient pas de données « fiables côté serveur » les affirmations de correction d'une page cliente. Origine vérifiée du message et justesse pédagogique sont deux propriétés différentes. Une nouvelle authentification, une rétention légale ou une autorisation de collecte ne sont pas déduites de cet audit.

## Couverture documentaire et décisions encore nécessaires

| Série | Exigences des huit sous-pages | État et prochaine preuve |
| --- | --- | --- |
| S7.1–S7.8 | Modèle, tentative/observation, matrice de cibles, correction/score/diagnostic, erreurs/feedback/remédiation, MicroSkill/Skill, histoire et validation | [Contrat proposé](../referentiel/normes/S7-v1.0.0.md) ; adoption humaine puis schémas/moteur, fixtures et intégration réelle |
| S8.1–S8.8 | Catégories/finalités, journal, maîtrise, progression/agrégation, répétition, recommandation, recalcul, protection/rétention | Formule MicroSkill, règle Skill, calendrier, rétention et accès à fermer avec exemples avant validation ; aucune adoption par cette PR |
| S9.1–S9.8 | Responsabilités, résolution, rendu, événements, accès S8, messages/erreurs, compatibilité/cache/migrations et qualification | Audit détaillé des composants et contrats S7/S8 stabilisés nécessaires ; aucune nouvelle API supposée |
| S10.1–S10.8 | Contribution, rôles, revues, IA, gates, publication, rollback et décisions normatives | Vérifier règles de branche, approbations et exécutions réelles ; pas d'auto-approbation IA |

## Limites et dépendances

Le nouvel objectif utilisateur est livrer S7 puis S8 puis S9 puis S10. Le chantier S6 reste une dépendance technique et un suivi distinct, non une livraison acquise. Les adaptations S7 en mémoire et les schémas synthétiques ne nécessitent pas de recueillir des données d'élèves ; la qualification publique nécessite les définitions, ancres et correspondances S6. Tout changement de collecte ou de synchronisation doit être examiné dans les contrats responsables avant activation.

La proposition ne remplace pas les sources Notion. Elle en ferme les décisions S7 de façon révisable et conserve les questions S8–S10 chez leurs propriétaires. Toute divergence doit être résolue dans la PR d'adoption, sans marquer les pages originales validated.

English summary: the current runtime has topic-level aggregates, not replayable S7 attempts. Preserve legacy data and qualify new contracts against real S6 experiences before claiming delivery. S8–S10 remain dependent, unadopted proposals.
