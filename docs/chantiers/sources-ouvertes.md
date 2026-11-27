# Chantier : sources de données ouvertes de l'Éducation nationale

**Niveau actuel : 2 (lots 1 à 6 livrés ; correspondances à relire, Futur Pro écarté)**

Décision : [ADR 0044](../decisions/0044-sources-ouvertes-education.md). Rapport généré :
[docs/referentiel/sources-ouvertes.md](../referentiel/sources-ouvertes.md).

## Pourquoi

Le portail [data.education.gouv.fr](https://data.education.gouv.fr) publie 314 jeux de données, presque tous sous
Licence Ouverte 2.0 (Etalab). Trois jeux servent directement KermicLab :

- les **évaluations nationales Repères** (CP, CE1, CE2, CM1, CM2 : taux de maîtrise nationaux par compétence, DEPP),
  pour savoir quelles notions du catalogue enrichir ou relire en premier ;
- les **programmes d'enseignement** (DGESCO), pour rattacher chaque fiche à son texte officiel ;
- le **calendrier scolaire** (DNE), pour caler le cahier de vacances sur les vraies vacances de chaque zone.

Écartés : annuaire et géolocalisation des établissements, IPS, résultats par établissement, effectifs, données RH et
d'usage des plateformes (rien sur les notions ; plusieurs vont contre le principe « aucune donnée personnelle »).

## Lots

| Lot | Contenu | Statut |
|---|---|---|
| 1 | Socle : ADR 0044, ce chantier, module `scripts/lib/sources-ouvertes.mjs` (fonctions pures testées hors ligne), script `npm run sources:importer` (réseau, à la main) et instantanés versionnés `referentiel/sources-ouvertes/` avec provenance et licence | Fait |
| 2 | Évaluations → priorités : table `correspondances-evaluations.json` (compétence nationale → notions du catalogue, statut `proposition`), contrôle (compétence et notion connues), classement des notions par taux de maîtrise | Fait |
| 3 | Programmes ↔ fiches : rattachement de chaque fiche (matière, classes, niveaux) aux textes en vigueur du jeu DGESCO ; signalement des fiches sans texte et de l'ancienneté du jeu | Fait |
| 4 | Clôture : rapport `docs/referentiel/sources-ouvertes.md` vérifié par la CI, actions manuelles, CHANGELOG, `npm run ci` | Fait |
| 5 | Repère national dans le tableau de bord Professeur (« Mes élèves », « Suivi ») et l'Espace famille : à côté de chaque notion à revoir, le taux national de la compétence la moins maîtrisée qui la vise (`dist/reperes-nationaux.json`, publié par le build). La relecture humaine de la table reste une action manuelle | Fait (relecture : à faire) |
| 6 | Calendrier scolaire (DNE, Licence Ouverte) : instantané `calendrier-scolaire.json` (91 périodes, 13 zones, vacances des élèves) ; dans le cahier de vacances, le choix facultatif d'une zone préremplit les dates des prochaines vacances (zone ni conservée ni envoyée). Futur Pro : écarté, licence non publiée, et l'Espace Métiers est déjà alimenté par l'import ONISEP (ADR 0042, référentiel des métiers) | Fait |

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

## Signalement au producteur du jeu « programmes » (prêt à envoyer)

À envoyer par le formulaire de contact de la page du jeu
[fr-en-programmes-enseignement-premier-degre](https://data.education.gouv.fr/explore/dataset/fr-en-programmes-enseignement-premier-degre/)
(et de `fr-en-programmes-enseignement-2nd-degre`) :

> Bonjour,
>
> Nous réutilisons les jeux « Programmes d'enseignement du premier degré » et « Programmes d'enseignement du second
> degré » (Licence Ouverte 2.0). Les textes les plus récents qu'ils contiennent sont entrés en vigueur à la rentrée 2020
> (2021 pour quelques lignes). Il manque notamment les programmes de cycles 1 à 3 publiés en 2024 (français et
> mathématiques, entrés en vigueur à la rentrée 2025) et le programme d'enseignement moral et civique de 2024, et les
> textes qu'ils remplacent apparaissent encore comme en vigueur (champ « abrogé à la rentrée » vide).
>
> Une mise à jour est-elle prévue ? Merci pour la mise à disposition de ces données.
