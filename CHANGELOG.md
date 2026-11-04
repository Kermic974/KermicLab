# Journal des versions / Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; versions [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Modifié
- **Feuille de route** : nouvelle page `feuille-de-route.html` (version révisée de la proposition « trigoLab → KermicLab » : état réel du projet, phases avec conditions de sortie et points de contrôle humains, cahier de vacances local avant les comptes, contrat d'événements `postMessage` des pages, garde-fous du tuteur IA, risques, résumé en anglais). Accessible depuis la barre latérale, entre « Profil et paramètres » et « Signaler un problème », et depuis le pied de page.
- **Bulle** : une page ouverte depuis le tableau de bord (catalogue « Explorer », « Rouvrir la page », « Commencer » de la suggestion, mini-lab) s'affiche dans une fenêtre par-dessus la page (plein écran sur mobile), et non plus dans le fil du chat. Boutons « Plein écran » et « Poser une question » ; la page est déchargée à la fermeture. Les réponses du chat restent dans le fil.
- **Tableau de bord élève par défaut** : l'accueil reprend la maquette KermicLab (barre latérale, rail sur tablette, barre inférieure sur mobile, mode sombre) et intègre le chat. Les données affichées viennent de la session en cours : reprise de la dernière notion, suggestion de la prochaine, progression par matière, activité des 7 derniers jours, défi express (5 XP par bonne réponse, une fois par jour), mini-lab du cercle trigonométrique. Le catalogue devient le tiroir « Explorer ». `/dashboard/` redirige vers l'accueil (ADR 0012).
- **Pseudo au premier lancement** et **mémorisation au choix** : par défaut la session seulement ; « Se souvenir de moi » crée un cookie local fonctionnel `kermiclab_memoire=1` (sans donnée personnelle) pour garder pseudo et progression sur l'appareil. Profil : changer de pseudo, retirer le cookie, tout effacer. Page de confidentialité mise à jour.
- `www.kermiclab.online` sert le chat à la racine et l’application autonome du cercle trigonométrique sous `/cercle/` (Cloudflare Pages, ADR 0008) ; le domaine nu n’est plus protégé par Cloudflare Access.
- Un seul chemin de publication : GitHub Actions déploie le Worker `kermiclab-api` et Pages après les vérifications ; plus de Workers Builds (ADR 0009, abandonné) ni de publication GitHub Pages.
- Le Worker accepte les origines `www.kermiclab.online` et `kermiclab.online`.
- Base D1 `kermiclab-kpi` créée et reliée au Worker.

### Ajouté
- **Jeux** : les **Échecs** (`catalogue/echecs/`, issue #87). Règles complètes (roque, prise en passant, promotion au choix, échec, mat, pat, nulle par répétition, 50 coups ou matériel insuffisant) ; contre l'ordinateur (facile, moyen ; Blancs ou Noirs) ou à deux sur le même appareil ; annulation du coup, échiquier retournable, coups en notation française, pièces prises ; souris, tactile et clavier ; quatre énigmes « mat en un coup ». Moteur validé par perft sur cinq positions de référence (`tests/unit/echecs.test.mjs`), parcours testés sur ordinateur et mobile (`tests/e2e/echecs.test.mjs`).
- **Jeux** : premier jeu universel, le **Démineur** (`catalogue/demineur/`, issue #85). Niveaux Débutant 9 × 9 (10 mines), Intermédiaire 16 × 16 (40), Expert 30 × 16 (99, grille tournée sur téléphone) ; premier coup toujours sûr ; ouverture en cascade ; drapeaux au clic droit, à l'appui long, au clavier (D ou F) ou avec le « Mode drapeau » ; compteur, chronomètre, record local par niveau ; énigmes de déduction. Nouvelle matière « Jeux » dans le chat. Moteur pur testé dans Node (`tests/unit/demineur.test.mjs`), parcours testés sur ordinateur et mobile (`tests/e2e/demineur.test.mjs`). ADR 0013, guide `docs/jeux.md`.
- SVT, vague 3 (terminale) : évolution et sélection naturelle, méiose et brassage génétique, immunité adaptative, climat et effet de serre, histoire de la Terre et datation, glycémie et diabète, contraction musculaire. Le programme de SVT est couvert (23 notions ; 82 au catalogue).
- SVT, vague 2 (seconde et première) : métabolisme et enzymes, ADN et mitose, expression des gènes, mutations et variabilité, structure interne de la Terre, système nerveux et réflexes, agrosystèmes et sols.
- Catalogue de **SVT**, vague 1 (collège) : la cellule, nutrition et digestion, respiration et circulation, photosynthèse, reproduction humaine, génétique et hérédité, microbes et système immunitaire, écosystèmes et biodiversité, séismes, volcans et tectonique des plaques. Feuille de route : `docs/chantiers/catalogue-svt.md`. Onglet « SVT » dans la barre de navigation.
- EMC : douze notions (laïcité, liberté, égalité, fraternité, justice, État de droit, citoyenneté, démocratie, intérêt général, droits de l'homme, discrimination, engagement civique), avec niveaux intuition → collège → lycée, exemples, QCM corrigés et défis quotidiens ; tests de contenu, routage et parcours interactifs.
- Philosophie, perspective **existence humaine et culture** : art, bonheur, conscience, inconscient, nature, religion, temps et travail. Chaque notion propose trois niveaux progressifs, 5 QCM corrigés et un défi quotidien en 3 étapes ; onglet de matière « Philosophie » dans le chat. / Philosophy: eight concepts with progressive explanations, corrected quizzes and everyday challenges.
- Physique-chimie, vague 3 (terminale) : lois de Newton, gravitation et satellites, cinétique chimique, radioactivité, thermodynamique, condensateur et circuit RC, diffraction et interférences. Le programme de physique-chimie est couvert (23 notions ; 59 au catalogue).
- Physique-chimie, vague 2 (seconde et première) : quantité de matière, atome et tableau périodique, réfraction et lentilles, oxydoréduction, travail et énergie mécanique, ondes mécaniques, absorbance et dosages.
- Catalogue de **physique-chimie**, vague 1 (collège) : états de la matière, masse volumique et mélanges, atomes et transformations chimiques, acides et bases, mouvements, forces et poids, circuits électriques et loi d'Ohm, énergie, signaux sonores et lumineux. Feuille de route : `docs/chantiers/catalogue-physique-chimie.md`.
- Chat : onglets par matière (Maths | Physique-chimie) dans la barre de navigation ; une recherche porte sur toutes les matières. `GET /api/catalogue` renvoie la matière de chaque notion.
- Chat : **barre de navigation du catalogue** — fixe à gauche sur grand écran, tiroir sur mobile (bouton « Catalogue », Échap pour fermer). Notions groupées par niveau (collège, seconde, première, terminale), recherche sans accents, coche ✓ et compteur des notions explorées ; un clic ouvre la page directement dans le fil (sans appel au chat) et compte comme notion découverte.
- Worker : `GET /api/catalogue` (notions triées par niveau puis par titre) ; champ facultatif `niveau` dans les fiches.
- Catalogue, vague 4 (terminale) : **limites et continuité**, **logarithme népérien**, **primitives et intégrales**, **raisonnement par récurrence**, **dénombrement**, **loi binomiale**, **géométrie dans l'espace**. Le programme de la 6e à la terminale est couvert (36 notions).
- Catalogue, vague 3 (seconde et première) : **vecteurs**, **droites et systèmes d'équations**, **fonctions de référence**, **second degré**, **dérivation**, **suites numériques**, **fonction exponentielle**, **produit scalaire**, **probabilités conditionnelles**.
- Gabarit : figure `parabole` (a, b, c réglables, discriminant, racines, sommet).
- Catalogue, vague 2 (compléments du collège) : **nombres décimaux**, **priorités opératoires**, **diviseurs, multiples et nombres premiers**, **périmètres et aires**, **volumes**, **angles et triangles**, **transformations**, **vitesse et grandeurs composées**. Le collège est couvert (20 notions au catalogue).
- Catalogue, vague 1 (cœur du brevet) : **nombres relatifs**, **puissances**, **calcul littéral**, **équations et inéquations**, **théorème de Thalès**, **statistiques**, **probabilités**, **fonctions affines et linéaires**. Feuille de route du programme complet : `docs/chantiers/catalogue-maths.md`.
- Gabarit : figures `affine` (droite y = ax + b réglable) et `des` (simulateur de lancers, loi des grands nombres).
- Chat : les suggestions et les exemples de la réponse hors catalogue tournent chaque jour parmi toutes les notions.
- Tests : chaque exercice de chaque notion générée est résolu automatiquement avec sa réponse attendue.
- Gabarit commun de notion (`gabarit/`, ADR 0011, guide `docs/gabarit.md`) : une notion = `fiche.md` + `contenu.json`, la page autonome est générée par `npm run build`. Composants : exercices QCM et numériques (fractions, virgules, tolérance, indices progressifs), figures interactives `pythagore`, `fraction` et `proportion`, étoiles par exercice, défi en étapes qui se débloquent.
- Catalogue : trois notions pilotes générées avec le gabarit — **Le théorème de Pythagore**, **Les fractions**, **Proportionnalité et pourcentages** (du collège au lycée, 6 exercices et un défi en 4 étapes chacune).
- Chat : les suggestions de l'accueil viennent du catalogue (`GET /api/suggestions`) et mènent toujours à une page ; des questions de secours (i18n), vérifiées par un test de routage, prennent le relais si l'API ne répond pas.
- Chat : relances proposées par le modèle après chaque réponse (champ `relances`, bornées et modérées), à la place de relances fixes qui ne fonctionnaient pas sans modèle.
- Modèle : consignes de réponse plus exigeantes (exactitude, niveau adapté, image du quotidien, exemple chiffré, petit défi, suivi de la conversation).
- Chat : nouvelle interface plus engageante — écran d'accueil avec suggestions cliquables, relances après chaque réponse, indicateur de saisie animé, bouton « Réessayer » en cas d'erreur, carte repliable pour les pages interactives, zone de saisie flottante et en-tête compact (mobile et mode sombre soignés, animations désactivées si « réduire les animations » est demandé).
- Chat : progression locale sans compte (`web/progression.js`) — série de jours, XP, niveaux et 7 badges, avec notifications et fenêtre « Mes progrès ». Stockée uniquement dans le navigateur, prête à être synchronisée vers la table `progres` de l'ADR 0010.
- Mesure d'audience Cloudflare Web Analytics (sans cookie) sur le chat ; absente de l'application autonome `/cercle/`.

### Corrigé
- Gabarit : la légende de l'axe horizontal de la figure `proportion` ne met plus les unités en minuscules (« Intensité I (A) »).
- Chat : une question hors catalogue sans modèle (mode zéro budget) renvoie une réponse `hors-catalogue` qui liste les notions disponibles et propose des questions qui marchent, au lieu d'une phrase de repli identique ; elle ne rapporte plus d'XP.
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
