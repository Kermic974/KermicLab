---
id: echecs
titre: Échecs
resume: Joue contre l'ordinateur, résous des énigmes et progresse de Noob à Pro avec l'Académie.
sujet: jeux/echecs
version: 1.1.0
date: 2026-11-04
langues: fr
onglets: explication, application, academie, mise-en-situation
mots-cles:
  - echecs
  - jeu d echecs
  - echiquier
  - roque
  - echec et mat
  - prise en passant
  - apprendre les echecs
  - strategie aux echecs
  - chess
questions:
  - je veux jouer aux échecs
  - comment bougent les pièces aux échecs ?
  - c'est quoi le roque ?
  - comment progresser aux échecs ?
  - play chess
---

# Échecs

Deuxième **jeu universel** de Kermiclab (issue #87), sur le modèle du Démineur (ADR 0013, guide `docs/jeux.md`) :
page écrite à la main, moteur pur dans `<script id="moteur-echecs">`, énigmes en données dans
`<script type="application/json" id="enigmes-echecs">`.

- **Règles** (onglet `explication`) : déplacement et valeur des pièces, roque, promotion, prise en passant,
  échec, mat, pat et nulles, commandes.
- **Jouer** (onglet `application`) : règles complètes (roque, prise en passant, promotion au choix, mat, pat,
  nulle par répétition, 50 coups ou matériel insuffisant), contre l'ordinateur (facile, moyen ; Blancs ou Noirs)
  ou à deux sur le même appareil, annulation du coup, échiquier retournable, coups en notation française, pièces prises.
- **Académie** (onglet `academie`, ADR 0014 et 0015, interface commune aux jeux) : didacticiel du débutant au pro en 6 grades (Pion → Roi) et 20 leçons
  (bases, mats, tactique, ouverture, milieu de partie, finales), avec stratégies à retenir, exercices vérifiés par le moteur,
  pièges expliqués, XP, niveaux, étoiles, badges, série, objectif du jour, révision espacée, défi du jour et conseils personnalisés.
- **Énigmes** (onglet `mise-en-situation`) : quatre mats en un coup (couloir, berger, roi et dame, mat étouffé).

Moteur validé par perft sur cinq positions de référence (`tests/unit/echecs.test.mjs`), parcours et gamification testés
(`tests/unit/echecs-academie.test.mjs`) ; interface testée dans
`tests/e2e/echecs.test.mjs`.

Relecture humaine : jouer une partie contre l'ordinateur et une à deux, sur ordinateur et sur téléphone ; résoudre les énigmes ;
relire chaque leçon de l'Académie (exactitude des explications : public mineur).
