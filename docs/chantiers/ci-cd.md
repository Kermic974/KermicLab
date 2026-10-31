# Chantier : CI/CD

**Niveau actuel : 0 (vérifications GitHub + déploiements Cloudflare et GitHub Pages)**

- `ci.yml` : lint → build (index + CSP) → contrôle des pages → tests unitaires → tests Playwright.
- Déploiement : Cloudflare Workers Builds (Worker `trigolab` relié au dépôt) à chaque push sur `main`, après toutes les vérifications de `npm run ci` via `npm run predeploy`, sans jeton dans GitHub (ADR 0007).
- Déploiement GitHub Pages de l’application autonome `index.html`, après la réussite du job `verifier` et uniquement sur `main`.
- Le site Pages ne publie que l’application autonome ; le chat et l’API restent servis par le Worker.
- Catalogue privé récupéré si `CATALOGUE_TOKEN` existe.

Prochaines étapes :
- Niveau 1 : versions de prévisualisation par branche (Workers Builds « non-production branch builds »), migrations D1 automatisées.
- Niveau 2 : tests de fumée après déploiement (`/api/sante`, question « sinus »), retour arrière automatique.
