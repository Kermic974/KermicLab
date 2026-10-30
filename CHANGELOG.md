# Changelog

## v1.2.0

Restructuration pour deux agents distincts sur un seul jeu d'instructions. Aucun changement fonctionnel visible, en dehors de deux corrections.

- **Sources modulaires** dans `src/`. `index.html` est désormais généré par `scripts/build-standalone.py` (vérification des imports, des noms et des cycles) et reste un fichier unique sans dépendance. Une version de développement par modules ES est disponible (`--dev`).
- **Deux agents** : Moteur (`src/core`, `src/pedagogy`, `src/solutions`) et Interface (`src/ui`, `src/styles`). Le contrat entre eux est `src/api.js`. `scripts/check_boundaries.py` fait respecter les zones (DOM interdit dans le Moteur, Interface limitée à `api.js`, contrôle par branche `agent/…`).
- **Un seul jeu d'instructions** : `AGENTS.md` (chargé par `CLAUDE.md`), `SPEC.md` réécrit en exigences numérotées, nouveau `ARCHITECTURE.md`.
- **État central** (`createStore`) limité aux valeurs sources ; moteur `compute()` seule source des valeurs.
- **Registre de méthodes de résolution** avec contrat commun ; première méthode : géométrique (elle fournit l'explication affichée).
- **Tests** : 30 tests `node --test` (moteur, pédagogie avec hasard reproductible, contrat des méthodes, page réelle, outillage). Dans la page : 1 404 autotests, dont les tests DOM étendus de la v0.1 portés sur l'interface actuelle (pointeur, clavier, modes).
- **CI** sur chaque PR : livrable à jour, frontières, tests, structure HTML ; déploiement Pages uniquement depuis `main`.
- Corrections :
  - un score de 440/800 (exactement 55 %) n'obtenait qu'une étoile au lieu de deux, à cause d'une erreur d'arrondi ;
  - `exactNum` renvoyait NaN au lieu de signaler une forme inconnue.

## v1.1.0

Orientation éducative et récréative : trois modes accessibles par onglets.

- **Explorer** : le cercle libre de la v1.0, inchangé.
- **Apprendre** : parcours guidé en 8 étapes (cercle unité, cosinus, sinus, cos² + sin² = 1, quadrants et signes, symétries et angle de référence, tangente, radians). Chaque étape règle l'affichage et propose une consigne « À toi » vérifiée automatiquement, avec une barre de progression.
- **Jouer** : deux défis de 8 questions.
  - 🎯 *Place le point* : placer P à partir d'une valeur exacte (`θ = 5π/6`, `cos θ = −1/2 et sin θ > 0`, `tan θ = −√3 et cos θ < 0`), avec une difficulté croissante et des points selon la précision.
  - 🧠 *Quiz des valeurs* : retrouver le cos, sin ou tan exact parmi 4 propositions (les pièges sont l'opposé et la valeur échangée), avec une explication à chaque réponse.
  - Score, série 🔥, étoiles de fin de partie et record conservé dans le navigateur.
- Correction : `norm()` ajoutait du bruit flottant (même correctif que la v0.1).
- 1 274 autotests, qui vérifient aussi la table des valeurs exactes, l'unicité de la solution de chaque énoncé, les propositions du quiz et la faisabilité des consignes.

## v1.0.0

Version finale du draft « Studio V5 ».

### Corrections

- Angle de référence faux dans les quadrants II, III et IV (120° affichait 30° au lieu de 60°).
- Un champ de saisie vide ramenait l'angle à 0° ; une saisie invalide est désormais signalée sans modifier l'angle.
- Un toucher au centre du cercle (angle indéfini) produisait un saut à 0° ; une zone morte centrale l'ignore.
- La virgule décimale (`22,5`) est acceptée.
- Fin de glissement fiabilisée (`lostpointercapture`, `pointercancel`).

### Nouveautés

- Saisie en radians : `π/3`, `2pi/3`, `-π`…
- Axe des tangentes (option) avec le point T = (1 ; tan θ).
- Repères du cercle en degrés ou en radians.
- Segments cos/sin colorés sur les axes et explication contextuelle (angle de référence, signes).
- Clavier : PageUp/PageDown (±15°) ; `aria-valuetext` et boutons `aria-pressed`.
- Glissement fluide via `requestAnimationFrame` ; cercle fixe à l'écran sur desktop.
- Code source lisible et commenté ; 1 118 autotests intégrés.

## v0.1.0

Stabilisation et tests DOM étendus (sur la base de la v0.0, sans les fonctionnalités de la v1.0). Fichier : `versions/v0.1/standalone.html`.

### Stabilisation

- Angle de référence corrigé dans les quadrants II, III et IV.
- Saisie vide ou invalide ignorée (elle ramenait l'angle à 0°), signalée par `aria-invalid`.
- Virgule décimale acceptée (`22,5`) ; champ texte à clavier décimal.
- Zone morte au centre du cercle (plus de saut à 0°).
- `norm()` sans bruit flottant (12,3° devenait 12,300000000000011°), trouvé par les nouveaux tests.
- Fin de glissement fiabilisée (`lostpointercapture`) ; clic droit ignoré.
- Boutons d'incrément sur une seule ligne.

### Tests DOM étendus

60 tests qui pilotent la vraie page puis restaurent son état :

- saisie et bouton Appliquer (entier, virgule, vide, invalide, négatif, 720°, touche Entrée) ;
- curseur (360°, 90°, valeur décimale) ;
- incréments ±1°, ±5°, ±15° avec passage par 0° ;
- les 16 angles remarquables (valeurs exactes et bouton actif) ;
- clavier sur le cercle (flèches, Maj, Début, Fin) ;
- géométrie SVG (point, rayon, projections, `aria-valuenow`, curseur) ;
- signes par quadrant, options d'affichage, annonce `aria-live` ;
- pointeur : appui aimanté, glisser, appui libre, toucher, centre, clic droit et survol ignorés.

Les tests de pointeur sont signalés « non exécutés » quand la page n'est pas affichée. Au total : 792 autotests (732 logiques et 60 DOM).

## v0.0.0

- Première version autonome du cercle trigonométrique interactif.
- Interface responsive mobile/desktop.
- Source d'état unique pour l'angle.
- Interactions Pointer Events.
- Valeurs exactes et approximatives.
- Diagnostic et autotests.
- Package VS Code et déploiement GitHub Pages.
