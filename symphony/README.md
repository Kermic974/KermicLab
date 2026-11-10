# symphony/

Espace de travail réservé aux fichiers produits par l'assistant Symphony pour le propriétaire du dépôt.

## Principe

Ce dossier est isolé du reste du projet. Il ne fait partie ni du moteur, ni de l'interface, ni du catalogue, ni du Worker. Rien ici n'est lu par le build, les tests ou le déploiement du site.

## Règles

- L'assistant écrit uniquement dans `symphony/`.
- Il ne modifie jamais `src/`, `catalogue/`, `gabarit/`, `worker/`, `web/`, `scripts/`, `tests/`, `.github/`, ni les fichiers racine (`package.json`, `CHANGELOG.md`, `AGENTS.md`, etc.).
- Chaque modification passe par une branche et une demande de fusion. Le propriétaire fusionne.
- Aucun secret, aucune donnée personnelle, aucun journal contenant un message d'utilisateur.
- Ce dossier n'est pas un livrable du projet : il n'est pas concerné par les versions SemVer ni par le journal des modifications.

## Organisation

| Dossier | Contenu |
|---|---|
| `livrables/` | Documents et exports produits à la demande (rapports, synthèses, brouillons). |
| `notes/` | Notes de travail, décisions, comptes rendus. |
