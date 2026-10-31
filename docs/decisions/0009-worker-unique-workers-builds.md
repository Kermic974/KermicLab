# ADR 0009 — Un seul Worker, déployé par Cloudflare Workers Builds (abandonné)

- Date : 2026-10-31 — Statut : **abandonné** le 2026-10-31 (renuméroté : ce fichier s'appelait 0007, comme l'ADR du stockage R2). Le Worker `trigolab` a été supprimé ; la production repose sur le Worker `kermiclab-api` (API, maquettes) et le projet Cloudflare Pages `kermiclab` (chat et application autonome), déployés par GitHub Actions après les vérifications (ADR 0008). Conservé pour l'historique.
- Contexte : le MVP prévoyait un Worker d'API et un projet Pages séparés, déployés par GitHub Actions avec un jeton API Cloudflare stocké dans GitHub.
- Décision :
  - Un seul Worker `trigolab` (`wrangler.toml` à la racine) sert l'API, les maquettes et les fichiers statiques du chat (`[assets]`, dossier `dist/`). `run_worker_first` limite l'exécution du Worker à `/api/*` et `/maquettes/*`.
  - Déploiement par **Cloudflare Workers Builds** à chaque push sur `main` : `npx wrangler deploy` lance `npm run predeploy`, qui installe Chromium et exécute `npm run ci` avant le déploiement. GitHub Actions ne déploie plus.
  - Chat et API sur la même origine : plus de CORS, `KERMICLAB_API_URL` vide par défaut, CSP `connect-src 'self'`.
  - L'aperçu de maquette dans le chat est un iframe `sandbox="allow-scripts"` (sans `allow-same-origin`, puisque la maquette est servie par la même origine) ; les scores sont conservés en plein écran.
  - `wrangler` est épinglé en dépendance de développement.
- Conséquences : aucun jeton Cloudflare dans GitHub (moins de secrets à gérer, mieux pour un futur dépôt public). Les secrets du Worker (`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`) se gèrent dans Cloudflare. Le catalogue privé n'est pas encore récupéré par Workers Builds (à traiter avec l'action 10). Les migrations D1 restent manuelles (schéma idempotent `worker/schema.sql`).
