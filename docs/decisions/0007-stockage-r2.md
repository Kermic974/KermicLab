# ADR 0007 — Stockage des données dans Cloudflare R2

- Date : 2026-10-31 — Statut : accepté (décision du propriétaire)
- Contexte : le projet doit pouvoir stocker des données (fichiers, exports, sauvegardes) en plus des KPI D1, sans sortir du mode zéro budget (ADR 0006).
- Décision : un bucket R2 privé, `kermiclab-bucket`, relié au Worker `kermiclab-api` sous le binding `DONNEES` (`worker/wrangler.toml`). Le déploiement passe uniquement par GitHub Actions ; la build Git Cloudflare de `trigolab-dev` est abandonnée (action manuelle 19).
- Règles :
  - Bucket privé : pas d'URL publique `r2.dev` ni de domaine personnalisé ; tout accès passe par le Worker.
  - Organisation par préfixes, un usage par préfixe (ex. `sauvegardes/kpi/AAAA-MM-JJ.json`). Chaque nouveau préfixe est documenté ici.
  - Aucune IP, aucun texte de message, aucune donnée personnelle d'élève.
  - Un bucket supplémentaire n'est créé que si les règles d'accès ou de rétention diffèrent (ex. fichiers envoyés par des utilisateurs, à isoler) ; il reçoit son propre binding et une ligne dans cet ADR.
- Conséquences : gratuit tant que l'usage reste dans l'offre gratuite R2 (10 Go). Le jeton `CLOUDFLARE_API_TOKEN` doit inclure la permission R2 (action 2).
- Préfixes en usage : aucun pour l'instant.
