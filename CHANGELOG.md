# Journal des versions / Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; versions [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Modifié
- `www.kermiclab.online` sert le chat à la racine et l’application autonome du cercle trigonométrique sous `/cercle/` (Cloudflare Pages, ADR 0008) ; le domaine nu n’est plus protégé par Cloudflare Access.
- Un seul chemin de publication : GitHub Actions déploie le Worker `kermiclab-api` et Pages après les vérifications ; plus de Workers Builds (ADR 0009, abandonné) ni de publication GitHub Pages.
- Le Worker accepte les origines `www.kermiclab.online` et `kermiclab.online`.
- Base D1 `kermiclab-kpi` créée et reliée au Worker.

### Ajouté
- Chat : nouvelle interface plus engageante — écran d'accueil avec suggestions cliquables, relances après chaque réponse (« plus simple », « un exemple », « un défi »), indicateur de saisie animé, bouton « Réessayer » en cas d'erreur, carte repliable pour les pages interactives, zone de saisie flottante et en-tête compact (mobile et mode sombre soignés, animations désactivées si « réduire les animations » est demandé).
- Chat : progression locale sans compte (`web/progression.js`) — série de jours, XP, niveaux et 7 badges, avec notifications et fenêtre « Mes progrès ». Stockée uniquement dans le navigateur, prête à être synchronisée vers la table `progres` de l'ADR 0010.
- Mesure d'audience Cloudflare Web Analytics (sans cookie) sur le chat ; absente de l'application autonome `/cercle/`.

### Corrigé
- Chat : après une mise en ligne, la nouvelle page pouvait s'afficher avec l'ancien CSS ou JS gardé en cache par le navigateur (4 h), ce qui cassait le rendu. Le build ajoute désormais l'empreinte du contenu aux URL (`style.css?v=…`, `app.js?v=…`, `progression.js?v=…`).
- CI : les tests navigateur du chat suivent l’URL d’API réellement construite (ils échouaient en CI avec `KERMICLAB_API_URL=http://localhost:8787`).
- CI : `pages.yml` et `ci.yml` ne partagent plus le même groupe de concurrence (ils s’annulaient mutuellement).
- Déploiement : le site publié pointe vers le Worker `https://kermiclab-api.kermic.workers.dev` même sans variable `KERMICLAB_API_URL` (il pointait vers `localhost`).
- Déploiement : les secrets du Worker absents (mode zéro budget, pas de `ANTHROPIC_API_KEY`) sont ignorés au lieu de faire échouer `wrangler-action`.
- CodeQL sur dépôt privé : analyse sans envoi à GitHub (GitHub Advanced Security requis), la CI échoue elle-même en cas d'alerte (`scripts/verifier-sarif.mjs`) ; envoi rétabli automatiquement en public.

## [1.4.0] — 2026-11-01

### Ajouté
- Vérification de concordance des méthodes : `compareResults` et `resultNumber` (`src/solutions/compare.js`, exposés par `src/api.js`), exigence S-08.
- Méthode tabulaire pour les angles remarquables et statut `unsupported` avec justification pour les angles hors table, exigences S-05 et S-06.
- Le mode Comparer (deux méthodes côte à côte) n'est pas encore livré : prévu pour une version ultérieure.

## [1.3.0] — 2026-11-01

### Ajouté
- Application du cercle : sélecteur de méthode dans le panneau « Ce que montre cet angle », avec étapes numérotées, avertissements et prise en charge du statut `unsupported` (SPEC A-04).
- Méthode algébrique (conversion en radians, réduction au premier quadrant, formules de réduction) et filtrage des méthodes par mode (`solutions.list({ mode })`), exigences S-04 et S-07.
- Les autotests de la page (`tests/dom/`) sont exécutés en CI.

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
