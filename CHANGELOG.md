# Journal des versions / Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; versions [SemVer](https://semver.org/lang/fr/).

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
