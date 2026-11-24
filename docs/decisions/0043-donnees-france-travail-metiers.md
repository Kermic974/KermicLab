# ADR 0043 — Espace Métiers : données de France Travail (ROME 4.0, marché du travail)

- Date : 2026-11-24 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : le propriétaire demande d'évaluer le catalogue francetravail.io pour enrichir l'Espace Métiers
  (ADR 0041, 0042) sur les débouchés des métiers, puis d'intégrer ces sources et de compléter le référentiel. Le
  référentiel porte déjà des codes ROME (repris de l'ONISEP) : c'est la clé commune à toutes les données de France
  Travail. Plan détaillé : [chantier Métiers](../chantiers/metiers.md), lots 7 à 10.

## Évaluation des sources (2026-11-24)

| Source | Accès | Licence | Retenue |
|---|---|---|---|
| **ROME 4.0**, « Toutes les données du ROME » (JSON, data.gouv.fr ; 4 API sur francetravail.io) | Ouvert, téléchargement sans compte | Licence Ouverte 2.0 | **Oui, lot 7 (fait)** : contextes de travail, transitions, mobilités, compétences et savoirs |
| **API Marché du travail** (francetravail.io) | Ouvert, compte et application francetravail.io (OAuth2) | Conditions d'utilisation de francetravail.io, à lire | **Oui, lot 8** : tension de recrutement, offres, embauches, salaire proposé, dynamique, par métier (ROME) et territoire, trimestriel |
| **Enquête BMO** (fichiers annuels, data.gouv.fr) | Ouvert | Licence Ouverte | **Oui, lot 9** : projets de recrutement, part difficile, part saisonnière, par bassin d'emploi ; codée en FAP 2021, passage FAP ↔ ROME de la DARES requis |
| API Sortants de formation et accès à l'emploi | Ouvert, compte | idem | Non : population de demandeurs d'emploi adultes, trompeuse pour des élèves |
| API La Bonne Boîte | Ouvert, compte | idem | Plus tard, espace Professeur seulement (stage d'observation de 3e) ; jamais à l'écran élève |
| API Offres d'emploi | Retirée de francetravail.io, accès sur demande | — | Non : offres nominatives inadaptées à un public mineur |

## Décision

1. **Même modèle que l'ONISEP (ADR 0042)** : chaque source entre par un **extrait daté et versionné**, réduit aux
   champs utiles, produit par un script lancé à la main ; la CI et les pages ne font aucun appel réseau ; les champs
   dérivés sont recalculés à chaque import, jamais saisis à la main.
2. **ROME 4.0** (`npm run import:rome`, `scripts/lib/rome.mjs`) : extrait
   `referentiel/sources/france-travail/rome-4.0-v<N>.json` (une fiche par code : intitulé, parent, transitions,
   contextes, compétences cœur de métier, savoirs hors certifications, mobilités ; ni définition ni texte d'accès).
   Champs dérivés d'un métier : `contextes` (dictionnaire `contextesTravail` à la racine), `transitions`
   (`ecologique` : emploi vert ou stratégique pour la transition écologique ; `numerique`), `proches` (métiers du
   référentiel atteints par les mobilités du ROME, 5 au plus). L'option `--preciser` remplace un code ROME v3 (fiche
   parent, venu de l'ONISEP) par la fiche ROME 4.0 de la même famille dont l'intitulé est exactement le nom du métier.
3. **Marché du travail et BMO** (lots 8 et 9) : seuls des **indicateurs agrégés** entrent dans le référentiel,
   ramenés à des paliers lisibles de 7 à 77 ans (« recrute beaucoup / moyennement / peu »), avec la période et la
   source affichées, et une phrase rappelant que la situation change. Champ prévu : `perspectives` (palier, période,
   portée France ou région, source). Aucune offre, aucune entreprise, aucune localisation de l'utilisateur.
4. **Identifiants** francetravail.io : secrets hors du dépôt (variables locales ou secrets d'environnement), lus par le
   seul script d'import ; aucun appel depuis le Worker ni depuis le navigateur.
5. **Attribution** : chaque source figure dans `sources` de `referentiel/metiers-v0.json`, affichée sous l'écran
   Métiers. La Licence Ouverte n'impose pas de partage à l'identique (contrairement à l'ODbL de l'ONISEP).

## Conséquences

- Lot 7 livré : 79 métiers sur 79 rattachés au ROME 4.0 (version 62, 19 octobre 2026), dont 7 codes choisis par
  l'agent pour des métiers sans code ONISEP et 13 codes précisés par `--preciser` ; 79 avec contextes de travail,
  39 avec une transition, 48 avec des métiers proches. Le détail d'un métier affiche transitions, conditions de travail
  et métiers proches (cliquables).
- Les vagues du lot 6 disposent des compétences et savoirs du ROME pour chaque candidat (`--candidats`), aide à la
  formulation des disciplines et des gestes, toujours relue par un humain.
- L'extrait ROME pèse environ 3 Mo (compétences et savoirs de 1 923 fiches) ; une fiche par ligne garde des diffs
  courts entre versions (deux versions du ROME par an).
- Preuves : `tests/unit/rome.test.mjs` (décodage, extrait, codes précis, enrichissement, alignement de l'extrait et du
  référentiel), `tests/unit/metiers.test.mjs` (validation des champs dérivés, contextes par type),
  `tests/e2e/metiers.test.mjs` (détail et attribution).
