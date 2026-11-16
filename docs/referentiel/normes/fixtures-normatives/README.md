# Fixtures normatives

Ce sont des **exemples normatifs** : ils précisent le sens des règles. Ce **ne sont pas** des fixtures d'implémentation définitives. Un validateur conforme doit cependant produire exactement les issues attendues pour chacun.

## Format d'un cas

```json
{
  "fixture": "042-validated-vers-draft",
  "description": "Texte humain",
  "specificationVersion": "1.2.0",
  "base": [ ... ],
  "candidate": [ ... ],
  "expected": {
    "verdict": "FAIL",
    "issues": [ { "rule": "S4-REF-005", "severity": "ERROR", "objectId": "…", "location": "/target" } ]
  }
}
```

| Champ | Sens |
|---|---|
| `specificationVersion` | valeur du manifeste de corpus (S4.8 §2) |
| `base` | révision de base (S4.2 §3). **Absent** : pas de base, les règles de comparaison ne s'appliquent pas. **Tableau vide** : base explicitement vide. |
| `candidate` | documents du corpus candidat, dans l'ordre (le rang sert à `location = document:<rang>`). Un document `{ "raw": "…" }` est un texte brut, pour les cas de niveau 1. |
| `expected.issues` | liste **exhaustive** des issues attendues. L'ordre n'est pas imposé ici ; le rapport réel suit l'ordre de S4.8 §4. `message` n'est pas comparé. `location` n'est comparé que s'il est indiqué. |
| `expected.verdict` | `PASS`, `PASS_WITH_WARNINGS` ou `FAIL` |

## Organisation

Un dossier par domaine (`syntaxe`, `identifiants`, `cycle-de-vie`, `versions`, `references`, `replaced-by`, `knowledge-core`, `relations`, `curriculum`, `mapping`, `provenance`). Les fichiers sont numérotés sans réutilisation. `index.json` liste chaque cas avec son verdict et ses Rule IDs.

## Couverture

Chaque règle du catalogue a au moins un cas, sauf :

- `S4-CUR-009` : garanti par construction (S4.5) ;
- `S4-RPT-001` à `S4-RPT-004` : règles du **validateur**, vérifiées par ses propres tests (déterminisme, verdict, code de sortie), pas par un corpus.

La colonne `fixtures` de `registres/RULE_CATALOG.csv` donne, pour chaque règle, les cas qui l'exercent.

## Objets de référence

Les cas réutilisent un petit corpus cohérent : Notions `theoreme-de-pythagore`, `carre-d-un-nombre`, `racine-carree` ; MicroSkills `calculer-l-hypotenuse`, `calculer-un-cote-de-l-angle-droit` ; Skill `resoudre-un-probleme-de-triangle-rectangle` ; Curriculum `mathematiques-cycle-4-2020` (cycle 4, cinquième, quatrième, domaine « Espace et géométrie ») et `mathematiques-seconde-2019`. **[R]** Ces contenus reprennent la notion pilote `pythagore` du dépôt.
