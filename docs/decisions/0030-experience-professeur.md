# ADR 0030 — Expérience Professeur : profil, « Mes classes », « Mes élèves »

- Date : 2026-11-17 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : l'ADR 0023 a créé les profils Contributeur et Prof pour les contributions au contenu ; le rôle système
  `prof` (« Professeur », ADR 0026) relit et décide déjà des contributions. Le propriétaire demande que le Professeur
  dispose d'une **expérience** complète, qui complète celle du Contributeur : un profil configurant ses matières et ses
  niveaux, un module **Mes classes** (gestion des classes) et un module **Mes élèves** (suivi des élèves affiliés), avec
  des **liens d'invitation** pour qu'un élève rejoigne une classe ou suive des cours particuliers. L'expérience est
  **réservée au rôle Professeur**.
- Références : comptes locaux (ADR 0024), Espace famille (ADR 0029, même socle : session porteuse, bilan borné, codes
  à usage contrôlé), back-office et rôles (ADR 0026), contributions (ADR 0023).

## Décision

### 1. Rôle

- Nouvelle permission `professeur` (fonctionnalité du registre `worker/src/roles.js`), donnée au rôle système `prof`
  (« Professeur »). Le Worker vérifie la permission sur toutes les routes du professeur ; l'interface affiche les menus
  « Mes classes » et « Mes élèves » et le bloc « Profil professeur » seulement si le Worker répond `professeur: true`.
- Le rôle n'est **jamais auto-attribué** : il est donné dans le back-office (Utilisateurs → compte local → rôle `prof`).
  L'administrateur a toutes les permissions et voit donc aussi l'expérience ; le back-office peut retirer `professeur`
  à un rôle.
- L'expérience Contributeur reste inchangée (propositions, ADR 0023) ; le Professeur y garde la relecture à quatre yeux.
  Les écrans « Mes classes » et « Mes élèves » portent une sous-navigation vers « Contributions » quand ce menu existe.

### 2. Profil du professeur

Nom affiché aux élèves (2 à 40 caractères : lettres, chiffres, espace, `. ' - ( )` ; ni `@` ni suite de 6 chiffres),
1 à 5 **matières** parmi celles du catalogue (jeux exclus), au moins un **niveau** parmi `6e`, `5e`, `4e`, `3e`,
`seconde`, `premiere`, `terminale` (chacun correspond à un niveau du catalogue). Le profil est exigé avant de créer une
classe ou un lien. Il se règle dans l'écran Profil (bloc « Profil professeur »).

### 3. Mes classes

- Une classe = nom court (1 à 30 caractères, mêmes règles), une matière et un niveau **pris dans le profil**. Au plus
  20 classes par professeur, 40 élèves par classe, 200 élèves au total.
- Modifier (nom, matière, niveau) ; supprimer avec confirmation en deux temps : ses liens sont désactivés et ses élèves
  ne sont plus suivis (leur compte et leur progression ne sont pas touchés).

### 4. Liens d'invitation

- Deux sortes : **classe** (partagé à toute la classe, jusqu'à 40 utilisations) et **cours particulier** (usage unique,
  l'élève est suivi sans classe). Validité au choix : 1, 7 ou 30 jours. Au plus 20 liens actifs.
- Le lien est `https://<site>/?rejoindre=<CODE>` ; le code (10 caractères de l'alphabet sans ambiguïté de l'ADR 0029)
  est aussi affiché en `ABCDE-FGHJK` pour une saisie à la main. **Seule son empreinte SHA-256 est gardée** : le lien
  n'est montré qu'à sa création, le professeur peut en créer un autre ou désactiver un lien actif.
- Même réponse pour un code mal formé, inconnu, expiré ou épuisé ; limitation de débit par IP en mémoire (20/min).
  Le cron quotidien purge les liens expirés ou épuisés.

### 5. Adhésion de l'élève

- Un élève **connecté avec un compte local lié** ouvre le lien (le code est retiré de l'adresse et gardé pour l'onglet ;
  sans compte lié, il est guidé vers « Mon compte » et l'adhésion reprend après la connexion) ou colle le lien / le code
  dans « Mon compte → Mes professeurs ».
- Il voit le nom du professeur, la classe, la matière et le niveau, et **ce qui sera partagé** ; il choisit le nom sous
  lequel il apparaît (règles du pseudo, prérempli avec son pseudo) et coche l'**accord** versionné
  (`partage-prof-v1`). Le Worker refuse sans accord. **Aucun accord parental n'est requis**, quel que soit l'âge de
  l'élève (décision du propriétaire du 2026-11-17, §8).
- Un lien par professeur et par élève : rejoindre une autre classe du même professeur change seulement la classe.
  Au plus 10 professeurs par élève. Un professeur ne peut pas utiliser son propre lien.
- L'élève **quitte** un professeur à tout moment (Mon compte) ; le professeur peut **retirer** un élève ou le
  **déplacer** (autre classe ou cours particulier).

### 6. Mes élèves (suivi)

- L'appareil de l'élève envoie (`PUT /api/professeur/bilan`) le même bilan borné que la famille (ADR 0029 §4), sans
  badges ni cahiers, avec le même rythme (au plus une fois par minute, à la connexion et quand l'onglet est masqué).
  Une ligne par élève, partagée par ses professeurs, effacée quand il n'en a plus aucun.
- Le Worker ne renvoie au professeur que les **notions des matières concernées** : celle de la classe, ou celles de son
  profil pour un cours particulier.
- Écran : filtre par classe (ou cours particuliers), synthèse de la semaine (élèves, actifs sur 7 jours, temps actif,
  notions à revoir), notions le plus souvent à revoir dans le groupe, points d'attention (aucune activité partagée,
  inactif depuis 7 jours, notions à revoir), carte par élève (activité, barres de la semaine, répartition des notions,
  gestion). Calculs dans le navigateur (`web/professeur.js`).

### 7. Technique

- Règles partagées dans `web/professeur.js` (Worker, interface, démonstration). Routes `/api/professeur/`
  (`worker/src/professeur.js`), session porteuse du compte local, CORS contrôlé, 503 si les tables manquent.
- Migration `0004_professeur.sql` (schéma de référence `worker/schema-professeur.sql`) : `professeurs_profils`,
  `professeurs_classes`, `professeurs_invitations`, `professeurs_eleves`, `professeurs_bilans`, décrites dans le
  registre des traitements (`worker/src/donnees.js`). Effacement en cascade à la suppression d'un compte (titulaire ou
  back-office, `worker/src/professeur-donnees.js`), export du droit d'accès complété.
- **Démonstration** : « Tester les rôles → Prof » (option temporaire de l'ADR 0023 §7) active aussi l'expérience
  Professeur avec le double `web/demo-professeur.js` (mêmes règles et mêmes réponses, élèves fictifs, bouton « Simuler
  l'arrivée d'un élève »), sans appel au Worker.

| Méthode et route | Qui | Effet |
|---|---|---|
| `GET moi` | tout compte lié | rôle, `professeur`, profil, nombre de professeurs suivis |
| `GET invitation/:code`, `POST rejoindre` | élève | aperçu, adhésion (pseudo + accord) |
| `GET mes-professeurs`, `POST mes-professeurs/:id/quitter`, `PUT bilan` | élève | ses professeurs, quitter, bilan |
| `PUT profil` | Professeur | nom affiché, matières, niveaux |
| `GET/POST classes`, `POST classes/:id/(modifier\|supprimer)` | Professeur | classes |
| `POST invitations`, `POST invitations/:id/revoquer` | Professeur | liens d'invitation |
| `GET eleves`, `POST eleves/:id/(deplacer\|retirer)` | Professeur | suivi des élèves |

### 8. Accord parental : non requis (décision du 2026-11-17)

Le propriétaire a tranché le point de contrôle ouvert par cet ADR : l'élève rejoint un professeur **sur son seul
accord**, y compris s'il a moins de 15 ans ; aucun accord d'un parent (Espace famille) n'est demandé. Ce qui encadre ce
choix :

- l'élève voit, avant d'accepter, qui l'invite et exactement ce qui est partagé, et peut quitter à tout moment ;
- le partage est limité aux compteurs et à la maîtrise des notions de la matière du professeur : jamais les questions
  posées, les badges ni les cahiers ;
- le rôle Professeur n'est attribué que par le propriétaire (back-office) ;
- le texte d'accord et la page de confidentialité restent soumis à la relecture juridique avant une ouverture au-delà de
  la bêta (action manuelle, [issue #357](https://github.com/Kermic974/KermicLab/issues/357)).

### 9. Activités et tableau de bord (complément du 2026-11-17)

À la demande du propriétaire, le professeur donne des **activités** à un élève ou à **toute une classe** (élèves
présents et futurs), et suit leur usage dans un **tableau de bord**.

| Activité | Contenu | Résultat remonté |
|---|---|---|
| **Défi** | 5 questions tirées des QCM publiés des notions choisies ; l'élève peut rejouer | meilleur score, nombre d'essais, durée |
| **Évaluation** | de **5 à 40 questions** (borne vérifiée par le Worker), même tirage ; **une seule tentative** : le premier résultat terminé fait foi | score, durée |
| **Cahier** | types exercices, fiches ou vacances (comme l'Espace famille), construit à partir du catalogue ou **rédigé par l'IA** (`MODELE_CAHIERS`, quota `CAHIERS_GENERATIONS_JOUR` par professeur et par jour) ; copié dans « Mes cahiers » de l'élève | exercices réussis / total |
| **Objectif** | mesuré sans rien demander à l'élève : minutes actives ou XP sur 7 jours, notions choisies maîtrisées, activités terminées | calculé à partir du bilan (§6) et des résultats |

- Chaque activité porte 1 à 10 notions des **matières du profil**, un titre court facultatif (mêmes règles que le nom
  d'une classe) et une échéance facultative (6 mois au plus). Au plus 60 activités en cours par professeur.
- **Questions reproductibles** : le tirage est fait dans le navigateur de l'élève, avec l'identifiant de l'activité
  comme graine, dans les QCM publiés du catalogue (`dist/contenus/`) ; tous les élèves d'une classe reçoivent donc les
  mêmes questions, en alternant les notions. S'il y a moins de QCM publiés que demandé, le quiz est plus court et le
  professeur en est averti à la création.
- **Rien de ce que l'élève coche ne quitte son appareil** : seuls des compteurs remontent (`PUT /api/professeur/resultats` :
  réussies, total, durée, terminé), bornés par `validerResultat`. Le score est calculé sur l'appareil de l'élève
  (comme l'avancement des cahiers de l'Espace famille) : c'est un outil de suivi, pas un examen surveillé.
- **Tableau de bord** (écran `#suivi`, entrée « Tableau de bord » de la navigation, entrée « Prof » sur mobile), filtrable
  par classe, calculé dans le navigateur du professeur (`tableauDeBord`) :
  - engagement : élèves actifs sur 7 jours, temps moyen par élève, activités terminées (taux), retards ;
  - performance : score moyen aux évaluations et aux défis, part des notions maîtrisées, notions à revoir ;
  - tableau par classe, détail de chaque activité (terminés / attendus, score moyen, retards, puis élève par élève) ;
  - élèves à suivre : aucune activité partagée, inactif depuis 7 jours, activités en retard, score moyen sous 50 %.
- « Mes élèves » affiche aussi les activités et l'avancement de chaque élève ; « Donner une activité » est proposé depuis
  le tableau de bord, la carte d'une classe et la carte d'un élève.
- Côté élève, un bloc « Travail donné par tes professeurs » apparaît sur l'accueil (statut, échéance, Commencer /
  Continuer / Rejouer).
- **Données** : migration `0005_professeur_activites.sql` (`professeurs_activites`, `professeurs_resultats`,
  `professeurs_consommations`), décrites dans le registre des traitements. Quand l'élève quitte un professeur ou en est
  retiré, ses résultats et ses activités personnelles sont effacés ; supprimer une classe efface ses activités ;
  supprimer un compte efface tout. Les compteurs d'IA sont purgés après 90 jours.

| Méthode et route | Qui | Effet |
|---|---|---|
| `GET activites`, `POST activites`, `POST activites/:id/(archiver\|supprimer)` | Professeur | activités et résultats de ses élèves |
| `GET mes-activites`, `PUT resultats` | élève | activités de sa classe et les siennes ; envoi des compteurs |

## Conséquences

- Le bilan d'un élève, souvent mineur, devient lisible par un adulte qui n'est pas son parent, **sur l'accord du seul
  élève**, sans accord parental (§8).
- Le nom affiché du professeur est une donnée personnelle d'adulte, choisie par lui et montrée à ses élèves.
- Les comptes OAuth (ADR 0017) ne sont pas concernés tant qu'ils ne sont pas activés.

## Pistes (non livrées)

Défis et évaluations rédigés par l'IA (aujourd'hui : QCM publiés du catalogue seulement) ; questions à saisie
numérique ; export du suivi (CSV, PDF) ; historique des scores dans le temps ; co-enseignement (plusieurs professeurs
par classe) ; filtre du tableau de bord des contributions sur les matières du professeur.

## Révision

- 2026-11-17 : accord parental non requis (§8), décision du propriétaire.
- 2026-11-17 : activités (défis, évaluations de 5 à 40 questions, cahiers, objectifs) et tableau de bord (§9).
- Reste à valider par le propriétaire avant toute ouverture au-delà de la bêta.
