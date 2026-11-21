# Relations à revoir (densification du référentiel)

Liens envisagés mais **non créés** : incertains, bloqués par une règle ou purement thématiques. Chaque entrée indique la raison. À arbitrer par la relecture humaine avant toute création.

## Physique-chimie

| Lien envisagé | Raison de l'écart |
|---|---|
| `acides-et-bases` ← `quantite-de-matiere` | Les sections « pH et concentration » (seconde/première) et le titrage mobilisent la concentration, mais `acides-et-bases` commence au cycle 4 et `quantite-de-matiere` en seconde : le garde-fou de niveau du build refuse un prérequis plus avancé. À traiter en scindant la notion par niveau. |
| `forces-et-poids` ← `mouvements` | Le bilan des forces (seconde/première) s'appuie sur le principe d'inertie, mais les deux notions partagent le cycle 4 et la dépendance inverse est tout aussi défendable. Lien d'étude, pas un prérequis établi. |
| `condensateur-et-circuit-rc` ← `energie` | L'énergie stockée relève d'une notion d'énergie plus générale, mais la section reste autonome. |
| `energie` ← `electricite` | La puissance et l'énergie électriques sont traitées dans les deux notions sans qu'une soit un préalable de l'autre. |
| `absorbance-et-dosages` ← `son-et-lumiere` | La couleur et l'absorbance reposent sur des notions de lumière du cycle 4, mais le lien est faible. |

## SVT

| Lien envisagé | Raison de l'écart |
|---|---|
| `genetique-et-heredite` ← `reproduction-humaine` | Les gamètes sont un préalable plausible à la transmission des chromosomes, mais le lien inverse (méiose ← reproduction) est retenu et les deux notions sont du même niveau : pas de sens d'apprentissage établi. |
| `respiration-et-circulation` ← `nutrition-et-digestion` | Les nutriments passent dans le sang, mais chaque notion reste autonome au collège. |
| `ecosystemes-et-biodiversite` ← `photosynthese` | Les producteurs primaires relèvent des deux notions ; dépendance réciproque, aucune n'est préalable. |
| `histoire-de-la-terre-et-datation` ← physique-chimie (`radioactivite`) | La datation absolue utilise la décroissance radioactive. Correction : le validateur n'interdit pas un `requires` entre disciplines (il vérifie seulement le type de la cible) ; le lien n'est pas créé parce que la notion de physique-chimie est terminale et que la dépendance dans la fiche reste partielle. À arbitrer. |
| `histoire-de-la-terre-et-datation` ← `evolution` | Les fossiles stratigraphiques supposent une idée d'évolution ; lien faible. |

## SES

| Lien envisagé | Raison de l'écart |
|---|---|
| `monnaie` ← `marche-concurrentiel` | La monnaie sert à comparer des prix, mais sa création bancaire ne dépend pas du modèle de marché. |
| `croissance-economique` ← `monnaie` | Lien thématique, pas de préalable cognitif. |

## EMC

| Lien envisagé | Raison de l'écart |
|---|---|
| `egalite` ← `droits-de-lhomme`, `fraternite` ← `droits-de-lhomme` | Pertinents pédagogiquement, mais `egalite` et `fraternite` sont classées en 5e et `droits-de-lhomme` en 4e : le garde-fou de classe du build refuse un prérequis plus avancé. Exprimés en `relatedTo`. |
| `democratie` ← `etat-de-droit` | Dépendance conceptuelle réciproque ; exprimée en `relatedTo`. |

## Géographie

| Lien envisagé | Raison de l'écart |
|---|---|
| `urbanisation` ← `mobilites` | Les mobilités domicile-travail structurent la ville, mais l'urbanisation reste compréhensible seule. |
| `risques-naturels` ← `changement-climatique` | Contexte, non préalable ; exprimé en `relatedTo`. |
| `union-europeenne` ← `mondialisation` | L'UE s'étudie aussi comme ensemble régional sans passer par les flux mondiaux. |

## Français

| Lien envisagé | Raison de l'écart |
|---|---|
| `roman`, `poesie`, `theatre`, `litterature-didees` entre genres | Aucune dépendance entre genres n'est créée (règle du lot). L'analyse de texte est reliée aux genres par `relatedTo`. |
| `grammaire-phrase-complexe` ← `conjugaison-temps` | La reconnaissance des verbes aide à compter les propositions, mais le lien est faible. |

## Histoire

| Lien envisagé | Raison de l'écart |
|---|---|
| `moyen-age` ← `antiquite`, `renaissance` ← `moyen-age` | Chronologie, pas prérequis : aucune compréhension d'une notion ne mobilise explicitement la précédente dans les fiches. |
| `ve-republique` ← `revolution-francaise` | La Constitution et les pouvoirs sont étudiés à part ; lien faible. |
| `monde-depuis-1990` ← `decolonisation` | Contexte seulement. |

## Philosophie

Aucun `requires` n'est créé : les notions sont en rapport conceptuel sans ordre d'apprentissage strict. 14 relations `relatedTo` justifient les voisinages utiles (ex. `raison`–`science`, `etat`–`liberte-philosophie`). D'autres rapprochements possibles (`langage`–`verite`, `justice-philosophie`–`devoir`) n'ont pas été retenus faute d'ancrage dans les sections des fiches.

## Technologie

| Lien envisagé | Raison de l'écart |
|---|---|
| Nouveaux `requires` entre notions de technologie | Aucun ajouté : le graphe déjà déclaré dans les fiches (objets, matériaux, programmation, réseaux, NSI, sciences de l'ingénieur) couvre les dépendances justifiées par les sections. |
| `objets-electriques-et-materiaux-c2` projeté vers la fiche | Les niveaux de cycle 2 ne sont pas projetables : l'énumération des codes d'étape du schéma `stage` s'arrête à `cycle-3`. Les objets existent, sans CurriculumMapping ; l'ajout de `cycle-2` au contrat est une décision de schéma à prendre (ADR). |

## Anglais, arts plastiques, musique, EPS

| Lien envisagé | Raison de l'écart |
|---|---|
| Liens entre matières (anglais ↔ français, musique ↔ arts, EPS ↔ SVT) | Aucune dépendance cognitive établie dans les fiches ; relations thématiques seulement. À exprimer en `relatedTo` si la relecture le juge utile. |
| Prérequis supplémentaires à l'intérieur d'une matière | Aucun : les chaînes déclarées dans les fiches sont déjà continues du cycle 2 (ou 3) au lycée. |

## Notions ajoutées depuis la V0

Aucun lien nouveau n'a été créé ni écarté dans ce lot : les `requires` reprennent les prérequis déjà déclarés dans les fiches. Les liens depuis les notions V0 vers ces notions (cycle précédent) restent proposés dans `propositions-liens-cycles-2-3-4.md`, à qualifier par le processus S4. Les justifications générées des 365 liens sont à enrichir à la relecture.

## Liens depuis les notions V0 vers les cycles précédents

Voir la [qualification des propositions](propositions-liens-cycles-2-3-4.md#résultat-de-la-qualification). Non créés : `la-cellule` ← `classification-du-vivant-cm` et `classification-du-vivant-6e` (classer n'est pas un préalable à la cellule) ; `afrique-australe` et `ressources` ← `question-demographique-c4` (lien faible) ; `theatre` ← `contes-fables-mythes-6e` (genres sans dépendance) ; `changement-climatique` ← `mieux-habiter-cm` ; `dynamiques-territoriales` ← `france-territoires` et `espaces-productifs` ← `dynamiques-territoriales` (liens faibles) ; `evolution` ← `ecosystemes-et-biodiversite` ; `forces-et-poids` ← `mouvements` (voir section Physique-chimie) ; `genetique-et-heredite` ← `reproduction-humaine` (voir section SVT) ; `antiquite` ← `prehistoire-cm` ; `moyen-age` ← `empire-romain-christianisme-6e` et `renaissance` ← `moyen-age` (chronologie) ; `probabilites-conditionnelles` ← `statistiques-et-echantillonnage-l` ; `geometrie-dans-l-espace` ← `orthogonalite-et-espace-l` (lien inverse) ; `integrales` ← `primitives-et-equations-differentielles-l` (cycle).

