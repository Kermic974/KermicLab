# Ajouter une notion avec le gabarit commun

Décision : [ADR 0011](decisions/0011-gabarit-de-notion.md). Exemples complets : `catalogue/pythagore/`, `catalogue/fractions/`, `catalogue/proportionnalite/`.

Le même gabarit couvre l'histoire avec `catalogue/antiquite/`, `catalogue/moyen-age/`,
`catalogue/renaissance/`, `catalogue/temps-modernes/`, `catalogue/lumieres/`,
`catalogue/revolution-francaise/`, `catalogue/napoleon/` et `catalogue/revolution-industrielle/` :
trois niveaux (intuition, collège, seconde), exemples, encadrés à retenir, cinq QCM corrigés et un
défi de mémoire ou du quotidien en trois étapes. Les sujets sont préfixés par `histoire/`.
Les Lumières et la Renaissance sont des mouvements inclus dans les Temps modernes, pas des périodes successives.

## 1. Créer le dossier

`catalogue/<id>/` (ou `<id>/` dans le dépôt privé `maquettes-catalogue`) avec :

- `fiche.md` : front matter habituel (`id`, `titre`, `sujet`, `version`, **`date`**, `langues: fr`, `onglets`, `mots-cles`, `questions`)
  et **`niveau`** (`college`, `seconde`, `premiere` ou `terminale`) qui range la notion dans la barre de navigation du chat (sinon : « Autres notions »).
  - Chaque question d'exemple doit être routée vers la notion par les mots-clés (test de non-régression) : vérifie qu'un mot-clé n'est pas déjà utilisé par une autre notion.
  - Les questions servent aussi de **suggestions cliquables** dans le chat : écris-les comme un élève les poserait.
  - **Référentiel (facultatif, recommandé)** : champs vérifiés par `npm run build` quand ils sont présents (feuille de route,
    phase 1). Exemple : `catalogue/proportionnalite/fiche.md`.
    - `niveaux` : parmi `cycle-3`, `cycle-4`, `seconde`, `premiere`, `terminale`, sans doublon, du plus jeune au plus
      avancé, d'après les niveaux réellement couverts par le contenu (`niveau` reste le rangement dans la navigation).
    - `prerequis` : identifiants d'autres notions à maîtriser avant. `prerequis:` sans élément signifie « aucun prérequis »
      (la notion compte alors comme renseignée). Le **graphe des prérequis** est vérifié à chaque build, sur le catalogue
      public et privé : chaque prérequis existe et est une notion (pas un jeu), aucun cycle (le message donne le chemin,
      par exemple `fractions → proportionnalite → fractions`), et un prérequis ne commence pas à un niveau plus avancé que
      la notion (vérifié quand les deux fiches renseignent `niveaux`).
    - `competences` : identifiants (minuscules, chiffres, tirets) de ce que l'élève sait faire après la notion.
    - `duree` : durée estimée en minutes, entier de 1 à 240.
  - **Relecture pédagogique** : après une relecture humaine selon la grille publiée, ajouter `relue` (date), `relue-version`
    et `relue-grille`, voir [validation des maquettes](chantiers/validation-maquettes.md#grille-de-relecture-v1). Ne jamais
    les remplir sans relecture réelle.
- `contenu.json` : le contenu (ci-dessous). **Ne crée pas `page.html`** : `npm run build` le génère.

## 2. Structure de `contenu.json`

```json
{
  "titresOnglets": { "explication": "Explication", "application": "S'entraîner", "mise-en-situation": "Défi" },
  "intro": "Phrase d'accueil de l'onglet Explication.",
  "niveaux": [
    {
      "titre": "Intuition : …", "niveau": "pour démarrer",
      "paragraphes": ["Texte avec **gras** et *italique*."],
      "exemple": { "titre": "Exemple", "etapes": ["Étape 1", "Étape 2"] },
      "aRetenir": "Optionnel : encadré à retenir."
    }
  ],
  "application": {
    "intro": "Consigne de la figure.",
    "figure": { "type": "pythagore" },
    "exercices": [ /* au moins 3 exercices */ ]
  },
  "situation": {
    "titre": "Titre de l'histoire", "histoire": ["Paragraphe…"],
    "etapes": [ /* au moins 2 exercices, débloqués un à un */ ],
    "conclusion": "Message de fin."
  }
}
```

- **Mémo (optionnel)** : ajoute `"memo"` dans `titresOnglets` (titre de l'onglet, défaut « Mémo ») et une section `memo` ; l'onglet apparaît après « Explication ». Sans section `memo`, aucun onglet n'est ajouté (les notions existantes sont inchangées). Pense à ajouter `memo` à `onglets` dans `fiche.md`. Exemple : `catalogue/pythagore/`.
  ```json
  "memo": {
    "intro": "Optionnel : phrase d'accueil.",
    "formules": [ { "titre": "Hypoténuse", "formule": "BC² = AB² + AC²", "explication": "Optionnel." } ],
    "pointsCles": ["Point à retenir avec **gras**."]
  }
  ```
  Au moins une formule ou un point clé est requis.
- **Niveaux** : au moins 2, du plus intuitif au plus formel (collège → lycée), avec le niveau scolaire dans `niveau`. Le premier est ouvert par défaut.
- **Exercice `qcm`** : `question`, `choix` (≥ 2), `bonne` (indice à partir de 0), `explication` (affichée après la bonne réponse), `indice` optionnel (affiché après une erreur), et en option `erreurs` : `[{ "choix": 1, "message": "…" }]`, une explication ciblée pour une mauvaise réponse précise (elle remplace l'indice général pour ce choix).
- **Exercice `nombre`** : `question`, `reponse` (nombre), `indices` (≥ 1, affichés un par erreur), `solution`, et en option `unite`, `tolerance` (ex. `0.05` pour un arrondi au dixième), `fractionIrreductible: true` (l'élève doit écrire une fraction simplifiée, ex. `3/4`), et `erreurs` : `[{ "reponse": 21, "tolerance": 0.05, "message": "…" }]`, les **erreurs fréquentes** (oubli du carré, de la racine, mauvais arrondi…). Une réponse qui correspond à une erreur fréquente reçoit son explication ciblée, suivie de l'indice suivant. Le build refuse une erreur qui recouvre la bonne réponse ou une autre erreur. L'élève peut écrire `3,5`, `3.5` ou `7/2`. Exemple : `catalogue/pythagore/contenu.json`.
- **Figures** (`application.figure.type`) :
  - `pythagore` : `a`, `b` (côtés initiaux).
  - `fraction` : `numerateur`, `denominateur`.
  - `proportion` : `libelleX`, `libelleY` (requis), `libelleCoefficient`, `unite`, `coefficient`, `coefficientMin`, `coefficientMax`, `pas`, `x`, `xMax`.
  - `thales` : `ab`, `ac` (longueurs initiales de 1 à 20), `angle` (angle en A, de 15° à 165°), `rapport` (rapport de réduction initial, de 0,1 à 0,9). Les paramètres sont facultatifs.

## 3. Vérifier

```bash
npm run build        # génère page.html et pose les hashes CSP
npm run ci           # validation du contenu, routage des questions, contrôle de sécurité, tests navigateur
```

Ouvre `catalogue/<id>/page.html` dans un navigateur et fais tous les exercices. **Relis l'exactitude de chaque calcul** : c'est le point de contrôle humain (public mineur).

Pour l'histoire, vérifie les dates, les personnages et les liens de causes-conséquences, ainsi que
les limites des droits et les différences entre territoires. Les fiches indiquent des ressources de
relecture ; les pages restent autonomes, sans ressource externe. Distingue repère conventionnel,
évolution progressive et application effective d'une loi.

## 3 bis. Événements pédagogiques (automatiques)

Chaque page générée émet, sans rien à écrire dans `contenu.json`, les événements du contrat v1
([ADR 0025](decisions/0025-contrat-evenements-pedagogiques.md)) vers le tableau de bord : `demarre`, `reponse`, `indice`
(indice d'un QCM après la première erreur, indices gradués d'un exercice « nombre ») et `termine`. Les identifiants
d'exercice sont `app-N` (onglet S'entraîner) et `defi-N` (mise en situation). Une page écrite à la main inclut
`gabarit/jeux/evenements.js` et appelle `Evenements.emettre(...)`.

Dans la bulle du tableau de bord, l'iframe est isolée sans `allow-forms` : un composant d'exercice ne doit **jamais**
compter sur l'événement `submit` d'un formulaire (il n'y est pas déclenché). Utiliser un bouton et la touche Entrée.

## 4. Ajouter un composant

**Nouvelle figure** (ADR 0020) : chaque figure est un fichier à part, inséré par le build dans le moteur des seules pages qui l'utilisent.

1. `gabarit/figures/<type>.js` : `FIGURES.<type> = function <type>(conf) { … };`, qui renvoie l'élément de la figure. Les outils du moteur (`h`, `s`, `riche`, `paragraphe`, `nombreFr`, `exact`, `pgcd`, `curseur`, `tuile`) sont disponibles. Le type est découvert automatiquement.
2. Si les paramètres ont des contraintes : `scripts/lib/figures/<type>.mjs`, qui exporte `valider(conf, ou, { exiger, texteNonVide })`.
3. Une puce dans la liste des figures ci-dessus, et un test dans `tests/e2e/notions.test.mjs`.

Seule la page de la notion qui déclare la figure change : si `npm run build` modifie d'autres pages, c'est une erreur.

**Nouveau type d'exercice**, ou toute modification de `gabarit/moteur.js` : l'ajouter dans `TYPES_EXERCICE` du moteur et de `scripts/lib/gabarit.mjs` (avec sa validation), le documenter ici et le tester. Toutes les pages générées sont alors régénérées : relis leur diff.
