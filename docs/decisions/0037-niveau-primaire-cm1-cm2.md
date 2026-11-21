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
