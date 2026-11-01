# Journal des versions / Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; versions [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Modifié
- `www.kermiclab.online` sert le chat à la racine et l’application autonome du cercle trigonométrique sous `/cercle/` (Cloudflare Pages, ADR 0008) ; le domaine nu n’est plus protégé par Cloudflare Access.
- Un seul chemin de publication : GitHub Actions déploie le Worker `kermiclab-api` et Pages après les vérifications ; plus de Workers Builds (ADR 0009, abandonné) ni de publication GitHub Pages.
- Le Worker accepte les origines `www.kermiclab.online` et `kermiclab.online`.
- Base D1 `kermiclab-kpi` créée et reliée au Worker.

### Ajouté
- Méthode algébrique (conversion en radians, réduction au premier quadrant, formules de réduction) et filtrage des méthodes par mode (`solutions.list({ mode })`), exigences S-04 et S-07.
- Mesure d'audience Cloudflare Web Analytics (sans cookie) sur le chat ; absente de l'application autonome `/cercle/`.

### Corrigé
- CI : les tests navigateur du chat suivent l’URL d’API réellement construite (ils échouaient en CI avec `KERMICLAB_API_URL=http://localhost:8787`).
- CI : `pages.yml` et `ci.yml` ne partagent plus le même groupe de concurrence (ils s’annulaient mutuellement).
- Déploiement : le site publié pointe vers le Worker `https://kermiclab-api.kermic.workers.dev` même sans variable `KERMICLAB_API_URL` (il pointait vers `localhost`).
- Déploiement : les secrets du Worker absents (mode zéro budget, pas de `ANTHROPIC_API_KEY`) sont ignorés au lieu de faire échouer `wrangler-action`.
- CodeQL sur dépôt privé : analyse sans envoi à GitHub (GitHub Advanced Security requis), la CI échoue elle-même en cas d'alerte (`scripts/verifier-sarif.mjs`) ; envoi rétabli automatiquement en public.

## [0.0.1] — 2026-10-31

Première version du MVP Kermiclab, en **mode zéro budget** (offres gratuites Cloudflare et GitHub, sans clé Anthropic ni domaine).

### Ajouté
- Worker Cloudflare : routage déterministe par mots-clés, routage Claude Haiku 5.5 (activé dès qu'une clé est fournie), maquettes servies telles quelles, issues `maquette-manquante` / `traduction-manquante` / `support` dédoublonnées, modération, limitation de débit, KPI anonymes D1.
- Chat web bilingue (fr/en) pour Cloudflare Pages, pages Confidentialité et Mentions légales.
- Maquette d'exemple `trigo-cercle` v1.0.0 : explication par niveaux, cercle interactif, défi « grande roue ».
- CI/CD GitHub Actions, CodeQL, audit npm, Gitleaks, revue IA, Dependabot.
- Instructions agents (`AGENTS.md`), fiches de chantiers, ADR, actions manuelles, fichiers communautaires.

### Modifié
- La revue des dépendances ne s'exécute que sur dépôt public (GitHub Advanced Security requis en privé).
