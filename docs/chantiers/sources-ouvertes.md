# Chantier : sources de données ouvertes de l'Éducation nationale

**Niveau actuel : 1 (socle livré, correspondances à relire)**

Décision : [ADR 0042](../decisions/0042-sources-ouvertes-education.md). Rapport généré :
[docs/referentiel/sources-ouvertes.md](../referentiel/sources-ouvertes.md).

## Pourquoi

Le portail [data.education.gouv.fr](https://data.education.gouv.fr) publie 314 jeux de données, presque tous sous
Licence Ouverte 2.0 (Etalab). Deux familles servent directement KermicLab :

- les **évaluations nationales Repères** (CP, CE1, CE2, CM1, CM2 : taux de maîtrise nationaux par compétence, DEPP),
  pour savoir quelles notions du catalogue enrichir ou relire en premier ;
- les **programmes d'enseignement** (DGESCO), pour rattacher chaque fiche à son texte officiel.

Écartés : annuaire et géolocalisation des établissements, IPS, résultats par établissement, effectifs, données RH et
d'usage des plateformes (rien sur les notions ; plusieurs vont contre le principe « aucune donnée personnelle »).

## Lots

| Lot | Contenu | Statut |
|---|---|---|
| 1 | Socle : ADR 0042, ce chantier, module `scripts/lib/sources-ouvertes.mjs` (fonctions pures testées hors ligne), script `npm run sources:importer` (réseau, à la main) et instantanés versionnés `referentiel/sources-ouvertes/` avec provenance et licence | Fait |
| 2 | Évaluations → priorités : table `correspondances-evaluations.json` (compétence nationale → notions du catalogue, statut `proposition`), contrôle (compétence et notion connues), classement des notions par taux de maîtrise | Fait |
| 3 | Programmes ↔ fiches : rattachement de chaque fiche (matière, classes, niveaux) aux textes en vigueur du jeu DGESCO ; signalement des fiches sans texte et de l'ancienneté du jeu | Fait |
| 4 | Clôture : rapport `docs/referentiel/sources-ouvertes.md` vérifié par la CI, actions manuelles, CHANGELOG, `npm run ci` | Fait |
| 5 | Relecture humaine des correspondances, puis affichage du repère national dans le tableau de bord Professeur | Backlog |
| 6 | Futur Pro (familles de métiers) pour l'Espace Métiers, après vérification de la licence ; calendrier scolaire pour les objectifs | Backlog |

## Fonctionnement

- `npm run sources:importer` télécharge les jeux (API Opendatasoft du portail), écrit les instantanés et régénère le
  rapport. Il n'est jamais lancé par la CI : la CI travaille sur les instantanés versionnés (déterminisme). Derrière un
  proxy HTTPS (sessions cloud), lancer `NODE_USE_ENV_PROXY=1 npm run sources:importer` : le `fetch` de Node ne lit pas
  `HTTPS_PROXY` sans cette variable.
- `npm run sources:rapport` régénère le rapport hors ligne, après une modification des correspondances ou du catalogue.
- `tests/unit/sources-ouvertes.test.mjs` vérifie les fonctions, la table de correspondance et que le rapport committé
  est à jour.

## Limites connues

- Le jeu « programmes » s'arrête aux textes entrés en vigueur en 2020-2021 : il ne contient pas les programmes de
  cycles 1 à 3 publiés en 2024 (mathématiques et français, rentrée 2025) ni l'EMC 2024. Pour le primaire et le collège,
  le texte rattaché est donc l'ancien. À signaler au producteur (action manuelle).
- Les taux sont nationaux (ligne « NATIONAL » du jeu régional), population « Ensemble », dernière année disponible.
  Les compétences changent d'intitulé d'une année à l'autre : la table de correspondance vise la dernière année.
