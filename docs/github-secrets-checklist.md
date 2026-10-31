# Checklist des secrets GitHub

Chemin : **Settings → Secrets and variables → Actions → Repository secrets**.

## Déploiement Cloudflare

- [ ] `CLOUDFLARE_API_TOKEN` — requis ; jeton limité au compte, avec Workers Scripts, Pages, D1 et Workers R2 Storage en permission Edit.
- [ ] `CLOUDFLARE_ACCOUNT_ID` — requis ; identifiant du compte Cloudflare.

Ces secrets sont validés par le workflow manuel **Vérifier la configuration Cloudflare**. Les noms peuvent aussi être vérifiés sans afficher de valeur avec `scripts/verifier-secrets.sh`.

## Fonctionnalités du Worker

- [ ] `KERMICLAB_GITHUB_TOKEN` — nécessaire à la création d’issues par le Worker ; jeton fine-grained limité au dépôt `trigoLab` avec la permission Issues en lecture/écriture.
- [ ] `ANTHROPIC_API_KEY` — facultatif ; active les réponses hors catalogue et le routage assisté. Définir un plafond de dépense dans la console Anthropic avant activation.

La CI transmet `KERMICLAB_GITHUB_TOKEN` au Worker sous le nom `GITHUB_TOKEN`.

## Catalogue privé

- [ ] `CATALOGUE_TOKEN` — facultatif tant que le dépôt privé de maquettes n’est pas utilisé ; accès en lecture seule au contenu de `maquettes-catalogue`.

Sans ce secret, la CI utilise la maquette d’exemple publique.

## Variables GitHub (pas des secrets)

Dans l’onglet **Variables**, configurer si nécessaire :

- [ ] `KERMICLAB_API_URL` — URL du Worker `kermiclab-api`, utilisée lors de la génération du site.
- [ ] `CLOUDFLARE_PAGES_PROJECT` — nom du projet Pages ; valeur par défaut : `kermiclab`.
- [ ] `CATALOGUE_REPO` — dépôt de maquettes ; valeur par défaut : `kermic974/maquettes-catalogue`.

Ne collez jamais de jeton ou de clé dans une variable, une issue ou un fichier du dépôt.
