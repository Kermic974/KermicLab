# ADR 0017 — Parcours de comptes : profil local, compte parent et profils enfants

- Date : 2026-11-06 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : ADR 0010 fixe le modèle de données (comptes parent, profils élèves, progression) et ADR 0012 le profil local
  (pseudo et mémorisation sur l'appareil). Le Worker contient déjà un premier module OAuth (`worker/src/auth/`) et
  l'interface deux dialogues provisoires (« Mon compte », « Consentement parental »). Avant d'activer la connexion, il faut un
  parcours lisible pour un public de 7 à 77 ans, dont des mineurs, et des garde-fous cohérents entre l'interface et le Worker.
- Règle du propriétaire : **un compte parent est nécessaire pour créer un compte enfant ; à défaut, l'enfant utilise un profil
  local.**

## Décision

### 1. Trois types de profil, un seul à la fois sur un appareil

| Type | Qui le crée | Où vivent les données | Ce qui est envoyé à Kermiclab |
|---|---|---|---|
| **Profil local** (défaut) | Le visiteur lui-même, au premier lancement (ADR 0012) | Navigateur (session ou stockage local si « Se souvenir de moi ») | Rien |
| **Compte parent** | Un adulte, par OAuth (Google ou Microsoft) | D1 : `comptes`, `auth_providers`, `sessions` | Empreinte de l'email, identifiant du fournisseur, horodatages |
| **Profil enfant** | Uniquement le parent, depuis l'Espace famille, après consentement | D1 : `eleves`, `progres` | Prénom ou surnom affiché, tranche d'âge, langue, progression |

- Un enfant **ne se connecte jamais seul** par OAuth : aucun bouton de connexion ne lui est destiné. Le libellé d'entrée est
  « Espace famille » (adulte), pas « Se connecter ».
- Le profil local reste **complet** (progression, badges, trophées, défis) : ne pas avoir de parent connecté n'est jamais une
  impasse ni une version dégradée. Seule la synchronisation entre appareils est réservée aux profils enfants.

### 2. Parcours

**A. Enfant sans parent (profil local)**
1. Premier lancement : dialogue de pseudo (inchangé, ADR 0012).
2. Dialogue Profil : nouveau bloc « Type de profil : local, sur cet appareil » avec une aide « Pour retrouver ta progression
   sur tous tes appareils, demande à un parent d'ouvrir l'Espace famille ». Aucun formulaire, aucune donnée demandée.

**B. Parent : connexion et Espace famille**
1. Entrée « Espace famille » dans l'en-tête et bouton « Ouvrir l'Espace famille » dans le dialogue Profil. Le dialogue de pseudo
   reste inchangé : le pseudo local est demandé à tout visiteur, parent compris.
2. Écran d'accueil non connecté : ce que fait le compte, ce qui est stocké, choix Google / Microsoft, et rappel « Ton enfant
   peut continuer avec un profil local sans compte ».
3. Connecté : écran plein « Espace famille » (route `#famille`, comme Configuration) avec la liste des profils enfants
   (prénom, tranche d'âge), les actions « Utiliser sur cet appareil » et « Supprimer », le formulaire « Ajouter un enfant »,
   la déconnexion et la suppression du compte.

**C. Création d'un profil enfant (parent connecté uniquement)**
1. Prénom ou surnom (mêmes règles que le pseudo : 2 à 20 caractères, pas de suite de 6 chiffres) et tranche d'âge
   (`6-10`, `11-14`, `15-17`). Pas de nom de famille, pas de date de naissance, pas d'école.
2. Consentement explicite **dans le formulaire**, texte versionné (`consentement-v1`), case non cochée par défaut ; le bouton
   reste actif mais la création est refusée avec un message tant qu'elle n'est pas cochée (un bouton désactivé n'explique
   rien aux lecteurs d'écran). Le Worker refuse aussi la création sans consentement (pas seulement l'interface).
3. Si l'appareil a une progression locale, proposer « Reprendre la progression de « pseudo » » (case cochée par défaut,
   décochable).
4. Au plus 6 profils enfants par compte.

**D. Utiliser un profil enfant sur un appareil**
- Phase C : le parent, connecté sur l'appareil, choisit « Utiliser sur cet appareil ». Le Worker remplace la session parent
  par une session limitée au profil enfant choisi : le bloc « Type de profil » affiche le prénom et la progression est synchronisée.
  Le Worker refuse toute opération de gestion des profils ou du compte tant qu'une session parent n'a pas été rétablie ;
  masquer ces actions dans l'interface ne suffit pas.
- Le retour à l'Espace famille exige une réauthentification parentale vérifiable. Avant l'activation, choisir et tester un
  mécanisme garantissant une nouvelle authentification pour chaque fournisseur, ou mettre en place un facteur parent propre
  à l'application. `prompt=login` seul ne constitue pas cette garantie, notamment pour Google. Tester le déverrouillage et
  le refus des appels directs aux API de gestion avant cette réauthentification.
- En attendant cette session limitée, l'interface préparée (`#famille`) ne propose en mode enfant que « Le parent se
  reconnecte », qui ferme la session du parent et ramène l'appareil au profil local.
- Phase D : code d'appairage à usage unique (6 caractères, 10 minutes) généré par le parent et saisi sur l'appareil de
  l'enfant, pour une session limitée au profil enfant. Cet appairage est hors périmètre de la phase C et de la première
  activation.

**E. Quitter, effacer**
- « Quitter le mode enfant » (parent reconnecté) : retour au profil local, la progression synchronisée reste sur le compte.
- « Supprimer le profil » et « Supprimer mon compte » : confirmation en deux temps, effacement en cascade (ADR 0010 §5).
  La suppression du compte parent passe par un endpoint Worker authentifié ; tester l'effacement des profils, progressions,
  sessions et liaisons OAuth avant l'activation.

### 3. États d'interface à prévoir

Chargement, service désactivé (`connexionActive = false`), non connecté, connecté sans enfant, connecté avec enfants,
mode enfant, session expirée, erreur réseau, quota de profils atteint. Chaque état a son texte dans `web/i18n/*.json`.

### 4. Garde-fous techniques préalables à l'activation

1. **Cookie de session même site** : la session est posée par le Worker. Servi depuis `kermic.workers.dev` alors que le site
   est sur `kermiclab.online`, le cookie est tiers et bloqué par une partie des navigateurs. Servir l'API sur un
   sous-domaine du site (par exemple `api.kermiclab.online`, route Cloudflare) avant d'activer la connexion.
2. **Aucun appel `/auth/me` tant que `connexionActive` vaut `false`** (aujourd'hui l'appel part à chaque visite).
3. **Validation côté Worker** de `/api/eleves` : prénom (règles du pseudo), tranche d'âge connue, consentement et version
   obligatoires et enregistrés, plafond de profils, suppression (`DELETE`) réservée au parent propriétaire.
4. **Liaison navigateur OAuth** : la colonne `oauth_states.browser_binding` (NOT NULL dans `schema-comptes.sql`) n'est pas
   renseignée par `worker/src/auth/oauth.js` ; à corriger (cookie de liaison vérifié au retour) avant toute connexion réelle.
5. Textes d'interface uniquement dans `web/i18n/*.json` (les dialogues provisoires contiennent du texte en dur) ; plus de
   `prompt()`.
6. **Suppression du compte parent** : ajouter un endpoint Worker authentifié et tester l'effacement en cascade du compte,
   des profils, progressions, sessions et liaisons OAuth avant l'activation.
7. **Mode enfant** : créer une session Worker limitée au profil choisi et refuser côté serveur les opérations de gestion tant
   qu'une session parent n'a pas été rétablie ; couvrir par des tests les appels directs aux API.
8. **Réauthentification parentale** : ne pas se fier à `prompt=login`. Avant l'activation, choisir et tester un mécanisme
   vérifiable pour chaque fournisseur ou ajouter un facteur parent propre à l'application ; tester le déverrouillage et le
   refus des opérations de gestion avant réauthentification.
9. **Retour OAuth** : configurer et autoriser une URL de retour vers le site (`#famille`) et tester le parcours complet du
   fournisseur jusqu'à l'Espace famille.

## Plan de livraison

| PR | Contenu | Effet en production |
|---|---|---|
| 1 | Cet ADR, plan dans `docs/chantiers/authentification.md`, actions manuelles | Aucun |
| 2 | Interface : logique pure `web/comptes.js`, Espace famille (`#famille`), bloc « Type de profil », formulaire enfant avec consentement, textes i18n, aucun appel `/auth/me` sans `connexionActive` | Aucun tant que `connexionActive = false`, sauf la suppression de l'appel `/auth/me` à chaque visite |
| 3 | Worker : validation et consentement de `/api/eleves`, suppression du profil et endpoint authentifié de suppression du compte parent, effacement en cascade et tests | Aucun tant que les tables et secrets OAuth ne sont pas en place |
| 4 | Worker : sessions limitées au profil enfant, refus des opérations de gestion jusqu'à réauthentification parentale vérifiable (par fournisseur ou facteur parent de l'application), URL de retour du site configurée et autorisée, tests des refus, déverrouillage et parcours OAuth jusqu'à `#famille` | Aucun tant que les tables et secrets OAuth ne sont pas en place |
| Ensuite | Domaine API même site, liaison navigateur OAuth, URL `AUTH_CALLBACK_URL` exacte chez Google et Microsoft et redéploiement, validation juridique, activation de `connexionActive` après réussite des tests | Activation, après validation humaine |

## Conséquences

- ADR 0010 reste la référence du schéma ; cet ADR précise les tranches d'âge (`6-10`, `11-14`, `15-17`) et rend le
  consentement obligatoire pour tout profil enfant, y compris de 15 à 17 ans (plus simple et plus protecteur).
- La page de confidentialité devra décrire le compte parent et les profils enfants avant l'activation.
- Points de contrôle humains : texte de consentement et base légale (chantier RGPD, action 14), choix du fournisseur et
  inscription des applications OAuth, domaine de l'API.

## Démonstration des écrans (« green card »)

Pour valider les écrans avant l'inscription des applications OAuth (action manuelle 34), `?demo=famille` active un double
du service des comptes dans le navigateur (`web/demo-famille.js`, mêmes formes de réponse que `/auth/me`, `/api/eleves`,
`/api/progres`). La connexion est simulée, les identifiants sont préfixés `demo-`, l'état reste dans `sessionStorage` de
l'onglet et aucun appel n'est fait au Worker. Aucun contournement d'OAuth n'existe côté serveur : la démonstration ne
donne accès à aucune donnée réelle. Hors démonstration, `connexionActive` reste faux dans le site construit.

## Révision

À valider par le propriétaire avant l'activation de `connexionActive`.
