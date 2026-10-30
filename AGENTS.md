# Instructions pour les agents trigoLab

Ce fichier est **le seul jeu d'instructions** du dépôt. Il s'applique à tout agent : Claude Code le charge via `CLAUDE.md`, les autres agents (Codex, Copilot, Cursor…) le lisent directement. Ne créez pas d'instructions parallèles : complétez ce fichier.

- **Quoi construire** : `SPEC.md`, exigences numérotées (F-, M-, E-, A-, D-, S-, X-, Q-).
- **Comment c'est organisé** : `ARCHITECTURE.md`.
- **Qui fait quoi** : ce fichier, § Les deux agents.

La langue du produit, des messages de commit et de la documentation est le français.

## Invariants non négociables

1. `interaction → setAngle() → moteur → rendu`. Une seule valeur d'angle dans l'état central (`createStore`). Aucune vue ni méthode ne recalcule cos, sin ou tan (F-01, F-02).
2. `src/` est la source de vérité. `index.html` est **généré** par `scripts/build-standalone.py` : ne le modifiez jamais à la main, reconstruisez-le et commitez-le avec le changement de `src/`.
3. Le livrable reste un fichier unique, sans dépendance externe ni réseau (F-03). `package.json` ne déclare aucune dépendance.
4. Ne désactivez, ne supprimez et n'affaiblissez jamais un test pour obtenir du vert. Un test faux se corrige dans une PR qui explique pourquoi.
5. Accessibilité exigée par `SPEC.md` § Accessibilité : clavier, tactile, `aria-live`, focus visible, `prefers-reduced-motion`.

## Commandes

| But | Commande |
|---|---|
| Construire `index.html` | `python3 scripts/build-standalone.py` |
| Vérifier que `index.html` est à jour | `python3 scripts/build-standalone.py --check` |
| Frontières entre agents | `python3 scripts/check_boundaries.py --agent auto` |
| Tests (Node 22, sans installation) | `node --test "tests/**/*.test.js"` |
| Structure HTML et syntaxe JS du livrable | `python3 scripts/check_html.py` |
| **Tout vérifier** (exigé avant une PR) | `npm run check` |
| Version de développement par modules | `python3 scripts/build-standalone.py --dev`, puis `python3 -m http.server 8000` et ouvrir `http://localhost:8000/src/dev.html` |
| Archiver une version publiée | `python3 scripts/build-standalone.py --out versions/vX.Y/standalone.html` |

`tests/dom/` utilise Playwright s'il est installé et s'ignore proprement sinon. Les mêmes autotests tournent aussi dans la page (badge « Prêt · N tests OK »).

## Les deux agents

Le dépôt est partagé entre deux agents aux périmètres disjoints. La liste exacte des zones fait foi dans `scripts/check_boundaries.py`. La CI refuse une PR d'un agent qui touche la zone de l'autre.

### Agent Moteur

- **Rôle** : mathématiques, état central, contenu pédagogique, méthodes de résolution. Code pur, testable dans Node.
- **Zone** : `src/core/`, `src/pedagogy/`, `src/solutions/`, `src/selfcheck.js`, `tests/core/`, `tests/solutions/`.
- **Interdits** : DOM et API du navigateur (`document`, `window`, `localStorage`, timers…), import de `src/ui/`.
- **Livre** : des fonctions exportées, documentées par leurs tests, et exposées via `src/api.js`.
- **Exigences principales** : M-*, E-01, D-02 à D-05 (logique), S-*.

### Agent Interface

- **Rôle** : page, rendu SVG, panneaux, entrées (pointeur, clavier, saisie), modes, accessibilité, style.
- **Zone** : `src/ui/`, `src/styles/`, `src/index.template.html`, `tests/dom/`.
- **Interdits** : importer le Moteur autrement que par `src/api.js` ; recalculer une valeur trigonométrique ; dupliquer une logique pédagogique (énoncés, barème, consignes).
- **Livre** : une interface qui consomme `src/api.js` et l'état central, avec ses autotests DOM dans `src/ui/selftest.js`.
- **Exigences principales** : E-02 à E-07, A-*, D-01, X-*.

### Zones communes

- **Contrat** (`src/api.js`, `SPEC.md`, `ARCHITECTURE.md`, `AGENTS.md`) : modifiable par les deux, toujours signalé par la CI.
- **Outillage et documentation** (`scripts/`, `tests/build/`, `.github/`, `README.md`, `CHANGELOG.md`, `versions/`, `index.html` généré) : modifiables par les deux.

## Contrat entre agents

`src/api.js` ne contient que des réexportations du Moteur. C'est la seule porte d'entrée de l'Interface.

- **Ajout** d'un export : le Moteur l'ajoute avec ses tests, dans sa propre PR. L'Interface peut l'utiliser ensuite.
- **Retrait ou changement de signature** : changement de contrat. Le Moteur ajoute d'abord la nouvelle forme à côté de l'ancienne. L'Interface migre. Une troisième PR retire l'ancienne forme. `ARCHITECTURE.md` est mis à jour dans la même PR que le contrat.
- **Besoin de l'Interface non couvert** : l'agent Interface ne code pas la logique lui-même. Il ouvre une issue « [contrat] … » décrivant l'export attendu (nom, entrée, sortie, exigence SPEC), puis attend la PR du Moteur.
- **Nouvelle méthode de résolution** : un fichier dans `src/solutions/` et une ligne dans `src/solutions/catalog.js`. Les tests de contrat s'appliquent automatiquement.

## Conventions de code

Le script de construction assemble les modules par simple concaténation. Il impose :

- `import { a, b } from './x.js';` : imports nommés, chemins relatifs, pas d'alias, pas d'`import *` ;
- `export function`, `export const` : exports nommés uniquement, pas d'`export default` ;
- déclarations de niveau module en colonne 0, **noms uniques dans tout `src/`** (le build échoue sinon) ;
- aucune dépendance circulaire.

Style : JavaScript sans dépendance, compatible navigateurs récents. Le style existant (fonctions, `var` dans les fonctions, guillemets simples, commentaires en français) est à suivre. Textes affichés en français, nombres via `fmt()`.

## Méthode de travail

1. **Branche** : `agent/moteur-<sujet>` ou `agent/interface-<sujet>`, créée depuis `main` à jour. Une PR = un agent = un sujet.
2. **Commits** : préfixe `[moteur]` ou `[interface]`, puis le résumé, avec l'exigence citée (`[moteur] Méthode algébrique (S-03)`).
3. **Avant de pousser** : `npm run check`. Si `src/` a changé, commitez aussi `index.html` reconstruit.
4. **PR** : remplir le modèle (agent, exigences, vérifications). `CHANGELOG.md` est mis à jour pour tout changement visible.
5. **Conflit sur `index.html`** : ne le fusionnez pas à la main. Prenez l'une ou l'autre version, puis reconstruisez.
6. **Fin de travail** : la PR est prête quand la CI est verte. La fusion reste une décision humaine.

## Définition de « terminé »

- l'exigence SPEC visée est couverte par au moins un test (Node pour le Moteur, `selftest.js` pour l'Interface) ;
- `npm run check` passe et le badge de la page affiche « Prêt · N tests OK » ;
- l'application est vérifiée à 390 px et à 1 280 px pour tout changement d'Interface ;
- la documentation (SPEC, ARCHITECTURE, CHANGELOG) est à jour.
