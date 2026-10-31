# Chantier : CI/CD

**Niveau actuel : 0 (pipeline complet sur main)**

- `ci.yml` : lint → build (index + CSP) → contrôle des pages → tests unitaires → tests Playwright → déploiement Cloudflare (D1, Worker, Pages) sur `main`.
- Le déploiement est ignoré avec un avertissement tant que les secrets Cloudflare ne sont pas configurés.
- Catalogue privé récupéré si `CATALOGUE_TOKEN` existe.

Prochaines étapes :
- Niveau 1 : environnements de prévisualisation par PR (Pages preview + Worker `--env preview`).
- Niveau 2 : tests de fumée après déploiement (`/api/sante`, question « sinus »), retour arrière automatique.
