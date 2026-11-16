# Points restant ouverts

Points restant ouverts après la décision finale du 2026-11-09. **Aucun ne bloque l'implémentation.**

| ID | Statut | Position retenue en attendant |
|---|---|---|
| OPEN-C01 | ouvert | option A : verser les textes primaires ; risque accepté qu'une [P] devienne obsolète |
| OPEN-C02 | **résolu** | toutes les [P] sont acceptées (décision finale §1) |
| OPEN-C03 | ouvert | définitions éditoriales de S3.1 §2 conservées |
| OPEN-C04 | ouvert (faible) | 9 disciplines de S4.1 §4 |
| OPEN-C05 | ouvert | codes de Stage au format libre ; une liste fermée pourra s'ajouter sans rupture |

## OPEN-C01 — Textes primaires

- **Question** : les textes S1, S2, S3.1, S3.2, S4.1 à S4.8 et l'audit v1.1.1 confirment-ils les sections reconstruites ?
- **Pourquoi ouvert** : ils n'ont pas été fournis.
- **Option A** : les verser ; chaque [P] contredite devient [OBSOLETE], chaque [P] confirmée devient [B].
- **Option B** : déclarer ce paquet (après acceptation) comme texte de référence ; les anciens textes deviennent historiques.
- **Recommandation** : A. Les textes primaires sont plus autoritaires (`AUTHORITY_INDEX.md`).
- **Décision humaine requise** : OUI.

## OPEN-C02 — Acceptation des propositions [P]

- **Question** : chaque règle marquée [P] est-elle acceptée, modifiée ou refusée ?
- **Pourquoi ouvert** : une proposition n'a aucune autorité.
- **Méthode** : `GATES.md`, case par case. Une [P] refusée redevient un OPEN avec sa question d'origine (`DECISIONS.md`).
- **Décision humaine requise** : OUI.

## OPEN-C03 — Sens exact de `supports` et `extends`

- **Question** : les définitions de S3.1 §2 (« facilite sans être indispensable », « prolonge ou généralise ») sont-elles celles de S3.1 ?
- **Pourquoi ouvert** : le handoff ne donne que les noms et les contraintes.
- **Impact** : éditorial (choix du type par les auteurs) ; aucune règle de validation ne change.
- **Décision humaine requise** : OUI.

## OPEN-C04 — Liste des disciplines

- **Question** : faut-il ajouter dès 1.2.0 des disciplines absentes du catalogue (technologie, langues vivantes, arts, EPS, numérique) ?
- **Impact** : liste fermée de S4.1 §4 ; ajouter plus tard est un changement mineur.
- **Recommandation** : s'en tenir aux 9 disciplines actuelles.
- **Décision humaine requise** : OUI (faible).

## OPEN-C05 — Codes de Stage français

- **Question** : faut-il une liste fermée des codes (`petite-section` … `terminale`, `cycle-1` … `cycle-4`) ?
- **Impact** : avec une liste fermée, `S4-CUR-006` pourrait refuser une coquille ; sans elle, le code n'est qu'un segment d'ID valide.
- **Recommandation** : liste fermée **par juridiction**, dans une annexe de S4.5 à la publication de 1.2.0.
- **Décision humaine requise** : OUI.
