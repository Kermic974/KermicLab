# Propositions de liens de prérequis — cycles 2, 3 et 4

**Statut : proposition, à qualifier par le processus S4** ([README du référentiel](../../referentiel/README.md), [génération des lots](../../referentiel/generation-v0.5.md)).

## Pourquoi ce document

Les fiches des notions listées dans `referentiel/projection-v0.json` (les 165 notions de la V0 : collège, lycée, SES, philosophie…) ont leurs champs `prerequis`, `niveaux` et `competences` **générés** par `npm run build` à partir des objets canoniques de `referentiel/objets/`. Modifier ces champs à la main dans la fiche est inutile : le build les réécrit. C'est pourquoi les notions du cycle 2, du cycle 3 et du cycle 4 ajoutées après la V0 portent leurs propres prérequis (vers les notions existantes comme vers les nouvelles), mais **les notions existantes ne pointent pas encore vers les notions du cycle précédent**.

Pour que le parcours CP → CE1 → CE2 → CM1 → CM2 → 6e → 5e → 4e → 3e → seconde soit complet dans les deux sens (recommandation de la prochaine notion, cahier de vacances), il faut ajouter des relations `requires` (et les objets `notion` des cibles nouvelles) au référentiel. Ce travail est **volontairement laissé au processus S4** : les guides exigent une justification documentaire pour chaque nouveau prérequis, des objets en brouillon et une relecture, et un classement par niveau ne suffit pas à établir un prérequis. La liste ci-dessous est une **séquence pédagogique proposée**, pas une preuve.

## Liens proposés (notions existantes → notions du cycle précédent)

98 notions, 127 liens. Chaque cible est une notion du catalogue (cycle 2, cycle 3 ou cycle 4) ou une notion existante du cycle précédent.

| Notion existante | Classes | Prérequis proposés |
|---|---|---|
| `angles` | 6e, 5e | `angles-cm` |
| `antiquite` | 6e | `gaulois-gallo-romains-cm`, `prehistoire-cm` |
| `conjugaison-temps` | 6e, 5e | `conjugaison-cm`, `temps-du-recit-6e` |
| `ecosystemes-et-biodiversite` | 6e, 5e | `biodiversite-et-chaines-cm`, `classification-du-vivant-6e` |
| `espaces-ruraux` | 6e | `habiter-ville-campagne-cm`, `paysages-et-ressources-cm` |
| `fractions` | 6e, 5e, 4e | `fractions-cm`, `fractions-operations-cm` |
| `la-cellule` | 6e, 5e | `classification-du-vivant-cm`, `classification-du-vivant-6e` |
| `nombres-decimaux` | 6e | `nombres-decimaux-cm`, `calcul-avec-decimaux-cm` |
| `perimetres-aires` | 6e, 5e | `perimetre-aire-cm` |
| `photosynthese` | 6e, 5e | `developpement-vegetaux-cm`, `nutrition-et-alimentation-6e` |
| `proportionnalite` | 6e, 5e, 4e | `proportionnalite-cm`, `moyenne-et-proportions-cm` |
| `transformations` | 6e, 5e, 4e, 3e | `symetrie-axiale-cm`, `reproduire-et-agrandir-cm` |
| `volumes` | 6e, 5e, 4e, 3e | `volumes-contenances-cm` |
| `accords` | 5e, 4e | `orthographe-grammaticale-6e` |
| `analyse-texte` | 5e, 4e, 3e | `recit-d-aventures-6e` |
| `arithmetique` | 5e, 3e | `divisions-6e` |
| `calcul-litteral` | 5e, 4e, 3e | `priorites-operatoires`, `nombres-relatifs` |
| `changement-climatique` | 5e | `mieux-habiter-cm` |
| `discrimination` | 5e | `regles-vivre-ensemble-6e` |
| `egalite` | 5e | `regles-vivre-ensemble-6e` |
| `electricite` | 5e, 4e | `energie-et-signaux-6e` |
| `energie` | 5e, 3e | `energie-et-signaux-6e` |
| `etats-de-la-matiere` | 5e | `etats-matiere-et-melanges-6e` |
| `figures-de-style` | 5e, 4e, 3e | `poesie-6e` |
| `fraternite` | 5e | `engagement-et-solidarite-6e` |
| `masse-volumique-et-melanges` | 5e, 4e | `masse-et-volume-6e` |
| `moyen-age` | 5e | `empire-romain-christianisme-6e`, `clovis-charlemagne-cm`, `louis-ix-cm` |
| `nombres-relatifs` | 5e, 4e | `entiers-et-operations-6e`, `nombres-decimaux` |
| `nutrition-et-digestion` | 5e | `nutrition-et-alimentation-6e` |
| `poesie` | 5e, 4e, 3e | `poesie-6e` |
| `priorites-operatoires` | 5e | `entiers-et-operations-6e` |
| `probabilites` | 5e, 4e, 3e | `fractions` |
| `renaissance` | 5e | `francois-ier-cm`, `moyen-age` |
| `respiration-et-circulation` | 5e | `organisme-et-effort-6e` |
| `ressources` | 5e | `question-demographique-c4` |
| `risques-naturels` | 5e | `volcans-et-seismes-cm` |
| `statistiques` | 5e, 4e, 3e | `reperage-et-donnees-6e`, `moyenne-et-proportions-cm` |
| `temps-modernes` | 5e | `renaissance`, `louis-xiv-cm` |
| `theatre` | 5e, 4e, 3e | `contes-fables-mythes-6e` |
| `afrique-australe` | 4e | `question-demographique-c4` |
| `argumentation` | 4e, 3e | `ecrire-et-reecrire-c4` |
| `atomes-et-molecules` | 4e, 3e | `etats-de-la-matiere` |
| `droits-de-lhomme` | 4e | `droit-et-regle-6e` |
| `equations` | 4e, 3e | `calcul-litteral`, `nombres-relatifs` |
| `etat-de-droit` | 4e | `droit-et-regle-6e` |
| `grammaire-phrase-complexe` | 4e, 3e | `grammaire-de-la-phrase-5e-c4` |
| `justice` | 4e | `droit-et-regle-6e` |
| `laicite` | 4e | `laicite-et-liberte-cm` |
| `liberte` | 4e | `droit-et-regle-6e` |
| `lumieres` | 4e | `temps-modernes` |
| `mers-oceans` | 4e | `habiter-le-littoral-6e` |
| `metropolisation` | 4e | `urbanisation` |
| `migrations` | 4e | `question-demographique-c4` |
| `mobilites` | 4e | `se-deplacer-transports-cm` |
| `mondialisation` | 4e | `monde-en-villes-cm` |
| `mouvements` | 4e | `mouvement-et-vitesse-6e` |
| `napoleon` | 4e | `revolution-francaise` |
| `puissances` | 4e | `nombres-relatifs` |
| `pythagore` | 4e | `triangles-et-constructions-c4`, `puissances` |
| `reproduction-humaine` | 4e | `reproduction-et-cycles-de-vie-6e` |
| `revolution-francaise` | 4e | `lumieres`, `revolution-empire-cm` |
| `revolution-industrielle` | 4e | `age-industriel-cm` |
| `roman` | 4e, 3e | `recits-d-aventures-et-voyages-c4` |
| `seismes-et-volcans` | 4e | `terre-dans-le-systeme-solaire-6e` |
| `son-et-lumiere` | 4e | `lumiere-et-son-6e` |
| `thales` | 4e, 3e | `triangles-et-constructions-c4`, `proportionnalite` |
| `tourisme` | 4e | `habiter-le-littoral-6e` |
| `urbanisation` | 4e | `habiter-une-metropole-6e` |
| `vitesse` | 4e, 3e | `proportionnalite`, `mouvement-et-vitesse-6e` |
| `acides-et-bases` | 3e | `atomes-et-molecules`, `transformations-chimiques-c4` |
| `citoyennete` | 3e | `devise-republique-cm` |
| `construction-europeenne` | 3e | `france-europe-depuis-1945-cm`, `seconde-guerre-mondiale` |
| `decolonisation` | 3e | `colonisations-c4`, `seconde-guerre-mondiale` |
| `democratie` | 3e | `citoyen-et-engagement-cm` |
| `dynamiques-territoriales` | 3e | `france-territoires` |
| `engagement-civique` | 3e | `engagement-et-solidarite-6e` |
| `espaces-productifs` | 3e | `dynamiques-territoriales` |
| `evolution` | 3e | `ecosystemes-et-biodiversite` |
| `fonctions-affines` | 3e | `equations`, `notion-de-fonction-c4` |
| `forces-et-poids` | 3e | `mouvements` |
| `france-regions` | 3e | `france-europe-monde-cm` |
| `france-territoires` | 3e | `france-regions` |
| `genetique-et-heredite` | 3e | `la-cellule`, `reproduction-humaine` |
| `guerre-froide` | 3e | `seconde-guerre-mondiale` |
| `interet-general` | 3e | `democratie` |
| `monde-depuis-1990` | 3e | `guerre-froide` |
| `premiere-guerre-mondiale` | 3e | `guerres-mondiales-cm`, `colonisations-c4` |
| `seconde-guerre-mondiale` | 3e | `totalitarismes` |
| `systeme-immunitaire` | 3e | `microbes-et-sante-c4` |
| `totalitarismes` | 3e | `premiere-guerre-mondiale` |
| `union-europeenne` | 3e | `france-europe-monde-cm` |
| `ve-republique` | 3e | `republique-ecole-cm`, `decolonisation` |
| `fonctions-de-reference` | — | `notion-de-fonction-c4` |
| `quantite-de-matiere` | — | `transformations-chimiques-c4` |
| `refraction-et-lentilles` | — | `signaux-et-information-c4` |
| `tableau-periodique` | — | `atomes-et-molecules` |
| `trigo-cercle` | — | `trigonometrie-triangle-rectangle-c4` |
| `vecteurs` | — | `transformations` |

## Comment les traiter

1. Constituer une proposition JSON pour `node scripts/generer-lot-s4.mjs` (relations `requires` en brouillon, objets `notion` des cibles nouvelles, ajouts à `projection-v0.json`), avec la justification documentaire de chaque lien.
2. Faire relire le lot, puis `npm run build` et `npm run ci`.
3. Comparer la recommandation et le cahier de vacances avant/après, comme l'exige le guide.

Tant que ce lot n'est pas traité, le garde-fou du build (un prérequis ne commence pas dans une classe plus avancée) s'applique aux liens existants, et la recommandation propose les notions existantes sans exiger celles du cycle précédent.
