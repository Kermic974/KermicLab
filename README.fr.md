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
Navigateur ──▶ www.kermiclab.online (Cloudflare Pages « kermiclab », construit dans dist/)
            ├─ /         chat (web/)
            └─ /cercle/  application autonome du cercle (index.html, hors ligne)
        ──POST /api/chat──▶ Cloudflare Worker « kermiclab-api » (worker/wrangler.toml)
                            ├─ routage par mots-clés (déterministe)
                            ├─ routage Claude Haiku 5.5 (JSON structuré) sinon
                            ├─ GET /maquettes/:id → HTML du catalogue tel quel
                            ├─ GitHub Issues (maquette-manquante, traduction-manquante, support)
                            ├─ Cloudflare D1 (KPI anonymes) + sauvegarde R2 quotidienne
```

L’application autonome du cercle trigonométrique (`index.html`, générée depuis `src/`) est publiée sous
`/cercle/`, à côté du chat (ADR 0008).

Des maquettes supplémentaires peuvent vivre dans un dépôt **privé** séparé (`maquettes-catalogue`), récupéré par la CI avec un
jeton en lecture seule. Ce dépôt contient le cercle trigonométrique et des exemples publics fondés sur le gabarit
en mathématiques, physique-chimie, géographie et philosophie.

Le catalogue de géographie couvre **métropolisation, urbanisation, espaces ruraux, risques naturels,
changement climatique, ressources, mobilités, migrations et territoires français**, ainsi que huit notions
de mondialisation (`mondialisation`, `mers-oceans`, `union-europeenne`, `dynamiques-territoriales`,
`france-regions`, `espaces-productifs`, `tourisme` et `afrique-australe`). Chaque page en français
progresse de l'intuition ou du collège jusqu'au lycée, avec des cas d'étude, des exercices corrigés et un
défi du quotidien. Les notions de mondialisation proposent cinq exercices auto-corrigés et un défi en
quatre étapes ; les données chiffrées des scénarios sont fictives et les références de relecture figurent
dans chaque `fiche.md`. Les pages sont générées depuis `catalogue/<id>/contenu.json` ; voir
[le guide du gabarit](docs/gabarit.md). Une relecture humaine de l'exactitude géographique est requise avant fusion.

Les neuf pages de philosophie couvrent le devoir, l’État, la justice, la liberté, le langage, la raison,
la science, la technique et la vérité. Elles utilisent le gabarit commun : explications progressives,
auteurs, QCM auto-corrigés et défis de la vie quotidienne.

## Démarrage rapide

Prérequis : Node.js 22+, un compte Cloudflare, une clé API Anthropic (facultative en local).

```bash
npm ci
npm run ci                          # lint, build, contrôle des pages, tests unitaires et navigateur
cp .env.example worker/.dev.vars    # renseigner ANTHROPIC_API_KEY / GITHUB_TOKEN (facultatif)
cd worker && npx wrangler d1 execute kermiclab-kpi --local --file=schema.sql && npx wrangler dev   # API sur :8787
# dans un autre terminal
KERMICLAB_API_URL=http://localhost:8787 npm run build && npx wrangler pages dev dist           # chat sur :8788
```

Sans `ANTHROPIC_API_KEY`, le catalogue fonctionne ; les autres questions reçoivent une réponse de repli.
C'est le **mode zéro budget** actuel (offres gratuites Cloudflare et GitHub uniquement), voir [l'ADR 0006](docs/decisions/0006-mode-zero-budget.md).
Sans `GITHUB_TOKEN`, aucune issue n'est créée.

## Déploiement

Chaque push sur `main` lance `.github/workflows/ci.yml` : le job `verifier` (lint, build, sécurité des pages, tests
unitaires et navigateur) doit réussir avant que le job **Déploiement Cloudflare** applique le schéma D1, déploie le
Worker `kermiclab-api`, lui transmette ses secrets s'ils existent et publie `dist/` sur le projet Cloudflare Pages
`kermiclab` (`www.kermiclab.online`, `kermiclab.online`). Chaque PR reçoit une prévisualisation Cloudflare Pages.
Secrets et variables : voir le [README anglais](README.md#deploy) et [docs/actions-manuelles.md](docs/actions-manuelles.md).

## Contribuer

Voir [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) et [SECURITY.md](SECURITY.md).

## Base HTML pour l'atelier UX

Ouvrir [docs/ux/index.html](docs/ux/index.html) dans un navigateur ou copier son contenu dans Canvas.
Le dossier contient quatre fichiers HTML autonomes : le site (accueil, catalogue, chat, défi, progression,
profil et informations), une [page de notion](docs/ux/notion.html), l'[application cercle](docs/ux/cercle.html)
et un [jeu avec Académie](docs/ux/jeux.html). Télécharger les quatre fichiers dans le même dossier pour
conserver les liens ; chacun reste utilisable seul, hors ligne, avec son style intégré.

Ce sont des squelettes structurels en français, pas une refonte ni une reproduction exhaustive du catalogue.
Les écrans et dialogues sont dépliés, repérés par `data-ecran`, avec des exemples fictifs et des notes sur les états.
Seuls les liens, champs de démonstration et volets natifs fonctionnent : aucun envoi, calcul, stockage ou service externe.
Les textes sont figés pour cet atelier, hors de l'interface traduite `web/i18n/`.
Ces fichiers ne sont pas publiés par le build et ne modifient pas le site actuel.
Après édition dans Canvas, transmettre le HTML modifié ou les instructions par écran pour préparer la refonte.

## Licence

[MIT](LICENSE) pour le moteur générique. Le catalogue de maquettes et les paramètres des générateurs sont privés.
