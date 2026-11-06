# AGENTS.md — instructions communes à tous les agents

Ce fichier est le **cœur d'instructions unique** du projet Kermiclab (dépôt `trigoLab`).
Il s'applique à Claude Code, GitHub Copilot, Codex et tout autre agent. `CLAUDE.md` et
`.github/copilot-instructions.md` ne font que renvoyer ici.

## 1. Vision

Un agent web répond aux questions d'utilisateurs de 7 à 77 ans (« c'est quoi le sinus ? ») et
leur sert une **page HTML autonome**, identifiée et versionnée, navigable par onglets :
explication, application ludique, mise en situation.

Principes non négociables :

- **Déterminisme** : une demande couverte par le catalogue produit toujours la même page (fichier servi tel quel, zéro token).
- **Apprentissage par backlog** : une demande non couverte crée (ou commente) une issue `maquette-manquante` ; après validation humaine et ajout au catalogue, la même demande produit la page.
- **Agnostique de l'agent** : tout le pilotage est en Markdown dans ce dépôt.
- **Maintenance par IA, contrôle humain** : les agents préparent ; le propriétaire valide aux points de contrôle.
- **CI/CD obligatoire** : rien n'est fusionné sans CI verte.
- **Public mineur** : aucune donnée personnelle collectée, modération des entrées et des sorties.

## 2. Carte du dépôt

| Chemin | Rôle |
|---|---|
| `worker/` | Cloudflare Worker : API `/api/chat`, `/api/support`, `/maquettes/:id`, routage, modération, issues GitHub, KPI D1, stockage R2 (`env.DONNEES`) |
| `worker/src/generated/` | Généré par `npm run build` (index + pages du catalogue). Ne pas modifier, non versionné |
| `web/` | Interface de chat (Cloudflare Pages). Textes uniquement dans `web/i18n/<langue>.json` |
| `catalogue/` | Maquettes publiques : `trigo-cercle` (écrite à la main) et les notions pilotes du gabarit (`pythagore`, `fractions`, `proportionnalite`). Les jeux (`demineur`, `echecs`, `belote`, matière `jeux`) sont écrits à la main avec un moteur testable (ADR 0013, guide `docs/jeux.md`). Les vraies maquettes vivent dans le dépôt privé `maquettes-catalogue`, récupéré par la CI dans `catalogue-prive/` |
| `gabarit/` | Gabarit commun des notions (page, style, moteur) : une notion décrite par `contenu.json` est générée en `page.html` par `npm run build` (ADR 0011, guide `docs/gabarit.md`) |
| `gabarit/jeux/` | Modules partagés des jeux (progression, Académie) recopiés dans chaque page par `npm run build` (ADR 0015, `docs/gamification.md`) |
| `scripts/` | Build, lint, contrôle de sécurité des pages, configuration GitHub |
| `tests/unit/` | Routage, modération, Worker (doubles de test pour D1, GitHub, Claude) |
| `tests/e2e/` | Playwright : onglets, rendu mobile, chat |
| `docs/chantiers/` | Une fiche par chantier transverse (niveau de maturité, prochaines étapes) |
| `docs/decisions/` | Journal des décisions (ADR courts) |
| `docs/actions-manuelles.md` | Actions humaines requises et leur statut |

## 3. Commandes

```bash
npm ci                # dépendances
npm run lint          # syntaxe JS, JSON, parité i18n, secrets évidents
npm run build         # index du catalogue + hashes CSP des pages + site statique dist/
npm run check:pages   # contrôle de sécurité des pages HTML du catalogue
npm test              # tests unitaires (node:test) ; en CI (pages.yml), Playwright est installé et les tests de page (tests/dom/) sont exécutés, leur absence échoue
npm run test:e2e      # tests navigateur (Playwright + Chromium)
npm run test:captures # mêmes tests + captures d'écran des parcours clés dans captures/ (documentation ; artefact « captures » en CI)
npm run ci            # tout ce qui précède
cd worker && npx wrangler dev   # Worker en local (http://localhost:8787)
npx wrangler pages dev dist     # chat en local
```

## 4. Conventions

- Code et identifiants en **français** (le projet est francophone) ; documentation publique en anglais avec version française.
- JavaScript ES modules, sans framework ni étape de compilation. Dépendances minimales : chaque ajout doit être justifié dans un ADR.
- Aucun texte d'interface en dur : clé dans `web/i18n/fr.json` **et** dans toutes les autres langues (le lint vérifie la parité). Ajouter une langue = ajouter un fichier.
- Modèles : Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast` pour les relances pédagogiques ; `claude-haiku-5-5` uniquement en repli (sortie JSON structurée) ; `claude-sonnet-5-5` pour préparer des maquettes candidates. Défi express : alias AI Gateway `custom/haiku` (variable `MODELE_DEFI`), quota séparé de `DEFI_GENERATIONS_JOUR` générations par session (ADR 0018). Quota de 1 000 tokens générés par session, sources du catalogue et métadonnées en fin de réponse (ADR 0016). Abonnement au backlog ; accès gratuit provisoire.
- Zéro secret dans le code : variables d'environnement, Cloudflare Secrets, GitHub Secrets ; documenter toute variable dans `.env.example`.
- **Pseudonymisation imposée vers les LLM** : tout texte d'origine utilisateur envoyé à un modèle passe par `pseudonymiser()` (`worker/src/pseudonymisation.js`), appliqué à l'intérieur de `appelerWorkersAI` et `appelerClaude` (`worker/src/llm.js`), seules fonctions autorisées à appeler un fournisseur. Ne jamais appeler un modèle autrement ; le prompt système ne contient que du texte du serveur (jamais de donnée du navigateur). Aucune table de correspondance n'est conservée.
- Ne jamais stocker d'IP ni de texte de message dans D1 ni dans R2. Les buckets R2 restent privés (pas d'URL publique `r2.dev`) ; organisation par préfixes, voir ADR 0007.

## 5. Contrat d'une page HTML autonome

- Un seul fichier, sans dépendance externe, lisible hors ligne, pensé mobile, accessible au clavier.
- En tête : `<script type="application/json" id="kermiclab-meta">` avec `id`, `titre`, `sujet`, `version`, `date`, `langue`, `onglets`.
- CSP en `<meta>` : `default-src 'none'`, `connect-src 'none'`, `script-src` avec **hashes** (recalculés par `npm run build`, à committer).
- Onglets déclarés dans un **registre** (`enregistrerOnglet({ id, type, titre, rendu, actif })`) ; onglets de base `explication`, `application`, `mise-en-situation` ; `self-test` prévu (inactif). Ajouter un onglet ne modifie pas le socle.
- Stockage abstrait : `local` (localStorage, actif) et `distant` (stub, phase 4).
- Bouton « Se connecter » présent mais masqué (`CONFIG.connexionActive = false`).
- Une notion = une page couvrant collège → lycée, en niveaux dépliables, du plus intuitif au plus formel. Approche par le jeu dans chaque onglet. Contenus adaptés à tous les âges.

## 6. Ajouter une maquette (processus)

1. Partir d'une issue `maquette-manquante`.
2. Créer une branche `maquette/<id>`.
3. Dans le dépôt privé `maquettes-catalogue` (ou `catalogue/` pour un exemple public) : dossier `<id>/` avec `fiche.md` (front matter : `id`, `titre`, `sujet`, `version`, `date`, `langues`, `onglets`, `mots-cles`, `questions`) et soit **`contenu.json`** (gabarit commun, recommandé : `page.html` est généré par `npm run build`, voir `docs/gabarit.md`), soit `page.html` écrit à la main (+ `page.<langue>.html` pour les traductions).
4. `npm run ci` : les questions d'exemple doivent être routées vers l'ID (non-régression), la page doit passer `check:pages`.
5. Pull request → revue IA de sécurité → **validation humaine du CODEOWNER** → fusion → déploiement automatique.

Une traduction manquante crée une issue `traduction-manquante` ; la version française est servie en attendant.

## 6 bis. Publier une version

1. Dans la PR : passer `version` de `package.json` à la nouvelle valeur (SemVer) et renommer la section
   `## [Non publié]` de `CHANGELOG.md` en `## [X.Y.Z] — AAAA-MM-JJ`.
2. Après la fusion sur `main`, le workflow `Publication` crée automatiquement le tag `vX.Y.Z` (sur le premier
   commit de `main` portant cette version) et la release GitHub, avec les notes du changelog. Les versions `0.x`
   sont publiées en pré-version. Aucun tag n'est créé à la main.

## 7. Définition du « terminé »

Une tâche est terminée quand : `npm run ci` passe, la documentation concernée (chantier, ADR, README) est à jour,
`docs/actions-manuelles.md` liste toute action humaine restante, et la PR est prête pour la revue du CODEOWNER.

## 8. Protocole des actions manuelles

Quand une étape nécessite une action humaine (compte, credentials, paiement, validation légale) :

1. S'arrêter sur cette étape **sans bloquer** le reste du travail possible.
2. Afficher dans le chat un bloc :
   ```
   ACTION MANUELLE REQUISE
   Quoi : …
   Où : <lien>
   Pourquoi : …
   Comment confirmer : …
   ```
3. Consigner l'action dans `docs/actions-manuelles.md` (statut `à faire` / `fait`).
4. Reprendre automatiquement après confirmation du propriétaire.

## 9. Sécurité (à vérifier sur chaque contribution)

- Aucun secret, aucune donnée personnelle, aucun journal contenant un message utilisateur.
- Appels LLM : uniquement via `llm.js` (pseudonymisation imposée), message utilisateur hors du prompt système.
- Pages HTML : pas de script externe, pas de ressource externe, pas d'appel réseau, pas d'`eval`.
- Entrées utilisateur : taille bornée, modération, limitation de débit.
- Dépendances : pas de vulnérabilité élevée ou critique.
- Workflows : `pull_request` uniquement (jamais `pull_request_target` avec du code de fork).
- Ne jamais modifier la visibilité du dépôt ; ne jamais fusionner sans validation humaine.
