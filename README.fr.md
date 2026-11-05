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

La **Boîte à idées**, accessible sur chaque vue publiée (pages, onglets et dialogues, y compris les
notions et jeux intégrés), ouvre dans un nouvel onglet un brouillon d’issue GitHub « Évolution ».
La page, sa version, la langue et la vue active sont renseignées, avec une trame de besoin, de critères
d’acceptation et de travail pour l’agent. L’utilisateur complète et valide la publication sur GitHub
(compte requis) : rien n’est créé automatiquement. Aucun pseudo, conversation, résultat d’exercice,
paramètre d’URL ou stockage local n’est transmis. Ne pas ajouter de données personnelles à l’issue publique.
Le composant partagé `web/boite-idees.{js,css}` et ses textes `web/i18n/*.json` sont incorporés au build
dans les pages du catalogue servies par le Worker ; les sources du catalogue restent inchangées.
L’application autonome les incorpore via `python3 scripts/build-standalone.py`. Aucun secret ni accès réseau
n’est nécessaire pour préparer le lien, même hors ligne ; publier nécessite une connexion à GitHub.

La navigation distingue les écrans **Accueil**, **Labs**, **Jeux**, **Défi express**, **Progression**,
**Mes trophées** et **Profil** dans la zone principale, avec des liens directs (`/#labs`, `/#jeux`,
`/#defi`, `/#progression`, `/#badges`, `/#profil`) et le retour du navigateur.
Les Labs présentent les applications dédiées disponibles (actuellement le cercle sous `/cercle/`),
pas les fiches du catalogue. L'entrée **Notions** conserve le catalogue existant, ses matières, niveaux,
recherche et compteurs. Les jeux disposent de cartes et d'une recherche séparée ; leur ouverture
conserve la bulle isolée et la progression locale. Sur mobile, la navigation s'affiche sur deux rangées.

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
Sans `GITHUB_TOKEN`, le Worker ne crée aucune issue automatiquement ; la Boîte à idées reste utilisable via GitHub.

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
Le dossier contient six fichiers HTML autonomes : le tableau de bord actuel (parcours d'accueil v3,
navigation Labs/Jeux, chat, catalogue, défi, trophées, profil et dialogues), les [variantes de notions](docs/ux/notion.html),
l'[application cercle](docs/ux/cercle.html), les [neuf jeux et leurs Académies](docs/ux/jeux.html),
les [pages éditoriales](docs/ux/editorial.html) et un [inventaire issu des sources](docs/ux/inventaire.html).
Télécharger les six fichiers dans le même dossier pour conserver les liens ; chacun fonctionne hors ligne avec son style intégré.

Ce sont des squelettes structurels en français, pas une refonte ni une copie au pixel près.
L'inventaire liste toutes les pages du catalogue public (181 à cet instant), leurs vrais onglets, versions,
figures et compatibilités avec Mes trophées. Les gabarits partagés sont représentés une fois, avec les écrans propres
aux jeux et les variantes d'état. Le catalogue privé et le déploiement effectif ne sont pas vérifiés.
Les écrans de compte masqués restent signalés comme inactifs.
Les écrans et dialogues sont dépliés, repérés par `data-ecran` et reliés aux sources par `data-source`, avec des exemples fictifs.
Seuls les liens et volets natifs fonctionnent : aucun envoi, calcul, stockage ou service externe.
Les textes sont figés pour cet atelier, hors de l'interface traduite `web/i18n/`.
Ces fichiers ne sont pas publiés par le build et ne modifient pas le site actuel.
Après édition dans Canvas, transmettre le HTML modifié ou les instructions par écran pour préparer la refonte.
Chaque fichier affiche un cartouche de version lié à ses vues actives, aux sources courantes et au commit
de référence immuable. Chaque ligne de l'inventaire relie aussi la page active et sa source. Les liens externes
ne chargent rien avant un clic ; les dialogues sans URL directe sont reliés à leur page d'entrée avec la procédure
d'ouverture. La version déployée n'est pas déduite de l'instantané des sources.

Après une évolution des sources ou des squelettes, relire les squelettes manuels puis lancer
`node scripts/ux-suivi.mjs --version=X.Y.Z` avec une version SemVer strictement croissante.
Cette commande régénère l'inventaire et les six cartouches, versionne uniquement les fichiers affectés et ajoute
les vues modifiées, commits sources et empreintes SHA-256 au journal `docs/ux/suivi.json`.
Version majeure pour une restructuration, mineure pour de nouveaux écrans, corrective pour des corrections.
Committer ensemble squelettes et registre ; Git conserve les instantanés précédents.
`node scripts/ux-suivi.mjs --check` détecte les écarts de sources ou de squelettes sans modifier les fichiers.
`node --test tests/e2e/ux.test.mjs` contrôle aussi la couverture du catalogue, des dialogues, de la navigation
et des onglets des jeux, les liens locaux et vers les vues actives, et les mises en page hors ligne à 360, 768 et 1440 pixels.
La CI des pull requests contrôle les sources fusionnées avec `main` : si une nouvelle vue y est livrée entre-temps,
intégrer `main`, actualiser les squelettes concernés et publier une nouvelle version ; ne pas régénérer les empreintes en CI.
Committer les sources avant de lancer le versioning : une source modifiée ou non suivie est refusée avant toute écriture.
Le contrôle vérifie aussi que le commit référencé contient les sources empreintées.
Seul l'encart factuel `roadmap:auto` est neutralisé pour ne pas bloquer les PR de suivi automatique :
le reste de la roadmap et son générateur restent contrôlés, donc leurs évolutions structurelles nécessitent une nouvelle version UX.

## Licence

[MIT](LICENSE) pour le moteur générique. Le catalogue de maquettes et les paramètres des générateurs sont privés.
