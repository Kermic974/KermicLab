---
id: echecs
titre: Échecs
sujet: jeux/echecs
version: 1.0.0
date: 2026-11-04
langues: fr
onglets: explication, application, mise-en-situation
mots-cles:
  - echecs
  - jeu d echecs
  - echiquier
  - roque
  - echec et mat
  - prise en passant
  - chess
questions:
  - je veux jouer aux échecs
  - comment bougent les pièces aux échecs ?
  - c'est quoi le roque ?
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
- **Énigmes** (onglet `mise-en-situation`) : quatre mats en un coup (couloir, berger, roi et dame, mat étouffé).

Moteur validé par perft sur cinq positions de référence (`tests/unit/echecs.test.mjs`) ; interface testée dans
`tests/e2e/echecs.test.mjs`.

Relecture humaine : jouer une partie contre l'ordinateur et une à deux, sur ordinateur et sur téléphone ; résoudre les énigmes.
