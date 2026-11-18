# Jeux : inventaire, contrats et suivi

[English](jeux-suivi.md) · [ADR proposé 0033](decisions/0033-suivi-jeux.md) · [Ajouter un jeu](jeux.md).

## Lots et couverture

| Lot | Livraison | Vérification |
|---|---|---|
| 1 | Neuf fiches ci-dessous, classification exposée au catalogue, cibles distinctes des liens historiques | Tests registre, projection canonique et catalogue |
| 2 | Pont v2, journal local borné, déduplication, reprise/abandon, validation des bilans | Tests purs et pont en contexte isolé |
| 3 | Académies Échecs, Démineur, Belote, Mots fléchés, Pendu, Poker ; compteurs « Mes mots » | Tests Académies, moteurs et confidentialité |
| 4 | Adaptateurs 2048, Sudoku, Mots croisés ; filtre par famille | Parcours clavier/tactile et tests de suivi |
| 5 | Progression, détails par activité, bilans Famille/Professeur filtrés | Tests bilan, permissions et navigateur |

L'implémentation est une proposition applicative, pas une validation normative S6–S9. Aucun marqueur de relecture humaine n'est renseigné par un agent. Les neuf pages gardent leurs moteurs purs, leurs tests, leur CSP et le fonctionnement autonome. La difficulté correspond aux grades éditoriaux propres à chaque jeu ; elle n'est ni un niveau scolaire ni une maîtrise.

## Les neuf jeux

| Jeu | Famille / intention | Interaction / restitution | Réussite mesurée | Limites et cible |
|---|---|---|---|---|
| 2048 | Nombres / mobiliser | Fusion / tuile cible | Atteindre la tuile du grade ; impasse avant cible = échec | Autonomie non mesurée. Cible explicite : puissances de deux, référence `notion.mathematiques.puissances` ; pas de diagnostic scolaire |
| Démineur | Logique / pratiquer | Grille / partie | Cases sûres ouvertes ; mine = échec ; exercices jugés par le solveur | Les essais libres ne prouvent pas une compétence de probabilités. Cible canonique à qualifier |
| Échecs | Stratégie / pratiquer | Déplacement / partie | Résultat contre ordinateur et exercices de l'Académie | Partie à deux : résultat neutre ; nul exclu des réussites évaluables. Cible à qualifier |
| Belote | Cartes / pratiquer | Choix / partie | Partie gagnée/perdue ; exercices de pli/enchère corrigés | Conseil compté comme aide, montants/enchères jamais des points scolaires. Cible à qualifier |
| Mots fléchés | Langage / consolider | Saisie / grille | Grille entièrement résolue, exercices de l'Académie | Erreurs observées lors des vérifications, pas à chaque frappe ; indice compté. Cible à qualifier |
| Mots croisés | Langage / consolider | Saisie / grille | Grille de l'étape résolue | Aucun faux résultat d'Académie ; erreurs lors des vérifications, indice compté. Vocabulaire mathématique ≠ maîtrise de la notion. Cible à qualifier |
| Pendu | Langage / consolider | Saisie / mot | Mot trouvé/perdu ; exercices de l'Académie | Lettres erronées et indices observés. Cible canonique à qualifier |
| Poker Texas Hold'em | Cartes / pratiquer | Choix / manche | Victoire/défaite/égalité et comparaisons de mains corrigées | Égalité neutre ; jetons et mises exclus des KPI pédagogiques. Cible à qualifier |
| Sudoku | Logique / pratiquer | Saisie / grille | Grille entièrement résolue | Conflits et vérifications erronées observés ; aides révélées comptées. Cible à qualifier |

Chaque page est une manipulation dans la classification principale ; elle peut contenir des leçons (`activite-guidee`), révisions et défis (`exercice`). Règles/contenus explicatifs et interactions restent des axes séparés. Aucun jeu n'est automatiquement converti en Lab. La définition éditoriale ne contient aucune tentative, score obtenu ou session.

### Cas particulier : « Mes mots »

Une tentative représente une session d'orthographe ; chaque correction fournit un booléen. La session réussit si tous les mots sont justes, sinon elle se termine en échec ; une nouvelle révision constitue une autre tentative. Le journal porte uniquement `mes-mots`, jamais les mots, définitions, saisies ou listes personnelles. L'éditeur et ses données locales restent indépendants.

## Lire les KPI

Le détail local affiche les tentatives par activité et mode. Les tuteurs reçoivent uniquement des agrégats par jeu, pour la dernière version pratiquée. La fenêtre est limitée aux **64 dernières tentatives** du jeu ; les jours actifs couvrent sept jours dans cette fenêtre. Les anciennes étoiles et acquisitions sont préservées, sans reconstituer d'anciennes tentatives.

- Engagement : commencées, en cours, abandons, jours actifs ; temps actif cumulé mesuré par le moteur existant, avec arrêt en cas d'inactivité.
- Complétion : terminées / commencées ; réussite : réussies / terminées évaluables.
- Autonomie : sans erreur ni aide parmi les réussites observables ; absence de mesure indiquée explicitement.
- Consolidation : révisions réussies / réalisées ; progression : leçons ou grades acquis / total lorsque l'adaptateur fournit réellement ces nombres.
- Points propres aux jeux, XP globaux et maîtrise scolaire restent séparés. Les comptes sont déclarés par l'appareil, sans certification serveur.

## Partage et accès

Famille : tous les jeux d'un enfant rattaché, avec la date du bilan. Professeur : seulement les jeux ayant une cible explicite résolue dans ses matières ; dans cette livraison, 2048 pour un professeur de mathématiques lorsque la notion Puissances est publiée. Les autres jeux restent au parent jusqu'à qualification de leurs cibles. Un jeu sans mesure n'est pas affiché comme un échec.

Pas de nouveau destinataire, rôle, notification ni export externe. Les bilans facultatifs passent par les validations serveur existantes ; ils sont remplacés lors de la synchronisation et effacés avec les rattachements. Consulter les écrans ne crée pas de résultat. Hors du tableau de bord, le jeu reste autonome et ne transmet aucun événement.

## Relecture et tests

Chaque moteur garde `tests/unit/<id>.test.mjs` ; chaque page garde `tests/e2e/<id>.test.mjs`. Le contrat commun et les scénarios de confidentialité sont dans `tests/unit/suivi-jeux.test.mjs`, le pont réel et les KPI dans `tests/e2e/suivi-jeux.test.mjs`. Exécuter `npm run ci` avant revue. La relecture adulte téléphone/ordinateur et l'acceptation de l'ADR restent à consigner dans `actions-manuelles.md`.
