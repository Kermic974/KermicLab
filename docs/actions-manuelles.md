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
| 2 | Créer ou vérifier le jeton API Cloudflare (Workers Scripts : Edit, Pages : Edit, D1 : Edit, Workers R2 Storage : Edit), associé au compte indiqué par `CLOUDFLARE_ACCOUNT_ID` | [Guide Cloudflare](setup-cloudflare.md) ; https://dash.cloudflare.com/profile/api-tokens | Déploiement par la CI ; le jeton actuel est refusé par l'API D1 (`Authentication error [code: 10000]`) | Secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` à jour dans GitHub ; le jeton est valide et autorisé sur ce compte (plan Free, gratuit) ; relancer le workflow CI/CD sur `main` : le job « Déploiement Cloudflare » passe au vert | à vérifier à la fusion de la PR « www : chat et cercle » : le job « Déploiement Cloudflare » doit passer au vert |
| 3 | Créer la base D1 : `cd worker && npx wrangler d1 create kermiclab-kpi`, reporter `database_id` dans `worker/wrangler.toml` | Terminal + PR | KPI | `wrangler d1 list` montre la base ; `database_id` est référencé dans `worker/wrangler.toml` ; PR fusionnée | fait |
| 4 | Créer le projet Pages `kermiclab` (`npx wrangler pages project create kermiclab --production-branch main`) et activer Web Analytics | Cloudflare → Workers & Pages ; [Guide Cloudflare](setup-cloudflare.md) | Hébergement du chat | URL `https://kermiclab.pages.dev` accessible | fait (projet créé ; Web Analytics à activer) |
| 5 | Créer une clé API Anthropic **et définir un plafond de dépense mensuel** | https://console.anthropic.com/settings/keys et /settings/limits | Chat et routage | Secret `ANTHROPIC_API_KEY` dans GitHub ; plafond visible dans la console | reporté (mode zéro budget) |
| 6 | Créer un jeton GitHub fine-grained : dépôt `trigoLab` uniquement, permission Issues lecture/écriture | https://github.com/settings/personal-access-tokens/new | Création des issues par le Worker (boucle d'apprentissage) | Secret `KERMICLAB_GITHUB_TOKEN` dans GitHub ; la CI le transmet au Worker comme `GITHUB_TOKEN` au déploiement suivant | à faire — **seul manque pour la boucle d'apprentissage** (gratuit) |
| 7 | Renseigner la variable GitHub `KERMICLAB_API_URL` (URL du Worker après le 1er déploiement) et `ORIGINES_AUTORISEES` dans `wrangler.toml` | Settings → Secrets and variables → Actions | Le chat doit joindre le Worker | Le chat répond à « c'est quoi le sinus ? » | fait par défaut : la CI utilise `https://kermiclab-api.kermic.workers.dev` si la variable est absente ; `ORIGINES_AUTORISEES` contient `www.kermiclab.online`, `kermiclab.online` et `kermiclab.pages.dev` |
| 8 | Lancer `scripts/configurer-github.sh` (labels, Dependabot, signalement privé, secret scanning, protection de `main`, commits signés, discussions) | Terminal avec `gh` authentifié | Sécurité et communauté | `gh label list` montre les labels ; règle de protection visible | à faire |
| 9 | Fournir les versions HTML existantes du cercle trigonométrique | Dépôt privé `maquettes-catalogue` | Maquette de référence | Maquette `trigo-cercle` remplacée, PR validée | à faire |
| 10 | Créer le dépôt **privé** `maquettes-catalogue` + jeton lecture seule (`CATALOGUE_TOKEN`) | github.com/new | Séparer maquettes et moteur | La CI affiche « Récupérer le catalogue privé » | à faire |
| 11 | Référentiel des notions des programmes de maths (collège → lycée) dans le dépôt privé | `maquettes-catalogue` | Feuille de route du catalogue | Fichier présent | à faire |
| 12 | Compléter l'identité de l'éditeur dans `web/mentions-legales.html` | PR | Obligation légale | PR fusionnée | à faire |
| 13 | Vérifier les exigences d'Anthropic pour les services accessibles aux mineurs | https://www.anthropic.com/legal | Conformité | Décision consignée dans `docs/decisions/` | à faire |
| 14 | Valider juridiquement le consentement parental (< 15 ans) avant « Mon compte » | Conseil juridique | Majorité numérique en France | ADR signé | à faire (phase 3) |
| 15 | Nom de domaine relié au projet Pages | Cloudflare → Domains | Lien public lisible | `https://www.kermiclab.online` sert le chat | fait : `kermiclab.online` acheté (2026-10-31), `www` et domaine nu reliés à Pages ; `kermiclab.ai` abandonné |
| 16 | Valider chaque pull request de maquette | GitHub | Contrôle humain | Revue CODEOWNER | permanent |
| 18 | Activer R2 et créer le bucket `kermiclab-bucket` | Cloudflare → R2 | Stockage des données (ADR 0007) | `wrangler r2 bucket list` montre le bucket | fait |
| 19 | Déconnecter la build Git Cloudflare du Worker `trigolab-dev`, puis supprimer ce Worker | Cloudflare → Workers & Pages → trigolab-dev → Settings → Build → Disconnect ; puis Settings → Delete | Le déploiement passe uniquement par GitHub Actions (Worker `kermiclab-api`) ; deux chemins de déploiement se contredisent | `trigolab-dev` n'apparaît plus dans Workers & Pages | fait (les Workers `trigolab` et `trigolab-dev` n'existent plus au 2026-10-31) |
| 20 | Retirer Cloudflare Access du domaine nu `kermiclab.online` | Cloudflare → Zero Trust → Access → Applications | Site public pour les élèves | `https://kermiclab.online` répond sans page de connexion | fait (2026-10-31, application « trigolab-poc » supprimée) |
| 21 | Désactiver les déploiements de production automatiques de l'intégration Git Cloudflare Pages | Cloudflare → Workers & Pages → kermiclab → Settings → Builds | Elle publiait le dépôt entier sans build et concurrençait la CI | « Production branch deployments » désactivé ; les prévisualisations restent actives | fait (2026-10-31) |
| 17 | Décider du passage du dépôt en public | Settings → General | Open source | Visibilité changée par le propriétaire | à faire (plus tard) |

Si l'étape « Schéma D1 » échoue avec `Authentication error [code: 10000]`, vérifier que `CLOUDFLARE_API_TOKEN` dispose bien de la permission `D1: Edit` sur le compte correspondant à `CLOUDFLARE_ACCOUNT_ID`, puis relancer le workflow.
