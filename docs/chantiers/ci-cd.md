# Chantier : CI/CD

**Niveau actuel : 0 (vérifications GitHub + déploiement Cloudflare après vérifications)**

- `ci.yml`, job `verifier` : lint → build (index + CSP) → contrôle des pages → tests unitaires → tests Playwright.
- `ci.yml`, job « Déploiement Cloudflare » (sur `main`, après `verifier`) : schéma D1, Worker `kermiclab-api`, secrets du Worker s'ils sont définis, puis `wrangler pages deploy dist` vers le projet Pages `kermiclab` (chat à la racine, application autonome sous `/cercle/`). ADR 0008.
- `pages.yml` : validation de l'application autonome (`index.html` à jour avec `src/`, frontières entre agents, tests, structure).
- `publication.yml` : tag et release à chaque nouvelle version.
- `roadmap.yml` : propose une mise à jour factuelle de la roadmap après validation de `main` (voir ci-dessous).
- Catalogue privé récupéré si `CATALOGUE_TOKEN` existe.
- Prévisualisation de chaque PR par l'intégration Git Cloudflare Pages (les déploiements de production automatiques sont désactivés).

Prochaines étapes :
- Niveau 1 : migrations D1 versionnées, prévisualisations construites avec `npm run build`.
- Niveau 2 : tests de fumée après déploiement (`/api/sante`, question « sinus »), retour arrière automatique.

## Roadmap après fusion

Le workflow `roadmap.yml` écoute la fin des workflows CI/CD, validation de l'application autonome et sécurité.
Il ignore les exécutions de PR, les forks et les échecs. Il charge uniquement `main`, jamais une branche ou un
artefact fourni par l'événement. `scripts/roadmap.mjs` exige les trois dernières validations **réussies sur le
même commit de main** ; une validation en attente, annulée ou échouée empêche toute proposition.
Les réexécutions sont prises en compte : un ancien succès ne masque pas un nouvel échec.
Un lancement manuel via Actions est possible, sans contourner ces contrôles.

Une fois le commit validé, le script réconcilie jusqu'à 20 PR fusionnées parmi les 100 PR fermées les plus récemment
mises à jour. Il vérifie leur présence dans l'historique du commit chargé (fusion classique, squash ou rebase).
Il recompte les pages et jeux du catalogue public et remplace uniquement l'encart HTML délimité par
`roadmap:auto:debut` / `roadmap:auto:fin`. Le bilan éditorial daté, les phases, le Gantt et leurs critères de sortie
restent humains : le titre d'une PR ne suffit pas à prouver qu'un chantier est achevé.
Une CI réussie ne certifie pas un déploiement réel (le job Cloudflare peut être ignoré faute de secrets).

La branche `automatisation/roadmap` et sa PR sont réutilisées, sans push direct ni fusion automatique sur `main`.
La sérialisation des exécutions et la reconstruction à partir de `main` permettent de rattraper les fusions
rapprochées même lorsqu'une exécution intermédiaire est annulée. Les PR de cette branche sont exclues du tableau.
Les sorties sont déterministes : pas de date d'exécution qui produirait un nouveau diff à chaque relance.
Une empreinte des PR et des compteurs empêche la fusion de la PR automatique de générer une nouvelle PR
uniquement parce que le SHA et les liens de validation ont changé.
Les erreurs API, bornes HTML invalides et erreurs Git font échouer le workflow explicitement.

### Activation et validation humaine

Le seul jeton utilisé est `GITHUB_TOKEN` avec `actions: read`, `contents: write` et `pull-requests: write`.
Aucun secret IA ou PAT n'est nécessaire. Dans **Settings → Actions → General → Workflow permissions**,
autoriser **Allow GitHub Actions to create and approve pull requests** (aucune approbation automatique n'est utilisée).
L'activation ne sera effective qu'après fusion de ce workflow sur `main`.

GitHub ne déclenche pas les workflows `pull_request` pour une PR créée ou actualisée avec `GITHUB_TOKEN`.
Le propriétaire doit **fermer puis rouvrir la PR automatique après sa dernière mise à jour** pour lancer la CI,
puis attendre les contrôles verts et approuver avant fusion. Cela évite d'ajouter un PAT privilégié uniquement
pour déclencher des workflows. Ne pas fusionner une proposition sans cette validation.
