# ADR 0023 — Contributions au contenu des notions : profils Prof et Contributeur (scénario sans IA)

- Date : 2026-11-07 — Statut : **accepté** (validé par le propriétaire le 2026-11-07)
- Contexte : le catalogue s'enrichit aujourd'hui par issues `maquette-manquante` et PR préparées par des agents. Le
  propriétaire veut ouvrir la mise à jour du contenu à deux nouveaux profils d'utilisateur :
  - **Contributeur** : propose des mises à jour du contenu des notions ;
  - **Prof** : propose aussi des mises à jour et dispose d'un **tableau de bord de suivi des contributions** pour relecture
    et validation.
  Première étape : **scénario sans IA** (aucun modèle n'intervient, ni pour rédiger ni pour relire).
- Références : modèle des comptes (ADR 0010), parcours famille et démonstration « green card » (ADR 0017), gabarit des
  notions `contenu.json` (ADR 0011), déterminisme du catalogue (AGENTS.md §1).

## Décision

### 1. Rôles

`comptes.role` prend une valeur parmi `parent` (défaut), `contributeur`, `prof`, `admin` (contrainte `CHECK` en base).

| Rôle | Proposer | Suivre ses propositions | Tableau de bord de relecture | Décider |
|---|---|---|---|---|
| parent | non | non | non | non |
| contributeur | oui | oui | non | non |
| prof | oui | oui | oui | oui, **sauf sur ses propres propositions** |
| admin (propriétaire) | oui | oui | oui | oui, y compris les siennes |

- Un rôle n'est **jamais auto-attribué** : le propriétaire l'attribue en base (action manuelle 35). Les contributeurs et
  profs sont des **adultes** identifiés par OAuth (même connexion que le compte parent, ADR 0017) ; aucun profil enfant ne
  contribue.
- **Relecture à quatre yeux** : un prof ne valide, ne refuse ni ne renvoie en révision sa propre proposition ; un autre
  prof (ou l'admin) s'en charge.

### 2. Ce qu'on peut proposer

- Une contribution vise **un champ texte** du `contenu.json` d'une notion du gabarit, désigné par un chemin
  (`intro`, `niveaux.1.paragraphes.0`, `application.exercices.3.explication`, `situation.conclusion`…).
- Deux natures : **modification** (remplacer le texte) ou **ajout** (insérer un texte après un élément d'une liste :
  paragraphe, étape, choix, indice, histoire, point clé).
- Hors champ en phase 1 : nombres (réponses, bonne réponse, tolérances), types d'exercice, figures, titres d'onglets,
  fiches (`fiche.md`), pages écrites à la main et jeux. Une erreur sur ces éléments passe par « Signaler un problème ».
- Règles (partagées interface / Worker dans `web/contributions.js`) : texte de 1 à 2 000 caractères, sans balise HTML ni
  lien (pages autonomes), différent du texte actuel ; type (`correction`, `clarification`, `exemple`, `orthographe`,
  `autre`) ; motif de 5 à 500 caractères ; **charte du contributeur** versionnée (`charte-contributeur-v1`) acceptée à
  chaque envoi ; au plus 20 propositions en cours par auteur. Le Worker refuse en plus toute donnée personnelle
  (e-mail, téléphone, adresse, identité). Les sujets sensibles ne sont pas filtrés automatiquement (une notion de SVT ou
  d'EMC peut les traiter) : la relecture humaine est le contrôle.

### 3. Cycle de vie

```
proposée ──valider──▶ validée ──intégrer──▶ intégrée
   │  ▲                (issue GitHub)        (PR fusionnée)
   │  └──modifier── à réviser
   ├──reviser (commentaire)──▶ à réviser
   ├──refuser (commentaire)──▶ refusée
   └──retirer (auteur)──▶ retirée        (aussi depuis « à réviser »)
```

- Refuser ou demander une révision exige un **commentaire** pour l'auteur.
- **Valider ne publie rien** : le Worker ouvre (ou commente) une issue GitHub `contribution-validee` avec le texte actuel,
  le texte proposé, le motif et le commentaire du relecteur, sans identifiant de compte ni mention. Un agent ou le
  propriétaire intègre la modification dans `contenu.json`, monte la version de la fiche, `npm run ci`, PR →
  **validation du CODEOWNER**. Le prof marque ensuite la contribution « intégrée ». Le principe de déterminisme est
  conservé : le catalogue ne change que par une PR validée.
- Si l'issue ne peut pas être créée (GitHub indisponible), la validation est conservée et l'interface invite à créer
  l'issue à la main.
- Chaque proposition garde le texte du champ **au moment de la proposition** : si le catalogue a changé depuis, le
  tableau de bord signale la proposition comme « à vérifier » (comparaison avec le contenu publié).

### 4. Données

- Table `contributions` (`worker/schema-comptes.sql`) : auteur, notion, version de la notion (prise au catalogue du Worker,
  pas au navigateur), chemin, nature, type, texte actuel, texte proposé, motif, charte, statut, relecteur, commentaire,
  numéro d'issue, horodatages.
- Ces textes sont du **contenu pédagogique destiné à publication**, rédigé par des adultes, pas des messages de chat :
  la règle « aucun texte de message dans D1 » (AGENTS.md §4) ne s'y applique pas, mais aucune donnée personnelle n'y est
  acceptée.
- L'auteur n'est jamais affiché : le tableau de bord montre un code court (6 derniers caractères de l'identifiant).
- Suppression d'un compte : ses contributions sont effacées ; ses décisions de relecture restent, sans relecteur.
- Le build publie `dist/contenus/index.json` et `dist/contenus/<id>.json` (contenu des notions du gabarit) pour le
  formulaire et la détection des propositions obsolètes. Ce sont les textes déjà servis dans les pages ; garder ces
  fichiers dans le Worker aurait alourdi son paquet (~1,2 Mo) sans gain de confidentialité. À revoir si le catalogue
  privé doit un jour être protégé.

### 5. API (Worker, session obligatoire, 401 sinon)

| Méthode et route | Rôle | Effet |
|---|---|---|
| `GET /api/contributions?vue=miennes` | contributeur, prof, admin | Ses propositions (200 max) |
| `GET /api/contributions?vue=relecture` | prof, admin | Toutes les propositions sauf retirées (200 max) |
| `POST /api/contributions` | contributeur, prof, admin | Crée une proposition (201) |
| `PATCH /api/contributions/:id` `{ action, … }` | selon l'action | `modifier`, `retirer` (auteur) ; `valider`, `refuser`, `reviser`, `integrer` (relecteur) |

Codes d'erreur : `role-requis` (403), `contribution-invalide` (400, détails par champ), `donnees-personnelles` (400),
`quota-atteint` (409), `relecture-quatre-yeux` (409), `statut-incompatible` (409), `introuvable` (404).

### 6. Interface

- Écran `#contributions` (rattaché à Profil), entrée « Contribuer au contenu » visible seulement si la connexion est
  active et le rôle le permet. Contributeur : formulaire (notion → texte → texte actuel → proposition, type, motif, charte)
  et « Mes contributions » (statut, avant / après, commentaire du relecteur, corriger et renvoyer, retirer). Prof : en plus
  le **tableau de bord** (compteurs par statut, filtres statut et notion, avant / après mot à mot, motif, commentaire,
  Valider / Refuser / Demander une révision, Marquer intégrée).
- Tant que `connexionActive` vaut `false`, rien n'est appelé et l'écran n'existe pas. **Démonstration** :
  `?demo=contributions` simule les deux rôles dans l'onglet (`web/demo-contributions.js`, mêmes règles et mêmes formes de
  réponse), sans OAuth ni appel au Worker, pour valider les écrans avant l'activation des comptes.

### 6 bis. Édition ciblée et menu Contributions (2026-11-07)

À la demande du propriétaire, le rôle contributeur ou prof change l'expérience globale :

- **Édition ciblée dans la notion** : quand une notion du gabarit s'ouvre (bulle), le bouton « Proposer une modification »
  affiche, à côté de la page, un panneau qui reprend **ses textes onglet par onglet** (Explication, Mémo, S'entraîner, Défi).
  Chaque texte porte le nombre de propositions en cours (les siennes pour un contributeur, toutes pour un prof) et se
  modifie ou se complète sur place, avec l'aperçu avant / après, le type, le motif et la charte. La page elle-même n'est
  pas modifiée : elle reste isolée (iframe sans même origine, CSP sans réseau) et déterministe ; la proposition suit le
  cycle du §3. Le panneau est ouvert par défaut (préférence de l'onglet) ; sur mobile il passe sous la page.
- **Menu « Contributions »** dans la navigation (barre latérale et barre du bas), affiché **seulement** pour un rôle
  contributeur, prof ou admin : c'est une sixième destination conditionnelle, qui ne change pas les cinq destinations de
  l'ADR 0021 pour les autres profils. Il centralise les contributions de l'utilisateur et, pour un prof, le tableau de bord
  avec une **synthèse matière par matière puis notion par notion** (à relire, à réviser, validées, total) et un filtre
  par matière ; un clic sur une matière ou une notion filtre la liste. Depuis la bulle, « Voir toutes les contributions »
  ouvre ce tableau filtré sur la notion.

### 7. Exception temporaire : « Tester les rôles » (à supprimer, issue #160)

À la demande du propriétaire (2026-11-07), pour tester les écrans avant l'ouverture des comptes : le Profil affiche un
sélecteur « Tester les rôles (option temporaire) » (*Aucun / Contributeur / Prof*). Choisir un rôle ouvre l'écran
Contributions avec ce rôle **simulé dans le navigateur** (double de démonstration, état gardé dans l'onglet, bandeau
« Démo »). « Aucun » revient au profil habituel.

- C'est une dérogation à la règle « un rôle n'est jamais auto-attribué » (§1), limitée à l'interface : **le Worker n'est
  pas modifié**, aucun rôle n'est attribué ni accepté côté serveur, rien n'est envoyé.
- Affichée seulement si `testRolesTemporaire` vaut `true` dans `config.json` (posé par `scripts/build.mjs`) : passer cette
  valeur à `false` la désactive immédiatement.
- **À supprimer** quand la gestion des comptes sera disponible : liste des fichiers et vérifications dans
  [l'issue #160](https://github.com/Kermic974/trigoLab/issues/160).

## Hors périmètre (étapes suivantes)

- **Avec IA** : pré-relecture (exactitude, niveau, ton) et préparation automatique de la PR d'intégration par un agent
  (`claude-sonnet-5-5`), toujours sous validation humaine.
- Proposition de nouvelles notions ou d'exercices complets, modification des nombres et des figures.
- Notifications (e-mail) aux auteurs, historique détaillé des décisions, attribution des rôles depuis l'interface,
  rattachement d'un prof à des matières.

## Conséquences

- Prérequis identiques à l'activation des comptes (ADR 0017 : domaine API même site, OAuth, schéma D1), plus
  l'attribution des rôles, le label GitHub `contribution-validee` (créé par le workflow « Labels » depuis
  `.github/labels.json`) et la validation de la charte du contributeur
  (cession des droits, licence du contenu) — **point de contrôle juridique**.
- La page de confidentialité devra décrire les comptes contributeur et prof avant l'activation.

## Révision

Accepté par le propriétaire le 2026-11-07. Prochain point de contrôle : charte du contributeur (action manuelle 36) avant l'attribution du premier rôle.
