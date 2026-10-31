# ADR 0008 — Application autonome et chat publiés sur Cloudflare Pages

- Date : 2026-10-31 — Statut : accepté (révisé le 2026-10-31 : Cloudflare Pages au lieu de GitHub Pages).
- Contexte : offrir un outil pédagogique accessible même sans l'API conversationnelle, à côté du chat, sur `www.kermiclab.online`.
- Décision :
  - `index.html` (généré depuis `src/`) est une application autonome du cercle trigonométrique : un seul fichier, utilisable hors ligne, sans ressource externe ni appel réseau. Elle garde sa propre CSP en `<meta>` (hashes des scripts et styles en ligne).
  - `npm run build` produit `dist/` : le chat à la racine (`/`) et l'application sous `/cercle/`. Le `_headers` retire la CSP du chat sur `/cercle/*`, qui la bloquerait.
  - Le chat appelle l'API du Worker `kermiclab-api` (`https://kermiclab-api.kermic.workers.dev` par défaut, surchargeable par `KERMICLAB_API_URL`) ; le Worker autorise les origines `www.kermiclab.online`, `kermiclab.online` et `kermiclab.pages.dev`.
  - Un seul chemin de publication : le job « Déploiement Cloudflare » de `ci.yml` (`wrangler pages deploy dist`), après la réussite du job `verifier`, uniquement depuis `main`. Les déploiements de production automatiques de l'intégration Git Cloudflare Pages sont désactivés (ils publiaient le dépôt entier, sans build).
  - Plus de publication sur GitHub Pages ; `pages.yml` ne garde que la validation de l'application autonome.
- Conséquences : le domaine `kermiclab.online` (et `www`) sert le projet Pages `kermiclab` ; les prévisualisations de PR restent fournies par l'intégration Git Cloudflare.
