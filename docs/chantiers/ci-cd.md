# Chantier : CI/CD

**Niveau actuel : 2 (vérifications obligatoires, migrations versionnées, test de fumée et retour arrière automatique)**

- `ci.yml`, job `verifier` : lint → build (index + CSP) → contrôle des pages → tests unitaires → tests Playwright.
  Ce job est un contrôle **obligatoire** de la protection de `main` (`scripts/configurer-github.sh`). Le contrat
  navigateur de **toutes les pages servies** (`tests/e2e/contrat-pages.test.mjs`) y est inclus : catalogue public et
  privé, pages du gabarit et pages écrites à la main (cercle, jeux), chaque langue, telles que le Worker les sert —
  onglets de base affichés, self-test inactif, navigation au clavier, aucune erreur ni violation CSP, aucun débordement
  à 360 px, connexion masquée. Avec `CATALOGUE_TOKEN`, l'absence des pages privées fait échouer la CI.
- `ci.yml`, job « Déploiement Cloudflare » (sur `main`, après `verifier`) : schéma D1, Worker `kermiclab-api`, secrets du Worker s'ils sont définis, puis `wrangler pages deploy dist` vers le projet Pages `kermiclab` (chat à la racine, application autonome sous `/cercle/`). ADR 0008.
- `ci.yml`, exécution quotidienne (02:07 UTC, 06:07 à La Réunion ; issue #312) : le job « Blog à publier
  aujourd'hui ? » compare les articles publiables ce jour-là avec `/blog/index.json` du site en ligne
  (`scripts/blog-programme.mjs`, lecture seule, sans secret). Sans écart, l'exécution s'arrête là ; sinon elle suit le
  chemin normal : `verifier`, puis déploiement, test de fumée et retour arrière. Si la liste en ligne est illisible,
  le déploiement a lieu par précaution.
- `pages.yml` : validation de l'application autonome (`index.html` à jour avec `src/`, frontières entre agents, tests, structure).
- `publication.yml` : tag et release à chaque nouvelle version.
- `roadmap.yml` : propose une mise à jour factuelle de la roadmap après validation de `main` (voir ci-dessous).
- `revue-ia.yml` : revue de sécurité par IA de chaque PR. Quand elle est ignorée (secret `ANTHROPIC_API_KEY` absent,
  ou PR d'un fork), un avertissement apparaît dans l'exécution et dans son résumé : l'absence de revue n'est plus
  silencieuse.
- `.cursor/environment.json` : même environnement que la CI pour les agents Cursor (AGENTS.md §6 quater).
- Catalogue privé récupéré si `CATALOGUE_TOKEN` existe.
- Prévisualisation de chaque PR par l'intégration Git Cloudflare Pages (les déploiements de production automatiques sont désactivés).

- Déploiement sûr (#178) : instantané des versions en production, migrations D1 versionnées (`worker/migrations/`,
  ajout seulement), test de fumée sans écriture de KPI, retour arrière automatique du Worker et du site en cas d'échec.
  Détail : [docs/deployer.md](../deployer.md).

## Test de fumée après déploiement (#178, #261)

Dernière étape du job « Déploiement Cloudflare » : `node scripts/deploiement.mjs fumee`. Onze contrôles, tous en
lecture :

| Contrôle | Route | Réussi si |
|---|---|---|
| API santé | `/api/sante` | `ok` vrai et au moins une page au catalogue |
| API catalogue | `/api/catalogue` | liste des notions non vide |
| API suggestions du chat | `/api/suggestions?lang=fr` | liste présente |
| API état de l'IA et du défi | `/api/llm/status` | champs `actif` et `defi.ia` présents |
| Page servie | `/maquettes/trigo-cercle?lang=fr` | métadonnées `kermiclab-meta` présentes |
| Site | `/` | titre KermicLab |
| Ressources | `app.js` et `style.css`, à l'adresse (avec empreinte) citée par la page d'accueil | fichier non vide |
| Configuration du site | `/config.json` | `apiUrl` égale à l'API testée |
| Textes du site | `/i18n/fr.json` | JSON non vide |
| Blog | `/blog/` | titre présent |

- **Sans coût ni écriture** : aucune requête vers `/api/chat`, `/api/defi`, `/api/cahier`, `/api/support` ni
  `/api/idee`. Aucun modèle n'est appelé, aucun KPI n'est écrit, aucune donnée personnelle n'est utilisée.
- **Limites** : le chat, la génération d'un défi et le compte local ne sont pas parcourus de bout en bout (ils
  écriraient des KPI ou coûteraient des tokens, et il n'existe pas d'environnement de test dédié) ; seuls leur état
  et leurs données de départ sont vérifiés. Le site est testé à l'adresse Pages (`kermiclab.pages.dev`), car le
  domaine personnalisé répond 403 aux machines de GitHub Actions.
- **Seuils** : chaque contrôle doit répondre en HTTP 2xx avec le contenu attendu ; cinq tentatives espacées de
  15 secondes laissent le temps au déploiement de se propager. Aucun seuil de durée : les durées sont relevées pour
  le diagnostic.
- **Rapport** : le résumé de l'étape (onglet « Summary » de l'exécution) liste pour chaque contrôle l'étape, la route,
  le statut HTTP, la durée et le diagnostic ; le journal reprend les mêmes lignes. Le diagnostic est borné à
  200 caractères et ne recopie jamais un corps de réponse ; ni secret, ni IP, ni texte d'utilisateur.
- **En cas d'échec** : le job échoue (visible dans Actions, notification GitHub) et le retour arrière automatique
  rétablit le Worker et le site de l'instantané ; la base D1 n'est jamais annulée (#178). Pour diagnostiquer : lire le
  rapport, rejouer la route en échec avec `curl`, corriger sur une branche, puis refusionner. Aucun autre
  retour arrière automatique n'est ajouté.

Prochaines étapes :
- Prévisualisations des PR construites avec `npm run build` (phase 5).

## Roadmap après fusion

Le workflow `roadmap.yml` écoute la fin du seul workflow CI/CD (issue #284 : un déclenchement par fusion au lieu de
trois). Il ignore les exécutions de PR, les exécutions quotidiennes, les forks et les échecs. Si la validation de
l'application autonome ou la sécurité se termine après CI/CD, aucune proposition n'est faite pour ce commit : la
fusion suivante la rattrape, ou un lancement manuel. Il charge uniquement `main`, jamais une branche ou un
artefact fourni par l'événement. `scripts/roadmap.mjs` exige les trois dernières validations **réussies sur le
même commit de main** ; une validation en attente, annulée ou échouée empêche toute proposition.
Les réexécutions sont prises en compte : un ancien succès ne masque pas un nouvel échec.
Un lancement manuel via Actions est possible, sans contourner ces contrôles.

Une fois le commit validé, le script réconcilie jusqu'à 20 PR fusionnées parmi les 100 PR fermées les plus récemment
mises à jour. Il vérifie leur présence dans l'historique du commit chargé (fusion classique, squash ou rebase).
Il recompte les pages et jeux du catalogue public et remplace uniquement l'encart HTML délimité par
`roadmap:auto:debut` / `roadmap:auto:fin`. Le bilan éditorial daté, les phases, le Gantt et leurs critères de sortie
restent humains : le titre d'une PR ne suffit pas à prouver qu'un chantier est achevé.
Une CI réussie ne certifie pas un déploiement réel (le job Cloudflare peut être ignoré faute de secrets).

La branche `automatisation/roadmap` et sa PR sont réutilisées, sans push direct ni fusion automatique sur `main`.
La sérialisation des exécutions et la reconstruction à partir de `main` permettent de rattraper les fusions
rapprochées même lorsqu'une exécution intermédiaire est annulée. Les PR de cette branche sont exclues du tableau.
Les sorties sont déterministes : pas de date d'exécution qui produirait un nouveau diff à chaque relance.
Une empreinte des PR et des compteurs empêche la fusion de la PR automatique de générer une nouvelle PR
uniquement parce que le SHA et les liens de validation ont changé.
Les erreurs API, bornes HTML invalides et erreurs Git font échouer le workflow explicitement.

### Activation et validation humaine

Le seul jeton utilisé est `GITHUB_TOKEN` avec `actions: read`, `contents: write` et `pull-requests: write`.
Aucun secret IA ou PAT n'est nécessaire. Dans **Settings → Actions → General → Workflow permissions**,
autoriser **Allow GitHub Actions to create and approve pull requests** (aucune approbation automatique n'est utilisée).
L'activation ne sera effective qu'après fusion de ce workflow sur `main`.

GitHub ne déclenche pas les workflows `pull_request` pour une PR créée ou actualisée avec `GITHUB_TOKEN`.
Le propriétaire doit **fermer puis rouvrir la PR automatique après sa dernière mise à jour** pour lancer la CI,
puis attendre les contrôles verts et approuver avant fusion. Cela évite d'ajouter un PAT privilégié uniquement
pour déclencher des workflows. Ne pas fusionner une proposition sans cette validation.
