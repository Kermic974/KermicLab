---
id: pendu
titre: Le pendu
resume: Trouve le mot secret lettre par lettre avant que le dessin ne soit terminé.
sujet: jeux/pendu
version: 1.1.0
date: 2026-11-05
langues: fr
onglets: explication, application, academie, orthographe, mise-en-situation
mots-cles:
  - pendu
  - jeu du pendu
  - jouer au pendu
  - apprendre le pendu
  - mots à deviner
  - hangman
  - liste de mots du pendu
questions:
  - je veux jouer au pendu
  - comment jouer au pendu ?
  - je veux apprendre à jouer au pendu
  - jeu du pendu du débutant au pro
  - play hangman
  - je veux tester ma liste de mots au pendu
---

# Le pendu

Trouve le mot secret lettre par lettre avant que le dessin ne soit terminé. Le jeu propose cinq grades, de Noob à Pro,
et une Académie avec des leçons pour apprendre à observer les indices, choisir de bonnes lettres et limiter les erreurs.

- **Jouer** : choisis une lettre au clavier ou à l’écran ; chaque mauvaise lettre ajoute une partie au dessin.
- **Progresser** : gagne une partie pour ouvrir le grade suivant, de Noob à Pro.
- **Académie** : révise les stratégies, gagne des étoiles et garde ta progression sur cet appareil.
- **Vocabulaire** : 100 mots uniques par niveau (500 au total), avec définitions et repères orthographiques.
  Les niveaux dépendent de la familiarité, des graphèmes et des pièges d’écriture, pas de la longueur.
  Par exemple, « pantalon » est Noob alors que « août », « œuf » et « paon » sont Pro.
- **Mes mots** : prépare une liste éditable de 1 à 100 mots (un par ligne, 40 caractères maximum), ou charge les
  100 mots d’un niveau. Enregistre ou efface la liste sur cet appareil. Le test montre un mot, puis le cache pour
  le faire écrire de mémoire ; il vérifie les accents et les ligatures, sans tenir compte de la casse.
  Un bilan présente les réponses et permet de refaire uniquement les mots à retravailler.

Le pendu accepte les lettres sans accent mais révèle la graphie accentuée, puis la définition et un repère de
mémorisation. Les ligatures sont développées pour le clavier (Œ → OE) ; l’orthographe originale reste visible
dans la correction. Un nouveau tirage évite de répéter immédiatement le dernier mot du niveau.

« Mes mots » est un entraînement de mémorisation, pas une dictée audio ou une évaluation normalisée. Les listes
personnalisées ne sont pas filtrées par un dictionnaire : l’adulte doit en vérifier l’orthographe et ne pas y mettre
de données personnelles. Seule la liste explicitement enregistrée persiste, pas les réponses ni le bilan.
Les listes ne sont pas transmises au tableau de trophées, à un serveur ou à un tiers. Un stockage indisponible
est signalé ; le jeu et les tests restent utilisables en mémoire.

Le moteur est pur et testé dans `tests/unit/pendu.test.mjs` ; l’interface est vérifiée dans
`tests/e2e/pendu.test.mjs`.
