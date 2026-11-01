# Architecture trigoLab

Objectif : développer et comparer plusieurs méthodes de résolution sans dupliquer l'interface, en gardant un livrable autonome en un seul fichier. Les exigences fonctionnelles sont dans `SPEC.md` ; le partage du travail entre agents dans `AGENTS.md`.

## Principe

```text
Un seul moteur mathématique        src/core/
Un seul état central               src/core/store.js
Des méthodes enregistrables        src/solutions/
Des modes de présentation          src/ui/ (Explorer, Apprendre, Jouer ; Comparer à venir)
Un livrable autonome généré        index.html ← scripts/build-standalone.py
```

Flux d'une interaction :

```text
entrée (pointeur, clavier, saisie)            src/ui/input.js
  → store.setAngle(saisie)                     src/core/store.js   (resolveAngle : lecture, normalisation)
  → abonnés notifiés                           src/ui/main.js
  → compute(angle)                             src/core/engine.js  (seule source des valeurs)
  → méthodes géométrique et algébrique         src/solutions/geometric.js, algebraic.js
  → rendu SVG, valeurs, contrôles              src/ui/render.js
```

## Couches et propriétaires

| Couche | Fichiers | Agent | Règle |
|---|---|---|---|
| Moteur mathématique | `src/core/angle.js`, `exact-values.js`, `engine.js`, `format.js` | Moteur | pur, sans DOM |
| État central | `src/core/store.js` | Moteur | valeurs sources uniquement |
| Pédagogie | `src/pedagogy/lessons.js`, `challenges.js` | Moteur | pur, hasard injectable |
| Méthodes | `src/solutions/registry.js`, `catalog.js`, `geometric.js`, `algebraic.js` | Moteur | contrat commun |
| Autotests Moteur | `src/selfcheck.js` | Moteur | exécutés dans Node et dans la page |
| **Contrat** | `src/api.js` | les deux | réexportations uniquement |
| Interface | `src/ui/*.js`, `src/styles/app.css`, `src/index.template.html` | Interface | importe le Moteur via `api.js` |

`scripts/check_boundaries.py` vérifie ces règles à chaque CI.

### Modules de l'Interface (sans cycle, du plus bas au plus haut)

| Module | Rôle | Dépend de |
|---|---|---|
| `dom.js` | utilitaires DOM | — |
| `geometry.js` | angle ↔ coordonnées SVG, aimantation | dom |
| `state.js` | instance de l'état central | api |
| `circle.js` | graduations, repères, boutons remarquables | dom, geometry, state |
| `options.js` | cases d'affichage | dom, circle |
| `render.js` | rendu synchronisé | dom, geometry |
| `learn.js` / `play.js` | modes Apprendre / Jouer | dom, state, options (+ geometry) |
| `modes.js` | onglets | learn, play, state |
| `input.js` | toutes les entrées | geometry, state, render, options, learn, play, modes |
| `selftest.js` | autotests DOM | geometry, state, options, modes |
| `main.js` | démarrage | tous |

Tous importent le Moteur uniquement via `../api.js`.

## État central

L'état ne contient **que des valeurs sources**. Les valeurs calculées (cos, sin, quadrant…) ne sont jamais stockées : `compute(angle)` les produit à la demande. Il ne peut donc pas y avoir deux sources de vérité.

```js
{ angle: 45, snap: true, mode: 'explore', locked: false }
```

- `angle` : dans [0 ; 360]. 360 est distinct de 0 quand l'utilisateur l'a demandé (M-01). Toute saisie passe par `resolveAngle()`.
- `store.get()` renvoie une copie gelée. Seuls `setAngle()` (avec rendu), `patch()` (sans rendu, clés connues uniquement) et `refresh()` (nouveau rendu, par exemple pour une annonce) modifient ou diffusent l'état.
- La progression des leçons et des parties (`lesson`, `game`) reste dans l'Interface tant qu'aucune méthode n'en a besoin. Elle rejoindra l'état central avec le mode Comparer si nécessaire.

## Contrat de solution

```js
{
  id: 'geometric', label: 'Méthode géométrique',
  supportedModes: ['explore', 'learn', 'compare'],
  supports(context) → boolean,
  solve(context) → résultat
}
```

`context` = `solutionContext(compute(angle))` : `{ angle, values }`, **gelé en profondeur**. Une méthode qui tente de le modifier lève une erreur (S-02).

Résultat normalisé :

```js
{
  solutionId: 'geometric',
  status: 'success',             // success | partial | unsupported | invalid | error
  title: '…',
  confidence: 'exact',           // exact | approx ; absent si unsupported
  result: { angle: 'π/3', cos: '1/2', sin: '√3/2', tan: '√3' },   // null si unsupported ; tan: null si non définie
  steps: [{ id, title, text }],  // au moins une étape, dans l'ordre
  explanation: '…',
  warnings: [{ code, message }]  // ex. TANGENT_UNDEFINED
}
```

- Une tangente non définie n'est pas un statut. Le résultat reste `success`, avec `tan: null` et l'avertissement `TANGENT_UNDEFINED`. cos et sin restent valables.
- `checkSolutionResult()` vérifie la forme. `result: null` est accepté uniquement avec `status: 'unsupported'`, un avertissement `NOT_APPLICABLE` et une étape `why` ; `confidence` est facultatif dans ce cas. Pour les résultats `success`, les autotests vérifient en plus que chaque méthode redonne les valeurs du moteur sur toutes les saisies de référence (`REFERENCE_INPUTS`). Le résultat affiché comme « commun » vient toujours du moteur, jamais d'une méthode.

`solutions.list({ mode })` ne renvoie que les méthodes dont `supportedModes` contient ce mode (S-07) : chaque `supports(context)` rend `true` si le contexte n'a pas de mode ou si le mode est pris en charge.

Ajouter une méthode : `src/solutions/<id>.js`, puis `solutions.register(...)` dans `catalog.js`. Les tests de contrat (`tests/solutions/contract.test.js`) s'appliquent automatiquement à toute méthode enregistrée.

## Construction

```text
src/index.template.html + src/styles/app.css + src/**/*.js
        ↓  scripts/build-standalone.py (tri topologique, retrait des import/export, IIFE unique)
index.html (commité, publié par GitHub Pages)
```

- Les modules sont de vrais modules ES. Node les exécute tels quels (`package.json` : `"type": "module"`). Le navigateur aussi, via `src/dev.html` (`--dev`), avec un serveur local, car les navigateurs bloquent les `import` en `file://`.
- Le livrable concatène les modules dans une seule fonction. D'où les conventions imposées : noms de niveau module uniques, pas de cycle, imports et exports nommés. Le build échoue avec un message précis en cas d'écart (testé dans `tests/build/`).
- La CI reconstruit et échoue si `index.html` diffère de `src/` (`--check`).

## Tests

| Niveau | Où | Exécution |
|---|---|---|
| Moteur (unitaires, propriétés, hasard reproductible) | `tests/core/` | `node --test` |
| Contrat et comparaison des méthodes | `tests/solutions/` | `node --test` |
| Autotests Moteur partagés | `src/selfcheck.js` | Node **et** page |
| Autotests Interface (géométrie, DOM étendu, pointeur, modes) | `src/ui/selftest.js` | page |
| Page réelle (ordinateur, mobile) | `tests/dom/` | `node --test` + Playwright facultatif |
| Outillage (build, frontières) | `tests/build/` | `node --test` |

## Étapes suivantes

1. ~~Extraction sans changement fonctionnel, registre, méthode géométrique~~ (v1.2).
2. **Méthode algébrique** (Moteur) : conversion, réduction à l'angle de référence, étapes écrites ; `approx` hors angles remarquables. Puis un **sélecteur de méthode** dans le panneau d'explication (Interface).
3. **Méthode tabulaire** (Moteur) : lecture dans la table, symétries, périodicité.
4. **Mode Comparer** (Interface) : deux méthodes côte à côte (onglets sur mobile) et un bloc « résultat commun » issu du moteur.
5. Mises en page par `data-layout` sur la racine (compacte, laboratoire, accessible) plutôt que des vues séparées.
