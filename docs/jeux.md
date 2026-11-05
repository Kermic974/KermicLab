# Ajouter un jeu universel

Décision : [ADR 0013](decisions/0013-jeux-universels.md). Exemples complets : `catalogue/2048/` (fusion de tuiles,
progression de Noob à Pro), `catalogue/demineur/` (grille, hasard),
`catalogue/echecs/` (deux joueurs ou contre l'ordinateur, énigmes en données), `catalogue/belote/` (jeu de cartes à quatre,
exercices « pli » et « enchère »), `catalogue/sudoku/` (grilles à solution unique, saisie clavier et tactile,
progression du débutant au pro) et `catalogue/mots-fleches/` (mots croisés, saisie clavier et tactile, Académie de Noob à Pro).

Un jeu suit le processus d'une maquette (AGENTS.md §6) : issue `maquette-manquante`, branche `maquette/<id>`, PR,
validation du CODEOWNER.

## 1. Dossier

`catalogue/<id>/` avec :

- `fiche.md` : front matter habituel avec **`sujet: jeux/<id>`** (matière « Jeux »), sans `niveau`, `langues: fr`,
  `onglets: explication, application, mise-en-situation`, des `mots-cles` propres au jeu (vérifier qu'ils ne routent pas
  déjà vers une autre page) et des `questions` comme un joueur les poserait (« je veux jouer au … »).
- `page.html` écrit à la main, en partant de `catalogue/demineur/page.html` : en-tête, `kermiclab-meta`, CSP (les hashes
  sont recalculés par `npm run build`), socle des onglets, stockage abstrait, bouton « Se connecter » masqué.

## 2. Structure de la page

| Partie | Rôle | Règle |
|---|---|---|
| `<script id="moteur-<id>">` | état et règles du jeu | pur : aucun `document`, `window` ni stockage ; hasard passé en paramètre |
| second `<script>` | vue, entrées, onglets | ne modifie l'état que par les fonctions du moteur |
| `<script type="application/json">` (facultatif) | données : énigmes, niveaux | lues par l'interface **et** par les tests, qui vérifient leur solution avec le moteur |

- **Onglets** : `explication` (règles très simples, commandes), `application` (le jeu, ouvert par défaut),
  `mise-en-situation` (énigmes ou défis courts). Le jeu reste amusant : pas de cours.
- **Entrées** : souris, tactile **et** clavier (focus visible, tabulation itinérante dans une grille). Toute action au
  clic droit ou à l'appui long a une alternative par bouton.
- **Lisibilité** : un état ne dépend jamais de la seule couleur (symbole, chiffre ou texte, plus `aria-label`).
- **Mobile** : la page ne défile jamais horizontalement ; une grande grille défile dans son propre cadre.
- **Données** : records et préférences en stockage `local` uniquement, sans donnée personnelle.
- **Académie** (facultatif, recommandé) : didacticiel « du débutant au pro » et gamification, communs aux jeux qui les intègrent
  (ADR 0014, 0015, présentation : `docs/gamification.md`). Le jeu fournit son parcours en JSON
  (`<script type="application/json" id="parcours-<id>">`) et un adaptateur par type d'exercice interactif. Il inclut les
  modules partagés avec `<script id="progression-jeux" data-inclure="gabarit/jeux/progression.js"></script>`,
  `<script id="academie-jeux" data-inclure="gabarit/jeux/academie.js"></script>` et
  `<style data-inclure="gabarit/jeux/academie.css"></style>`, que `npm run build` remplit. Ne modifie jamais ces copies
  dans la page : modifie `gabarit/jeux/`, puis relance le build.

## 3. Tests

- `tests/unit/<id>.test.mjs` : extraire le moteur de la page et l'exécuter avec `node:vm` (voir
  `tests/unit/demineur.test.mjs`) ; tester les règles avec un hasard reproductible. Pour un jeu à règles nombreuses, comparer le moteur
  à des valeurs de référence publiques (aux échecs : le perft, nombre de positions atteignables).
- `tests/e2e/<id>.test.mjs` : parcours principaux sur ordinateur et sur mobile (`isMobile`, `hasTouch`), absence
  d'erreur console et de violation CSP, absence de débordement horizontal.

```bash
npm run build && npm run ci
```

Relecture humaine : jouer quelques parties sur ordinateur et sur téléphone.
