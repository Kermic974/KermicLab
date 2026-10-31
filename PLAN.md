# Plan d'exécution v1.3 → v1.4

Ce plan découpe la suite de la feuille de route (`SPEC.md`) en **lots**. Chaque lot correspond à **un agent, une branche, une PR**. Les règles de travail sont dans `AGENTS.md`, et ce plan ne les répète pas. Il précise pour chaque lot :

- ce qu'il faut faire, et dans quels fichiers ;
- les signatures exactes à exposer ;
- les tests à écrire ;
- les critères d'acceptation.

Cochez les cases au fil de l'eau, dans la PR du lot.

**Suivi sur GitHub** : l'issue #2 regroupe les lots, et chaque lot a sa sous-issue (#3 à #9). La description de chaque PR contient « Closes #N » pour fermer l'issue du lot à la fusion.

**Objectif final**
- **v1.3** : méthode algébrique, et sélecteur de méthode dans le panneau d'explication.
- **v1.4** : méthode tabulaire, et mode Comparer (deux méthodes côte à côte, avec un résultat commun vérifié).

## Vue d'ensemble

| Lot | Issue | Agent | Branche | Dépend de | Contrat `api.js` | Exigences |
|---|---|---|---|---|---|---|
| L0 | #3 | commun | `agent/commun-ci-navigateur` | PR #1 fusionnée | — | Q-01, Q-02 |
| L1 | #4 | Moteur | `agent/moteur-methode-algebrique` | PR #1 | — | S-01, S-02, **S-04**, S-07 |
| L2 | #5 | Interface | `agent/interface-selecteur-methode` | PR #1 | — | **A-04**, X-01, X-02 |
| L3 | #6 | Moteur | `agent/moteur-methode-tabulaire` | L1 | modifié (statut `unsupported`) | **S-05**, **S-06** |
| L4 | #7 | Moteur | `agent/moteur-comparaison` | L1 | ajout `compareResults`, `resultNumber` | **S-08** |
| L5 | #8 | Interface | `agent/interface-mode-comparer` | L2, L3, L4 | — | **D-06**, X-03 |
| L6 | #9 | commun | `agent/commun-publication` | L1 à L5 | — | — |

Les exigences en **gras** n'existent pas encore. Leur texte est donné dans le lot qui les crée, et ce lot doit les ajouter à `SPEC.md`.

### Ordre et parallélisme

```text
PR #1 fusionnée
   ├─ L0 (commun)            ─────────────────────────────┐
   ├─ L1 (Moteur) ──┬─ L3 (Moteur) ──┐                   │
   │                └─ L4 (Moteur) ──┼─ L5 (Interface) ──┴─ L6 (publication v1.4)
   └─ L2 (Interface) ────────────────┘
        └─ après L1 + L2 : publication intermédiaire v1.3 (L6, première passe)
```

- **Vague 1**, en parallèle : L0, L1 et L2. Ils ne touchent pas les mêmes fichiers, sauf `index.html` et `CHANGELOG.md` (voir § Conflits).
- **Vague 2**, en parallèle : L3 et L4, une fois L1 fusionné.
- **Vague 3** : L5, une fois L2, L3 et L4 fusionnés.
- **Vague 4** : L6.

---

## Étape préalable (humain)

- [ ] Fusionner la PR #1 dans `main`.
- [ ] Settings → Pages → Source : **GitHub Actions**. Vérifier que le site est publié.
- [ ] (Recommandé) Settings → Branches : protéger `main` en exigeant le check `validate`.
- [ ] Ouvrir une session d'agent par lot avec le prompt fourni à la fin du lot. Chaque session part de `main` à jour.

---

## L0 : faire tourner les autotests de la page en CI (commun)

**Pourquoi.** Aujourd'hui, `tests/dom/` est ignoré en CI faute de Playwright. Les 799 autotests de l'Interface ne sont donc vérifiés qu'en local, alors que L2 et L5 en dépendent.

**À faire**
- [ ] `.github/workflows/pages.yml`, job `validate`, avant l'étape « Tests » :
  ```yaml
  - name: Navigateur pour les tests de page
    run: |
      npm install --no-save --no-package-lock playwright@1.48.2
      npx playwright install --with-deps chromium
  - name: package.json sans dépendance
    run: git diff --exit-code package.json
  ```
- [ ] `tests/dom/page.test.js` : en CI (`process.env.CI`), l'absence de Playwright doit **échouer** au lieu d'ignorer, sinon une erreur d'installation passerait inaperçue.
- [ ] `AGENTS.md` § Commandes : préciser que la CI exécute les tests de page.

**Acceptation**
- [ ] Dans les journaux de la CI d'une PR, « autotests de la page (ordinateur) » et « (mobile) » apparaissent en `ok`, pas en `skip`.
- [ ] `package.json` ne contient toujours aucune dépendance.

---

## L1 : méthode algébrique (Moteur)

**Fichiers** : `src/solutions/algebraic.js` (nouveau), `src/solutions/catalog.js` (+1 ligne), `src/solutions/geometric.js` (filtrage par mode), `tests/solutions/algebraic.test.js` (nouveau), `SPEC.md`, `ARCHITECTURE.md`, `CHANGELOG.md`.

**Exigences à ajouter à `SPEC.md`**
- **S-04** : la méthode algébrique convertit l'angle en radians, le réduit au premier quadrant par une formule de réduction, puis en déduit cos, sin et tan. Toutes les étapes sont écrites. Hors angles remarquables, les valeurs sont approchées (`confidence: 'approx'`) et aucune forme exacte n'est inventée.
- **S-07** : `solutions.list({ mode })` ne renvoie que les méthodes dont `supportedModes` contient ce mode.

**Contenu des étapes.** Les `id` sont stables et dans cet ordre : `convert`, `reduce`, `formulas` (absente sur les axes), `values`, `tangent`.

| Quadrant | Écriture de θ | cos θ | sin θ |
|---|---|---|---|
| I | θ = α | cos α | sin α |
| II | θ = 180° − α | −cos α | sin α |
| III | θ = 180° + α | −cos α | −sin α |
| IV | θ = 360° − α | cos α | −sin α |

Exemple attendu pour 150° (les textes peuvent être reformulés, pas les valeurs) :

| id | title | text |
|---|---|---|
| convert | Conversion en radians | θ = 150° = 150 × π / 180 = 5π/6 rad. |
| reduce | Réduction au premier quadrant | θ est dans le quadrant II : θ = 180° − 30°, avec α = 30°. |
| formulas | Formules de réduction | cos(180° − α) = −cos α et sin(180° − α) = sin α. |
| values | Valeurs | cos 150° = −cos 30° = −√3/2 ; sin 150° = sin 30° = 1/2. |
| tangent | Tangente | tan 150° = sin θ / cos θ = (1/2) / (−√3/2) = −√3/3. |

- **Sur un axe** (0°, 90°, 180°, 270°, 360°) : `reduce` dit « θ est sur l'axe … : lecture directe ». Il n'y a pas d'étape `formulas`.
- **Tangente non définie** : `tangent` dit « cos θ = 0 : la tangente n'est pas définie ». `result.tan` vaut `null`, avec l'avertissement `TANGENT_UNDEFINED`, comme pour la méthode géométrique.
- **Angle non remarquable** (ex. 37°) : `convert` donne « ≈ 0,645772 rad ». α est donné avec `fmt(α, 3)`, et `values` utilise `fmt()`. Aucun `√` ni `π` n'apparaît dans `values`.
- **Source des valeurs** : uniquement `ctx.values` (`x`, `y`, `t`, `exact`, `ref`, `quadrant`). La seule exception est la table `EXACT[α]`, utilisée pour la forme exacte de l'angle de référence. Aucun appel à `Math.cos` ou `Math.sin`.

**Filtrage par mode (S-07)**
- `geometricSolution.supports(ctx)` et `algebraicSolution.supports(ctx)` doivent valoir `!ctx || !ctx.mode || this.supportedModes.indexOf(ctx.mode) >= 0`.
- `supportedModes` de la méthode algébrique : `['explore', 'learn', 'compare']`.

**Tests**
- [ ] Contrat et cohérence avec le moteur : automatiques, dès que la méthode est dans `catalog.js`.
- [ ] `algebraic.test.js` :
  - ordre des `id` à 150° ;
  - pas de `formulas` à 90° ;
  - `confidence === 'approx'` et aucun `√` à 37° ;
  - résultat identique à la méthode géométrique sur `REFERENCE_INPUTS` ;
  - `list({ mode: 'play' })` ne renvoie aucune des deux méthodes.
- [ ] Les quatre formules de réduction sont vérifiées numériquement pour tous les angles entiers de 0° à 359°, avec la valeur de `α = ref`.

**Acceptation** : `npm run check` vert. Le badge de la page compte plus de tests qu'avant. Aucune modification sous `src/ui/`.

**Prompt de lancement**
> Lis `AGENTS.md`, puis le lot L1 de `PLAN.md`. Tu es l'agent **Moteur**. Crée la branche `agent/moteur-methode-algebrique` depuis `main` et réalise L1 exactement : méthode algébrique, filtrage par mode, exigences S-04 et S-07 dans `SPEC.md`, tests. Ne touche à aucun fichier hors de ta zone, sauf `SPEC.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `PLAN.md` (cases cochées) et `index.html` reconstruit. Lance `npm run check`, pousse, puis ouvre la PR avec le modèle rempli.

---

## L2 : sélecteur de méthode et étapes (Interface)

**Fichiers** : `src/index.template.html`, `src/styles/app.css`, `src/ui/state.js`, `src/ui/render.js`, un nouveau module `src/ui/method.js`, `src/ui/input.js` (liaison des événements), `src/ui/selftest.js`, `SPEC.md`, `CHANGELOG.md`.

**Exigence à ajouter à `SPEC.md`**
- **A-04** : le panneau « Ce que montre cet angle » propose de choisir la méthode parmi celles du mode courant. Il affiche ses étapes numérotées et ses avertissements. Le choix est conservé en changeant d'angle et de mode. Les valeurs du panneau « Valeurs » ne changent jamais selon la méthode.

**À faire**
- [ ] État : ajouter `method: 'geometric'` à l'état initial dans `src/ui/state.js`. C'est une préférence, modifiée par `store.patch()`.
- [ ] Gabarit : dans le panneau d'explication, un groupe de boutons radio (`role="radiogroup"`, une option par méthode, généré depuis `solutions.list({ mode })`), puis `<h3 id="mtitle">`, `<ol id="msteps">`, `<ul id="mwarn">`. Le `<p id="explain">` est conservé.
- [ ] Rendu : `render()` résout la méthode choisie avec `solutions.get(s.method)`. Si elle n'est pas proposée dans le mode courant, il revient à la première de `solutions.list({ mode })`. Il affiche `title`, puis les étapes (`title` en gras, puis `text`), les `warnings` et l'`explanation`.
- [ ] **Robustesse demandée dès maintenant**, car L3 ajoutera ce statut : si `status === 'unsupported'`, afficher « Méthode non applicable à cet angle » suivi des étapes et des avertissements, sans planter ni rien afficher de faux.
- [ ] Accessibilité : flèches dans le groupe radio, focus visible, annonce `aria-live` « Méthode : … » au changement. Rien n'est annoncé à chaque angle (les étapes ne sont pas dans une région live).
- [ ] Mobile 390 px : options sur une ligne avec défilement interne si besoin, et pas de défilement horizontal de la page (X-03).

**Tests** (`selftest.js`)
- [ ] Il y a autant d'options que `solutions.list({ mode: 'explore' })`.
- [ ] Changer de méthode à 150° : le titre change, et `#msteps` compte autant d'éléments que `steps`.
- [ ] Les textes de `#cos`, `#sin` et `#tan` sont identiques avant et après le changement de méthode (A-04, F-02).
- [ ] La méthode choisie reste sélectionnée après `setAngle(30)` et après un aller-retour Apprendre → Explorer.
- [ ] Un faux résultat `unsupported` s'affiche sans erreur. Pour cela, `src/ui/method.js` expose `renderMethod(result, cible)`, qui affiche un objet résultat quelconque ; le test lui passe un objet construit à la main, sans toucher au registre du Moteur.

**Acceptation** : `npm run check` vert, badge vert, vérification visuelle à 390 et 1 280 px. Aucun fichier du Moteur modifié. Avant la fusion de L1, une seule option est visible ; c'est normal.

**Prompt de lancement**
> Lis `AGENTS.md`, puis le lot L2 de `PLAN.md`. Tu es l'agent **Interface**. Crée la branche `agent/interface-selecteur-methode` depuis `main` et réalise L2 : sélecteur de méthode, affichage des étapes et avertissements, prise en charge du statut `unsupported`, exigence A-04 dans `SPEC.md`, autotests dans `src/ui/selftest.js`. N'importe le Moteur que via `src/api.js`. Si un export te manque, ouvre une issue « [contrat] … » au lieu de coder la logique. Vérifie la page à 390 et 1 280 px, lance `npm run check`, pousse et ouvre la PR.

---

## L3 : méthode tabulaire et statut « non applicable » (Moteur)

**Fichiers** : `src/solutions/tabular.js` (nouveau), `catalog.js`, `src/solutions/registry.js` (contrat), `src/selfcheck.js`, `tests/solutions/contract.test.js`, `tests/solutions/tabular.test.js`, `SPEC.md`, `ARCHITECTURE.md` (§ Contrat de solution), `CHANGELOG.md`.

**Exigences à ajouter à `SPEC.md`**
- **S-05** : la méthode tabulaire lit la valeur de l'angle de référence dans la table des angles remarquables, applique la symétrie du quadrant, puis le tableau des signes, et rappelle la périodicité (θ + 360° k).
- **S-06** : une méthode qui ne s'applique pas à un angle renvoie `status: 'unsupported'`, `result: null`, au moins une étape `why` qui explique pourquoi, et un avertissement `NOT_APPLICABLE`. L'Interface l'affiche sans valeur.

**Changement de contrat** (signalé par la CI ; prévenir l'agent Interface dans la PR)
- `checkSolutionResult` accepte `result: null` **uniquement** avec `status: 'unsupported'` et un avertissement `NOT_APPLICABLE`. `confidence` est alors facultatif.
- `runCoreChecks()` et `contract.test.js` ne comparent les valeurs au moteur que pour `status === 'success'`. Un nouveau test vérifie qu'une méthode ne renvoie `unsupported` que si elle le justifie.
- `ARCHITECTURE.md` est mis à jour dans la même PR.

**Étapes de la méthode tabulaire** : `lookup` (ligne de α dans la table), `symmetry` (absente en quadrant I et sur les axes), `signs`, `values`, `period`.
- Symétries : quadrant II = symétrie par rapport à l'axe des ordonnées ; III = par rapport à l'origine ; IV = par rapport à l'axe des abscisses.
- Angle non remarquable (22,5°, 137,5°, 37°) : `unsupported`, avec l'étape `why` « 37° n'est pas un angle remarquable : sa valeur n'est pas dans la table. »

**Tests**
- [ ] `tabular.test.js` : `unsupported` exactement pour les entrées non remarquables de `REFERENCE_INPUTS` ; `symmetry` correcte pour 150°, 210° et 330° ; résultat identique à la méthode algébrique sur les 16 angles remarquables.
- [ ] Contrat : un résultat `unsupported` sans `NOT_APPLICABLE` est refusé ; un résultat `success` avec `result: null` est refusé.

**Acceptation** : `npm run check` vert. Dans la page, si L2 est fusionné, choisir « Méthode tabulaire » à 37° affiche « non applicable » sans erreur.

**Prompt de lancement**
> Lis `AGENTS.md`, puis le lot L3 de `PLAN.md`. Tu es l'agent **Moteur**. Depuis `main` à jour (L1 fusionné), crée `agent/moteur-methode-tabulaire` et réalise L3 : méthode tabulaire, statut `unsupported` dans le contrat (registry, selfcheck, tests), exigences S-05 et S-06, `ARCHITECTURE.md` mis à jour. Signale le changement de contrat en tête de la PR. `npm run check`, puis pousse et ouvre la PR.

---

## L4 : comparaison des résultats (Moteur)

**Fichiers** : `src/solutions/compare.js` (nouveau), `src/selfcheck.js` (utilise le nouveau module), `src/api.js` (ajout), `tests/solutions/compare.test.js`, `SPEC.md`, `ARCHITECTURE.md`, `CHANGELOG.md`.

**Exigence à ajouter à `SPEC.md`**
- **S-08** : le Moteur fournit une vérification de concordance. Pour un angle, toutes les méthodes applicables donnent les mêmes cos, sin et tan que le moteur. Le résultat commun affiché vient du moteur, la concordance des méthodes.

**Contrat (ajout uniquement)**
```js
// Déplacée depuis selfcheck.js ; selfcheck l'importe désormais d'ici.
resultNumber(s: string) → number | null      // forme exacte ou approchée → nombre ; null si « non définie »
compareResults(results: Résultat[], values: compute()) → {
  agree: boolean,              // vrai si aucune divergence parmi les résultats 'success'
  checked: number,             // nombre de résultats comparés
  skipped: string[],           // solutionId des résultats non 'success'
  mismatches: [{ solutionId, field: 'cos'|'sin'|'tan', expected: number|null, got: number|null }]
}
```
Tolérance : 1e-9 si `confidence === 'exact'`, 1e-6 sinon.

À ajouter à `src/api.js` : `export { compareResults, resultNumber } from './solutions/compare.js';`

**Tests** : concordance des méthodes enregistrées sur `REFERENCE_INPUTS` ; une divergence injectée (faux résultat) est détectée avec le bon `field` ; un résultat `unsupported` va dans `skipped`.

**Prompt de lancement**
> Lis `AGENTS.md`, puis le lot L4 de `PLAN.md`. Tu es l'agent **Moteur**. Depuis `main` à jour, crée `agent/moteur-comparaison` et réalise L4 : `src/solutions/compare.js` avec `resultNumber` et `compareResults` exactement selon la signature du plan, ajout à `src/api.js`, exigence S-08, tests. `npm run check`, puis pousse et ouvre la PR.

---

## L5 : mode Comparer (Interface)

**Fichiers** : `src/index.template.html`, `src/styles/app.css`, `src/ui/compare.js` (nouveau), `src/ui/modes.js`, `src/ui/input.js`, `src/ui/render.js` (ou un abonné dédié dans `main.js`), `src/ui/selftest.js`, `SPEC.md`, `CHANGELOG.md`.

**Exigence à ajouter à `SPEC.md`**
- **D-06** : un 4e onglet, « ⚖️ Comparer », affiche deux méthodes au choix côte à côte pour l'angle courant (onglets sur mobile). En dessous, un bloc « Résultat commun » montre cos, sin et tan issus du moteur, avec la concordance des méthodes (« ✓ Méthodes concordantes » ou la liste des divergences). Le cercle et les contrôles restent utilisables.

**À faire**
- [ ] Onglet `data-tab="compare"` ; panneau `data-mode="compare"`. Le cercle et « Contrôles » sont visibles dans ce mode, mais pas « Valeurs », que le bloc commun remplace.
- [ ] Deux sélecteurs (`#cmpA`, `#cmpB`) alimentés par `solutions.list({ mode: 'compare' })`, par défaut géométrique et algébrique. Une même méthode ne peut pas être choisie des deux côtés.
- [ ] Chaque colonne affiche le titre, les étapes numérotées et les avertissements, et gère `unsupported` (réutiliser le rendu d'étapes de L2, sans le dupliquer).
- [ ] Bloc commun : valeurs de `compute()` (forme exacte si elle existe), puis le badge issu de `compareResults([résultat A, résultat B], values)`.
- [ ] Mobile (≤ 900 px) : les deux colonnes deviennent deux onglets (`role="tablist"`), un seul visible à la fois ; le bloc commun reste toujours visible.
- [ ] L'état : `mode: 'compare'`. Il faut ajouter `'compare'` aux valeurs acceptées partout où le mode est testé (`setMode`, annonces `aria-live` autorisées dans ce mode).

**Tests** (`selftest.js`)
- [ ] Onglet Comparer : les deux colonnes sont remplies à 150° ; le bloc commun affiche −√3/2, 1/2 et −√3/3 ; le badge indique la concordance.
- [ ] Les sélecteurs ne peuvent pas désigner la même méthode.
- [ ] Méthode tabulaire à 37° dans une colonne : « non applicable » dans la colonne ; le bloc commun reste correct.
- [ ] Mobile simulé (classe ou largeur) : un seul panneau de méthode visible, et la bascule fonctionne au clavier.
- [ ] Retour à Explorer : le panneau Comparer est masqué et l'état est intact.

**Acceptation** : `npm run check` vert, badge vert, vérification visuelle à 390 et 1 280 px, aucune valeur trigonométrique calculée dans `src/ui/`.

**Prompt de lancement**
> Lis `AGENTS.md`, puis le lot L5 de `PLAN.md`. Tu es l'agent **Interface**. Depuis `main` à jour (L2, L3 et L4 fusionnés), crée `agent/interface-mode-comparer` et réalise L5 : onglet Comparer, deux colonnes de méthodes, bloc « Résultat commun » alimenté par `compute()` et `compareResults()`, version mobile en onglets, exigence D-06, autotests. Réutilise le rendu des étapes de L2. Vérifie à 390 et 1 280 px, `npm run check`, puis pousse et ouvre la PR.

---

## L6 : publications (commun)

**Après L1 et L2 (v1.3) :**
- [ ] Monter `VERSION` (`src/ui/main.js`) et le libellé du gabarit à 1.3.
- [ ] `CHANGELOG.md` : la section « Non publié » devient `v1.3.0`.
- [ ] `python3 scripts/build-standalone.py --out versions/v1.3/standalone.html`.
- [ ] `SPEC.md` § Feuille de route : v1.3 livrée.

**Après L3, L4 et L5 (v1.4) :** même procédure, plus une mise à jour de `README.md` (fonctions) et de `ARCHITECTURE.md` § Étapes suivantes.

---

## Conflits et règles de fusion

- **`index.html`** : ne jamais le fusionner à la main. Sur conflit : `git checkout --theirs index.html && python3 scripts/build-standalone.py`, puis commit.
- **`CHANGELOG.md`** : chaque lot ajoute ses lignes sous une section `## Non publié` en tête. En cas de conflit, garder les deux listes de lignes.
- **`SPEC.md`** : chaque lot ajoute ses lignes dans le bon tableau. En cas de conflit, garder les deux.
- **Ordre de fusion recommandé par vague** : Moteur avant Interface. Le second à fusionner se met à jour sur `main` et reconstruit `index.html`.

## Relecture humaine de chaque PR

- [ ] CI verte (`validate`) ; pour L0 et les lots suivants, tests de page exécutés (pas `skip`).
- [ ] La PR ne touche que la zone de son agent (la CI le vérifie ; la note « contrat partagé modifié » est attendue en L3 et L4 seulement).
- [ ] Les exigences annoncées sont dans `SPEC.md` et couvertes par un test nommé.
- [ ] Pour l'Interface : ouvrir l'`index.html` de la branche, vérifier le badge, essayer la fonction au doigt (ou en mode mobile du navigateur) et au clavier.
- [ ] Fusionner. Les lots suivants partent ensuite de `main` à jour.
