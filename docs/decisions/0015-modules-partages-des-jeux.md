# ADR 0015 — Modules partagés des jeux, recopiés dans chaque page au build

- Date : 2026-11-04 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : l'ADR 0013 prévoyait d'extraire le code commun des jeux « quand plusieurs jeux existeront réellement ».
  Avec l'Académie des échecs (ADR 0014) puis celle du Démineur, deux pages auraient porté chacune ~700 lignes
  identiques (progression, badges, révisions, présentation). Or une page du catalogue doit rester **un seul fichier
  autonome**, lisible hors ligne, sans script externe (AGENTS.md §5).

## Décision

1. Le code commun vit dans **`gabarit/jeux/`** : `progression.js` (logique pure, paramétrée par le parcours du jeu),
   `academie.js` (interface commune : synthèse, parcours, séances, page « Ma progression »), `academie.css`.
2. Une page écrite à la main déclare l'emplacement : `<script id="…" data-inclure="gabarit/jeux/progression.js"></script>`
   (ou `<style data-inclure="…">`). **`npm run build` recopie le module dedans** (`inclureModules`,
   `scripts/lib/catalogue.mjs`), puis recalcule les hashes CSP. La page committée contient donc tout le code : elle reste
   autonome, et sa relecture montre exactement ce qui est servi.
3. Une copie périmée est une **page obsolète** pour `check:pages` (même mécanisme que les hashes CSP) : la CI échoue
   tant que `npm run build` n'a pas été relancé. Seuls les fichiers `gabarit/jeux/<nom>.js|css` peuvent être inclus.
4. Chaque jeu ne fournit que **ses données** (parcours JSON : grades, leçons, exercices, badges propres, niveaux de
   partie) et un **adaptateur** par type d'exercice interactif (`coup` pour l'échiquier, `grille` pour le Démineur).

## Conséquences

- Corriger ou enrichir la gamification se fait une fois, dans `gabarit/jeux/`, puis `npm run build` met à jour toutes
  les pages : leur diff doit être relu (comme pour le gabarit de notion, ADR 0011).
- Les tests vérifient la logique commune une fois, et chaque parcours avec le moteur de son jeu ; un test garantit que
  les pages embarquent la version à jour des modules.
- Un futur jeu (morpion, 2048, sudoku…) obtient l'Académie complète en écrivant son parcours et, si besoin, un
  adaptateur d'exercice.
