# Gates de validation documentaire

Le paquet passe de `1.2.0` à `1.2.0` quand **toutes** les cases sont cochées par le propriétaire. Une case refusée renvoie la règle concernée dans `OPEN.md`.

Toutes les cases sont décochées : aucune proposition n'est encore acceptée.

## Préalables

- [ ] OPEN-C01 : textes primaires versés (non bloquant ; risque accepté)
- [x] OPEN-C02 : méthode d'acceptation des propositions [P] validée

## S1, S2, S3.1, S3.2

- [x] S1 : invariants S1-1 à S1-5 (S1-5 [P] : le référentiel ne dépend d'aucune page produit)
- [x] S2 : guide d'atomicité non bloquant ; frontière MicroSkill / Skill (WARNING `S4-KC-007`)
- [x] S3.1 : acyclicité type par type
- [ ] S3.1 : définitions exactes de `supports` et `extends` (OPEN-C03, non bloquant ; définitions éditoriales conservées)
- [x] S3.2 : `projectionKey` sans `version` ; nouvelle identité sans exception

## S4.1 Identifiants

- [x] patterns des 8 namespaces
- [x] IDs opaques pour Relation et CurriculumMapping + clés sémantiques
- [ ] liste fermée des disciplines (OPEN-C04, non bloquant ; les 9 disciplines de S4.1 §4 s'appliquent)
- [x] longueur maximale 160
- [x] WARNING lexical des termes de niveau

## S4.2 Cycle de vie et versions (S42-09)

- [x] cycle canonique et 4 transitions [B]
- [x] `active` et `retired` non canoniques [B]
- [x] `deprecated` terminal et figé [P]
- [x] objet nouveau en `draft` ou `review` [P]
- [x] suppression interdite après `validated` [P]
- [x] comparaison révision de base / révision candidate [P]
- [x] `version = 1` à la création, +1 exactement, statut compris [P]
- [x] matrice des références selon les statuts [B] + [P]
- [x] `replacedBy` : règles [B], namespace identique et chaîne historique [P]
- [x] gates `review → validated` par contrat [P]
- [x] distinction `version` / `curriculumVersion` [B]
- [x] répartition des niveaux de validation [B]

## S4.3 Knowledge Core

- [x] `label` et `description` localisés, `fr` obligatoire
- [x] gates `teaches` et `contributesTo` [B]

## S4.4 Relation

- [x] champs d'identité immuables ; `relationKey` unique tous statuts confondus
- [x] graphes hors Relations `deprecated`
- [x] définition de « `equivalentTo` durable »

## S4.5 Curriculum Graph

- [x] un Curriculum par édition institutionnelle ; format de `curriculumVersion`
- [x] `jurisdiction` ISO 3166-1 alpha-2
- [x] `stageType` ∈ {`cycle`, `classe`} ; `parent` et `order`
- [ ] liste fermée des codes de Stage par juridiction (OPEN-C05, non bloquant ; format libre en attendant)
- [x] `parent` des Domains
- [x] provenance institutionnelle obligatoire sur Curriculum

## S4.6 CurriculumMapping

- [x] `projectionKey` unique tous statuts confondus, et sa conséquence (pas de réaffirmation d'une projection dépréciée)
- [x] `evidence` ≥ 1 dès `validated`

## S4.7 Provenance et evidence

- [x] 4 types de provenance et champs conditionnels
- [x] `evidence` toujours tableau ; porteurs Relation et CurriculumMapping seulement
- [x] aucune donnée personnelle

## S4.8 Validation et rapport

- [x] 3 verdicts ; gabarit `PASS|FAIL` obsolète
- [x] priorité entre règles et objet porteur des issues de groupe
- [x] ordre du rapport et codes de sortie
- [x] manifeste de corpus `specificationVersion`

## Registres

- [x] `RULE_CATALOG.csv` : Rule IDs stables
- [x] fixtures normatives : verdicts et issues attendus relus

## Déclaration

```text
🟢 KermicLab baseline 1.2.0 — ADOPTÉE AU NIVEAU DOCUMENTAIRE (2026-11-09)
Points ouverts non bloquants : OPEN-C01, OPEN-C03, OPEN-C04, OPEN-C05
Validation technique : NON ACQUISE
```
