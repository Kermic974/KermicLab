# KermicLab — Baseline normative 1.2.0

| | |
|---|---|
| Version | `1.2.0` |
| Date | 2026-11-09 |
| Statut global | 🟢 **ADOPTÉE** par la décision finale du 2026-11-09 (`DECISION_FINALE_1.2.0.md`) |
| Points ouverts | OPEN-C01, C03, C04, C05 : aucun ne bloque l'implémentation (`registres/OPEN.md`) |
| Nature | validation **documentaire** ; **validation technique non acquise** (schémas, validateur et CI S4 restent à construire) |

## Origine

Cette baseline est issue de la proposition `1.2.0-rc-Claude`. La décision finale a accepté l'ensemble de ses propositions [P] et confirmé les règles [B] de la baseline v1.1.2 (handoff v1.1.2, proposition S4.2 v1.1.2). L'historique des sources est conservé dans `../historique/`.

## Marqueurs d'origine

| Marqueur | Sens |
|---|---|
| **[B]** | Règle de la baseline v1.1.2, reprise sans modification de sens. |
| **[P]** | Proposition de Claude **acceptée** par la décision finale. Normative pour 1.2.0, sous réserve d'une contradiction avec un texte primaire de rang supérieur (OPEN-C01). |
| **[D]** | Conséquence directe de règles [B] ou [P]. |
| **[R]** | Contrainte observée dans le dépôt, qui motive une règle. |

Le marqueur reste affiché : quand les textes primaires seront versés (OPEN-C01), chaque règle [P] qu'ils contredisent deviendra [OBSOLETE] dans `registres/CONFLICTS.md`. Les Rule IDs stables permettent une correction ciblée.

## Limites déclarées

- Les textes primaires S1, S2, S3.1, S3.2, S4.1 à S4.8 et l'audit v1.1.1 n'ont pas été fournis. Les sections sont **reconstruites** à partir du handoff v1.1.2, de la présentation du notebook, de la proposition S4.2 v1.1.2 et de l'audit du dépôt. Le texte primaire, quand il sera versé, prime (`AUTHORITY_INDEX.md`).
- L'attribution des numéros S4.3, S4.4, S4.5, S4.7 et S4.8 à un sujet est elle-même une décision [P]. S4.1 (identifiants), S4.2 (cycle de vie) et S4.6 (CurriculumMapping) sont attestés [B].
- S4 ne décide ni de l'emplacement des fichiers dans le dépôt, ni de l'outil de validation, ni du lien avec les pages du produit : voir l'ADR 0026 du dépôt.

## Ordre de lecture

1. `DECISION_FINALE_1.2.0.md`
2. `AUTHORITY_INDEX.md`
3. `sections/S4_synthese.md`
4. `sections/S4.1` à `sections/S4.8`
5. `registres/DECISIONS.md`
6. `registres/RULE_CATALOG.csv`
7. `fixtures-normatives/README.md`
8. `registres/GATES.md`
9. `CHANGELOG.md`

## Contenu

```text
README.md                  ce fichier
DECISION_FINALE_1.2.0.md   décision du propriétaire (texte reçu, sans modification)
AUTHORITY_INDEX.md         ordre d'autorité, statut et origine de chaque texte
CHANGELOG.md               v1.1.1 → v1.1.2 → 1.2.0-rc-Claude → 1.2.0
MANIFEST.json              chemin, octets, sha256 de chaque fichier
sections/                  S1 à S4.8 (reconstruits et complétés)
registres/                 RULE_CATALOG.csv, DECISIONS.md, OPEN.md, CONFLICTS.md, GATES.md
fixtures-normatives/       cas normatifs (exemples), au format décrit dans leur README
```

## Intégrité

`MANIFEST.json` donne l'empreinte SHA-256 de chaque fichier. Vérification, depuis ce dossier :

```bash
node -e 'const m=require("./MANIFEST.json"),c=require("crypto"),f=require("fs");let k=0;for(const x of m.fichiers)if(c.createHash("sha256").update(f.readFileSync(x.chemin)).digest("hex")!==x.sha256){k++;console.log("KO",x.chemin)}console.log(k?"échec":"ok",m.fichiers.length)'
```

## Convention de version

- La **baseline** porte `1.2.0`. Un changement de règle compatible (ajout d'une discipline, liste fermée de codes de Stage) donne `1.x.0` ; un changement incompatible donne `2.0.0`.
- Chaque **section** porte sa propre version.
- Les **Rule IDs** (`S4-<DOMAINE>-<NNN>`) sont stables : un ID n'est jamais réutilisé ni renuméroté.
