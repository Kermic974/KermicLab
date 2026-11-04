---
id: demineur
titre: Démineur
sujet: jeux/demineur
version: 1.0.0
date: 2026-11-04
langues: fr
onglets: explication, application, mise-en-situation
mots-cles:
  - demineur
  - jeu du demineur
  - minesweeper
questions:
  - je veux jouer au démineur
  - c'est quoi le démineur ?
  - comment on joue au démineur ?
  - play minesweeper
---

# Démineur

Premier **jeu universel** de Kermiclab (issue #85). Page écrite à la main (pas de `contenu.json` :
le gabarit des notions ne couvre pas un jeu), conforme au contrat d'une page autonome (AGENTS.md §5).
Guide pour les jeux suivants : `docs/jeux.md` ; décision : ADR 0013.

- **Règles** (onglet `explication`) : le but, les chiffres, la case vide, les drapeaux, comment gagner, les commandes.
- **Jouer** (onglet `application`) : Débutant 9 × 9 (10 mines), Intermédiaire 16 × 16 (40 mines),
  Expert 30 × 16 (99 mines). Premier coup toujours sûr (ni mine sur la case ni autour, quand la grille le permet).
- **Énigmes** (onglet `mise-en-situation`) : quatre petites grilles à résoudre par déduction.

Moteur pur (`<script id="moteur-demineur">`, sans DOM, hasard injectable) testé dans
`tests/unit/demineur.test.mjs` ; interface testée dans `tests/e2e/demineur.test.mjs`.

Relecture humaine : jouer une partie par niveau sur ordinateur et sur téléphone, et résoudre les énigmes.
