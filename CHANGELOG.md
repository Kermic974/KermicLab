# Journal des versions / Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; versions [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Modifié
- Ajout d’une application autonome du cercle trigonométrique, publiée sur GitHub Pages après les vérifications CI.
- Mise en ligne via un seul Worker Cloudflare `trigolab` (chat + API + maquettes), déployé par Cloudflare Workers Builds à chaque push sur `main` ; plus de projet Pages pour le chat ni de jeton Cloudflare dans GitHub (ADR 0007).
- Base D1 `kermiclab-kpi` créée et reliée au Worker.

### Corrigé
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
