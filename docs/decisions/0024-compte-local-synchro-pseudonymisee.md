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

### 3. Serveur (`worker/src/compte-local.js`, `worker/schema-compte-local.sql`)

- Routes `/api/compte-local/` : `etat` (GET), `inscription`, `connexion`, `deconnexion`, `compte/supprimer`,
  `donnees/lire`, `donnees` (PUT), `donnees/supprimer`. Jeton porteur (`Authorization: Bearer`, 12 h), **pas de cookie** :
  ni cookie tiers (`workers.dev` / `kermiclab.online`, ADR 0017 §4.1) ni CSRF. Origine contrôlée (CORS).
- `comptes_locaux` : empreinte **HMAC** de l'identifiant (secret `COMPTES_LOCAUX_SECRET`) et mot de passe haché
  (HMAC du même secret comme poivre, puis PBKDF2-SHA256 salé, 100 000 itérations, maximum accepté par Workers).
  Date de création **au jour près**.
- `sessions_locales` : empreinte SHA-256 du jeton, compte, expiration ; purge quotidienne par le cron.
- `donnees_pseudonymes` : pseudonyme, empreinte du jeton d'écriture, version, IV, contenu chiffré (350 000 caractères
  base64 au plus), date de mise à jour au jour près. **Aucune colonne ne relie une ligne à un compte.**
- Une session est exigée pour lire ou écrire des données (le stockage reste réservé aux comptes inscrits), mais le lien
  session ↔ pseudonyme n'est **ni stocké ni journalisé**.
- Anti force brute : 10 inscriptions ou connexions par minute et par IP (en mémoire, sans IP stockée) ; blocage de
  15 minutes après 10 échecs sur un compte ; réponse identique pour un compte inconnu et un mauvais mot de passe, avec
  le même calcul (pas d'énumération par le temps).
- Suppression : `compte/supprimer` redemande le mot de passe. Les données pseudonymisées n'étant pas reliées au compte,
  l'interface les efface d'abord avec la phrase secrète ; sans elle, elles restent stockées, illisibles (l'interface le dit).
- Sans `COMPTES_LOCAUX_SECRET` (32 caractères min.) ou sans tables : `503 synchro-indisponible`, le compte local reste
  utilisable.

### 4. Ce que cette pseudonymisation garantit, et ses limites

- Une fuite de la base seule ne donne ni identifiant, ni mot de passe, ni contenu lisible, ni lien compte ↔ données.
- Il s'agit d'une **pseudonymisation** au sens du RGPD (art. 4.5), pas d'une anonymisation : au moment d'une requête,
  le serveur voit à la fois une session et un pseudonyme. L'engagement est de ne jamais les enregistrer ensemble ; aucun
  journal ne contient pseudonyme ni identifiant.
- Le serveur voit l'identifiant en clair lors de la connexion : une phrase secrète faible pourrait être attaquée hors
  ligne par un serveur malveillant. D'où les 12 caractères minimum et 310 000 itérations.
- Données orphelines (phrase oubliée, compte supprimé sans phrase) : conservées, illisibles. **Durée de conservation à
  fixer** (point de contrôle juridique, chantier RGPD) ; une purge des pseudonymes inactifs est possible plus tard
  grâce à `maj_le`.

### 5. Relation avec OAuth (ADR 0017)

Module indépendant : tables, routes et secret distincts ; `connexionActive` reste faux et l'Espace famille inchangé.
Le compte local ne remplace pas le compte parent : il ne crée pas de profil enfant. À l'activation d'OAuth, décider
s'il reste une option (adultes, appareils partagés) ou s'il est rattaché à un compte parent.

## Conséquences

- Nouveau secret Worker `COMPTES_LOCAUX_SECRET` et nouveau schéma `worker/schema-compte-local.sql` à appliquer :
  actions manuelles 38 et 39. En attendant, l'écran affiche « synchronisation indisponible ».
- Aucune nouvelle dépendance : WebCrypto (navigateur et Workers) suffit.
- Règles partagées entre l'interface et le Worker (`web/compte-local.js`), comme `web/profil.js` pour le pseudo.
- Page de confidentialité mise à jour (compte facultatif, synchronisation pseudonymisée).
- Changer `ITERATIONS_NAVIGATEUR` ou le préfixe de sel change les pseudonymes : à faire seulement avec une migration
  (nouvelle version de protocole).

## Révision

À valider par le propriétaire, avec la durée de conservation des données orphelines (chantier RGPD), avant d'appliquer
le schéma et de déposer le secret en production.
