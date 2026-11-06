---
id: demineur
titre: Démineur
resume: Révèle toutes les cases sans mine en lisant les chiffres, de la petite grille à la grille experte.
sujet: jeux/demineur
version: 1.1.0
date: 2026-11-04
langues: fr
onglets: explication, application, academie, mise-en-situation
mots-cles:
  - demineur
  - jeu du demineur
  - minesweeper
  - progresser au demineur
questions:
  - je veux jouer au démineur
  - c'est quoi le démineur ?
  - comment on joue au démineur ?
  - comment progresser au démineur ?
  - play minesweeper
---

# Démineur

Premier **jeu universel** de Kermiclab (issue #85). Page écrite à la main (pas de `contenu.json` :
le gabarit des notions ne couvre pas un jeu), conforme au contrat d'une page autonome (AGENTS.md §5).
Guide pour les jeux suivants : `docs/jeux.md` ; décision : ADR 0013.

- **Règles** (onglet `explication`) : le but, les chiffres, la case vide, les drapeaux, comment gagner, les commandes.
- **Jouer** (onglet `application`) : Débutant 9 × 9 (10 mines), Intermédiaire 16 × 16 (40 mines),
  Expert 30 × 16 (99 mines). Premier coup toujours sûr (ni mine sur la case ni autour, quand la grille le permet).
- **Académie** (onglet `academie`, ADR 0014 et 0015) : du débutant au pro en 5 grades (Apprenti → Expert) et 15 leçons
  (bases, déductions, motifs 1-1 / 1-2-1 / 1-2-2-1, méthode, jeu d'expert). Les exercices sur grille sont des positions
  réalistes (une disposition de mines, puis les cases ouvertes comme en vraie partie) et chaque geste est jugé par le
  solveur du moteur : seules les certitudes sont acceptées. Progression commune aux jeux (XP, grades, badges, révisions…).
- **Indice** (onglet `application`) : le solveur montre une case sûre ou une mine certaine, sans jouer à la place du joueur.
- **Énigmes** (onglet `mise-en-situation`) : quatre petites grilles à résoudre par déduction.

Moteur pur (`<script id="moteur-demineur">`, sans DOM, hasard injectable) testé dans
`tests/unit/demineur.test.mjs` ; interface testée dans `tests/e2e/demineur.test.mjs`.

Relecture humaine : jouer une partie par niveau sur ordinateur et sur téléphone, et résoudre les énigmes.
