# Extraits France Travail

Extraits datés des données de France Travail utilisées par l'Espace Métiers (chantier Métiers, ADR 0043).

| Fichier | Source | Contenu |
|---|---|---|
| `rome-4.0-v62.json` | [Répertoire opérationnel des métiers et des emplois (ROME)](https://www.data.gouv.fr/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome), « Toutes les données du ROME » (JSON, zip), ROME 4.0 version 62 publiée le 2026-10-19 | 1 923 fiches : code, intitulé, code parent, transitions écologique et numérique, contextes de travail (codes, dictionnaire en tête), compétences cœur de métier, savoirs (sans certifications), mobilités |

**Licence : Licence Ouverte 2.0** ([Etalab](https://www.etalab.gouv.fr/licence-ouverte-open-licence/)). Attribution :
« France Travail, Répertoire opérationnel des métiers et des emplois (ROME 4.0), data.gouv.fr ».

## Mettre à jour (deux versions du ROME par an)

1. Télécharger « Toutes les données du ROME » au format JSON (`https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/json`, un zip) et le dézipper.
2. `npm run import:rome -- <dossier dézippé> --extrait referentiel/sources/france-travail/rome-4.0-v<N>.json --date AAAA-MM-JJ`
   (date de publication lue dans `version.txt`).
3. `npm run import:rome -- referentiel/sources/france-travail/rome-4.0-v<N>.json --preciser --appliquer`, relire le
   rapport (codes précisés, codes absents), supprimer l'ancien extrait et mettre à jour le test d'alignement
   (`tests/unit/rome.test.mjs`).

- Les fichiers sont en Latin-1 avec quelques chaînes doublement encodées : `decoderRome` les remet en UTF-8.
- Les définitions et textes d'accès des fiches ne sont pas repris. Les fichiers téléchargés ne sont pas versionnés ;
  la CI ne télécharge rien.
