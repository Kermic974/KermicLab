# Configurer Cloudflare

Ce guide prépare les secrets nécessaires au workflow de déploiement de trigoLab. Le dépôt ne contient aucune valeur secrète : configurez-les dans les paramètres GitHub du dépôt.

## 1. Créer un jeton API Cloudflare

Dans [Profil Cloudflare → API Tokens](https://dash.cloudflare.com/profile/api-tokens), créez un jeton personnalisé limité au compte Cloudflare utilisé par trigoLab. Accordez uniquement les permissions nécessaires au déploiement :

| Ressource | Permission |
|---|---|
| Workers Scripts | Edit |
| Pages | Edit |
| D1 | Edit |
| Workers R2 Storage | Edit |

Copiez le jeton au moment de sa création. Ne le partagez pas et ne le placez jamais dans un fichier du dépôt.

## 2. Ajouter les secrets GitHub

Dans **Settings → Secrets and variables → Actions → New repository secret**, créez :

| Nom | Valeur |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Jeton créé à l’étape 1 |
| `CLOUDFLARE_ACCOUNT_ID` | Identifiant du compte Cloudflare (32 caractères hexadécimaux), visible dans le tableau de bord du compte |

Le jeton et l’identifiant du compte sont les deux seuls secrets requis pour déployer le Worker et le site Pages. Les autres secrets du Worker sont décrits dans [la checklist GitHub](github-secrets-checklist.md).

## 3. Vérifier les ressources Cloudflare

Le dépôt référence déjà la base `kermiclab-kpi` et le bucket privé `kermiclab-bucket` dans `worker/wrangler.toml`. Vérifiez qu’ils existent dans le compte configuré avant de déployer :

```bash
cd worker
npx wrangler login
npx wrangler d1 list
npx wrangler r2 bucket list
```

Si une ressource manque, créez-la une seule fois :

```bash
npx wrangler d1 create kermiclab-kpi
npx wrangler r2 bucket create kermiclab-bucket
```

Si la création D1 retourne un nouvel identifiant, reportez-le dans `worker/wrangler.toml` (`database_id`) avant le déploiement. N’exécutez pas ces commandes de création si les ressources existent déjà.

Vérifiez aussi le projet Pages :

```bash
npx wrangler pages project list
```

S’il n’existe pas encore :

```bash
npx wrangler pages project create kermiclab --production-branch main
```

Le projet doit être nommé `kermiclab`, sauf si la variable GitHub `CLOUDFLARE_PAGES_PROJECT` est configurée avec un autre nom.

## 4. Vérifier le jeton

Après avoir ajouté les deux secrets, ouvrez **Actions → Vérifier la configuration Cloudflare → Run workflow** sur la branche principale. Le workflow vérifie la présence des secrets, le format de l’identifiant et l’état du jeton via l’API Cloudflare. Il ne révèle ni n’enregistre leurs valeurs.

Il faut corriger la portée ou les permissions du jeton si cette vérification échoue. Pour lister seulement les noms des secrets du dépôt depuis un terminal, utilisez :

```bash
scripts/verifier-secrets.sh
```

## 5. Déployer

Le déploiement est déclenché par un push sur `main` après la réussite des contrôles de la CI. Le workflow applique le schéma D1, déploie le Worker, puis publie `dist/` sur Pages. Les pull requests n’effectuent pas de déploiement.

Consultez [le guide de déploiement](deployer.md) pour les variables du site, le premier déploiement et les vérifications après publication.
