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

- **Niveaux** : au moins 2, du plus intuitif au plus formel (collège → lycée), avec le niveau scolaire dans `niveau`. Le premier est ouvert par défaut.
- **Exercice `qcm`** : `question`, `choix` (≥ 2), `bonne` (indice à partir de 0), `explication` (affichée après la bonne réponse), `indice` optionnel (affiché après une erreur).
- **Exercice `nombre`** : `question`, `reponse` (nombre), `indices` (≥ 1, affichés un par erreur), `solution`, et en option `unite`, `tolerance` (ex. `0.05` pour un arrondi au dixième), `fractionIrreductible: true` (l'élève doit écrire une fraction simplifiée, ex. `3/4`). L'élève peut écrire `3,5`, `3.5` ou `7/2`.
- **Figures** (`application.figure.type`) :
  - `pythagore` : `a`, `b` (côtés initiaux).
  - `fraction` : `numerateur`, `denominateur`.
  - `proportion` : `libelleX`, `libelleY` (requis), `libelleCoefficient`, `unite`, `coefficient`, `coefficientMin`, `coefficientMax`, `pas`, `x`, `xMax`.

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

## 4. Ajouter un composant

Nouvelle figure ou nouveau type d'exercice : l'ajouter dans `gabarit/moteur.js` (objet `FIGURES` ou `TYPES_EXERCICE`), le déclarer dans `scripts/lib/gabarit.mjs` (`TYPES_FIGURE` ou `TYPES_EXERCICE`, avec sa validation), le documenter ici et le tester dans `tests/e2e/notions.test.mjs`. Toutes les pages générées sont alors régénérées : relis leur diff.
