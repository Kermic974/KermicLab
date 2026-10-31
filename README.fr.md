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
Navigateur (Cloudflare Pages : web/)  ──POST /api/chat──▶  Cloudflare Worker (worker/)
                                                            ├─ routage par mots-clés (déterministe)
                                                            ├─ routage Claude Haiku 5.5 (JSON structuré) sinon
                                                            ├─ GET /maquettes/:id → HTML du catalogue tel quel
                                                            ├─ Issues GitHub (maquette-manquante, traduction-manquante, support)
                                                            └─ Cloudflare D1 (KPI anonymes)
```

Les vraies maquettes sont dans un dépôt **privé** séparé (`maquettes-catalogue`), récupéré par la CI avec un
jeton en lecture seule. Ce dépôt ne contient qu'une maquette d'exemple (`catalogue/trigo-cercle`).

## Démarrage rapide

Prérequis : Node.js 22+, un compte Cloudflare, une clé API Anthropic (facultative en local).

```bash
npm ci
npm run ci                          # lint, build, contrôle des pages, tests unitaires et navigateur
cp .env.example worker/.dev.vars    # renseigner ANTHROPIC_API_KEY / GITHUB_TOKEN (facultatif)
cd worker && npx wrangler d1 execute kermiclab-kpi --local --file=schema.sql && npx wrangler dev
# dans un autre terminal
npm run build && npx wrangler pages dev dist
```

Sans `ANTHROPIC_API_KEY`, le catalogue fonctionne ; les autres questions reçoivent une réponse de repli.
C'est le **mode zéro budget** actuel (offres gratuites Cloudflare et GitHub uniquement), voir [l'ADR 0006](docs/decisions/0006-mode-zero-budget.md).
Sans `GITHUB_TOKEN`, aucune issue n'est créée.

## Déploiement

Chaque push sur `main` lance la CI/CD (`.github/workflows/ci.yml`) : tests, schéma D1, Worker, Pages.
Les secrets et variables nécessaires sont listés dans le [README anglais](README.md#deploy) et dans
[docs/actions-manuelles.md](docs/actions-manuelles.md).

## Contribuer

Voir [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) et [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE) pour le moteur générique. Le catalogue de maquettes et les paramètres des générateurs sont privés.
