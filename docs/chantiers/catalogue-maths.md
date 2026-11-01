# Chantier : catalogue de mathématiques (programme complet)

**Niveau actuel : collège en ligne (20 notions) ; vague 3 (seconde, première) en PR**

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
