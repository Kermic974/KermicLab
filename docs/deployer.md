# Déployer trigoLab

## Prérequis

- Les secrets GitHub `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` sont configurés.
- Le compte Cloudflare contient la base D1 `kermiclab-kpi`, le bucket R2 privé `kermiclab-bucket` et le projet Pages `kermiclab`.
- La configuration locale est synchronisée avec `worker/wrangler.toml`.

Suivez [le guide de configuration Cloudflare](setup-cloudflare.md) pour créer et vérifier ces ressources et secrets.

## Premier déploiement

1. Configurez les secrets et variables selon la [checklist](github-secrets-checklist.md).
2. Vérifiez la configuration avec `scripts/verifier-secrets.sh` ou le workflow manuel **Vérifier la configuration Cloudflare**.
3. Fusionnez le code après les contrôles requis, puis poussez sur `main`. La CI valide d’abord le projet ; le job de déploiement s’exécute uniquement après réussite sur `main`.
4. Consultez **Actions → CI/CD → Déploiement Cloudflare**. Sans les deux secrets Cloudflare, le déploiement est ignoré avec un avertissement.

Le job de déploiement, dans l'ordre :

1. prend un **instantané** des versions en production (Worker et Pages) avec `scripts/deploiement.mjs instantane`,
   transmis à l'étape de retour arrière par une sortie d'étape GitHub (jamais par un fichier) ;
2. applique les **migrations D1** versionnées (`wrangler d1 migrations apply`, voir [`worker/migrations/README.md`](../worker/migrations/README.md)) ;
3. déploie `worker/` avec Wrangler, pose les secrets du Worker, puis publie `dist/` sur Pages (projet `kermiclab` par défaut) ;
4. lance le **test de fumée** (`scripts/deploiement.mjs fumee`) : `/api/sante`, `/api/catalogue`, une page servie, l'accueil
   du site et sa `config.json`. Lectures seulement, aucun KPI écrit, cinq essais espacés de 15 s pour laisser la
   propagation se faire ;
5. en cas d'échec après le déploiement du Worker (secrets, Pages ou test de fumée), **retour arrière automatique** :
   le Worker et le site reviennent aux versions de l'instantané et le job reste en échec. La base D1 n'est jamais
   annulée : les migrations ne font que des ajouts compatibles avec la version précédente du Worker.

Variables facultatives : `KERMICLAB_API_URL` (API testée, défaut `https://kermiclab-api.kermic.workers.dev`) et
`KERMICLAB_SITE_URL` (site testé, défaut `https://kermiclab.online`).

## Déploiement manuel de diagnostic

Pour une intervention locale autorisée, installez les dépendances, connectez Wrangler au compte approprié et lancez les commandes depuis la racine :

```bash
npm ci
npm run ci
cd worker
npx wrangler d1 migrations apply kermiclab-kpi --remote
npx wrangler deploy
cd ..
npm run build
npx wrangler pages deploy dist --project-name=kermiclab --branch=main
```

Wrangler demande une authentification interactive avec `npx wrangler login`. Ne mettez pas de jeton dans la ligne de commande ou dans l’historique du terminal. En CI, le déploiement doit passer par le workflow existant et ses secrets GitHub.

## Après publication

### Gateway LLM

Tous les appels pédagogiques passent obligatoirement par **`kermiclab-gateway`**, dans le même compte Cloudflare que le Worker. Workers AI utilise le troisième argument de `AI.run` ; le SDK Anthropic utilise l'URL `anthropic` obtenue par `AI.gateway("kermiclab-gateway").getUrl(...)`, jamais `api.anthropic.com`. Aucun retour direct au fournisseur n'est autorisé en cas d'erreur gateway.

Le repli nécessite aussi le secret **`AI_GATEWAY_TOKEN`** (permission AI Gateway Run), en plus de `ANTHROPIC_API_KEY`. Le créer dans les secrets GitHub Actions pour transmission au Worker, sans le partager dans le chat. Workers AI via binding n'a pas besoin de ce jeton. L'absence du jeton empêche le repli, pas les appels Workers AI.

Le code désactive le cache et la collecte de logs par requête et limite la gateway à un essai ; les réservations D1 et le repli applicatif restent inchangés. Dans les réglages Cloudflare, désactiver aussi les logs de contenu, tout export Logpush de requêtes/réponses et les retries/fallbacks additionnels. Après validation humaine et déploiement, vérifier les métriques agrégées de `kermiclab-gateway` pour une relance, sans consulter ni conserver son texte. L'accès au tableau de bord n'est pas vérifiable depuis cette session.

English: Pedagogical calls must use `kermiclab-gateway`, including the Anthropic SDK fallback. Workers AI uses the binding; fallback requires a separate AI Gateway Run token. No direct-provider bypass, request logging or cache; gateway retries must not add hidden generations outside the application quota.

- Vérifiez que le Worker `https://kermiclab-api.<compte>.workers.dev` répond.
- Configurez la variable Actions `KERMICLAB_API_URL` avec cette URL, puis relancez un déploiement pour générer le site avec la bonne adresse d’API.
- Vérifiez `https://kermiclab.pages.dev` et testez une question couverte par le catalogue.
- Activez Web Analytics dans les paramètres du projet Pages si souhaité.
- Gardez `ORIGINES_AUTORISEES` dans `worker/wrangler.toml` alignée avec le domaine du site. Une modification de domaine doit être revue avant le déploiement.

Workers AI est déclaré dans `worker/wrangler.toml` avec le binding `AI` : aucune clé API Workers AI n'est à ajouter. À la demande du propriétaire, la configuration de déploiement active le coupe-circuit global (`LLM_ACTIF=true`) ; `false` reste l'arrêt d'urgence. Cette modification ne certifie pas l'activation en production avant déploiement et vérification de `/api/llm/status`. Chaque visiteur doit également cocher « Utiliser l'IA » dans Configuration ; ce choix individuel est désactivé par défaut et mémorisé dans la session du navigateur. Les appels nécessitent les deux activations, le secret aléatoire `LLM_SESSION_SECRET` (32 caractères minimum) et le schéma D1 à jour (`sessions_llm`). La CI applique le schéma avant le déploiement et transfère les secrets définis. Sans session de quota valide, aucun appel n'est effectué.

Après activation globale et opt-in individuel : ouvrir une notion dans le chat puis cliquer « Donne-moi un exemple ». Vérifier le cookie technique, les sources et métadonnées en fin de réponse, et le compteur de sortie limité à 1 000 par session, tous fournisseurs compris. Une demande sans lien avec les données ou un historique arbitraire ne doit pas appeler le modèle. Le catalogue reste accessible après épuisement, si l'opt-in individuel est désactivé, ou avec `LLM_ACTIF=false`.

La consommation d'entrée et les nouvelles sessions peuvent être facturées au-delà de cette limite de sortie. `ANTHROPIC_API_KEY` reste facultative pour le repli en cas d'échec, sous le même budget ; `KERMICLAB_GITHUB_TOKEN` sert aux issues. Vérifier les coûts/conditions dans Cloudflare et Anthropic ; voir la checklist et l'ADR 0016. L'abonnement est au backlog : l'accès actuel reste gratuit provisoirement.
