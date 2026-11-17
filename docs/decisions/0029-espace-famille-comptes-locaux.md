# ADR 0029 — Espace famille des comptes locaux

- Date : 2026-11-17 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : les comptes en production sont des comptes locaux (identifiant + mot de passe, ADR 0024). L'Espace famille
  OAuth (ADR 0017) attend toujours les fournisseurs, le domaine de l'API et la validation juridique. Le propriétaire
  demande, pour les comptes locaux : un rôle parent qui gère les comptes de ses enfants ; un compte solo qui invite son
  parent sans perdre sa progression ; un tableau de bord Famille (synthèse et détail par enfant) ; la génération et
  l'affectation de cahiers, précédés d'un questionnaire de calibrage ; le suivi des consommations de la famille.
- Choix du propriétaire (2026-11-17) : **bilan famille en clair** (le parent lit la progression, le serveur peut
  l'agréger), **l'enfant garde ses identifiants** (le parent peut les réinitialiser), livraison complète en une PR.

## Décision

### 1. Rôles et liens

- Un compte local est **parent** si son rôle (attribué dans le back-office, ADR 0026) a la permission `famille`
  (`parent`, `beta-testeur`, `contributeur`, `prof`, `admin`). Aucun rôle n'est attribué automatiquement.
- `familles_liens` relie un compte enfant à un seul parent, avec le prénom ou surnom et la tranche d'âge choisis par le
  parent (règles du pseudo, tranches `6-10`, `11-14`, `15-17`) et le **consentement parental versionné**
  (`consentement-v1`, obligatoire, vérifié par le Worker). Au plus 6 enfants.
- Un compte enfant ne gère pas de famille (même avec un rôle parent) ; un parent qui a des enfants ne peut pas être
  rattaché comme enfant.

### 2. Rattachement

- **Invitation** : un compte solo, lié en ligne, crée un code de 8 caractères (alphabet sans caractère ambigu, 48 h,
  usage unique, une invitation à la fois ; seule l'empreinte SHA-256 est gardée). Le parent le saisit avec le prénom,
  la tranche d'âge et son consentement. Même réponse pour un code inconnu, expiré ou utilisé ; limitation de débit par IP.
- **Création** : le parent crée directement le compte de l'enfant (identifiant et mot de passe, mêmes règles que
  l'inscription). Rien n'est déplacé : la progression reste sur l'appareil et dans la synchronisation chiffrée.

### 3. Gestion par le parent

Modifier le prénom et la tranche d'âge ; **nouveau mot de passe** (mot de passe du parent redemandé, sessions de
l'enfant fermées ; sur l'appareil de l'enfant, la connexion locale accepte le nouveau mot de passe vérifié par le serveur
et recalcule le vérificateur) ; **détacher** (le compte redevient solo ; liens, bilan, cahiers, consommations effacés) ;
**supprimer** (mot de passe du parent redemandé, confirmation en deux temps, compte effacé en cascade). Les données
synchronisées chiffrées de l'enfant ne sont reliées à aucun compte (ADR 0024) : elles deviennent orphelines et expirent.

### 4. Bilan de progression

L'appareil de l'enfant envoie (`PUT /api/famille/bilan`, au plus une fois par minute, à la connexion et quand l'onglet est
masqué) un bilan **clair et borné** (`web/famille.js`, relu par le Worker) : XP, niveau, série, questions, temps actif,
14 derniers jours (XP, minutes, questions), badges, état de maîtrise de 200 notions au plus (identifiants du catalogue),
avancement des cahiers assignés. Jamais de pseudo, de titre ou de note de cahier, de question posée. Une ligne par
enfant, remplacée à chaque envoi. La synthèse (totaux de la semaine, alertes : aucun bilan, aucune activité, inactif
depuis 7 jours, notions à revoir, cahier non commencé depuis 3 jours) est calculée dans le navigateur du parent.

### 5. Cahiers assignés et calibrage

Le parent utilise le constructeur de « Mes cahiers » (ADR 0022) en mode famille : type, notions du catalogue, longueur,
univers, objectif, IA facultative ; **pas de titre libre** (aucun texte saisi n'est stocké). Génération par l'alias
`MODELE_CAHIERS` (quota `CAHIERS_GENERATIONS_JOUR` par parent et par jour) ; sans IA, le cahier est construit à partir
du catalogue. Au plus 10 cahiers actifs par enfant. L'enfant voit « Assignés par ta famille » ; avant de commencer, il
répond à un **questionnaire de calibrage** (un QCM publié par notion, « Je ne sais pas » possible). Une notion réussie
passe à la fin en approfondissement (exercices de niveau 1 retirés s'il en reste d'autres). Le cahier est copié dans
« Mes cahiers » ; son avancement remonte avec le bilan (tout réussi → terminé). Le parent peut archiver un cahier.

### 6. Consommations

Les routes d'IA (`/api/chat`, `/api/defi`, `/api/cahier`, `/api/idee/cadrage`) reçoivent, pour un membre d'une famille,
la session porteuse du compte local : le Worker ajoute un appel et les tokens générés à `familles_consommations`
(compte, jour, module). Rien pour un compte solo, jamais de texte. Le parent voit un tableau par membre et par module sur
30 jours ; les compteurs sont purgés après 90 jours par le cron quotidien.

### 7. Technique

Routes `/api/famille/` (`worker/src/famille.js`), session porteuse du compte local, CORS contrôlé, 503 si les tables
manquent. Migration `0003_famille.sql` (schéma de référence `worker/schema-famille.sql`), tables décrites dans le
registre des traitements. Effacement en cascade à la suppression d'un compte (par son titulaire ou le back-office),
export du droit d'accès complété. L'interface garde la session serveur du compte lié pour l'onglet (`sessionStorage`).

## Conséquences

- Le bilan est une donnée d'enfant **lisible par le serveur** : c'est un choix assumé (le parent doit la lire), limité aux
  compteurs et aux identifiants du catalogue. La page de confidentialité le dit.
- L'ADR 0017 (OAuth) reste valable ; à son activation, décider si un compte OAuth peut aussi être parent de comptes locaux.

## Pistes (non livrées)

Plafond quotidien d'IA par enfant fixé par le parent ; plages horaires ; objectifs hebdomadaires et récompenses ;
résumé hebdomadaire ; recommandations de notions à assigner d'après les notions à revoir ; second parent (co-gestion) ;
export PDF du bilan ; demande de détachement par un adolescent de 15 à 17 ans.

## Révision

À valider par le propriétaire avant toute ouverture au-delà de la bêta.
