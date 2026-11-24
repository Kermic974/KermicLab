# Couverture S7 — preuves et reste à livrer

Contrat adopté par #428 ; lot S7-B en vérification. Les tests synthétiques ne sont pas une attestation de relecture humaine ou de déploiement. Les commandes finales et le SHA testé seront reportés dans la PR ; ce bilan décrit la portée des preuves, pas un succès anticipé de la CI.

| Exigence normative | Preuve de S7-B | Limite de livraison |
| --- | --- | --- |
| S7-01 — Structure et cycle | Neuf documents JSON Schema, propriétés fermées, tests schémas et histoire des définitions | Déploiement/publication non attestés |
| S7-02 — Références exactes | Tests d'intégrité et CLI sur dépôt Git temporaire ; expérience/unité et versions explicites ; archives résolues sans latest | Brancher les expériences publiques S6 en S7-C |
| S7-03 — Cibles | MicroSkill/Skill exactes et justifiées, Notion seulement contextuelle, doublons/versions inconnues refusés | Relecture des cibles réellement travaillées par les unités publiques |
| S7-04 — Skill directe/contributive | Justification directe, relation contributesTo épinglée et preuve MicroSkill ; aucun poids ou score propagé | Politique de maîtrise/agrégation reste S8 |
| S7-05 — Tentatives et ordre | Schémas et tests journal : rattachement, séquence, calendrier, critères et preuves | Ordre/remise effectifs du transport à qualifier en S7-C puis S9 |
| S7-06 — Retry et clôture | Copie non mutante, retry normalisé sans ajout, conflit refusé, soumissions et clôture bornées, décision humaine différée | Rechargement/session/interruptions réelles à qualifier |
| S7-07 — Absence/vide/partiel | États distincts et politique explicite ; pas de zéro implicite ni absence inférée sans trace | Collecte par les renderers et retours visibles à brancher |
| S7-08 — Méthodes | Correcteur déterministe, modes assisté/humain avec critères préparés, registre/SHA/version et tests de rejeu | Méthodes dynamiques des jeux/labs à qualifier sur leurs sources |
| S7-09 — Confirmation | Proposition distincte de la confirmation, preuve d'autorité exigée, origine cliente non promue en certification serveur | Autorités et accès réels à qualifier avant flux humain public |
| S7-10 — Score | Échelle/valeurs/seuils déclarés, score absent hors barème, bornes et finitude | Aucun score de maîtrise ou de Skill calculé |
| S7-11 — Aides | Schéma sans pénalité non déclarée ; tests du correcteur et score sans malus implicite | Émission et affichage des aides réelles à qualifier |
| S7-12 — Diagnostic | Motifs préparés et preuves du même critère, inconnu/ambigu visibles, aucune cause inventée | Pertinence pédagogique à relire ; pas de diagnostic IA autonome |
| S7-13 — Feedback/remédiation | Références réellement lisibles, ressource existante, absence facultative permise | Rendu/consommation réelle ne sont pas encore branchés |
| S7-14 — Révisions | Ajout lié, confirmation, révision/invalidation humaines, refus des branches concurrentes, anciens résultats intacts | Registre réel des actes humains à qualifier |
| S7-15 — Histoire | Git des définitions/sources, sections documentaires référencées, méthodes figées ; modification sans version refusée | Archives distribuées et clients à qualifier dans S9/S10 |
| S7-16 — Minimisation | Occurrences fermées sans réponse brute/compte/horodatage précis ; correction sans saisie dans sa sortie | Accès/rétention/effacement et persistance restent S8/S9 |
| S7-17 — Reproductibilité | Rejeu synthétique sous mêmes règles ; limite input-not-retained/human-judgment explicite et WARNING | Une trace réelle sans réponse conservée n'est pas déclarée rejouable |
| S7-18 — V0 | Invariant maintenu : ce lot ne transforme aucun agrégat ou stockage existant | Adaptation/mapping et preuves d'import sans invention requis en S7-C |
| S7-19 — Parité | Test parcourt tous les exercices JSON publics : réponses attendues et mauvaises réponses, fractions/tolérances et motifs | Parité renderer/feedback, entrées invalides et jeux/labs encore requise |
| S7-20 — Flux et corpus | Tests bibliothèque observation→soumission→correction→décision, plus CLI sur sources synthétiques réelles | Pilote, couverture publique, UI/clavier/mobile, build idempotent, revue et production requis en S7-C/D |

Les tests sont répartis entre `evaluations-schemas`, `evaluations-integrite`, `evaluations-journal`, `evaluations-correction` et `evaluations-validateur`. Le helper de preuves S5 contrôle que chaque fixture référencée pour un diagnostic a réellement produit la règle et sa sévérité. Les règles de minimisation/absence de malus sont aussi des propriétés positives/négatives du schéma et du correcteur, sans création artificielle d'un code d'erreur dédié.

Le validateur actuel peut retourner PASS avec zéro définition publique, tout en vérifiant le registre des méthodes. Ce résultat ne prouve ni la migration du corpus S6 ni la livraison S7. La clôture du suivi #427 exige ensuite S7 livré/vérifié, puis S8, S9 et S10, dans l'ordre demandé.

English summary: the table separates kernel/contract evidence from public integration, human review and production evidence still required. Empty-corpus PASS is not a delivery claim.
