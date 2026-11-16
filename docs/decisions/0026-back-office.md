# ADR 0026 — Back-office : utilisateurs, sécurité, données, contenus, charte et harness

- Date : 2026-11-16 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : le site n'a que des bêta-testeurs. Le propriétaire veut un back-office pour gérer les utilisateurs et
  démontrer la protection des données personnelles, exploiter une télémétrie anonyme, analyser les requêtes
  (données personnelles, injections) et le comportement des profils, gérer les rôles et les stratégies d'accès, la
  charte graphique, les contenus et les harness. Le contrôle d'accès par rôle doit être **préparé, pas appliqué**
  (« réglage = tous les utilisateurs » pendant la bêta).

## Décision

### 1. Une API d'administration dans le Worker, une interface statique

- API sous `/api/admin/` (`worker/src/backoffice.js`), interface sous `/admin/` (`web/admin/`, sans framework, sous la
  CSP du site). L'interface est en français seulement, comme le blog : c'est un outil interne.
- **Accès par clé partagée** : secret Cloudflare `BACKOFFICE_JETON` (32 caractères au moins), envoyé en
  `Authorization: Bearer`. Sans clé configurée, l'API répond 503 : **fermée par défaut**. Comparaison en temps constant,
  essais limités par IP en mémoire (aucune IP stockée). Raison : le site est public et sert des mineurs ; un
  back-office qui supprime des comptes et règle les prompts ne peut pas rester ouvert, même en bêta. Le propriétaire
  donne la clé aux personnes de son choix. Quand les comptes seront ouverts, la clé sera remplacée par les permissions
  `admin.*` d'un rôle.
- Chaque écriture est notée dans `journal_admin` : l'action et sa cible, jamais le contenu.

### 2. Rôles et stratégies d'accès : préparés, non appliqués

- Rôles système dans le code (`worker/src/roles.js` : visiteur, bêta-testeur, parent, contributeur, professeur,
  administrateur), surchargeables ; rôles personnalisés dans la table `roles`. Attribution d'un rôle et d'un niveau de
  souscription à un compte dans `attributions_roles` (la colonne historique `comptes.role` reste alignée quand le rôle
  fait partie de ses valeurs).
- Une stratégie par fonctionnalité (`strategies_acces`) : tous, rôles ou niveaux choisis, fermée.
- `accesAutorise()` rend la décision. Tant que **`CONTROLE_ACCES_ACTIF` vaut `false` (défaut), elle répond toujours
  oui** et n'est branchée sur aucune route : aucune fonctionnalité n'est limitée. Le back-office propose un simulateur
  (« si le contrôle était activé »).

### 3. Réglages à chaud, dans le registre

- La table `reglages` surcharge les paramètres du registre (`configuration.js`, ADR 0019). À chaque requête, le Worker
  dérive un `env` propre à la requête (`envAvecReglages`) : `lireConfiguration(env)` reste l'unique lecture. Lecture de
  la base au plus toutes les 15 secondes par isolat.
- Une saisie hors bornes est **refusée** (jamais ramenée en silence) ; une valeur stockée devenue invalide est ignorée.
- Les paramètres marqués `prive` (seuils de sécurité, instructions) ne sortent jamais par `/api/llm/status`.
- `PLAFONDS_SCHEMA` : `LIMITE_TOKENS_SESSION` ≤ 1 000 et `MAX_TOKENS_APPEL` ≤ 500 à chaud, car la table `sessions_llm`
  porte ces bornes en contrainte `CHECK` (migration 0001, non modifiable). Voir « Limites ».

### 4. Harness

- Modèles, budgets de tokens, quotas et skills actifs se règlent à chaud, par module.
- **Instructions système** : le socle de chaque harness (sécurité des enfants, périmètre, format) reste dans le code.
  Le back-office ajoute des **instructions complémentaires** (`INSTRUCTIONS_*`, 2 000 caractères), placées après le socle
  avec la mention qu'elles ne peuvent ni le lever ni l'affaiblir (`systemeComplet`, `llm.js`). À l'enregistrement, un
  texte contenant une donnée personnelle ou une consigne visant à lever le socle est refusé. C'est du texte du serveur,
  écrit par un administrateur : la règle « jamais de donnée du navigateur dans le prompt système » reste vraie pour les
  utilisateurs.
- **Niveaux de souscription** : le niveau « gratuit » est celui du registre et s'applique à tous. D'autres niveaux
  (tokens par session et par réponse, défis et cahiers par jour) sont enregistrés, bornés par le registre, et pourront
  être attribués aux comptes ; ils ne sont pas appliqués tant que le contrôle d'accès est inactif.

### 5. Analyse des requêtes et non-conservation

- `analyserRequete()` (`analyse-requete.js`) classe un texte sans le conserver : données personnelles, contenu sexuel,
  contenu dangereux, détresse, **injection directe** (annulation ou révélation des consignes, débridage, changement
  d'identité) et **injection indirecte** (balises de rôle, caractères invisibles, charge encodée, balisage actif,
  exfiltration par lien, adresse au modèle lecteur). Dans un contenu (brouillon, champ annexe d'une requête), toute
  consigne adressée au modèle compte comme injection indirecte.
- Chaque requête POST (`/api/chat`, `/api/idee`, `/api/idee/cadrage`, `/api/support`, `/api/defi`, `/api/cahier`) est
  analysée avant traitement : le message comme saisie d'utilisateur, les autres champs comme contenu.
- **Seules des catégories sortent de l'analyse** et incrémentent des compteurs (`signaux_securite` : profil, jour,
  catégorie, module). Le texte n'est ni journalisé ni stocké.
- **Garantie de non-conservation**, à trois niveaux : (a) aucune table n'a de colonne recevant le texte d'une requête ;
  (b) le test `tests/unit/backoffice.test.mjs` envoie des requêtes piégées sur toutes les routes puis vérifie qu'aucun
  fragment n'apparaît dans **aucune** valeur de **aucune** table ; (c) le back-office relit à la demande les tables
  alimentées par les requêtes avec les détecteurs de la pseudonymisation et signale toute donnée personnelle ou tout
  texte libre (`donnees.js`). Ce contrôle ne renvoie que des compteurs.
- La question citée dans une issue `traduction-manquante` est désormais pseudonymisée, comme les idées et signalements.

### 6. Analyse comportementale et garde-fous

- Un **profil** est l'empreinte HMAC tronquée d'un identifiant de compte connecté ou de session de quota IA (secret
  `PROFILS_SECRET`, à défaut `LLM_SESSION_SECRET`). Sans cookie, l'activité est comptée sous « anonyme », sans profil :
  **aucune IP n'est utilisée**.
- `evaluerProfil()` (`comportement.js`) est déterministe : score pondéré sur 7 jours, comportements retenus (messages
  à caractère personnel, contenu sexuel, contenu dangereux, injection directe ou indirecte, consommation élevée,
  surconsommation, détresse) et état : normal, surveillé, restreint (IA coupée, catalogue servi), suspendu.
- La **suspension n'est jamais automatique** : décision d'un administrateur, avec une durée. La **détresse n'est jamais
  sanctionnée**. Une décision d'administrateur n'est jamais remplacée par les règles avant son expiration.
- **`GARDE_FOUS_ACTIFS` vaut `false` par défaut** : les profils sont classés, rien n'est restreint (calibrage des seuils
  pendant la bêta). Une fois activé : un profil suspendu ne peut plus poser de question (le signalement d'un problème
  reste ouvert) ; un profil restreint voit `LLM_ACTIF` forcé à `false` pour sa requête.

### 7. Télémétrie anonyme

- `telemetrie_llm` : compteurs agrégés à l'heure par module, fournisseur, modèle et statut (appels, tokens entrants et
  sortants, durée, données pseudonymisées). Aucun identifiant de session, de profil ou de requête. Enregistrée dans
  `llm.js`, seul point d'appel des fournisseurs.

### 8. Charte graphique

- Trois thèmes (Indigo, d'origine ; Lagon ; Bougainvillier) ou deux couleurs personnalisées. Les variables claires et
  sombres sont dérivées avec un contraste AA garanti (`web/theme.js`, partagé par le Worker et le site). Le site lit
  `/api/theme` au chargement et applique une feuille construite, compatible avec la CSP.

### 9. Contenus

- Le catalogue reste dans le dépôt et **se publie par PR validée** (AGENTS.md §6, blog/README.md) : le back-office ne
  contourne pas ce contrôle humain. Il offre : l'inventaire ; le **masquage** et la **mise en avant** d'un contenu à
  chaud (`contenus_etats`, appliqués au catalogue, aux suggestions, au routage et aux pages) ; les **parcours**, listes
  ordonnées de contenus déjà publiés, publiés à chaud et servis par `/api/parcours` ; des **brouillons** (article, cours,
  lab, jeu) filtrés à l'enregistrement (donnée personnelle, injection indirecte) et envoyés en revue par une issue
  `contenu-propose`.
- Exception assumée à « pas de texte en base » : comme les contributions (ADR 0023), les brouillons sont des textes
  destinés à publication, sans donnée personnelle.

### 10. Conservation

- Signaux de sécurité : `CONSERVATION_SIGNAUX_JOURS` (30). Télémétrie : `CONSERVATION_TELEMETRIE_JOURS` (90). États
  automatiques : 7 jours glissants. Purge par le cron quotidien et à la demande. La suppression d'un compte efface
  aussi son attribution de rôle et les signaux de son profil.

## Limites connues

- Les niveaux de souscription au-delà de 1 000 tokens par session demandent une nouvelle table de quota : la contrainte
  `CHECK` de `sessions_llm` ne peut pas être levée par une migration « ajouts seulement ». Le défaut existait déjà : le
  registre annonçait 4 000 alors que la base refuse plus de 1 000.
- La charte ne s'applique pas aux pages de notion, aux jeux ni au blog (pages autonomes).
- Les labs ne sont pas un type distinct du catalogue : ils n'apparaissent que comme brouillons.
- Les règles d'analyse sont des motifs : elles signalent, elles ne prouvent pas. Les garde-fous restent en observation
  tant que leurs faux positifs ne sont pas mesurés.
- Le site affiche les parcours et les contenus mis en avant sur l'accueil (`web/parcours.js`) ; un contenu mis en avant
  n'est pas encore signalé dans la liste d'Éducation.

## Conséquences

- Migration `0002_backoffice.sql` (ajouts seulement), schéma de référence `worker/schema-backoffice.sql`.
- Nouveau secret `BACKOFFICE_JETON` ; secret facultatif `PROFILS_SECRET`.
- La page Confidentialité décrit les compteurs de sécurité et la télémétrie.
- Action humaine : valider cet ADR, créer le secret, décider quand activer les garde-fous puis le contrôle d'accès
  (`docs/actions-manuelles.md`).
