# Chantier : catalogue de physique-chimie (programme complet)

**Niveau actuel : vague 1 (collège) en PR**

Objectif : couvrir le programme de physique-chimie du collège (cycle 4) à la terminale (spécialité), une notion par page, du plus
intuitif au plus formel. Même méthode que les mathématiques (`docs/chantiers/catalogue-maths.md`) : gabarit commun (ADR 0011),
une PR par vague, relecture humaine de l'exactitude, contrôles automatiques (contenu validé, questions routées, pages sûres,
chaque exercice résolu par un test navigateur). La matière d'une notion se lit dans son `sujet` (`physique-chimie/…`) : la barre
de navigation du chat affiche un onglet par matière. Statuts : `en ligne` / `PR ouverte` / `à faire`.

## Vague 1 — collège

| Notion (`id`) | Niveaux couverts | Figure | Statut |
|---|---|---|---|
| `etats-de-la-matiere` | 5e → seconde (modèle particulaire) | — | PR ouverte |
| `masse-volumique-et-melanges` | 5e → seconde (concentration en masse) | — | PR ouverte |
| `atomes-et-molecules` (et transformations chimiques) | 4e → seconde (ions) | — | PR ouverte |
| `acides-et-bases` | 3e → terminale (pKa) | — | PR ouverte |
| `mouvements` | 5e → seconde (principe d'inertie) | — | PR ouverte |
| `forces-et-poids` (et gravitation) | 4e → première | P = m × g réglable | PR ouverte |
| `electricite` (circuits, loi d'Ohm, puissance) | 5e → 3e | U = R × I réglable | PR ouverte |
| `energie` (conversions, énergie cinétique) | 5e → seconde | — | PR ouverte |
| `son-et-lumiere` (signaux) | 4e → seconde | — | PR ouverte |

## Vague 2 — seconde et première

| Notion | Statut |
|---|---|
| `quantite-de-matiere` (mole, concentration, dilution) | à faire |
| `tableau-periodique` (structure électronique, ions, liaisons) | à faire |
| `refraction-et-lentilles` | à faire |
| `oxydoreduction` | à faire |
| `energie-mecanique` (travail, énergies potentielle et mécanique) | à faire |
| `ondes` (ondes mécaniques, célérité, longueur d'onde) | à faire |
| `absorbance-et-dosages` (loi de Beer-Lambert, titrages) | à faire |

## Vague 3 — terminale (spécialité)

| Notion | Statut |
|---|---|
| `lois-de-newton` (deuxième loi, chute libre, mouvement dans un champ) | à faire |
| `gravitation-et-satellites` (lois de Kepler) | à faire |
| `cinetique-chimique` | à faire |
| `radioactivite` | à faire |
| `thermodynamique` (premier principe, transferts thermiques) | à faire |
| `condensateur-et-circuit-rc` | à faire |
| `diffraction-et-interferences` | à faire |

## Points d'attention

- **Mots-clés** : la physique-chimie partage du vocabulaire avec les maths (« vitesse », « puissance », « transformations »…).
  Préférer des mots-clés de plusieurs mots (« puissance électrique », « transformations chimiques ») et éviter les mots courants
  (« son », « base », « solution » seuls).
- **Données** : valeurs usuelles du programme (g = 9,8 N/kg, son ≈ 340 m/s dans l'air, c = 3,0 × 10⁸ m/s).
- **Sécurité** : rappeler les consignes (acides et bases corrosifs, court-circuit, niveaux sonores) ; aucune expérience dangereuse proposée.
