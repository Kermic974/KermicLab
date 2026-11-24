# Contrats techniques S7 — lot S7-B

Application du contrat adopté S7 v1.0.0 / D7-1 à D7-8. Les [schémas](../../evaluations/schemas/) sont la forme exécutable ; ce document explicite leurs responsabilités et limites. Les seuils/mesures de maîtrise, la rétention, l'identité de compte, la session et le transport ne sont pas décidés ici.

## Définition d'évaluation

`evaluation.<domaine>.<slug>` possède une version entière positive et le cycle S4.2. Elle référence une seule expérience S6 exacte. Une composition peut fournir plusieurs unités évaluées, à condition qu'elles soient atteignables dans la composition exacte de cette expérience, sans prendre un exercice voisin à sa place. La source préparée reste en S6.

Chaque critère a un ID local stable, une unité S6 exacte, une méthode/version/mode, les genres d'observations admis et des bindings de cibles S4 exactes. Une MicroSkill est directe ; une Skill directe demande une justification. Une Skill contributive référence aussi par `via` l'identité/version de la relation contributesTo et possède au moins une MicroSkill directe source. Aucun poids ou score de Skill n'est généré par ce lien. Les Notions sont réservées à `contextTargets`, sans confusion avec une cible évaluée.

Une méthode déterministe doit correspondre au format préparé QCM/nombre de l'exercice. Une méthode humaine/assistée a une `rubric` explicite vers la réponse attendue ou les critères préparés de l'unité ; un paragraphe explicatif seul ne devient pas un barème humain. Le lecteur vérifie une tâche préparée complète ou une liste non vide de critères. L'absence de telles règles bloque le modèle.

Le feedback fourni référence une source S6 existante, même s'il est facultatif. Une remédiation référence une expérience/révision disponible ; sa proposition ne prouve pas qu'elle a été suivie. Revue humaine et provenance sont documentaires et versionnées ; l'agent ne remplit pas une attestation réelle.

Le barème est facultatif. S'il est déclaré, `min < max`, les valeurs et seuils sont finis et dans l'échelle. `outcome-values` associe explicitement succès/échec et éventuellement partiel à des valeurs préparées ; `human` accepte un score humain dans les bornes et n'est pas une méthode automatique. L'arrondi `none` conserve les valeurs déclarées sans conversion implicite. Les seuils nommés servent à interpréter l'échelle, sans redéfinir l'issue de correction. Absence et indétermination n'ont aucun score ; une aide n'a pas de malus implicite.

`replacedBy` est optionnel, réservé à une définition deprecated et doit référencer une autre définition existante non dépréciée. Les versions anciennes restent dans Git ; l'identité n'est pas réutilisée après retrait.

## Occurrences et ordre

| Contrat | Données nécessaires et effet |
| --- | --- |
| attempt | ID opaque `attempt.` suivi de 32 caractères hexadécimaux, définition et expérience exactes, jour d'ouverture, origine local-session/synthetic/legacy-import. Aucun compte ou profil |
| observation | ID opaque, rattachement à la tentative, séquence, jour, critère, genre et origine ; answer porte un état provided/empty/partial/absent, help porte un rang 1–10 ; aucun texte saisi |
| submission | ID opaque, tentative, séquence/jour et liste ordonnée d'observations antérieures ; au plus une réponse par critère dans cette soumission |
| closure | ID opaque, séquence/jour et motif completed/abandoned ; completed exige une soumission. La clôture termine l'activité, sans interdire une décision humaine différée |
| decision | Soumission/critère et preuves, définition/expérience/méthode exactes, état, issue, diagnostic, producteur, motif et limite de rejeu ; score seulement selon barème ; revue humaine séparée et référencée |
| journal | Version de format 1, tentative et événements ordonnés. C'est une entrée/sortie en mémoire ; ce module n'écrit aucun stockage |

La séquence vaut 1, 2, … dans l'ordre d'occurrence, sans réordonner les événements par date ou arrivée réseau. Le jour doit être une date calendaire réelle, au moins celui d'ouverture ; aucune horloge précise n'est ajoutée. La politique qui fournit le jour à l'application relève de S9, pas du fuseau de l'hôte de test. Un retry d'événement déjà normalisé avec même ID/contenu est sans effet ; un contenu divergent est refusé. Un événement historique ne figure pas deux fois dans le journal. Une réponse déjà soumise n'est pas recyclée en nouvelle réponse ; les aides peuvent rester du contexte.

`allowPartial` et `maxSubmissions` sont déclarés par le modèle. Une soumission interdite/incomplète est refusée, sans transformer une case vide en zéro. Plusieurs réponses au même critère dans une soumission sont ambiguës et refusées ; des étapes distinctes demandent des critères distincts. Une nouvelle tentative est une nouvelle occurrence, pas une remise à zéro destructrice du journal précédent.

Les limites structurelles sont des garde-fous d'entrée : 100 critères, 30 bindings/cibles de contexte, 99 soumissions au plus, 1 000 références d'observations et 10 000 événements par journal, séquence au plus un million. Un dépassement produit une erreur explicite ; il ne purge pas l'historique. Les IDs d'occurrence sont générés par l'appelant, sans nom personnel ; leur génération, échange et persistance seront qualifiés en S9.

## Correction et décisions

`corrigerCritere` consomme la réponse uniquement pendant son appel. QCM accepte un index déclaré ; nombre prend décimaux à point/virgule et fractions. Fraction non réduite, tolérance et motifs préparés sont distingués. Une syntaxe impossible ou un nombre non fini reste indéterminé ; ce point doit aussi être traité par le renderer lors de l'intégration. Le résultat ne retourne ni saisie, ni texte de solution, ni score implicite.

`evaluerCritereSoumis` demande les règles préparées au lecteur du contexte, vérifie l'observation effectivement soumise, puis ajoute seulement la décision qualifiée. Il ne déduit pas une absence de réponse d'une absence de trace. `ajouterEvenementEvaluation` impose un validateur structurel, valide aussi le journal initial, refuse les conflits et retourne une copie. L'API de retry porte sur l'événement normalisé, pas sur une nouvelle saisie brute réinterprétée sous le même ID.

Un correcteur déterministe local peut confirmer sur ses observations locales. Une affirmation cliente seule reste proposée. Un moteur assisté reste proposé jusqu'à confirmation par un humain habilité. La décision humaine indique `actorRef`, `reviewMethod` human-review v1, jour et motif ; le callback d'autorité est obligatoire pour l'accepter. Il reçoit l'identité de décision et son jour afin de vérifier l'habilitation historique de cet acte, pas seulement les droits courants d'un acteur. Ce callback n'est ni une authentification ni un nouveau rôle implicite : les registres/accès réels restent à qualifier en S9/S10.

Une révision ou invalidation ajoute une décision avec `supersedes` vers la décision courante du même critère/soumission. Deux branches concurrentes sont refusées. Une confirmation peut suivre une proposition ; une révision ou invalidation demande un humain habilité et le motif correspondant. L'invalidation est terminale pour cette chaîne de décisions ; elle ne réécrit ni n'efface ses prédécesseurs. Une nouvelle définition peut être utilisée pour une réévaluation explicitement révisée, avec la même expérience historique et des références résolues ; l'invalidation de cette réévaluation cite la même définition que son prédécesseur.

Le diagnostic est indéterminé sans motif établi, matched pour un motif, ambiguous pour plusieurs. Les motifs doivent être déclarés dans la source préparée et avoir des preuves du critère concerné ; aucun départage causal n'est inventé. Les clés de choix/motifs héritées sans ancre sont locales à la révision exacte de la source, pas des identités canoniques interversions. La migration S6 doit fournir ses ancres persistantes.

## Reproduction et histoire des méthodes

Un rejeu synthétique exige une entrée contrôlée fournie hors du journal et vérifie issue, motif et diagnostic. Sans cette entrée, le registre ne prétend pas reproduire le résultat. Une trace réelle porte input-not-retained, un jugement humain human-judgment ; leur limite de reproduction produit WARNING, sans invalider automatiquement un fait auditable. Une saisie non conservée n'est jamais recréée à partir de compteurs V0.

Le registre des méthodes conserve identité/version/mode, chemin d'implémentation, empreinte LF et statut supported/deprecated. Le contrôle compare source et empreinte, puis les états Git ; modifier code, mode, chemin ou SHA sous le même ID/version est une erreur. Une méthode ancienne reste disponible pour audit, sans nouvelle exécution implicite en cas de dépréciation. Les consommateurs actuels importent directement le module v1 figé ; un futur dispatch doit conserver cette liaison pour les anciennes versions.

L'histoire Git porte uniquement sur définitions publiques, méthodes et sources pédagogiques. Un journal apprenant ne va ni dans Git ni dans le Knowledge Core. Le validateur résout les références historiques exactes si nécessaires, sans prendre une version future pour valider un ancien état. Toute modification de définition ou d'empreinte de source exige une version supérieure.

## Preuves et critères encore ouverts

Les tests couvrent les schémas fermés, les références/cibles, les méthodes et scores, les observations/soumissions, les confirmations et révisions, la minimisation et le CLI réel en dépôt temporaire. Chaque diagnostic S7 enregistré dans RULE_CATALOG a une preuve exécutée et une sévérité contrôlée. Les règles documentaires S7-11 et S7-16 sont aussi couvertes par fermeture des schémas et propriétés du correcteur, sans inventer un diagnostic dédié.

La vérification de toutes les réponses préparées JSON couvre le correcteur, pas encore le renderer, le pont, les jeux/labs dynamiques ou le flux public S6→S7. S7-18 (agrégats historiques), la parité complète S7-19 et l'intégration S7-20 restent à qualifier en S7-C/D. Aucun nouveau modèle de maîtrise S8, stockage, transport ou publication n'est introduit par cette bibliothèque.

English summary: exact versioned references, closed occurrence schemas, in-memory correction and append-only decisions. Human confirmation, honest replay limits and frozen method implementations are explicit. Public integration and production qualification remain separate deliverables.
