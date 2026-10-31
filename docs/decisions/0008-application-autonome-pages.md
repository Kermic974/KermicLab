# ADR 0008 — Application autonome publiée sur GitHub Pages

- Date : 2026-10-31 — Statut : accepté.
- Contexte : offrir un outil pédagogique accessible même sans l’API conversationnelle.
- Décision :
  - `index.html` est une application autonome du cercle trigonométrique : un seul fichier, utilisable hors ligne, sans ressource externe ni appel réseau.
  - Le job `deploy-pages` de `ci.yml` la publie sur GitHub Pages après la réussite des vérifications et uniquement depuis `main`. L’artefact ne contient que `index.html`.
  - Le chat, l’API et les maquettes restent hébergés par le Worker Cloudflare ; le déploiement Pages est complémentaire.
- Conséquences : le propriétaire doit activer GitHub Pages avec la source « GitHub Actions » (action manuelle 20).
