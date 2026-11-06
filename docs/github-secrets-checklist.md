# Checklist des secrets GitHub

Chemin : **Settings → Secrets and variables → Actions → Repository secrets**.

## Déploiement Cloudflare

- [ ] `CLOUDFLARE_API_TOKEN` — requis ; jeton limité au compte, avec Workers Scripts, Pages, D1 et Workers R2 Storage en permission Edit.
- [ ] `CLOUDFLARE_ACCOUNT_ID` — requis ; identifiant du compte Cloudflare.

Ces secrets sont validés par le workflow manuel **Vérifier la configuration Cloudflare**. Les noms peuvent aussi être vérifiés sans afficher de valeur avec `scripts/verifier-secrets.sh`.

## Fonctionnalités du Worker

- [ ] `KERMICLAB_GITHUB_TOKEN` — nécessaire à la création d’issues par le Worker ; jeton fine-grained limité au dépôt `trigoLab` avec la permission Issues en lecture/écriture.
- Workers AI est le modèle principal via le binding `AI` dans `worker/wrangler.toml` ; aucune clé API Workers AI n’est requise.
- [ ] `LLM_SESSION_SECRET` — secret aléatoire d'au moins 32 caractères, nécessaire à la signature des sessions de quota IA. À créer dans GitHub Secrets pour transmission au Worker (ou directement dans Cloudflare). Ne pas le transmettre dans le chat. Le schéma D1 doit contenir `sessions_llm`.
- `LLM_ACTIF=true` est configuré dans `worker/wrangler.toml` à la demande du propriétaire ; déployer puis vérifier `/api/llm/status` pour confirmer l'activation effective. `LLM_ACTIF=false` reste le coupe-circuit global. Même activé, le LLM exige aussi l'opt-in individuel « Utiliser l'IA » dans Configuration, désactivé par défaut et conservé pour la session du navigateur. Quota partagé Workers AI/Anthropic de 1 000 tokens générés par session, maximum 24 h. Les entrées ne sont pas plafonnées par ce compteur. Accès gratuit provisoire ; contrôle par abonnement au backlog.
- [ ] `ANTHROPIC_API_KEY` — facultatif ; utilisé comme repli seulement si Workers AI échoue. Définir un plafond de dépense dans la console Anthropic avant de l’ajouter.
- [ ] `AI_GATEWAY_TOKEN` — requis si le repli Anthropic est utilisé ; permission AI Gateway Run, transmis au Worker comme secret. Tous les appels pédagogiques utilisent `kermiclab-gateway`, cache et logs désactivés ; vérifier aussi les exports Logpush et l'absence de retries additionnels dans Cloudflare. Workers AI via binding ne nécessite pas ce jeton.

Workers AI facture selon les quotas et tarifs du compte Cloudflare. Vérifiez la consommation et les options de contrôle des coûts dans le tableau de bord Cloudflare avant activation.

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
