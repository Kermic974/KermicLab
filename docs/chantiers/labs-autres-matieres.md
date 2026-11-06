# Plan des labs interactifs — autres matières

Cette feuille complète le [plan des labs de mathématiques](catalogue-maths.md) pour les matières
scolaires restantes. Le catalogue contient déjà des pages d'explication progressive, des exercices
corrigés et des défis ; l'inventaire des figures dédiées montre que la physique-chimie est la seule
autre matière avec des figures interactives, et qu'elles se limitent actuellement à deux graphiques
de proportionnalité.

Les pages restent des HTML autonomes du gabarit commun, avec les onglets explication, application
et défi. Un lab doit rendre une relation ou une démarche visible et manipulable, sans remplacer le
raisonnement par une animation décorative. On ajoute un composant partagé seulement quand plusieurs
notions en ont réellement besoin.

## État du catalogue

| Matière | Fiches cataloguées | Figures interactives dédiées | Observation |
|---|---:|---|---|
| Physique-chimie | 23 | `electricite` et `forces-et-poids` utilisent la figure générique de proportionnalité. | Pas encore de schéma de circuit ni de représentation temporelle du mouvement. |
| SVT | 31 | Aucune | Les mécanismes cellulaires, génétiques, écologiques et géologiques sont expliqués et exercés, sans modèle manipulable dédié. |
| Géographie | 17 | Aucune | Les études de territoires et d'échelles gagneraient à associer cartes schématiques et données. |
| Histoire | 16 | Aucune | Les repères et études de sources sont traités sans frise ni carte manipulable. |
| Français | 10 | Aucune | Les accords, la grammaire et l'analyse littéraire reposent surtout sur des QCM. |
| Philosophie | 17 | Aucune | Les notions et arguments sont présentés progressivement ; les questions ouvertes ne doivent pas être réduites à un corrigé unique. |
| SES | 10 | Aucune | Les mécanismes économiques et sociaux sont expliqués avec exemples, sans simulation de modèle ou de données. |
| EMC | 12 | Aucune | Les cas pratiques existent ; un parcours de décision peut rendre visibles droits, règles et conséquences. |

**Point de cohérence SVT :** le chantier [catalogue-svt.md](catalogue-svt.md) liste 23 notions,
alors que les fiches du catalogue couvrent 31 identifiants. Les huit fiches qui ne figurent pas dans
ses tableaux sont `biodiversite`, `cellule`, `ecosystemes`, `evolution`, `genetique-adn`,
`nutrition-digestion`, `tectonique-plaques` et `volcanisme`. Réconcilier ces variantes avec les
notions déjà listées avant d'ajouter un contenu ou une figure ; ne pas créer de doublon pédagogique.

## Labs proposés

| Priorité | Matière et pages existantes | Lab à concevoir | Ce que l'élève peut explorer | Garde-fous |
|---|---|---|---|---|
| 1 | Physique-chimie — `electricite` | Schéma de circuit en basse tension, avec composants déplaçables ou activables. | Ouvrir ou fermer un circuit, choisir série ou dérivation, puis observer les mesures cohérentes de U et I. | Simulation seulement, aucune consigne de branchement secteur ou de court-circuit réel ; calculs testés et unités toujours visibles. |
| 2 | SVT — `la-cellule` / `cellule` (après réconciliation) | Cellule schématique à couches informatives. | Sélectionner des organites, comparer cellule végétale, animale et procaryote, relier structure et fonction. | Dessin conventionnel explicitement schématique, échelles et exceptions précisées ; pas de fausse précision visuelle. |
| 3 | Histoire — ensemble des notions | Frise chronologique manipulable. | Trier des repères, zoomer entre périodes et relier un événement à une conséquence documentée. | Dates et formulations sourcées dans les données du lab ; distinguer repère conventionnel, processus long et débat d'interprétation. |
| 4 | Français — `accords`, `grammaire-phrase-complexe`, `conjugaison-temps` | Constructeur de phrase et repérage des relations grammaticales. | Sélectionner donneur d'accord, sujet, auxiliaire ou COD ; observer les formes possibles et la justification. | Plusieurs analyses peuvent être valides selon le contexte ; explication explicite plutôt qu'une simple couleur ou sanction. |
| 5 | Physique-chimie — `mouvements`, puis `lois-de-newton` | Chronophotographie et vecteurs vitesse/force. | Déplacer des positions ou changer l'intervalle de temps ; comparer mouvement uniforme et accéléré, puis relier variation de vitesse et force résultante. | Référentiel et unités affichés ; ne pas confondre espacement des positions et vitesse si les intervalles changent. |
| 6 | Géographie — `urbanisation`, `metropolisation`, `risques-naturels` | Carte schématique à couches et choix d'aménagement. | Activer habitat, transports, relief ou aléas ; comparer des scénarios fictifs à plusieurs échelles. | Légende, échelle et date des données visibles ; territoires fictifs ou données autorisées, sans adresse ou localisation d'élève. |
| 7 | SES — `marche-concurrentiel`, `croissance-economique`, `inegalites` | Graphique de modèle réglable et distribution de données fictives. | Faire varier offre ou demande, ou modifier une distribution et observer les indicateurs associés. | Séparer résultat du modèle et réalité observée ; expliquer hypothèses, limites, corrélation et causalité ; pas de données personnelles. |
| 8 | SVT — `ecosystemes-et-biodiversite`, `agrosystemes-et-sols` | Réseau trophique et perturbations d'un écosystème simplifié. | Modifier une population ou un facteur environnemental et suivre les effets dans le réseau. | Montrer les dépendances sans prétendre prédire exactement un écosystème réel ; hypothèses et temporalité explicites. |
| 9 | EMC — `democratie`, `droits-de-lhomme`, `etat-de-droit` | Cas civique à embranchements avec règles et droits concernés. | Examiner plusieurs décisions, leurs conséquences et les garanties applicables. | Présentation pluraliste et non partisane ; l'outil vérifie des faits et des règles, jamais les opinions ou convictions de l'élève. |
| 10 | Histoire — `antiquite`, `monde-depuis-1990`, `construction-europeenne` | Carte historique à dates et couches. | Comparer des territoires, frontières ou réseaux à deux dates et relier la carte à une frise. | Ne pas projeter les frontières contemporaines sur le passé ; légende et date de chaque carte indispensables. |
| 11 | Philosophie — `justice-philosophie`, `raison`, `science` et notions voisines | Carte d'argumentation et contre-exemple. | Relier thèse, raison, objection et réponse ; tester si un exemple soutient réellement une proposition. | Ne pas noter la position personnelle ni réduire un débat à une « bonne opinion » ; feedback sur la cohérence du raisonnement. |
| 12 | Français — `analyse-texte`, `poesie`, `figures-de-style` | Atelier d'annotation d'un texte. | Marquer procédés, rythme, point de vue et indices, puis confronter plusieurs lectures possibles. | Utiliser des textes du domaine public ou autorisés ; distinguer observation textuelle et interprétation argumentée. |

Les lots 1 à 4 constituent les premiers prototypes : ils couvrent quatre matières et mettent à
l'épreuve des interactions très différentes. Les lots suivants ne démarrent qu'après leur revue
pédagogique et technique ; les idées d'un même domaine peuvent être regroupées si cela évite la
duplication de composants.

Le découpage en pull requests (ordre, dépendances, critères d'acceptation) est dans
[le plan des PR des labs](../plan-pr-labs.md).

## Critères communs et déroulement

Pour chaque lot :

1. Partir d'une fiche existante et définir l'état manipulable, les règles du modèle et les cas limites
   avant de coder. Conserver les exercices et les niveaux déjà utiles.
2. Ajouter la figure dans `gabarit/figures/<type>.js`, sa validation dans `scripts/lib/figures/<type>.mjs`, son
   format dans `docs/gabarit.md`, puis l'intégrer à `contenu.json`.
3. Tester le calcul ou les transitions d'état dans les tests unitaires adaptés et vérifier le rendu,
   les interactions et les réponses dans `tests/e2e/notions.test.mjs`.
4. Vérifier clavier, tactile, mobile, focus, annonces accessibles, unités, légendes et mode hors
   ligne. Une figure doit rester compréhensible sans s'appuyer uniquement sur la couleur.
5. Garder les données locales et fictives lorsque possible ; aucune collecte de données
   personnelles, aucun réseau requis. Relire le contenu et l'exactitude avec une personne compétente
   avant fusion.

Le gabarit est commun, mais les critères de réussite varient selon la discipline : résultats
calculables pour les modèles physiques et économiques, repères factuels vérifiables en histoire et
géographie, justifications grammaticales en français, et qualité des raisons plutôt que position
choisie en philosophie et en EMC.

Les jeux ne font pas partie de cette feuille : ils ont leurs propres moteurs, parcours et critères
dans [le guide des jeux](../jeux.md) et [la gamification](../gamification.md).
