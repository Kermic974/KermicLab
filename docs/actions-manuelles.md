# Actions manuelles

Actions qui nécessitent le propriétaire (protocole : AGENTS.md §8). Statut : `à faire` / `fait` / `reporté`.

## Mode zéro budget (actif)

Le MVP est mis en ligne **sans aucune dépense** (décision : `docs/decisions/0006-mode-zero-budget.md`).

| Service | Coût | Statut |
|---|---|---|
| Cloudflare Workers, Pages, D1, Web Analytics (plan Free) | 0 € | utilisé |
| Cloudflare R2 (offre gratuite : 10 Go, opérations incluses) | 0 € | utilisé |
| GitHub (dépôt, Actions, issues) | 0 € | utilisé |
| Adresse `https://kermiclab.pages.dev` | 0 € | utilisée à la place d'un domaine |
| Clé API Anthropic (crédits prépayés) | payant | **reporté** |
| Domaine `kermiclab.ai` (≈ 160 €, 2 ans minimum) | payant | **reporté** |

Ce qui fonctionne sans clé Anthropic : routage par mots-clés vers le catalogue (sinus, cosinus, trigo…),
pages interactives, signalement de problèmes (issues `support`), KPI, deux langues.

Ce qui attend la clé Anthropic : réponses aux questions hors catalogue (réponse de repli à la place) et
création automatique des issues `maquette-manquante` (en attendant, elles se créent à la main avec le modèle
d'issue « Demande de maquette »).

Pour sortir du mode zéro budget : ajouter le secret GitHub `ANTHROPIC_API_KEY` (action 5), sans modifier le code ;
acheter le domaine quand le budget le permet (action 15).

## Liste des actions

| # | Action | Où | Pourquoi | Comment confirmer | Statut |
|---|---|---|---|---|---|
| 1 | Confirmer le compte GitHub et autoriser le dépôt `trigoLab` | github.com | Source unique de vérité | Le dépôt est accessible à l'agent | fait |
| 2 | Créer un jeton API Cloudflare (Workers Scripts : Edit, Pages : Edit, D1 : Edit, Workers R2 Storage : Edit) et ajouter les secrets de déploiement | [Guide Cloudflare](setup-cloudflare.md) ; https://dash.cloudflare.com/profile/api-tokens | Déploiement par la CI | Workflow manuel « Vérifier la configuration Cloudflare » réussi ; secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` présents | à faire |
| 3 | Base D1 `kermiclab-kpi` et `database_id` dans `worker/wrangler.toml` | Terminal + PR | KPI | Base référencée dans `worker/wrangler.toml` ; `wrangler d1 list` confirme son existence | fait |
| 4 | Créer le projet Pages `kermiclab` s’il n’existe pas et activer Web Analytics | Cloudflare → Workers & Pages ; [Guide Cloudflare](setup-cloudflare.md) | Hébergement du chat | URL `https://kermiclab.pages.dev` accessible | à faire |
| 5 | Créer une clé API Anthropic et définir un plafond de dépense mensuel | https://console.anthropic.com/settings/keys et /settings/limits | Chat et routage hors catalogue | Secret `ANTHROPIC_API_KEY` dans GitHub ; plafond visible dans la console | reporté (mode zéro budget) |
| 6 | Créer un jeton GitHub fine-grained : dépôt `trigoLab` uniquement, permission Issues lecture/écriture | https://github.com/settings/personal-access-tokens/new | Création des issues par le Worker | Secret `KERMICLAB_GITHUB_TOKEN` dans GitHub | à faire |
| 7 | Renseigner la variable GitHub `KERMICLAB_API_URL` après le premier déploiement et vérifier `ORIGINES_AUTORISEES` dans `wrangler.toml` | Settings → Secrets and variables → Actions | Le chat doit joindre le Worker | Le chat répond à « c'est quoi le sinus ? » depuis le domaine autorisé | à faire |
| 8 | Lancer `scripts/configurer-github.sh` (labels, Dependabot, signalement privé, secret scanning, protection de `main`, commits signés, discussions) | Terminal avec `gh` authentifié | Sécurité et communauté | `gh label list` montre les labels ; règle de protection visible | à faire |
| 9 | Fournir les versions HTML existantes du cercle trigonométrique | Dépôt privé `maquettes-catalogue` | Maquette de référence | Maquette `trigo-cercle` remplacée, PR validée | à faire |
| 10 | Créer le dépôt **privé** `maquettes-catalogue` + jeton lecture seule (`CATALOGUE_TOKEN`) | github.com/new | Séparer maquettes et moteur | La CI affiche « Récupérer le catalogue privé » | à faire |
| 11 | Référentiel des notions des programmes de maths (collège → lycée) dans le dépôt privé | `maquettes-catalogue` | Feuille de route du catalogue | Fichier présent | à faire |
| 12 | Compléter l'identité de l'éditeur dans `web/mentions-legales.html` | PR | Obligation légale | PR fusionnée | à faire |
| 13 | Vérifier les exigences d'Anthropic pour les services accessibles aux mineurs | https://www.anthropic.com/legal | Conformité | Décision consignée dans `docs/decisions/` | à faire |
| 14 | Valider juridiquement le consentement parental (< 15 ans) avant « Mon compte » | Conseil juridique | Majorité numérique en France | ADR signé | à faire (phase 3) |
| 15 | Optionnel : acheter le domaine `kermiclab.ai` et le relier à Pages | Registrar / Cloudflare | Lien public lisible | Le domaine sert le chat | reporté (budget ≈ 160 €) |
| 16 | Valider chaque pull request de maquette | GitHub | Contrôle humain | Revue CODEOWNER | permanent |
| 18 | Activer R2 et créer le bucket `kermiclab-bucket` | Cloudflare → R2 | Stockage des données (ADR 0007) | `wrangler r2 bucket list` montre le bucket | fait |
| 19 | Déconnecter la build Git Cloudflare du Worker `trigolab-dev`, puis supprimer ce Worker | Cloudflare → Workers & Pages → trigolab-dev → Settings → Build → Disconnect ; puis Settings → Delete | Le déploiement passe uniquement par GitHub Actions (Worker `kermiclab-api`) ; deux chemins de déploiement se contredisent | `trigolab-dev` n'apparaît plus dans Workers & Pages | à faire |
| 17 | Décider du passage du dépôt en public | Settings → General | Open source | Visibilité changée par le propriétaire | à faire (plus tard) |
