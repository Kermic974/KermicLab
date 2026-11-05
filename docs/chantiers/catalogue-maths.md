# Chantier : catalogue de mathématiques (programme complet)

**Niveau actuel : programme complet rédigé (36 notions) — collège en ligne, vagues 3 et 4 (lycée) en PR**

Objectif : couvrir le programme de mathématiques de la 6e à la terminale (spécialité), une notion par page, du plus intuitif au plus formel.
Méthode : gabarit commun (ADR 0011, guide `docs/gabarit.md`), **une PR par vague** de 8 notions environ, pour que la relecture humaine
de l'exactitude reste possible (public mineur). Statuts : `en ligne` / `PR ouverte` / `à faire`.

Chaque vague est contrôlée automatiquement : contenu validé, questions d'exemple routées vers leur page, contrôle de sécurité des pages,
et un test navigateur qui résout **tous** les exercices avec la réponse attendue (`tests/e2e/notions.test.mjs`).

## Pilote et vague 1 — collège, cœur du brevet

| Notion (`id`) | Niveaux couverts | Figure | Statut |
|---|---|---|---|
| `trigo-cercle` (page écrite à la main) | 3e → terminale | cercle trigonométrique | en ligne |
| `pythagore` | 4e → première (Al-Kashi) | carrés sur les côtés | en ligne |
| `fractions` | 6e → seconde (rationnels) | barres partagées | en ligne |
| `proportionnalite` (et pourcentages) | 6e → seconde (évolutions) | tableau et droite | en ligne |
| `nombres-relatifs` | 5e → seconde (valeur absolue) | — | en ligne |
| `puissances` | 4e → seconde | — | en ligne |
| `calcul-litteral` | 5e → seconde | — | en ligne |
| `equations` (et inéquations) | 4e → seconde | — | en ligne |
| `thales` | 4e → seconde (homothétie) | — | en ligne |
| `statistiques` | 5e → seconde (quartiles, écart type) | — | en ligne |
| `probabilites` | 5e → seconde (loi des grands nombres) | simulateur de dé | en ligne |
| `fonctions-affines` | 3e → seconde (variations) | droite y = ax + b | en ligne |

## Vague 2 — collège, compléments

| Notion | Niveaux | Figure envisagée | Statut |
|---|---|---|---|
| `nombres-decimaux` | 6e | — | en ligne |
| `priorites-operatoires` | 5e | — | en ligne |
| `arithmetique` (diviseurs, nombres premiers, PGCD) | 5e → 3e | — | en ligne |
| `perimetres-aires` | 6e → 4e | — | en ligne |
| `volumes` | 6e → 3e | — | en ligne |
| `angles` (et triangles, parallèles) | 6e → 5e | — | en ligne |
| `transformations` (symétries, translation, rotation, homothétie) | 6e → 3e | — | en ligne |
| `vitesse` (grandeurs composées, conversions) | 4e → 3e | — | en ligne |

## Vague 3 — seconde et première

| Notion | Niveaux | Statut |
|---|---|---|
| `vecteurs` | seconde | PR ouverte |
| `droites-et-systemes` (équations de droites, systèmes) | seconde | PR ouverte |
| `fonctions-de-reference` (carré, inverse, racine) | seconde | PR ouverte |
| `second-degre` | première | PR ouverte |
| `derivation` | première | PR ouverte |
| `suites` | première | PR ouverte |
| `exponentielle` | première | PR ouverte |
| `produit-scalaire` | première | PR ouverte |
| `probabilites-conditionnelles` | première | PR ouverte |

## Vague 4 — terminale (spécialité)

| Notion | Statut |
|---|---|
| `limites-et-continuite` | PR ouverte |
| `logarithme` | PR ouverte |
| `integrales` | PR ouverte |
| `recurrence` | PR ouverte |
| `denombrement` | PR ouverte |
| `loi-binomiale` | PR ouverte |
| `geometrie-dans-l-espace` | PR ouverte |

## Revue et plan des labs interactifs

L'inventaire du catalogue couvre **36 notions**, réparties entre nombres et calcul, géométrie,
fonctions et analyse, statistiques et probabilités. Les notions citées comme exemples — Pythagore,
Thalès et équations — ont déjà leur page : il faut enrichir ces pages, pas en créer de doublons.

Le cercle trigonométrique sert de **référence d'expérience** : manipuler une représentation, observer
les valeurs se mettre à jour, apprendre par étapes, puis réinvestir dans un défi. Les autres pages
restent dans le gabarit commun (explication, application, défi), autonome et utilisable hors ligne.
On ne crée pas une application distincte par notion.

### État des interactions

Le gabarit sait déjà représenter Pythagore (triangle et aires), les fractions (barres), la
proportionnalité (tableau et droite), les fonctions affines, les paraboles et les probabilités
(simulateur de dé). Le cercle trigonométrique est une page interactive écrite à la main. Les pages
Thalès, équations, systèmes et statistiques ont des exercices corrigés, mais pas encore de figure
interactive dédiée : ce sont les lacunes prioritaires pour rapprocher leur pratique de celle du
cercle.

### Ordre proposé

| Priorité | Page existante | Lab à ajouter | Intention pédagogique et garde-fous |
|---|---|---|---|
| 1 | `thales` | Figure « configuration de Thalès » : faire varier les longueurs ou le rapport de réduction, afficher les triangles semblables, les parallèles et les rapports correspondants. | Faire voir pourquoi les rapports sont égaux avant d'appliquer le produit en croix. Prévoir des valeurs non dégénérées et distinguer le théorème de sa réciproque. |
| 2 | `equations` | Figure « balance » : représenter les deux membres et appliquer la même opération des deux côtés pour isoler l'inconnue. | Commencer par des équations du type `ax + b = c` ; rendre visibles les étapes et la vérification. Pas de parseur général d'expressions dans le premier lot. |
| 3 | `droites-et-systemes` | Figure à deux droites réglables, avec coordonnées de l'intersection et cas sécant, parallèle ou confondu. | Réutiliser les conventions visuelles de la figure affine ; relier une solution du système au point d'intersection, sans masquer les cas sans solution ou avec une infinité de solutions. |
| 4 | `statistiques` | Petit jeu de données manipulable ou sélectionnable, avec mise à jour des indicateurs et de leur représentation. | Rendre visibles moyenne, médiane et dispersion ; utiliser des données fictives, bornées et adaptées au niveau, et expliquer les effets d'une valeur extrême. |
| Suite | `angles`, `transformations`, `perimetres-aires`, `volumes`, `vecteurs`, `geometrie-dans-l-espace` | Labs géométriques ciblés, à choisir selon les retours : rotation/symétrie, changement de dimensions, composition de vecteurs ou déplacement de points en 3D. | Réutiliser une même grammaire de manipulation et ne créer une nouvelle figure que si elle aide réellement à comprendre une notion. |

Pythagore, fractions, proportionnalité, fonctions affines, second degré et probabilités disposent
déjà d'une représentation interactive : conserver ces figures comme références et les améliorer
seulement si les essais révèlent un obstacle pédagogique ou d'accessibilité. Le cercle reste le
modèle de profondeur du parcours, pas un composant à recopier dans chaque page.

### Découpage et critères d'acceptation

1. **Lot Thalès** : définir et valider le schéma de configuration, ajouter la figure au moteur et au
   validateur du gabarit, documenter son format dans `docs/gabarit.md`, l'intégrer à
   `catalogue/thales/contenu.json` et tester les variations et les cas limites dans
   `tests/e2e/notions.test.mjs`.
2. **Lot balance** : après le lot Thalès, ajouter la figure à `equations`, avec opérations
   réversibles et vérification de la solution. Tester les équations choisies ainsi que les
   situations où une opération n'est pas permise.
3. **Lots suivants** : réaliser le graphique des systèmes, puis le lab de statistiques. Réévaluer
   les priorités après les retours sur les deux premiers labs plutôt que de lancer plusieurs
   figures concurrentes dans `gabarit/moteur.js`.

Pour chaque lot : conserver les trois onglets et la progression du plus intuitif au plus formel ;
mettre à jour le schéma de validation, le guide et les tests navigateur ; vérifier clavier, tactile,
mobile et annonces accessibles ; résoudre chaque exercice automatiquement ; garder la page autonome,
sans réseau ni collecte de données ; enfin, faire relire l'exactitude mathématique avant fusion.

## Points d'attention

- **Mots-clés** : une question d'exemple doit être routée vers sa page. Préférer des mots-clés de plusieurs mots aux mots trop généraux
  (« angle » seul enverrait « le cosinus d'un angle » vers la mauvaise page).
- **Exactitude** : relecture humaine obligatoire avant fusion (idéalement par un enseignant).
- **Traductions** : pages en français seulement ; une demande en anglais crée une issue `traduction-manquante` et sert la version française.
- **Dépôt privé** : les notions vivent dans `catalogue/` (public) tant que l'agent n'a pas accès à `maquettes-catalogue`.
