# Actions manuelles

Actions qui nécessitent le propriétaire (protocole : AGENTS.md §8). Statut : `à faire` / `fait` / `reporté`.

## Mode zéro budget (actif)

Le MVP est mis en ligne **sans aucune dépense** (décision : `docs/decisions/0006-mode-zero-budget.md`).

| Service | Coût | Statut |
|---|---|---|
| Cloudflare Workers (+ fichiers statiques), Workers Builds, D1, Web Analytics (plan Free) | 0 € | utilisé |
| GitHub (dépôt, Actions, issues) | 0 € | utilisé |
| Adresse `https://trigolab.<sous-domaine>.workers.dev` | 0 € | utilisée à la place d'un domaine |
| Clé API Anthropic (crédits prépayés) | payant | **reporté** |
| Domaine `kermiclab.ai` (≈ 160 €, 2 ans minimum) | payant | **reporté** |

Ce qui fonctionne sans clé Anthropic : routage par mots-clés vers le catalogue (sinus, cosinus, trigo…),
pages interactives, signalement de problèmes (issues `support`), KPI, deux langues.

Ce qui attend la clé Anthropic : réponses aux questions hors catalogue (réponse de repli à la place) et
création automatique des issues `maquette-manquante` (en attendant, elles se créent à la main avec le modèle
d'issue « Demande de maquette »).

Pour sortir du mode zéro budget : ajouter le secret `ANTHROPIC_API_KEY` au Worker dans Cloudflare (action 5), sans modifier le code ;
acheter le domaine quand le budget le permet (action 15).

## Liste des actions

| # | Action | Où | Pourquoi | Comment confirmer | Statut |
|---|---|---|---|---|---|
| 1 | Confirmer le compte GitHub et autoriser le dépôt `trigoLab` | github.com | Source unique de vérité | Le dépôt est accessible à l'agent | fait |
| 2 | Créer un compte Cloudflare et le Worker `trigolab` relié au dépôt GitHub (Workers Builds) | Cloudflare → Workers & Pages → Import a repository | Déploiement automatique à chaque push | Le Worker `trigolab` existe ; « Deployments » montre les builds | fait (2026-10-31) — plus besoin de jeton API dans GitHub (ADR 0007) |
| 3 | Créer la base D1 `kermiclab-kpi`, appliquer `worker/schema.sql`, reporter `database_id` dans `wrangler.toml` | Terminal + PR | KPI | `wrangler d1 list` montre la base ; PR fusionnée | fait (2026-10-31, `kermiclab-kpi`, WEUR, via le connecteur Cloudflare) |
| 4 | Après le premier build réussi : noter l'URL du Worker et activer Web Analytics | Cloudflare → Workers → trigolab → Settings → Domains & Routes ; Analytics → Web Analytics | Lien public, mesure d'audience sans cookie | Le chat répond à « c'est quoi le sinus ? » sur l'URL `*.workers.dev` | à faire |
| 5 | Créer une clé API Anthropic **et définir un plafond de dépense mensuel** | https://console.anthropic.com/settings/keys et /settings/limits | Chat et routage | Secret `ANTHROPIC_API_KEY` du Worker dans Cloudflare ; plafond visible dans la console | reporté (mode zéro budget) |
| 6 | Créer un jeton GitHub fine-grained : dépôt `trigoLab` uniquement, permission Issues lecture/écriture | https://github.com/settings/personal-access-tokens/new | Création des issues par le Worker | Secret `GITHUB_TOKEN` du Worker dans Cloudflare → Workers → trigolab → Settings → Variables and Secrets | à faire |
| 7 | ~~Renseigner `KERMICLAB_API_URL`~~ | — | Le chat et l'API sont servis par le même Worker | — | sans objet (ADR 0007) |
| 8 | Lancer `scripts/configurer-github.sh` (labels, Dependabot, signalement privé, secret scanning, protection de `main`, commits signés, discussions) | Terminal avec `gh` authentifié | Sécurité et communauté | `gh label list` montre les labels ; règle de protection visible | à faire |
| 9 | Fournir les versions HTML existantes du cercle trigonométrique | Dépôt privé `maquettes-catalogue` | Maquette de référence | Maquette `trigo-cercle` remplacée, PR validée | à faire |
| 10 | Créer le dépôt **privé** `maquettes-catalogue` + jeton lecture seule (`CATALOGUE_TOKEN`) | github.com/new | Séparer maquettes et moteur | La CI affiche « Récupérer le catalogue privé » | à faire |
| 11 | Référentiel des notions des programmes de maths (collège → lycée) dans le dépôt privé | `maquettes-catalogue` | Feuille de route du catalogue | Fichier présent | à faire |
| 12 | Compléter l'identité de l'éditeur dans `web/mentions-legales.html` | PR | Obligation légale | PR fusionnée | à faire |
| 13 | Vérifier les exigences d'Anthropic pour les services accessibles aux mineurs | https://www.anthropic.com/legal | Conformité | Décision consignée dans `docs/decisions/` | à faire |
| 14 | Valider juridiquement le consentement parental (< 15 ans) avant « Mon compte » | Conseil juridique | Majorité numérique en France | ADR signé | à faire (phase 3) |
| 15 | Optionnel : acheter le domaine `kermiclab.ai` et le relier au Worker (Custom Domain) | Registrar / Cloudflare | Lien public lisible | Le domaine sert le chat | reporté (budget ≈ 160 €) |
| 16 | Valider chaque pull request de maquette | GitHub | Contrôle humain | Revue CODEOWNER | permanent |
| 17 | Décider du passage du dépôt en public | Settings → General | Open source | Visibilité changée par le propriétaire | à faire (plus tard) |
| 20 | Activer GitHub Pages avec la source « GitHub Actions » | GitHub → Settings → Pages → Build and deployment | Publier l’application autonome sans modifier le déploiement du Worker | Après un push sur `main`, l’environnement `github-pages` affiche l’URL du site | à faire |
