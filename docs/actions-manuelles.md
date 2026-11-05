# Actions manuelles

Actions qui nécessitent le propriétaire (protocole : AGENTS.md §8). Statut : `à faire` / `fait` / `reporté`.

## Actualisation automatique de la roadmap

- **À faire** : après fusion du workflow `roadmap.yml`, autoriser **Allow GitHub Actions to create and approve
  pull requests** dans [Settings → Actions → General](https://github.com/Kermic974/trigoLab/settings/actions).
  Cette permission n'a pas pu être vérifiée par l'agent (API GitHub : HTTP 403).
- **Pourquoi** : créer ou actualiser la PR `automatisation/roadmap` avec le jeton éphémère, sans PAT ni IA.
- **Comment confirmer** : lancer « Actualisation de la roadmap » après les trois validations vertes de `main` ;
  une PR factuelle est proposée (ou aucune modification si elle est déjà à jour).
- **Permanent** : fermer puis rouvrir la PR automatique après sa dernière mise à jour pour déclencher sa CI
  (restriction GitHub sur les événements créés par `GITHUB_TOKEN`), puis revue CODEOWNER et CI verte avant fusion.
  Voir [le fonctionnement et les limites](chantiers/ci-cd.md#roadmap-après-fusion).

## Validation du catalogue d'histoire contemporaine

- **À faire** : relire et valider les huit notions `premiere-guerre-mondiale`, `totalitarismes`,
  `seconde-guerre-mondiale`, `guerre-froide`, `decolonisation`, `construction-europeenne`,
  `ve-republique` et `monde-depuis-1990`, notamment les réponses corrigées, les violences historiques,
  les mémoires et les liens avec l'actualité.
- **Où** : [PR #69](https://github.com/Kermic974/trigoLab/pull/69), dossiers
  `catalogue/<id>/` (`fiche.md`, `contenu.json` et `page.html` générée).
- **Pourquoi** : exactitude historique et adaptation au public mineur ; validation humaine du CODEOWNER
  requise avant toute fusion.
- **Comment confirmer** : revue approuvée par le CODEOWNER après lecture des contenus et réalisation
  des exercices ; CI verte avant fusion.
- **À faire** : autoriser les workflows de la PR #69, actuellement en attente d'autorisation
  (`action_required`), puis vérifier leurs résultats. La CI locale passe lint, build, contrôle des pages
  et les 63 tests unitaires ; la suite e2e attend le Chromium géré par Playwright, absent de cet
  environnement. Les 56 exercices des nouvelles pages ont été vérifiés avec Chromium système,
  ainsi que les indices, les défis complets, le rendu mobile et l'absence d'erreurs CSP.

## Fournisseurs LLM actifs

Le routage vers le catalogue reste déterministe et sans appel modèle. Seules les relances pédagogiques proposées sur une page déjà ouverte peuvent utiliser Workers AI ; les demandes hors périmètre sont refusées sans appel. Activation avec `LLM_ACTIF=true`, secret de signature et schéma D1 à jour.

| Service | Coût | Statut |
|---|---|---|
| Cloudflare Workers AI (`AI` binding) | selon tarifs et quotas Cloudflare | principal, à vérifier (action 28) |
| Anthropic (`ANTHROPIC_API_KEY`) | selon le compte Anthropic | repli facultatif, non requis pour Workers AI |
| Cloudflare Workers, Pages, D1, GitHub | selon les offres du compte | utilisés |
| Domaine `kermiclab.online` | acheté | utilisé |

Sans secret Anthropic, le Worker utilise tout de même Workers AI. La clé Anthropic (action 5) n'est sollicitée que si l'appel Workers AI échoue.
Le budget partagé est de **1 000 tokens générés par session navigateur**, expiration serveur absolue de 24 h. Les entrées restent facturables ; supprimer le cookie ou changer de navigateur crée une autre session. Ce n'est pas un plafond financier global. L'accès est gratuit provisoirement ; le contrôle par abonnement est au [backlog #121](https://github.com/Kermic974/trigoLab/issues/121).

## Liste des actions

| # | Action | Où | Pourquoi | Comment confirmer | Statut |
|---|---|---|---|---|---|
| 1 | Confirmer le compte GitHub et autoriser le dépôt `trigoLab` | github.com | Source unique de vérité | Le dépôt est accessible à l'agent | fait |
| 2 | Créer ou vérifier le jeton API Cloudflare (Workers Scripts : Edit, Pages : Edit, D1 : Edit, Workers R2 Storage : Edit), associé au compte indiqué par `CLOUDFLARE_ACCOUNT_ID` | [Guide Cloudflare](setup-cloudflare.md) ; https://dash.cloudflare.com/profile/api-tokens | Déploiement par la CI ; le jeton actuel est refusé par l'API D1 (`Authentication error [code: 10000]`) | Secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` à jour dans GitHub ; le jeton est valide et autorisé sur ce compte (plan Free, gratuit) ; relancer le workflow CI/CD sur `main` : le job « Déploiement Cloudflare » passe au vert | à vérifier à la fusion de la PR « www : chat et cercle » : le job « Déploiement Cloudflare » doit passer au vert |
| 3 | Créer la base D1 : `cd worker && npx wrangler d1 create kermiclab-kpi`, reporter `database_id` dans `worker/wrangler.toml` | Terminal + PR | KPI | `wrangler d1 list` montre la base ; `database_id` est référencé dans `worker/wrangler.toml` ; PR fusionnée | fait |
| 4 | Créer le projet Pages `kermiclab` et activer Web Analytics | Cloudflare → Workers & Pages ; Analytics & Logs → Web Analytics | Hébergement du chat ; mesure d'audience sans cookie | `https://www.kermiclab.online` sert le chat ; les visites apparaissent dans Web Analytics (site `kermiclab.online`) | fait (2026-10-31) : script de mesure ajouté au chat (`web/index.html`), injection automatique désactivée car elle ne s'appliquait pas aux pages servies par Pages ; mode « lite » (exclusion de l'UE) désactivé |
| 5 | (Facultatif) Créer une clé API Anthropic et définir un plafond de dépense | https://console.anthropic.com/settings/keys et /settings/limits | Repli du chat si Workers AI échoue | Secret `ANTHROPIC_API_KEY` dans GitHub ; vérifier qu'une erreur Workers AI peut être relayée par Anthropic sans exposer de clé | à faire si le repli Anthropic est souhaité |
| 6 | Créer un jeton GitHub fine-grained : dépôt `trigoLab` uniquement, permission Issues lecture/écriture | https://github.com/settings/personal-access-tokens/new | Création des issues par le Worker (boucle d'apprentissage) | Secret `KERMICLAB_GITHUB_TOKEN` dans GitHub ; la CI le transmet au Worker comme `GITHUB_TOKEN` au déploiement suivant | fait (2026-10-31) : secret `GITHUB_TOKEN` présent sur le Worker `kermiclab-api` ; issue de test #33 (`support`) créée depuis le chat. Jeton à renouveler avant son expiration (1 an) |
| 7 | Renseigner la variable GitHub `KERMICLAB_API_URL` (URL du Worker après le 1er déploiement) et `ORIGINES_AUTORISEES` dans `wrangler.toml` | Settings → Secrets and variables → Actions | Le chat doit joindre le Worker | Le chat répond à « c'est quoi le sinus ? » | fait par défaut : la CI utilise `https://kermiclab-api.kermic.workers.dev` si la variable est absente ; `ORIGINES_AUTORISEES` contient `www.kermiclab.online`, `kermiclab.online` et `kermiclab.pages.dev` |
| 8 | Protéger `main` (PR obligatoire, CI « Lint, build, tests » verte, revue CODEOWNER, pas de force push) | GitHub → Settings → Branches → Add branch ruleset (réservé à l'administrateur du dépôt) | Sécurité : rien n'arrive sur `main` sans vérifications | Un push direct sur `main` est refusé | à faire — les labels sont désormais créés automatiquement par le workflow « Labels » (`.github/labels.json`) |
| 9 | Fournir les versions HTML existantes du cercle trigonométrique | Dépôt privé `maquettes-catalogue` | Maquette de référence | Maquette `trigo-cercle` remplacée, PR validée | à faire |
| 10 | Créer le dépôt **privé** `maquettes-catalogue` + jeton lecture seule (`CATALOGUE_TOKEN`) | github.com/new | Séparer maquettes et moteur | La CI affiche « Récupérer le catalogue privé » | à faire |
| 11 | Référentiel des notions des programmes de maths (collège → lycée) dans le dépôt privé | `maquettes-catalogue` | Feuille de route du catalogue | Fichier présent | à faire |
| 12 | Compléter l'identité de l'éditeur dans `web/mentions-legales.html` | PR | Obligation légale | PR fusionnée | à faire |
| 13 | Vérifier les exigences d'Anthropic pour les services accessibles aux mineurs | https://www.anthropic.com/legal | Conformité | Décision consignée dans `docs/decisions/` | à faire |
| 14 | Valider juridiquement le consentement parental (< 15 ans) avant « Mon compte » | Conseil juridique | Majorité numérique en France | ADR signé | à faire (phase 3) |
| 15 | Nom de domaine relié au projet Pages | Cloudflare → Domains | Lien public lisible | `https://www.kermiclab.online` sert le chat | fait : `kermiclab.online` acheté (2026-10-31), `www` et domaine nu reliés à Pages ; `kermiclab.ai` abandonné |
| 16 | Valider chaque pull request de maquette | GitHub | Contrôle humain | Revue CODEOWNER | permanent |
| G1 | Relire les neuf notions de géographie : métropolisation, urbanisation, espaces ruraux, risques naturels, changement climatique, ressources, mobilités, migrations, territoires français | [Pull requests du dépôt](https://github.com/Kermic974/trigoLab/pulls) ; `catalogue/<id>/fiche.md`, `contenu.json` et `page.html` | Exactitude pédagogique pour un public mineur : exemples, distinctions entre notions, acteurs et échelles ; aucune fusion sans validation humaine | Revue CODEOWNER approuvée et CI verte sur la PR portant ces notions | à faire |
| 22 | Autoriser la CI, relire et valider les huit notions de philosophie « existence humaine et culture » | [PR #66](https://github.com/Kermic974/trigoLab/pull/66) ; [catalogue](../catalogue/) | Workflows en attente d'autorisation (`action_required`) ; public mineur : exactitude pédagogique, neutralité religieuse et absence de diagnostic sur l'inconscient | Workflows autorisés, CI verte et revue CODEOWNER approuvée, notamment des réponses aux QCM et des présentations des auteurs | à faire |
| 23 | Relire et valider les huit notions d'histoire (Antiquité, Moyen Âge, Renaissance, Temps modernes, Lumières, Révolution française, Napoléon, révolution industrielle) | [PR #68](https://github.com/Kermic974/trigoLab/pull/68) ; `catalogue/<id>/fiche.md` et `contenu.json` | Public mineur : vérifier repères, causes-conséquences, corrections QCM et nuances sur les droits et la colonisation | Revue CODEOWNER approuvée et CI verte avant fusion | à faire |
| 24 | Autoriser les workflows de la PR des notions d'histoire | [Actions de la PR #68](https://github.com/Kermic974/trigoLab/pull/68/checks) | Les workflows indiquent `action_required`, sans job exécuté ; les e2e locaux sont bloqués par le headless shell Playwright absent, malgré la vérification hors ligne des huit pages dans Chromium système | Workflows autorisés puis CI verte | à faire |
| 18 | Activer R2 et créer le bucket `kermiclab-bucket` | Cloudflare → R2 | Stockage des données (ADR 0007) | `wrangler r2 bucket list` montre le bucket | fait |
| 19 | Déconnecter la build Git Cloudflare du Worker `trigolab-dev`, puis supprimer ce Worker | Cloudflare → Workers & Pages → trigolab-dev → Settings → Build → Disconnect ; puis Settings → Delete | Le déploiement passe uniquement par GitHub Actions (Worker `kermiclab-api`) ; deux chemins de déploiement se contredisent | `trigolab-dev` n'apparaît plus dans Workers & Pages | fait (les Workers `trigolab` et `trigolab-dev` n'existent plus au 2026-10-31) |
| 20 | Retirer Cloudflare Access du domaine nu `kermiclab.online` | Cloudflare → Zero Trust → Access → Applications | Site public pour les élèves | `https://kermiclab.online` répond sans page de connexion | fait (2026-10-31, application « trigolab-poc » supprimée) |
| 21 | Désactiver les déploiements de production automatiques de l'intégration Git Cloudflare Pages | Cloudflare → Workers & Pages → kermiclab → Settings → Builds | Elle publiait le dépôt entier sans build et concurrençait la CI | « Production branch deployments » désactivé ; les prévisualisations restent actives | fait (2026-10-31) |
| 17 | Décider du passage du dépôt en public | Settings → General | Open source | Visibilité changée par le propriétaire | à faire (plus tard) |
| 25 | Relire et valider les huit notions de géographie : mondialisation, mers-oceans, union-europeenne, dynamiques-territoriales, france-regions, espaces-productifs, tourisme et afrique-australe | PR du catalogue ; références dans chaque `catalogue/<id>/fiche.md` | Exactitude pour un public mineur : repères régionaux datés de 2026, distinction UE/euro/Schengen, ZEE, tourisme et limites de l'étude de Maputo | Relecture des niveaux et corrigés, exercices parcourus, CI verte et approbation du CODEOWNER avant fusion | à faire |
| 26 | Autoriser les workflows de la PR géographie et traiter séparément l'installation des dépendances du Worker dans la CI | [PR #71](https://github.com/Kermic974/trigoLab/pull/71) ; `.github/workflows/ci.yml` et `worker/package.json` | Le run 41318570992 est `action_required`, sans job exécuté. Localement, `npm ci` à la racine ne fournit pas `jose`, déclaré dans le Worker : la suite complète nécessite aussi ces dépendances, indépendamment du catalogue | Workflows autorisés, dépendances du Worker disponibles et CI verte avant fusion ; aucune modification de dépendances ou de workflow dans cette contribution | à faire |
| 27 | Autoriser les workflows de la PR EMC et relire les douze notions avant fusion | [PR #74](https://github.com/Kermic974/trigoLab/pull/74) | GitHub attend une autorisation pour exécuter les workflows ; validation pédagogique du CODEOWNER requise pour le public mineur | Workflows CI/CD et sécurité verts, puis revue CODEOWNER approuvée | à faire |
| 28 | Vérifier l'accès Workers AI, ses conditions pour mineurs et les coûts avant activation en production | [Tableau de bord Cloudflare](https://dash.cloudflare.com/) ; [tarifs Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/) | Le modèle `@cf/meta/llama-3.3-70b-instruct-fp8-fast` utilise le binding `AI`, sans clé API ; le quota de 1 000 tokens de sortie par session n'est pas un plafond global de dépense | Confirmer l'accès/conditions du modèle et les quotas/tarifs du compte, vérifier les options d'alerte/coût ; après déploiement ouvrir une page puis choisir une relance, contrôler les sources, métadonnées et compteur | à faire |
| 29 | Créer `LLM_SESSION_SECRET` (au moins 32 caractères aléatoires), valider le cookie technique et vérifier la migration D1 | [Secrets GitHub du dépôt](https://github.com/Kermic974/trigoLab/settings/secrets/actions) ; Cloudflare → Worker `kermiclab-api` → Settings → Variables and Secrets | Signature du quota serveur ; aucune clé ni historique dans le chat. Le cookie navigateur peut être bloqué comme cookie tiers entre Pages et workers.dev : aucun appel n'est autorisé sans cookie valide | Secret ajouté sans le partager dans une issue/chat ; CI applique `worker/schema.sql`, le Worker possède `sessions_llm` ; vérifier l'expiration 24 h, le refus après quota et les règles de confidentialité. L'activation est demandée par le propriétaire et préparée avec `LLM_ACTIF=true` ; `false` reste l'arrêt d'urgence | à faire |
| 30 | Déployer l'activation LLM et confirmer son fonctionnement en production | [Tableau de bord Cloudflare](https://dash.cloudflare.com/) → Workers & Pages → `kermiclab-api` ; `/api/llm/status` | L'accès est activé dans la configuration du dépôt à la demande du propriétaire. La session ne dispose pas des accès Cloudflare et ne résout pas le domaine de l'API ; l'état distant n'est pas vérifiable ici | Après CI verte et validation humaine, déployer avec les prérequis des actions 28–29 ; vérifier `{"actif":true}`, cocher « Utiliser l'IA » dans Configuration, ouvrir l'avatar puis une notion et demander une relance ; vérifier sources, métadonnées et quota | à faire |

Si l'étape « Schéma D1 » échoue avec `Authentication error [code: 10000]`, vérifier que `CLOUDFLARE_API_TOKEN` dispose bien de la permission `D1: Edit` sur le compte correspondant à `CLOUDFLARE_ACCOUNT_ID`, puis relancer le workflow.

## Catalogue de philosophie

| Action | Où | Pourquoi | Comment confirmer | Statut |
|---|---|---|---|---|
| Relire les neuf notions (devoir, État, justice, liberté, langage, raison, science, technique, vérité), leurs auteurs et leurs corrigés | [PR #67](https://github.com/Kermic974/trigoLab/pull/67) ; `catalogue/<id>/contenu.json` et `page.html` | Exactitude philosophique, accessibilité aux mineurs et contrôle humain des maquettes (action 16) | Revue CODEOWNER approuvée et CI verte avant fusion | à faire |
| Autoriser les workflows de la PR de philosophie | [Actions de la PR #67](https://github.com/Kermic974/trigoLab/pull/67/checks) | L'exécution initiale est en statut `action_required`. Localement, lint, build, contrôle des pages et 64 tests unitaires passent ; l'e2e est bloqué par Chromium absent du cache Playwright, mais les 54 QCM et le rendu mobile des neuf pages ont été vérifiés via le navigateur disponible | Autoriser l'exécution GitHub Actions et vérifier que tous les contrôles passent, dont les tests e2e avec Chromium installé par la CI | à faire |

## Atelier UX versionné

| Action | Où | Pourquoi | Comment confirmer | Statut |
|---|---|---|---|---|
| Confirmer les liens vers les vues actives | Cartouche de suivi de chacun des six fichiers dans `docs/ux/` ; `https://kermiclab.online/` et API définie dans `web/config.json` | Les liens proviennent de la configuration du projet ; leur résolution DNS échoue depuis l'environnement de travail au 5 novembre 2026. La version locale du catalogue ne certifie pas la version déployée | Ouvrir les liens depuis un navigateur connecté ; vérifier les trois modes du cercle, les pages éditoriales et les pages du catalogue ; ouvrir les dialogues via les actions précisées dans les cartouches | à faire |
| Autoriser les workflows de la PR #119 | [Actions de la PR #119](https://github.com/Kermic974/trigoLab/pull/119/checks) | Le run CI/CD après correction est en `action_required`, sans job exécuté ; `npm run ci` passe localement (285 tests) | Autoriser les workflows puis vérifier que le job « Lint, build, tests » passe au vert | à faire |
