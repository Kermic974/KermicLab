# Kermiclab (trigoLab)

*[English version](README.md)*

Kermiclab est un agent conversationnel pédagogique pour les 7 à 77 ans. On pose une question
(« c'est quoi le sinus ? ») et il sert une **page HTML autonome, identifiée et versionnée**, à onglets :
explication (de l'intuition au formel), application ludique, mise en situation.

- **Déterministe** : une question couverte par le catalogue renvoie toujours le même fichier (zéro token de génération).
- **Apprentissage par backlog** : une question non couverte ouvre (ou commente) une issue `maquette-manquante` ; après validation humaine d'une nouvelle page, la même question la renvoie.
- **Agnostique de l'agent** : toutes les instructions sont dans [AGENTS.md](AGENTS.md).
- **Pensé pour les enfants** : aucune donnée personnelle, modération des entrées et sorties, KPI anonymes.

## Architecture

```
Navigateur ──▶ Cloudflare Worker « trigolab » (wrangler.toml)
                                                            ├─ fichiers statiques du chat (dist/, construit depuis web/)
                                                            ├─ routage par mots-clés (déterministe)
                                                            ├─ routage Claude Haiku 5.5 (JSON structuré) sinon
                                                            ├─ GET /maquettes/:id → HTML du catalogue tel quel
                                                            ├─ Issues GitHub (maquette-manquante, traduction-manquante, support)
                                                            └─ Cloudflare D1 (KPI anonymes)
```

L’application autonome du cercle trigonométrique se trouve dans `index.html` à la racine.
GitHub Pages ne publie que cette application, après la réussite des vérifications CI ; le chat et l’API
restent servis par le Worker Cloudflare.

Les vraies maquettes sont dans un dépôt **privé** séparé (`maquettes-catalogue`), récupéré par la CI avec un
jeton en lecture seule. Ce dépôt ne contient qu'une maquette d'exemple (`catalogue/trigo-cercle`).

## Démarrage rapide

Prérequis : Node.js 22+, un compte Cloudflare, une clé API Anthropic (facultative en local).

```bash
npm ci
npm run ci                          # lint, build, contrôle des pages, tests unitaires et navigateur
cp .env.example .dev.vars           # renseigner ANTHROPIC_API_KEY / GITHUB_TOKEN (facultatif)
npx wrangler d1 execute kermiclab-kpi --local --file=worker/schema.sql
npx wrangler dev                    # build, puis chat + API sur http://localhost:8787
```

Sans `ANTHROPIC_API_KEY`, le catalogue fonctionne ; les autres questions reçoivent une réponse de repli.
C'est le **mode zéro budget** actuel (offres gratuites Cloudflare et GitHub uniquement), voir [l'ADR 0006](docs/decisions/0006-mode-zero-budget.md).
Sans `GITHUB_TOKEN`, aucune issue n'est créée.

## Déploiement

Le Worker Cloudflare `trigolab` est relié à ce dépôt GitHub (**Workers Builds**) : chaque push sur `main` est
vérifié (lint, build, sécurité des pages et tests unitaires et end-to-end) avant son déploiement par Cloudflare
(`npx wrangler deploy` lance d'abord `npm run predeploy`). Aucun jeton de déploiement n'est stocké dans GitHub ;
GitHub Actions ne déploie pas le Worker.

Le même workflow GitHub Actions déploie aussi `index.html` sur GitHub Pages après les vérifications, sur `main`.
Activer une fois **Settings → Pages → Build and deployment → GitHub Actions**. L’artefact Pages ne contient que
l’application autonome, sans appel réseau ni ressource externe ; elle peut être enregistrée et utilisée hors ligne.

Les secrets du Worker (`ANTHROPIC_API_KEY`, facultatif en mode zéro budget, et `GITHUB_TOKEN`) se renseignent dans
Cloudflare → Workers → trigolab → Settings → Variables and Secrets. Détails dans le [README anglais](README.md#deploy)
et [docs/actions-manuelles.md](docs/actions-manuelles.md).

## Contribuer

Voir [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) et [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE) pour le moteur générique. Le catalogue de maquettes et les paramètres des générateurs sont privés.
