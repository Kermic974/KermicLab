# Plan des PR — génération des labs

Ce plan découpe en pull requests les labs décrits dans deux chantiers :
[catalogue-maths.md](chantiers/catalogue-maths.md) (§ Revue et plan des labs interactifs) et
[labs-autres-matieres.md](chantiers/labs-autres-matieres.md). Les règles de travail sont dans
`AGENTS.md`, et ce plan ne les répète pas.

**Une PR = un lot = une branche = un agent.** Un lot de lab ajoute **une figure** et l'intègre à
**une notion**. Pour réutiliser la figure dans d'autres notions, on ouvre ensuite de petites PR de
contenu séparées. Cochez les cases dans la PR du lot.

## État de départ (6 novembre 2026)

- Figures du gabarit : `pythagore`, `fraction`, `proportion`, `affine`, `parabole`, `des`, `thales`.
  Le **lab Thalès** (priorité 1 des maths) est donc fait.
- L'écran **Labs** du tableau de bord ne liste que le cercle (`/cercle/`). Les pages à figure du
  catalogue n'y apparaissent pas.
- Aucune PR de lab n'est ouverte. Les PR #133, #137 et #138 ne touchent pas le gabarit.
- **Problème bloquant pour le parallélisme.** Tout `gabarit/moteur.js` (33 Ko, toutes les figures)
  est recopié dans chaque page générée. Ajouter une figure modifie donc les quelque 170 `page.html`
  du catalogue. Deux PR de labs ouvertes en même temps entrent en conflit sur `moteur.js`, sur
  `TYPES_FIGURE` et sur toutes les pages. Le lot S0 lève ce blocage.

## Vue d'ensemble

| Lot | Type | Branche | Dépend de | Notion | Figure (`type`) |
|---|---|---|---|---|---|
| S0 | socle | `labs/socle-figures-modulaires` | — | toutes (régénérées une fois) | — |
| S1 | socle | `labs/ecran-labs-catalogue` | S0 | — | — |
| S2 | contenu | `labs/reconciliation-svt` | — | fiches SVT | — |
| M2 | maths | `labs/balance-equations` | S0 | `equations` | `balance` |
| P1 | physique | `labs/circuit-electrique` | S0 | `electricite` | `circuit` |
| H1 | histoire | `labs/frise-chronologique` | S0 | une notion d'histoire (à choisir dans la PR) | `frise` |
| F1 | français | `labs/constructeur-phrase` | S0 | `accords` | `phrase` |
| M3 | maths | `labs/systemes-deux-droites` | M2 (retours) | `droites-et-systemes` | `deux-droites` |
| M4 | maths | `labs/statistiques-donnees` | M2 (retours) | `statistiques` | `serie-statistique` |
| V1 | SVT | `labs/cellule-schematique` | S0, S2 | `la-cellule` (ou la variante retenue par S2) | `cellule` |
| R1 | contrôle | — (point de contrôle humain) | P1, V1, H1, F1 | — | — |
| C* | vague C | `labs/<figure>` | R1 | voir § Vague C | — |
| L9 | publication | `labs/publication` | fin de vague B, puis de vague C | — | — |

### Ordre et parallélisme

```text
S0 ──┬─ S1 (écran Labs)
     ├─ M2 balance ────────┬─ M3 deux droites
     │                     └─ M4 statistiques
     ├─ P1 circuit ─────────┐
     ├─ H1 frise ───────────┤
     ├─ F1 phrase ──────────┼─ R1 revue des 4 prototypes ── vague C ── L9
S2 ──┴─ V1 cellule ─────────┘
```

- **Vague A** : S0 seul. S2 (contenu SVT) peut avancer en parallèle, car il ne touche pas au gabarit.
- **Vague B**, en parallèle : S1, M2, P1, H1, F1, puis V1 une fois S2 fusionné. Pour que la
  relecture humaine reste possible (public mineur), on ouvre **au plus trois PR de lab à la fois**.
- **Vague B bis** : M3 et M4, après les retours sur M2. Le chantier maths demande de réévaluer les
  priorités après les deux premiers labs.
- **R1** : revue pédagogique et technique des quatre prototypes hors maths. La vague C ne démarre
  qu'après cette revue.

### Conflits attendus et règle de résolution

Une fois S0 fusionné, chaque lab ne touche que **ses** fichiers :
`gabarit/figures/<type>.js`, `scripts/lib/figures/<type>.mjs`, `catalogue/<notion>/`, son bloc de
test. Seuls trois fichiers restent partagés :

- `CHANGELOG.md` : ajouter **une seule** ligne sous `## [Non publié]` ; en cas de conflit, garder
  les deux lignes.
- `docs/gabarit.md` : ajouter **une seule** puce dans la liste des figures, à sa place
  alphabétique.
- `tests/e2e/notions.test.mjs` : un `test(...)` par lab, ajouté à la fin du fichier.

Une PR ne doit **jamais** régénérer les pages d'autres notions. Si son diff contient d'autres
`page.html` que la sienne, le lot S0 est cassé : corriger avant de continuer.

---

## S0 : figures modulaires (socle)

**Pourquoi.** Pour que les labs puissent avancer en parallèle sans conflits, et que les pages
restent légères (une page n'embarque que sa figure).

**À faire**
- [x] Déplacer chaque figure de l'objet `FIGURES` de `gabarit/moteur.js` vers
  `gabarit/figures/<type>.js`. Chaque fichier enregistre sa figure auprès du moteur
  (ex. `FIGURES.thales = (conf) => …`). Les aides communes (`h`, `s`, `curseur`, `tuile`)
  restent dans `moteur.js`.
- [x] `scripts/lib/gabarit.mjs` : n'insérer dans la page que le fichier de la figure déclarée par
  `application.figure.type` (aucun si la notion n'a pas de figure). Garder une seule balise
  `<script>` pour ne pas changer le calcul des hashes CSP, ou adapter ce calcul.
- [x] Dériver `TYPES_FIGURE` du contenu de `gabarit/figures/` au lieu d'une liste en dur. Déplacer
  la validation propre à chaque figure dans `scripts/lib/figures/<type>.mjs`
  (`export function valider(conf, ou, exiger)`).
- [x] `docs/gabarit.md` § 4 : décrire la nouvelle procédure (un fichier de figure, un fichier de
  validation, une puce de doc, un test).
- [x] ADR court `docs/decisions/0019-figures-modulaires.md`.

**Tests**
- [x] `tests/unit/gabarit.test.mjs` : une page sans figure ne contient aucun code de figure ; une
  page `thales` ne contient que la figure `thales` ; un type inconnu est refusé avec la liste des
  types découverts.
- [x] Les tests navigateur existants des figures (`tests/e2e/notions.test.mjs`) passent sans
  modification.

**Acceptation**
- [x] `npm run ci` vert. Toutes les `page.html` sont régénérées **une seule fois** dans cette PR, et
  la taille des pages sans figure diminue.
- [ ] Ajouter une figure factice dans une branche locale ne modifie que la page qui l'utilise
  (vérification manuelle, décrite dans la PR).

**Prompt de lancement**
> Lis `AGENTS.md`, puis le lot S0 de `docs/plan-pr-labs.md`. Crée la branche
> `labs/socle-figures-modulaires` depuis `main` et réalise S0 exactement, sans changer le
> comportement d'aucune figure. Lance `npm run ci`, pousse, puis ouvre la PR.

---

## S1 : l'écran Labs liste les pages à figure

**Pourquoi.** Aujourd'hui, l'écran Labs ne montre que le cercle. Les labs du gabarit seraient
invisibles depuis le tableau de bord.

**À faire**
- [ ] Exposer `figure` (le type, ou `null`) dans l'index du catalogue généré par `npm run build`.
- [ ] `web/app.js` : l'écran Labs affiche le cercle, puis une carte par notion à figure (titre,
  matière). La carte ouvre la page sur l'onglet `application`.
- [ ] Textes : nouvelles clés dans `web/i18n/fr.json` **et** dans toutes les autres langues.
- [ ] README (EN et FR) : remplacer « Labs list dedicated apps (currently the unit circle) ».

**Tests** : `tests/e2e/tableau.test.mjs` vérifie que les cartes Pythagore et Thalès apparaissent
dans `/#labs` et que l'une d'elles s'ouvre sur l'onglet application ; le rendu mobile (390 px) n'a
pas de défilement horizontal.

**Acceptation** : `npm run ci` vert ; chaque lab fusionné ensuite apparaît sans modifier `web/`.

---

## S2 : réconciliation des fiches SVT

**Pourquoi.** Prérequis de V1 (voir `labs-autres-matieres.md`, point de cohérence SVT) : huit fiches
(`cellule`, `la-cellule`, `genetique-adn`, …) se recoupent, et on ne doit pas construire le lab
cellule sur un doublon.

**À faire**
- [ ] Pour chaque paire en doublon, choisir la notion à conserver, fusionner les exercices utiles et
  rediriger les questions d'exemple (mots-clés) vers elle.
- [ ] Mettre à jour `docs/chantiers/catalogue-svt.md`.
- [ ] Ne supprimer aucune page servie sans l'accord du propriétaire : le signaler dans la PR.

**Acceptation** : `npm run ci` vert, toutes les questions d'exemple routées. **Point de contrôle
humain** : le choix des notions conservées est validé avant fusion.

---

## Lots de lab (modèle commun)

Chaque lot de lab suit les mêmes étapes. Seuls changent la notion, la figure et les cas limites
(tableau suivant).

**À faire**
1. [ ] Dans la description de la PR, avant de coder : l'état manipulable, les règles du modèle, les
   cas limites et les paramètres de `application.figure`.
2. [ ] `gabarit/figures/<type>.js` (figure) et `scripts/lib/figures/<type>.mjs` (validation des
   paramètres, bornes comprises).
3. [ ] Une puce dans `docs/gabarit.md` (paramètres, bornes, valeurs par défaut).
4. [ ] `catalogue/<notion>/contenu.json` : ajouter `application.figure` et une consigne d'intro.
   Conserver les niveaux et les exercices existants ; en ajouter un ou deux qui exploitent la figure.
5. [ ] Si la figure a un modèle calculable (circuit, balance, statistiques, offre et demande) : le
   coder en fonctions pures et le tester unitairement dans `tests/unit/`.
6. [ ] `tests/e2e/notions.test.mjs` : manipulation au clavier et à la souris, mise à jour des valeurs
   affichées, cas limites, aucune erreur console, rendu mobile.
7. [ ] Accessibilité : clavier, tactile, focus visible, annonces `aria-live` sur les valeurs (pas sur
   chaque mouvement), compréhension sans la couleur seule.
8. [ ] Une ligne dans `CHANGELOG.md` ; le statut du lab dans la fiche de chantier concernée.

**Acceptation**
- [ ] `npm run ci` vert ; seule la `page.html` de la notion a changé.
- [ ] Page autonome, sans réseau, sans donnée personnelle ; `check:pages` vert.
- [ ] **Point de contrôle humain** : relecture de l'exactitude (mathématique, scientifique,
  historique ou grammaticale) par le propriétaire ou une personne compétente avant fusion.

**Prompt de lancement** (remplacer `<lot>`)
> Lis `AGENTS.md`, puis le lot `<lot>` et le « modèle commun » de `docs/plan-pr-labs.md`. Crée la
> branche indiquée depuis `main` à jour et réalise le lot exactement. Ne modifie aucune autre figure
> et ne régénère aucune autre page. Lance `npm run ci`, pousse, puis ouvre la PR avec l'état
> manipulable, les règles et les cas limites en tête de description.

### Fiches des lots

| Lot | Ce que l'élève manipule | Modèle et cas limites à tester | Garde-fous propres |
|---|---|---|---|
| **M2** balance (`equations`) | Deux plateaux `ax + b` et `c` ; boutons « retirer b des deux côtés », « diviser par a des deux côtés ». | Équations `ax + b = c` seulement (pas de parseur général) ; `a = 0` refusé ; solution non entière ; opération invalide refusée avec explication ; vérification finale. | Étapes écrites à chaque opération ; la balance reste en équilibre. |
| **P1** circuit (`electricite`) | Pile basse tension, deux lampes, interrupteur ; montage série ou dérivation. | Loi des mailles et des nœuds ; circuit ouvert (I = 0) ; lampe retirée ; unités toujours affichées. | Simulation seulement, aucune consigne de branchement secteur ; court-circuit impossible à construire. |
| **H1** frise (`frise`) | Repères à placer ou trier, zoom entre périodes, lien événement → conséquence. | Dates négatives (av. J.-C.) ; périodes qui se chevauchent ; processus long distinct d'une date ponctuelle. | Chaque repère sourcé dans `contenu.json` ; débats d'interprétation signalés. Composant réutilisé par C10. |
| **F1** phrase (`accords`) | Sélection du donneur d'accord, du sujet, de l'auxiliaire, du COD ; formes proposées. | Participe passé avec avoir et COD placé avant ; sujets inversés ; plusieurs analyses valides. | Justification écrite, pas seulement une couleur ou une sanction. |
| **M3** deux droites (`droites-et-systemes`) | Coefficients de deux droites ; point d'intersection. | Sécantes, parallèles (pas de solution), confondues (infinité) ; coordonnées non entières. | Mêmes conventions visuelles que la figure `affine`. |
| **M4** statistiques (`statistiques`) | Petit jeu de données fictif modifiable (8 à 15 valeurs bornées). | Moyenne, médiane, étendue, quartiles ; effectif pair ou impair ; valeur extrême ajoutée. | Données fictives ; l'effet de la valeur extrême sur la moyenne et la médiane est expliqué. |
| **V1** cellule (`la-cellule`) | Organites sélectionnables ; comparaison végétale, animale, procaryote. | Organite absent selon le type de cellule ; libellés et fonctions appariés. | Dessin explicitement schématique, échelle précisée. |

---

## R1 : point de contrôle après les prototypes

**Quand** : P1, V1, H1 et F1 fusionnés.

**Quoi** : le propriétaire relit les quatre labs (pédagogie, accessibilité, performances sur
mobile), puis décide quels lots de la vague C lancer et dans quel ordre. Les composants à mutualiser
(frise et carte, graphique réglable, parcours à embranchements) sont décidés à ce moment, pas avant.

**Comment confirmer** : un commentaire sur l'issue de suivi des labs, avec la liste des lots
retenus.

## Vague C (après R1)

Un lot par ligne, avec le même modèle commun. Les dépendances indiquent une réutilisation de
composant, pas un ordre imposé.

| Lot | Notion de départ | Figure | Réutilise |
|---|---|---|---|
| C5 | `mouvements`, puis `lois-de-newton` | chronophotographie et vecteurs | — |
| C6 | `urbanisation` | carte schématique à couches | — |
| C7 | `marche-concurrentiel` | offre et demande réglables | conventions de `deux-droites` (M3) |
| C8 | `ecosystemes-et-biodiversite` | réseau trophique | — |
| C9 | `democratie` | cas civique à embranchements | — |
| C10 | `antiquite` | carte historique à dates | `frise` (H1), carte (C6) |
| C11 | `justice-philosophie` | carte d'argumentation | parcours à embranchements (C9) |
| C12 | `figures-de-style` | atelier d'annotation | sélection de mots (F1) |
| C13 | `angles`, `transformations`, `vecteurs`, … | labs géométriques ciblés | selon les retours |

## L9 : publication

Après la vague B (puis après la vague C) : une PR qui suit `AGENTS.md` § 6 bis (version SemVer
mineure, section `## [Non publié]` du changelog renommée). Elle met aussi à jour les statuts des
fiches de chantier et l'inventaire UX (`npm run test:captures` pour les captures de l'écran Labs).

## Suivi sur GitHub

À la demande du propriétaire, on peut créer une issue de suivi « Labs » avec une sous-issue par lot
(S0 à V1, puis la vague C après R1). Chaque PR contient alors « Closes #N ».
