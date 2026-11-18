# ADR 0024 — Compte local (identifiant + mot de passe) et synchronisation pseudonymisée

- Date : 2026-11-07 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : l'authentification OAuth (ADR 0017) attend l'inscription des applications Google et Microsoft, le domaine
  de l'API et la validation juridique. En attendant, le propriétaire demande un module d'authentification locale :
  identifiant + mot de passe, sans email ni réinitialisation en libre-service, mot de passe complexe de 12 caractères
  minimum. Le compte reste **facultatif** : le site s'utilise sans compte. Une fois le compte créé, l'utilisateur peut
  choisir de **synchroniser** son compte avec le serveur ; les données en ligne doivent être **pseudonymisées**, avec une
  **phrase secrète** (12 caractères minimum) qui sert à réconcilier localement la pseudonymisation. Elle n'est jamais
  enregistrée en ligne : en cas d'oubli, les données en ligne sont perdues pour l'utilisateur (elles restent stockées,
  mais plus disponibles).

## Décision

### 1. Compte sur l'appareil

- Écran « Mon compte » (`#compte`), ouvert depuis le Profil (bouton « Mon compte (facultatif) »). Aucun écran ne l'impose.
- **Identifiant** : 3 à 32 caractères `[a-z0-9._-]`, au moins une lettre, normalisé en minuscules ; le « @ » est refusé
  (pas d'email), ainsi que les suites de 6 chiffres ou plus (numéro de téléphone, public mineur).
- **Mot de passe** : 12 à 128 caractères, au moins une minuscule, une majuscule, un chiffre et un caractère spécial, sans
  contenir l'identifiant. Règles affichées et cochées en direct ; pas de réinitialisation (message explicite).
- L'appareil garde l'identifiant et un **vérificateur** PBKDF2-SHA256 (310 000 itérations, sel aléatoire), jamais le mot
  de passe. Le compte suit le choix « Se souvenir de moi » (ADR 0012) et l'effacement des données du profil.
- « Connecté » signifie : mot de passe vérifié sur l'appareil pour l'onglet en cours (`sessionStorage`). Le compte ne
  restreint rien localement ; il ouvre l'accès à la synchronisation.
- **Rien n'est envoyé à Kermiclab** tant que la synchronisation n'est pas activée (vérifié par un test navigateur).

### 2. Synchronisation pseudonymisée et chiffrée

Activation : mot de passe, phrase secrète (12 à 256 caractères, différente du mot de passe) saisie deux fois, et case
« J'ai compris : si j'oublie ma phrase secrète, mes données en ligne seront perdues ».

Dans le navigateur uniquement : `maître = PBKDF2-SHA256(phrase, "kermiclab:pseudonymisation:v1:" + identifiant, 310 000)`,
puis HKDF-SHA256 en trois secrets indépendants :

| Secret | Usage | Ce que le serveur en voit |
|---|---|---|
| `pseudonyme` (256 bits, hex) | Clé de rangement des données en ligne | Le pseudonyme, **sans aucun lien avec le compte** |
| `jeton` d'écriture (256 bits) | Preuve de possession pour lire, écrire, effacer | Son empreinte SHA-256 seulement |
| `clé` AES-GCM 256 bits | Chiffre l'instantané (pseudonyme en données associées) | Rien |

- L'identifiant sert de sel : deux comptes avec la même phrase ont des pseudonymes différents.
- La phrase est différente du mot de passe (le serveur voit le mot de passe à la connexion et ne doit pas pouvoir en
  déduire le pseudonyme).
- L'appareil garde une courte **empreinte** du pseudonyme : une phrase mal saisie est reconnue sans appel au serveur.
- **Instantané synchronisé** : pseudo, progression, trophées et cahiers (les clés du stockage local), chiffrés.
- Autre appareil : créer le compte avec le même identifiant et le même mot de passe, puis activer la synchronisation
  avec la même phrase : les données sont retrouvées et « Récupérer » les charge (confirmation en deux temps).
- Concurrence : écriture conditionnelle à la version (`409 version-conflit`), l'interface propose de récupérer d'abord.

### 2 bis. Clé de synchronisation et appairage (révision du 2026-11-18)

Demande du propriétaire : la phrase secrète est difficile à retenir ; la remplacer par un secret transmis entre
appareils, sans baisser le niveau de sécurité. Protocole v2 (`web/compte-local.js`) :

- **Clé** : 256 bits aléatoires (`crypto.getRandomValues`) tirés à l'activation. Secrets dérivés par HKDF-SHA256, sel
  `"kermiclab:pseudonymisation:v2:" + identifiant` : mêmes `pseudonyme`, `jeton` d'écriture et clé AES-GCM qu'en v1,
  dans un espace de pseudonymes distinct. Pas d'étirement : l'entropie est déjà maximale.
- **Sur l'appareil** : la clé est gardée sous une **enveloppe** AES-GCM dont la clé vient de PBKDF2-SHA256 (310 000
  itérations) du mot de passe, avec un sel aléatoire distinct de celui du vérificateur et l'identifiant en données
  associées. Le mot de passe déverrouille la synchronisation à la connexion : rien d'autre à saisir.
- **Appairage** (« Ajouter un appareil ») : l'appareil déverrouillé tire un **code** de 80 bits (16 caractères en base 32
  de Crockford, saisie tolérante), en dérive par PBKDF2 (100 000 itérations, sel `"kermiclab:appairage:v1:" +
  identifiant`) puis HKDF une adresse de **boîte**, un jeton et une clé AES-GCM, et dépose la clé de synchronisation
  chiffrée (`PUT /api/compte-local/appairage`). Le nouvel appareil, connecté au **même compte**, saisit le code et retire
  la boîte (`POST appairage/lire`). Le serveur ne voit ni le code ni la clé ; la boîte est liée au compte, unique par
  compte, effacée à la première lecture et au plus tard après 10 minutes (cron), retraits limités par IP.
- **Kit de récupération** : la clé et 3 octets de somme de contrôle SHA-256, 56 caractères en groupes de 4, copiable et
  téléchargeable. Il remplace la phrase pour le cas où tous les appareils sont perdus.
- **Ancienne méthode** : un compte à phrase secrète garde son accès (retrouver, déverrouiller) mais ne peut plus en créer ;
  « Remplacer par une clé » reprend la copie en ligne (ou celle de l'appareil) sous le pseudonyme v2 puis efface
  l'ancienne. Ses autres appareils passent alors par un code d'appairage.

Niveau de sécurité comparé à la phrase :

| Menace | Phrase (v1) | Clé (v2) |
|---|---|---|
| Serveur malveillant qui tente de deviner le secret hors ligne (il connaît l'identifiant) | phrase de 12 caractères minimum, souvent 40 à 60 bits, 310 000 itérations | impossible : 256 bits aléatoires |
| Serveur malveillant pendant un appairage | sans objet | code de 80 bits + 100 000 itérations, boîte de 10 minutes au plus, liée au compte |
| Vol du stockage de l'appareil | empreinte courte de la phrase | enveloppe : il faut le mot de passe (même barrière que le vérificateur local, qui protège déjà le compte et coexiste avec les données locales en clair) |
| Lecture par un administrateur du back-office | aucune | aucune : la réinitialisation du mot de passe ne touche pas la clé |
| Oubli | phrase oubliée = données perdues | kit perdu et aucun appareil = données perdues |

Limite assumée : un mot de passe changé par un parent (ADR 0029) ou réinitialisé par le support n'ouvre plus l'ancienne
enveloppe ; la clé se ressaisit sur cet appareil par un code d'appairage ou le kit (l'enveloppe est alors refermée avec
le nouveau mot de passe).

### 3. Serveur (`worker/src/compte-local.js`, `worker/schema-compte-local.sql`)

- Routes `/api/compte-local/` : `etat` (GET), `inscription`, `connexion`, `deconnexion`, `compte/supprimer`,
  `donnees/lire`, `donnees` (PUT), `donnees/supprimer`. Jeton porteur (`Authorization: Bearer`, 12 h), **pas de cookie** :
  ni cookie tiers (`workers.dev` / `kermiclab.online`, ADR 0017 §4.1) ni CSRF. Origine contrôlée (CORS).
- `comptes_locaux` : empreinte **HMAC** de l'identifiant (secret `COMPTES_LOCAUX_SECRET`) et mot de passe haché
  (HMAC du même secret comme poivre, puis PBKDF2-SHA256 salé, 100 000 itérations, maximum accepté par Workers).
  Date de création **au jour près**.
- `sessions_locales` : empreinte SHA-256 du jeton, compte, expiration ; purge quotidienne par le cron.
- `donnees_pseudonymes` : pseudonyme, empreinte du jeton d'écriture, version, IV, contenu chiffré (350 000 caractères
  base64 au plus), date de dernière écriture (`maj_le`) et de dernière lecture ou écriture (`vu_le`), au jour près.
  **Aucune colonne ne relie une ligne à un compte.**
- Une session est exigée pour lire ou écrire des données (le stockage reste réservé aux comptes inscrits), mais le lien
  session ↔ pseudonyme n'est **ni stocké ni journalisé**.
- Anti force brute : 10 inscriptions ou connexions par minute et par IP (en mémoire, sans IP stockée) ; blocage de
  15 minutes après 10 échecs sur un compte ; réponse identique pour un compte inconnu et un mauvais mot de passe, avec
  le même calcul (pas d'énumération par le temps).
- Suppression : `compte/supprimer` redemande le mot de passe. Les données pseudonymisées n'étant pas reliées au compte,
  l'interface les efface d'abord avec la phrase secrète ; sans elle, elles restent stockées, illisibles (l'interface le dit).
- Sans `COMPTES_LOCAUX_SECRET` (32 caractères min.) ou sans tables : `503 synchro-indisponible`, le compte local reste
  utilisable.

### 3 bis. Réinitialisation du mot de passe par le support (révision du 2026-11-18)

- Back-office → Utilisateurs : recherche d'un compte par son **identifiant unique** (`GET /api/admin/utilisateurs?id=`)
  et « Réinitialiser le mot de passe » (`POST /api/admin/utilisateurs/compte-local/:id/mot-de-passe`). Le Worker tire un
  mot de passe provisoire de 16 caractères conforme aux règles (sans caractères ambigus), le renvoie **une seule fois**,
  ne le journalise pas (`journal_admin` : `utilisateur.mot-de-passe` et la cible), ferme les sessions et lève le blocage.
- Colonne `comptes_locaux.mdp_provisoire` (migration 0008) : tant qu'elle vaut 1, une session ne sert qu'à changer le
  mot de passe (`POST /api/compte-local/mot-de-passe`), se déconnecter ou consulter ses données ; toutes les autres routes
  (synchronisation, Espace famille, Professeur, contributions) refusent la session (`compteDeSession`).
- `mot-de-passe` redemande le mot de passe actuel (ou le provisoire) et l'identifiant, vérifié contre son empreinte
  HMAC (règle « sans l'identifiant »), refuse le même mot de passe, ferme toutes les sessions et en ouvre une nouvelle.
  La même route sert au changement en libre-service dans « Mon compte ».
- Le contrôle de l'identité du demandeur reste une procédure humaine du support (action manuelle 44). La réinitialisation
  ne donne aucun accès aux données synchronisées.

### 3 ter. Ce que Kermiclab sait de moi (révision du 2026-11-18)

- `GET /api/compte-local/moi` (session porteuse) renvoie exactement l'export du back-office pour ce compte
  (`worker/src/compte-local-acces.js`, une seule fonction pour les deux) : identifiant unique, date de création, mot de
  passe provisoire ou non, sessions ouvertes, famille, professeurs, contributions, rôle, compteurs de sécurité.
- L'écran « Mon compte » l'affiche sur demande (rien n'est appelé avant le clic), avec copie de l'identifiant unique et
  téléchargement JSON. L'identifiant de connexion n'est montré que depuis l'appareil : le serveur n'en a qu'une empreinte.
- L'identifiant unique est la seule donnée à communiquer au support ; l'écran rappelle de ne jamais donner son mot de
  passe ni sa clé de récupération.

### 4. Ce que cette pseudonymisation garantit, et ses limites

- Une fuite de la base seule ne donne ni identifiant, ni mot de passe, ni contenu lisible, ni lien compte ↔ données.
- Il s'agit d'une **pseudonymisation** au sens du RGPD (art. 4.5), pas d'une anonymisation : au moment d'une requête,
  le serveur voit à la fois une session et un pseudonyme. L'engagement est de ne jamais les enregistrer ensemble ; aucun
  journal ne contient pseudonyme ni identifiant.
- Le serveur voit l'identifiant en clair lors de la connexion : une phrase secrète faible pourrait être attaquée hors
  ligne par un serveur malveillant. D'où les 12 caractères minimum et 310 000 itérations.
- Données orphelines (phrase oubliée, compte supprimé sans phrase) : conservées, illisibles, puis effacées selon la
  règle de conservation (§ 4 bis).

### 4 bis. Conservation (décision du propriétaire, 2026-11-07)

- **365 jours sans activité** : le cron quotidien efface les données pseudonymisées ni lues ni écrites depuis plus de
  365 jours (`vu_le`, constante `CONSERVATION_JOURS` de `worker/src/compte-local.js`). Une lecture ou un envoi compte
  comme activité et repousse l'échéance ; la date affichée « mise à jour le » reste celle du dernier envoi (`maj_le`).
- Effet sur les données orphelines : une phrase oubliée rend les données illisibles tout de suite et elles sont
  effacées au plus tard 365 jours après la dernière synchronisation.
- Sessions : effacées dès leur expiration (12 h), par le même cron. Le cron ne journalise que des compteurs.
- Changer cette durée exige de mettre à jour cet ADR et la page de confidentialité.

### 5. Relation avec OAuth (ADR 0017)

Module indépendant : tables, routes et secret distincts ; `connexionActive` reste faux et l'Espace famille inchangé.
Le compte local ne remplace pas le compte parent : il ne crée pas de profil enfant. À l'activation d'OAuth, décider
s'il reste une option (adultes, appareils partagés) ou s'il est rattaché à un compte parent.

## Conséquences

- Nouveau secret Worker `COMPTES_LOCAUX_SECRET` et nouveau schéma `worker/schema-compte-local.sql` à appliquer :
  action manuelle 39. En attendant, l'écran affiche « synchronisation indisponible ».
- Aucune nouvelle dépendance : WebCrypto (navigateur et Workers) suffit.
- Règles partagées entre l'interface et le Worker (`web/compte-local.js`), comme `web/profil.js` pour le pseudo.
- Page de confidentialité mise à jour (compte facultatif, synchronisation pseudonymisée).
- Changer `ITERATIONS_NAVIGATEUR` ou le préfixe de sel change les pseudonymes : à faire seulement avec une migration
  (nouvelle version de protocole).

## Révision

2026-11-18 : clé de synchronisation et appairage (§2 bis), réinitialisation par le support (§3 bis), droit d'accès en
libre-service (§3 ter), migration D1 `0008`, table `appairages` décrite dans le registre des traitements.

Durée de conservation fixée par le propriétaire le 2026-11-07 (365 jours sans activité). Le passage au statut
« accepté » reste à confirmer par le propriétaire avant d'appliquer le schéma et de déposer le secret en production.
Point ouvert : conservation des identifiants en ligne (`comptes_locaux`) d'un compte abandonné, qui ne contiennent
aucune donnée de progression.
