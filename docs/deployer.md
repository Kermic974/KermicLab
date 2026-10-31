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

Les clés destinées au runtime du Worker (`ANTHROPIC_API_KEY` et `KERMICLAB_GITHUB_TOKEN`) restent facultatives selon les fonctions activées. Elles sont transférées au Worker par le workflow ; voir la checklist des secrets.
