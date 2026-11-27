# Extraits ONISEP

Extraits datés du référentiel métiers de l'ONISEP (chantier Métiers, ADR 0042), produits par
`npm run import:onisep -- <XML> --complement <CSV> --extrait <ce dossier>/ideo-metiers-AAAA-MM-JJ.json --date AAAA-MM-JJ`.

| Fichier | Sources (data.gouv.fr, organisation ONISEP) | Contenu |
|---|---|---|
| `ideo-metiers-2026-11-24.json` | [Idéo-Fiches métiers](https://www.data.gouv.fr/datasets/ideo-fiches-metiers) (zip XML, mise à jour du 2026-11-06) et [Idéo-Métiers Onisep](https://www.data.gouv.fr/datasets/ideo-metiers-onisep) (CSV, mise à jour du 2026-10-20) | 1 138 fiches : identifiant, intitulé, synonymes, codes ROME, niveau d'accès minimum, domaines, lien |

**Licence : ODbL 1.0** ([Open Database License](https://opendatacommons.org/licenses/odbl/1-0/)). Attribution :
« Onisep, jeux Idéo-Fiches métiers et Idéo-Métiers Onisep, data.gouv.fr ». Ces extraits sont des bases de données
dérivées : ils restent sous ODbL, quelle que soit la licence du reste du dépôt.

- Les textes descriptifs des fiches (compétences, nature du travail, salaires…) ne sont pas repris.
- Les fichiers téléchargés ne sont pas versionnés : seul l'extrait fait foi pour l'import, et la CI ne télécharge rien.
- `candidats.json` est produit par l'import comme liste de travail ; il n'est pas versionné.
- Les vagues complémentaires (`npm run vague:metiers`, `referentiel/vagues/`) partent de cet extrait : voir la section
  « Vagues complémentaires » de `docs/chantiers/metiers.md`.
