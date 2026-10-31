# Actions manuelles

Actions qui nécessitent le propriétaire (protocole : AGENTS.md §8). Statut : `à faire` / `fait`.

| # | Action | Où | Pourquoi | Comment confirmer | Statut |
|---|---|---|---|---|---|
| 1 | Confirmer le compte GitHub et autoriser le dépôt `trigoLab` | github.com | Source unique de vérité | Le dépôt est accessible à l'agent | fait |
| 2 | Créer un compte Cloudflare, puis un jeton API (Workers Scripts : Edit, Pages : Edit, D1 : Edit) | https://dash.cloudflare.com/profile/api-tokens | Déploiement par la CI | Secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` présents dans GitHub | à faire |
| 3 | Créer la base D1 : `cd worker && npx wrangler d1 create kermiclab-kpi`, reporter `database_id` dans `worker/wrangler.toml` | Terminal + PR | KPI | `wrangler d1 list` montre la base ; PR fusionnée | à faire |
| 4 | Créer le projet Pages `kermiclab` (`npx wrangler pages project create kermiclab --production-branch main`) et activer Web Analytics | Cloudflare → Workers & Pages | Hébergement du chat | URL `https://kermiclab.pages.dev` accessible | à faire |
| 5 | Créer une clé API Anthropic **et définir un plafond de dépense mensuel** | https://console.anthropic.com/settings/keys et /settings/limits | Chat et routage | Secret `ANTHROPIC_API_KEY` dans GitHub ; plafond visible dans la console | à faire |
| 6 | Créer un jeton GitHub fine-grained : dépôt `trigoLab` uniquement, permission Issues lecture/écriture | https://github.com/settings/personal-access-tokens/new | Création des issues par le Worker | Secret `KERMICLAB_GITHUB_TOKEN` dans GitHub | à faire |
| 7 | Renseigner la variable GitHub `KERMICLAB_API_URL` (URL du Worker après le 1er déploiement) et `ORIGINES_AUTORISEES` dans `wrangler.toml` | Settings → Secrets and variables → Actions | Le chat doit joindre le Worker | Le chat répond à « c'est quoi le sinus ? » | à faire |
| 8 | Lancer `scripts/configurer-github.sh` (labels, Dependabot, signalement privé, secret scanning, protection de `main`, commits signés, discussions) | Terminal avec `gh` authentifié | Sécurité et communauté | `gh label list` montre les labels ; règle de protection visible | à faire |
| 9 | Fournir les versions HTML existantes du cercle trigonométrique | Dépôt privé `maquettes-catalogue` | Maquette de référence | Maquette `trigo-cercle` remplacée, PR validée | à faire |
| 10 | Créer le dépôt **privé** `maquettes-catalogue` + jeton lecture seule (`CATALOGUE_TOKEN`) | github.com/new | Séparer maquettes et moteur | La CI affiche « Récupérer le catalogue privé » | à faire |
| 11 | Référentiel des notions des programmes de maths (collège → lycée) dans le dépôt privé | `maquettes-catalogue` | Feuille de route du catalogue | Fichier présent | à faire |
| 12 | Compléter l'identité de l'éditeur dans `web/mentions-legales.html` | PR | Obligation légale | PR fusionnée | à faire |
| 13 | Vérifier les exigences d'Anthropic pour les services accessibles aux mineurs | https://www.anthropic.com/legal | Conformité | Décision consignée dans `docs/decisions/` | à faire |
| 14 | Valider juridiquement le consentement parental (< 15 ans) avant « Mon compte » | Conseil juridique | Majorité numérique en France | ADR signé | à faire (phase 3) |
| 15 | Optionnel : acheter le domaine `kermiclab.ai` et le relier à Pages | Registrar / Cloudflare | Lien public lisible | Le domaine sert le chat | à faire |
| 16 | Valider chaque pull request de maquette | GitHub | Contrôle humain | Revue CODEOWNER | permanent |
| 17 | Décider du passage du dépôt en public | Settings → General | Open source | Visibilité changée par le propriétaire | à faire (plus tard) |
