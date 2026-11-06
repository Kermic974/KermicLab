---
id: poker-texas-holdem
titre: Poker Texas Hold'em
resume: Une table de Texas Hold'em contre l'ordinateur, avec des jetons fictifs et sans argent réel.
sujet: jeux/poker-texas-holdem
version: 1.1.0
date: 2026-11-05
langues: fr
onglets: explication, application, academie, mise-en-situation
mots-cles:
  - poker
  - poker texas holdem
  - texas hold em
  - texas hold'em
  - texas holdem
  - pocker texas hold them
  - jeu de poker
  - apprendre le poker
questions:
  - je veux jouer au poker
  - je veux jouer au texas hold'em
  - je veux jouer au pocker texas hold them
  - comment jouer au poker texas hold'em ?
  - quelles sont les combinaisons au poker ?
  - play texas hold'em
---

# Poker Texas Hold'em

Une table de Texas Hold’em à deux joueurs, contre l’ordinateur, avec des jetons fictifs et sans argent réel.

- **Règles** : les deux cartes privées, les cinq cartes communes, les quatre tours d’enchères et le classement des mains.
- **Jouer** : étapes de la manche, coût exact des actions (y compris les tapis), historique, conseil sans accès aux
  cartes adverses et bilan présentant les cinq meilleures cartes de chacun. Une nouvelle session est proposée
  explicitement si une pile ne permet plus les blindes.
- **Académie** : 3 grades et 6 leçons, QCM et comparaisons de mains vérifiées par le moteur, XP, étoiles, badges,
  objectif et défi du jour, révisions espacées. Les manches rapportent 40 XP pour une victoire, 10 pour une égalité
  et 5 pour une défaite, une seule fois par manche. Les compteurs de pratique ne dépendent pas de la mise.
- **Défis libres** : trois situations (full, égalité, carte de départage), sans récompense répétable. Le défi quotidien
  récompensé se trouve dans l’Académie.

Table pédagogique simplifiée : le joueur parle en premier et mise ou relance de 20 ; l’ordinateur suit ou se couche,
sans surrelancer. Ce n’est pas une simulation complète de tournoi. Aucun conseil ne garantit de gagner.

La progression utilise les modules partagés `gabarit/jeux/` et remonte dans « Mes trophées » via le pont local existant.
Les jetons et les cartes en cours ne sont pas sauvegardés ; les acquis pédagogiques sont conservés sans donnée personnelle.

English: Improved training table with explicit action costs, a hand history, visible-information-only coaching and
five-card showdown summaries. The shared Academy adds three grades, six lessons, XP, stars, badges, spaced review,
daily goals and dashboard trophies. Practice chips have no monetary value.

Le moteur est pur et testé dans `tests/unit/poker-texas-holdem.test.mjs` ; l’interface est vérifiée dans
`tests/e2e/poker-texas-holdem.test.mjs`.
