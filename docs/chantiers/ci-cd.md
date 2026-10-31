# Chantier : CI/CD

**Niveau actuel : 0 (vérifications GitHub + déploiement Cloudflare Workers Builds)**

- `ci.yml` : lint → build (index + CSP) → contrôle des pages → tests unitaires → tests Playwright.
- Déploiement : Cloudflare Workers Builds (Worker `trigolab` relié au dépôt) à chaque push sur `main`, sans jeton dans GitHub (ADR 0007).
- Catalogue privé récupéré si `CATALOGUE_TOKEN` existe.

Prochaines étapes :
- Niveau 1 : versions de prévisualisation par branche (Workers Builds « non-production branch builds »), migrations D1 automatisées.
- Niveau 2 : tests de fumée après déploiement (`/api/sante`, question « sinus »), retour arrière automatique.
