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

Le job de déploiement applique `worker/schema.sql` à D1, déploie `worker/` avec Wrangler, puis publie `dist/` sur Pages. Le nom Pages par défaut est `kermiclab`.

## Déploiement manuel de diagnostic

Pour une intervention locale autorisée, installez les dépendances, connectez Wrangler au compte approprié et lancez les commandes depuis la racine :

```bash
npm ci
npm run ci
cd worker
npx wrangler d1 execute kermiclab-kpi --remote --file=schema.sql
npx wrangler deploy
cd ..
npm run build
npx wrangler pages deploy dist --project-name=kermiclab --branch=main
```

Wrangler demande une authentification interactive avec `npx wrangler login`. Ne mettez pas de jeton dans la ligne de commande ou dans l’historique du terminal. En CI, le déploiement doit passer par le workflow existant et ses secrets GitHub.

## Après publication

- Vérifiez que le Worker `https://kermiclab-api.<compte>.workers.dev` répond.
- Configurez la variable Actions `KERMICLAB_API_URL` avec cette URL, puis relancez un déploiement pour générer le site avec la bonne adresse d’API.
- Vérifiez `https://kermiclab.pages.dev` et testez une question couverte par le catalogue.
- Activez Web Analytics dans les paramètres du projet Pages si souhaité.
- Gardez `ORIGINES_AUTORISEES` dans `worker/wrangler.toml` alignée avec le domaine du site. Une modification de domaine doit être revue avant le déploiement.

Workers AI est déclaré dans `worker/wrangler.toml` avec le binding `AI` : aucune clé API Workers AI n'est à ajouter. À la demande du propriétaire, la configuration de déploiement active le coupe-circuit global (`LLM_ACTIF=true`) ; `false` reste l'arrêt d'urgence. Cette modification ne certifie pas l'activation en production avant déploiement et vérification de `/api/llm/status`. Chaque visiteur doit également cocher « Utiliser l'IA » dans Configuration ; ce choix individuel est désactivé par défaut et mémorisé dans la session du navigateur. Les appels nécessitent les deux activations, le secret aléatoire `LLM_SESSION_SECRET` (32 caractères minimum) et le schéma D1 à jour (`sessions_llm`). La CI applique le schéma avant le déploiement et transfère les secrets définis. Sans session de quota valide, aucun appel n'est effectué.

Après activation globale et opt-in individuel : ouvrir une notion dans le chat puis cliquer « Donne-moi un exemple ». Vérifier le cookie technique, les sources et métadonnées en fin de réponse, et le compteur de sortie limité à 1 000 par session, tous fournisseurs compris. Une demande sans lien avec les données ou un historique arbitraire ne doit pas appeler le modèle. Le catalogue reste accessible après épuisement, si l'opt-in individuel est désactivé, ou avec `LLM_ACTIF=false`.

La consommation d'entrée et les nouvelles sessions peuvent être facturées au-delà de cette limite de sortie. `ANTHROPIC_API_KEY` reste facultative pour le repli en cas d'échec, sous le même budget ; `KERMICLAB_GITHUB_TOKEN` sert aux issues. Vérifier les coûts/conditions dans Cloudflare et Anthropic ; voir la checklist et l'ADR 0016. L'abonnement est au backlog : l'accès actuel reste gratuit provisoirement.
