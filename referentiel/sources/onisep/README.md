# Instantanés ONISEP

Dossier d'accueil des instantanés du jeu ouvert « Idéo – Fiches métiers » de l'ONISEP (chantier Métiers, ADR 0042).

- Nom : `ideo-fiches-metiers-AAAA-MM-JJ.csv` (ou `.json`), date du téléchargement.
- Joindre dans la PR l'URL de téléchargement et la licence constatée (Licence Ouverte Etalab attendue, à confirmer).
- Import : `npm run import:onisep -- referentiel/sources/onisep/<fichier>` (voir `docs/chantiers/metiers.md`).
- `candidats.json` est produit par l'import ; il sert de liste de travail et peut être régénéré à tout moment.

La CI ne télécharge rien : seul le fichier versionné ici fait foi.
