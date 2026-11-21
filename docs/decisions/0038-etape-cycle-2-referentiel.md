# ADR 0038 — Étape `cycle-2` dans le référentiel canonique S4

Statut : proposé. Complète l'[ADR 0028](0028-adoption-contrats-s4.md) et l'[ADR 0037](0037-niveau-primaire-cm1-cm2.md).

## Contexte

Le catalogue couvre désormais le cycle 2 (CP, CE1, CE2). Le contrat `stage` du référentiel canonique n'admettait que `cycle-3`, `cycle-4`, `seconde`, `premiere` et `terminale` : les 51 notions de cycle 2 ne pouvaient recevoir aucun CurriculumMapping, donc aucun niveau projeté, et leurs fiches restaient hors projection (compétences génériques conservées). Le code de projection (`NIVEAUX_SCOLAIRES`) et le contrôle d'intégrité (`rangs`) connaissaient déjà `cycle-2` ; seul le schéma JSON l'ignorait.

## Décision

- Le champ `code` d'un Stage admet `cycle-2`, de type `cycle` (comme `cycle-3` et `cycle-4`).
- Les primitives `notion`, `microskill` et `skill` interdisent aussi `cycle-2` comme segment d'identifiant (le niveau n'est jamais encodé dans un ID), comme pour les autres niveaux.
- Le Stage `stage.mathematiques.cycle-2` est ajouté au programme de projection et les 51 notions de cycle 2 reçoivent leurs CurriculumMappings.
- Aucune autre évolution du contrat : types, relations, statuts et règles S4 sont inchangés.

## Conséquences

- Les fiches de cycle 2 sont projetées comme les autres : `prerequis`, `niveaux` et `competences` sont générés depuis le corpus canonique. Leurs valeurs de niveaux, classes et prérequis restent identiques.
- Toutes les notions du catalogue (hors jeux) sont désormais projetées.
- Fixtures de contrat ajoutées : `stage-cycle-2-valide`, `stage-cycle-2-incoherent` (type `grade` refusé) et `notion-id-niveau-cycle-2`.
- Compatibilité : les consommateurs qui énuméraient les codes de Stage doivent accepter `cycle-2` ; la recommandation et le cahier de vacances le reconnaissent déjà.
