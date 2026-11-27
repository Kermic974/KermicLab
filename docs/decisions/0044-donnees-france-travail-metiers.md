# ADR 0044 — Espace Métiers : données de France Travail (ROME 4.0, marché du travail)

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
| **Enquête BMO** (fichiers annuels, data.gouv.fr) | Ouvert | Licence Ouverte | **Oui, lot 9 (fait)** : projets de recrutement, part difficile, part saisonnière, par bassin d'emploi ; codée en FAP 2021, rattachée aux métiers par un code FAP choisi à la main |
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
3. **BMO** (`npm run import:bmo`, `scripts/lib/bmo.mjs`, lecture xlsx minimale sans dépendance) : extrait
   `referentiel/sources/france-travail/bmo-<année>.json` (totaux France par métier BMO, valeurs couvertes par le secret
   statistique exclues, donc minimales). La table de passage FAP ↔ ROME de la DARES n'étant pas téléchargeable
   automatiquement, chaque métier porte un champ `fap` choisi à la main (relecture humaine), et seulement quand le
   rattachement est sûr ; les métiers recrutés surtout par concours de la fonction publique, hors du champ de
   l'enquête, n'en ont pas. Champ dérivé `perspectives` : année, groupe BMO, projets, part difficile et saisonnière
   (%), palier (`fort`, `moyen`, `faible` : tiers du nombre de projets parmi les métiers BMO). L'écran cite le groupe
   BMO, la portée de l'enquête et rappelle que les chiffres changent chaque année.
4. **Marché du travail et BMO** (lots 8 et 9) : seuls des **indicateurs agrégés** entrent dans le référentiel,
   ramenés à des paliers lisibles de 7 à 77 ans (« recrute beaucoup / moyennement / peu »), avec la période et la
   source affichées, et une phrase rappelant que la situation change. Champ prévu : `perspectives` (palier, période,
   portée France ou région, source). Aucune offre, aucune entreprise, aucune localisation de l'utilisateur.
5. **Identifiants** francetravail.io : secrets hors du dépôt (variables locales ou secrets d'environnement), lus par le
   seul script d'import ; aucun appel depuis le Worker ni depuis le navigateur.
6. **Attribution** : chaque source figure dans `sources` de `referentiel/metiers-v0.json`, affichée sous l'écran
   Métiers. La Licence Ouverte n'impose pas de partage à l'identique (contrairement à l'ODbL de l'ONISEP).

## Conséquences

- Lot 7 livré : 935 métiers sur 1 131 rattachés au ROME 4.0 (version 62, 19 octobre 2026) après la fusion des vagues
  ONISEP ; 196 restent sans code ROME (fiches ONISEP sans code). 7 codes choisis par l'agent pour des métiers sans
  code ONISEP et 57 codes précisés par `--preciser` ; 935 avec contextes de travail, 402 avec une transition, 920 avec
  des métiers proches. Le détail d'un métier affiche transitions, conditions de travail et métiers proches (cliquables).
- Lot 9 livré : enquête BMO 2026 (217 métiers BMO) ; 66 métiers (ceux de la maquette V5 et de la vague pilote) rattachés par un code FAP choisi par l'agent ; les métiers des vagues ONISEP n'en ont pas encore
  (30 `fort`, 19 `moyen`, 17 `faible`), 13 sans rattachement (concours publics ou équivalent incertain). Le détail
  d'un métier affiche ses perspectives de recrutement.
- Lot 8 (API Marché du travail) **préparé sans données** (2026-11-27) : `npm run import:marche`
  (`scripts/importer-marche.mjs`, `scripts/lib/marche.mjs`) lit des réponses JSON enregistrées depuis la console de
  francetravail.io (aucune adresse de service devinée, aucun identifiant dans le dépôt), en extrait la tension
  (indicateur `PERSP_2`, cinq tranches, niveau France, par code ROME) et la range dans le champ `marche`
  (`tension` 1 à 5, `periode`), affichée dans le bloc « Perspectives de recrutement ». La forme des réponses est
  supposée (documentation inaccessible depuis l'environnement) : toute réponse différente est refusée avec un message
  clair, et le code s'ajuste au premier fichier réel. Tests sur réponses factices, marquées comme telles.
- Les vagues du lot 6 disposent des compétences et savoirs du ROME pour chaque candidat (`--candidats`), aide à la
  formulation des disciplines et des gestes, toujours relue par un humain.
- L'extrait ROME pèse environ 3 Mo (compétences et savoirs de 1 923 fiches) ; une fiche par ligne garde des diffs
  courts entre versions (deux versions du ROME par an).
- Preuves : `tests/unit/rome.test.mjs` (décodage, extrait, codes précis, enrichissement, alignement de l'extrait et du
  référentiel), `tests/unit/bmo.test.mjs` (lecture xlsx, agrégation, paliers, perspectives, alignement), `tests/unit/metiers.test.mjs` (validation des champs dérivés, contextes par type),
  `tests/e2e/metiers.test.mjs` (détail et attribution).
