# Chantier : catalogue de mathématiques (programme complet)

**Niveau actuel : vague 1 livrée (11 notions générées + `trigo-cercle`)**

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
| `nombres-relatifs` | 5e → seconde (valeur absolue) | — | PR ouverte |
| `puissances` | 4e → seconde | — | PR ouverte |
| `calcul-litteral` | 5e → seconde | — | PR ouverte |
| `equations` (et inéquations) | 4e → seconde | — | PR ouverte |
| `thales` | 4e → seconde (homothétie) | — | PR ouverte |
| `statistiques` | 5e → seconde (quartiles, écart type) | — | PR ouverte |
| `probabilites` | 5e → seconde (loi des grands nombres) | simulateur de dé | PR ouverte |
| `fonctions-affines` | 3e → seconde (variations) | droite y = ax + b | PR ouverte |

## Vague 2 — collège, compléments

| Notion | Niveaux | Figure envisagée | Statut |
|---|---|---|---|
| `nombres-decimaux` | 6e | droite graduée | à faire |
| `priorites-operatoires` | 5e | — | à faire |
| `arithmetique` (diviseurs, nombres premiers, PGCD) | 5e → 3e | — | à faire |
| `perimetres-aires` | 6e → 4e | — | à faire |
| `volumes` | 6e → 3e | — | à faire |
| `angles` (et triangles, parallèles) | 6e → 5e | — | à faire |
| `transformations` (symétries, translation, rotation, homothétie) | 6e → 3e | — | à faire |
| `vitesse` (grandeurs composées, conversions) | 4e → 3e | — | à faire |

## Vague 3 — seconde et première

| Notion | Niveaux | Statut |
|---|---|---|
| `vecteurs` | seconde | à faire |
| `droites-et-systemes` (équations de droites, systèmes) | seconde | à faire |
| `fonctions-de-reference` (carré, inverse, racine) | seconde | à faire |
| `second-degre` | première | à faire |
| `derivation` | première | à faire |
| `suites` | première | à faire |
| `exponentielle` | première | à faire |
| `produit-scalaire` | première | à faire |
| `probabilites-conditionnelles` | première | à faire |

## Vague 4 — terminale (spécialité)

| Notion | Statut |
|---|---|
| `limites-et-continuite` | à faire |
| `logarithme` | à faire |
| `integrales` | à faire |
| `recurrence` | à faire |
| `denombrement` | à faire |
| `loi-binomiale` | à faire |
| `geometrie-dans-l-espace` | à faire |

## Points d'attention

- **Mots-clés** : une question d'exemple doit être routée vers sa page. Préférer des mots-clés de plusieurs mots aux mots trop généraux
  (« angle » seul enverrait « le cosinus d'un angle » vers la mauvaise page).
- **Exactitude** : relecture humaine obligatoire avant fusion (idéalement par un enseignant).
- **Traductions** : pages en français seulement ; une demande en anglais crée une issue `traduction-manquante` et sert la version française.
- **Dépôt privé** : les notions vivent dans `catalogue/` (public) tant que l'agent n'a pas accès à `maquettes-catalogue`.
