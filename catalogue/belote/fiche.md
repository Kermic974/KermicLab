---
id: belote
titre: Belote
sujet: jeux/belote
version: 1.0.0
date: 2026-11-04
langues: fr
onglets: explication, application, academie, mise-en-situation
mots-cles:
  - belote
  - jeu de belote
  - belote rebelote
  - atout belote
  - dix de der
questions:
  - je veux jouer à la belote
  - comment on joue à la belote ?
  - c'est quoi l'atout à la belote ?
  - comment progresser à la belote ?
  - play belote
---

# Belote

Troisième **jeu universel** de Kermiclab (issue #93), sur le modèle des Échecs et du Démineur (ADR 0013, 0014,
0015, guide `docs/jeux.md`, gamification `docs/gamification.md`).

- **Règles** (onglet `explication`) : équipes, distribution, enchères en deux tours, obligations (fournir, couper,
  surcouper, monter à l'atout, partenaire maître), valeur des cartes, belote-rebelote, dix de der, capot, contrat.
- **Jouer** (onglet `application`) : partie à quatre, toi et Nord contre Est et Ouest gérés par l'ordinateur (Facile,
  Normal), en 501 ou 1001 points ; seules les cartes autorisées sont actives et la règle qui s'applique est écrite ;
  bouton « 💡 Conseil » ; bilan détaillé de chaque donne.
- **Académie** (onglet `academie`) : du débutant au pro en 5 grades (Apprenti → Champion) et 15 leçons, avec des
  exercices « pli » (quelle carte jouer ?) et « enchère » (prendre, passer, choisir l'atout) vérifiés par le moteur.
- **Le compteur** (onglet `mise-en-situation`) : un vrai pli joué par l'ordinateur ; trouver qui le remporte et combien
  de points il vaut.

Règles de cette page : sans annonces autres que la belote-rebelote ; en cas d'égalité, le preneur est dedans.

Moteur pur (`<script id="moteur-belote">`) testé dans `tests/unit/belote.test.mjs` (cartes jouables, décompte de
162 points, simulation de milliers de donnes) ; parcours dans `tests/unit/belote-academie.test.mjs` ; interface dans
`tests/e2e/belote.test.mjs`.

Relecture humaine : jouer une partie complète sur ordinateur et sur téléphone ; relire les 15 leçons.
