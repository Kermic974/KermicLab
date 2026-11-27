# Extraits France Travail

Extraits datés des données de France Travail utilisées par l'Espace Métiers (chantier Métiers, ADR 0044).

| Fichier | Source | Contenu |
|---|---|---|
| `rome-4.0-v62.json` | [Répertoire opérationnel des métiers et des emplois (ROME)](https://www.data.gouv.fr/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome), « Toutes les données du ROME » (JSON, zip), ROME 4.0 version 62 publiée le 2026-10-19 | 1 923 fiches : code, intitulé, code parent, transitions écologique et numérique, contextes de travail (codes, dictionnaire en tête), compétences cœur de métier, savoirs (sans certifications), mobilités |
| `bmo-2026.json` | [Enquête Besoins en main-d'œuvre (BMO)](https://www.data.gouv.fr/datasets/enquete-besoins-en-main-doeuvre-bmo), « Base open data BMO 2026 » (xlsx, mise à jour du 2026-04-21) | 217 métiers BMO (code FAP 2021) : projets de recrutement, dont difficiles et saisonniers, totaux France (valeurs masquées par le secret statistique exclues), palier par tiers |

**Licence : Licence Ouverte 2.0** ([Etalab](https://www.etalab.gouv.fr/licence-ouverte-open-licence/)). Attribution :
« France Travail, Répertoire opérationnel des métiers et des emplois (ROME 4.0), data.gouv.fr » et « France Travail, enquête Besoins en main-d’œuvre (BMO), data.gouv.fr ».

## Mettre à jour (deux versions du ROME par an)

1. Télécharger « Toutes les données du ROME » au format JSON (`https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/json`, un zip) et le dézipper.
2. `npm run import:rome -- <dossier dézippé> --extrait referentiel/sources/france-travail/rome-4.0-v<N>.json --date AAAA-MM-JJ`
   (date de publication lue dans `version.txt`).
3. `npm run import:rome -- referentiel/sources/france-travail/rome-4.0-v<N>.json --preciser --appliquer`, relire le
   rapport (codes précisés, codes absents), supprimer l'ancien extrait et mettre à jour le test d'alignement
   (`tests/unit/rome.test.mjs`).

Enquête BMO (une par an, au printemps) : `npm run import:bmo -- Base-open-data-BMO-AAAA.xlsx --extrait
referentiel/sources/france-travail/bmo-AAAA.json --date AAAA-MM-JJ`, puis
`npm run import:bmo -- referentiel/sources/france-travail/bmo-AAAA.json --appliquer` ; supprimer l'ancien extrait et
mettre à jour le test d'alignement (`tests/unit/bmo.test.mjs`). Si la nomenclature des métiers BMO change, revoir les
champs `fap` du référentiel.

API Marché du travail (lot 8, préparé) : `npm run import:marche -- --codes` liste les codes ROME à interroger ;
enregistrer les réponses JSON de l'indicateur de tension (France) dans un dossier, puis
`npm run import:marche -- <dossier> --extrait referentiel/sources/france-travail/marche-AAAA-TN.json --date AAAA-MM-JJ`
et `npm run import:marche -- <extrait> --appliquer`. Si une réponse est refusée (« réponse non reconnue »), adapter
`normaliserReponse` (`scripts/lib/marche.mjs`) et son test à la forme réelle.

**Après chaque vague de métiers** (`npm run vague:metiers`) ou toute modification des codes `rome` ou `fap` : relancer
`npm run import:rome -- referentiel/sources/france-travail/rome-4.0-v62.json --preciser --appliquer` puis
`npm run import:bmo -- referentiel/sources/france-travail/bmo-2026.json --appliquer` ; les tests d'alignement
(`tests/unit/rome.test.mjs`, `tests/unit/bmo.test.mjs`) échouent sinon.

- Les fichiers du ROME sont en Latin-1 avec quelques chaînes doublement encodées : `decoderRome` les remet en UTF-8.
- Les définitions et textes d'accès des fiches ne sont pas repris. Les fichiers téléchargés ne sont pas versionnés ;
  la CI ne télécharge rien.
