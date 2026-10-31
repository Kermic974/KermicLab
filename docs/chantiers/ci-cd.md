# Chantier : CI/CD

**Niveau actuel : 0 (vérifications GitHub + déploiement Cloudflare après vérifications)**

- `ci.yml`, job `verifier` : lint → build (index + CSP) → contrôle des pages → tests unitaires → tests Playwright.
- `ci.yml`, job « Déploiement Cloudflare » (sur `main`, après `verifier`) : schéma D1, Worker `kermiclab-api`, secrets du Worker s'ils sont définis, puis `wrangler pages deploy dist` vers le projet Pages `kermiclab` (chat à la racine, application autonome sous `/cercle/`). ADR 0008.
- `pages.yml` : validation de l'application autonome (`index.html` à jour avec `src/`, frontières entre agents, tests, structure).
- `publication.yml` : tag et release à chaque nouvelle version.
- Catalogue privé récupéré si `CATALOGUE_TOKEN` existe.
- Prévisualisation de chaque PR par l'intégration Git Cloudflare Pages (les déploiements de production automatiques sont désactivés).

Prochaines étapes :
- Niveau 1 : migrations D1 versionnées, prévisualisations construites avec `npm run build`.
- Niveau 2 : tests de fumée après déploiement (`/api/sante`, question « sinus »), retour arrière automatique.
