# ADR 0037 — Niveau « primaire » et classes CM1 / CM2

Statut : acceptée (à valider par le propriétaire à la fusion)

## Contexte

Le catalogue couvrait la 6e à la terminale. Le cycle 3 du programme comprend aussi le CM1 et le CM2, qui n'avaient ni niveau de
navigation ni classe dans le référentiel. Un élève de 9 à 11 ans ne trouvait donc aucune notion à sa portée dans l'écran Éducation.

## Décision

- Nouveau niveau de navigation `primaire` (valeur du champ `niveau` des fiches), rangé avant `college`.
- Le champ facultatif `classes` accepte `CM1` et `CM2` pour une notion de niveau `primaire` (cycle 3, déjà connu de `niveaux`) ;
  il exige `cycle-3` dans `niveaux`, comme la 6e. Une notion enseignée deux ans apparaît dans chacune de ses classes.
- Nouvelles matières `technologie`, `anglais`, `arts-plastiques`, `musique` et `eps` (sujet `<matière>/<id>`), libellés ajoutés dans les deux langues, pour couvrir tout le programme du cycle 3.
- Les notions du primaire portent le suffixe `-cm` quand elles ont un équivalent de collège (`fractions-cm`, `accords-cm`…), pour ne pas
  casser les liens existants. Leurs questions d'exemple sont distinctes de celles du collège (le routage donne la priorité à la
  question exacte).
- Les limites de progression locales (notions faites, collection de trophées, notions suivies par événements) passent de 200/300 à 600,
  car le catalogue dépasse 250 entrées.

## Conséquences

- Aucune migration : les fiches existantes ne changent pas.
- Le profil Professeur (6e à terminale) n'est pas modifié : il reste centré sur le collège et le lycée.
- Les notions du primaire sont générées par le gabarit commun ; leur relecture humaine reste à faire (champs `relue*` vides).

## Parcours et prérequis (ajout)

Le cycle 3 est un parcours continu CM1 → CM2 → 6e : chaque notion déclare ses `prerequis`, les **nouvelles** notions de 6e pointent vers leurs prolongements du primaire (les notions déjà présentes avant le cycle 3 relèvent du référentiel S4, qui génère leurs prérequis : leurs liens sont proposés dans `docs/referentiel/propositions-liens-cycles-2-3-4.md`), et `verifierGraphePrerequis` refuse un prérequis qui commence dans une classe plus avancée (ordre CM1, CM2, 6e, 5e, 4e, 3e). Le fil détaillé est dans `docs/chantiers/catalogue-primaire.md`.

## Cycle 2 (ajout)

Le niveau `primaire` couvre aussi les classes `CP`, `CE1` et `CE2` (cycle `cycle-2`). `NIVEAUX_SCOLAIRES` et l'ordre des classes (CP, CE1, CE2, CM1, CM2, 6e…) sont étendus ; la recommandation, le cahier de vacances et l'écran Éducation reconnaissent le cycle 2. Les schémas du référentiel canonique (`referentiel/schemas`) ne sont pas modifiés : ils décrivent un autre périmètre (objets canoniques S4/S6).

## Cycle 4 (ajout)

Les 39 notions `-c4` couvrent les matières absentes ou maigres du collège (technologie, anglais, arts, musique, EPS, trigonométrie, algorithmique…). Aucune évolution des classes : `5e`, `4e` et `3e` existaient déjà. Les fiches des notions de la V0 sont projetées depuis le référentiel S4 ; l'ajout de prérequis entre cycles pour ces notions passe par le processus S4 (voir `docs/referentiel/propositions-liens-cycles-2-3-4.md`).
