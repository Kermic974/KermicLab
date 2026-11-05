# La gamification des jeux Kermiclab

Décisions : [ADR 0014](decisions/0014-academie-echecs-gamification-locale.md) (progression gardée dans la page) et
[ADR 0015](decisions/0015-modules-partages-des-jeux.md) (modules partagés). Code : `gabarit/jeux/`.

## Synthèse

L'interface commune de l'Académie, utilisée par les Échecs, le Démineur, la Belote, les Mots fléchés et le Poker Texas Hold'em, propose un parcours
**du débutant au pro**, découpé en **grades**
(6 aux échecs, 5 au Démineur et à la belote). Chaque grade contient des **leçons**, et chaque leçon a une explication courte, une
stratégie **« À retenir »** et des exercices. Ce sont des QCM, ou des positions à jouer sur l'échiquier ou sur la grille,
toutes vérifiées par le moteur du jeu.

Ce qui motive le joueur :

| Mécanisme | En une phrase |
|---|---|
| XP et niveaux | Chaque réussite rapporte de l'XP ; les niveaux demandent de plus en plus d'XP (100, 300, 600…). |
| Grades et emblèmes | Terminer un grade ouvre le suivant et un nouvel emblème à choisir. |
| Étoiles | 1 à 3 par leçon, selon les erreurs et les indices : on peut refaire une leçon pour s'améliorer. |
| Badges | Une vingtaine par jeu, avec leur avancement visible (« 3 / 10 révisions »). |
| Série et objectif du jour | Jours d'affilée, et un objectif quotidien choisi (1, 3 ou 5 exercices). |
| Révisions espacées | Chaque stratégie apprise revient de plus en plus tard si elle est réussie, dès le lendemain sinon. |
| Défi du jour | Un exercice, le même pour tous le même jour, avec un bonus d'XP. |
| Conseil personnalisé | Réviser, retravailler le point faible, avancer, viser 3 étoiles, ou aller jouer. |
| Parties | Les parties jouées (victoires, records de temps au Démineur) rapportent de l'XP et des badges. |

L'écran d'accueil de l'Académie est une **synthèse** : grade et niveau, barre d'XP, série, objectif du jour, grades et
badges, le conseil du jour, le prochain badge à gagner, puis la carte du parcours. Le bouton **« Ma progression
détaillée »** ouvre la **page détaillée**. Elle montre les règles d'XP, les grades, tous les badges avec leur
avancement, les 7 derniers jours, le carnet de stratégies, les points forts et faibles, les statistiques de parties et
les réglages, dont l'effacement de la progression.

**Ni donnée personnelle, ni réseau.** La progression reste sur l'appareil (`localStorage`). Elle contient seulement des
compteurs, des identifiants de leçons et des dates.

## Détail

### Tableau de bord : « Mes trophées »

La rubrique « Mes trophées » rassemble les succès d'exploration et du défi express, les étoiles des notions
du gabarit commun, les deux objectifs du mini-lab du cercle (trois angles manipulés et `sin(θ) = 1`),
le record du Lab `trigo-cercle`, ainsi que les parcours des jeux. L'Académie commune
(Échecs, Démineur, Belote, Mots fléchés, Pendu, Poker Texas Hold'em) remonte XP, niveau, étoiles, leçons, grades, série,
révisions, victoires et tous ses badges avec leur avancement. Sudoku remonte ses grades réellement terminés
(le premier grade ouvert n'est pas un grade obtenu) et 2048 ses objectifs de tuiles et son record.
Les jeux sans adaptateur ne déclarent aucun résultat ; un état vide est affiché, sans inventer de réussite.
Les XP ne sont pas additionnés : les règles et les niveaux diffèrent selon les parcours.

La collection est consultable **depuis l'accueil, avant toute ouverture d'un module** : le build produit
`dist/trophees.json` à partir des contenus et des moteurs de progression du catalogue. Ce fichier public ne contient
que les objectifs disponibles et leurs états initiaux, jamais de données utilisateur. À l'ouverture de « Mes trophées »,
le tableau de bord affiche cette collection puis y superpose les instantanés déjà conservés dans le navigateur.
Un trophée sans résultat est présenté comme à débloquer ; consulter la collection ne crée ni XP, ni étoile,
ni notion explorée et ne lance aucun jeu en arrière-plan. Un échec de chargement est signalé et peut être réessayé.

Le pont autonome `gabarit/jeux/trophees.js`, inclus au build avec ses hashes CSP, échange seulement avec le parent
par `postMessage`. Les iframes restent `sandbox="allow-scripts"`, **sans** `allow-same-origin`.
Le module envoie `kermiclab:trophees:pret` avec son identifiant ; le tableau de bord répond par
`kermiclab:trophees:charger` avec l'état précédemment conservé (ou `null`). L'adaptateur valide cet état,
restaure sa progression et publie `kermiclab:trophees:progres` à chaque changement, avec ses compteurs,
ses badges et l'état nécessaire à la reprise. Le parent vérifie la fenêtre source, son origine opaque,
l'identifiant attendu et le format borné de l'instantané. L'enfant accepte une seule restauration,
uniquement depuis sa fenêtre parente. L'origine opaque impose `targetOrigin: "*"`, sans ouverture réseau.

Le pont ne dépend pas de `document.referrer` : la politique de confidentialité du site est
`Referrer-Policy: no-referrer`. L'annonce initiale ne contient que le type et l'identifiant du module ;
l'enfant apprend l'origine HTTP(S) du parent depuis le message de restauration, après vérification de
`event.source === window.parent`. Toute origine explicitement configurée dans les métadonnées reste imposée.
Les instantanés suivants ciblent exclusivement cette origine. Les tests de remontée et du chat reproduisent
la politique `no-referrer` du déploiement.

Les instantanés sont conservés sous `kermiclab:trophees`, en session par défaut, dans le stockage local
uniquement après choix de mémorisation. Changer ce choix déplace les instantanés ; l'effacement du profil les
supprime des deux stockages. Effacer la progression dans l'Académie met aussi à jour le tableau de bord.
Une page ouverte séparément reste autonome, avec son propre stockage : **pas de synchronisation entre origines
ni de récupération des anciens résultats de pages plein écran**. Aucun résultat n'est envoyé au serveur.

English: **My trophies** combines exploration achievements, concept and mini-lab stars, lab records and compatible
game learning paths. The available collection is visible directly from the homepage before opening any module,
with saved dashboard snapshots overlaid on locked goals. Browsing the collection does not award progress or launch games.
Sandboxed pages exchange bounded, source-checked local snapshots with the dashboard;
progress follows the profile's session/remember/erase choice. XP scales remain separate. Standalone pages retain
their independent storage and do not sync with the dashboard.

### Gains d'XP

| Action | XP |
|---|---|
| Exercice réussi du premier coup | 20 |
| Exercice réussi après une erreur | 10 |
| Exercice réussi avec un indice | 5 |
| Leçon terminée (la première fois) | 30 |
| Révision réussie du premier coup (sinon 1) | 5 |
| Objectif du jour atteint | 20 |
| Défi du jour réussi | 15 |
| Partie (selon le jeu et le niveau) | défini dans le parcours : par exemple 50 pour une victoire contre l'ordinateur Facile, 200 pour une victoire au Démineur Expert |

Le niveau *n* commence à 50 × *n* × (*n* − 1) XP.

### Étoiles

Pénalité = erreurs + 2 × indices. 0 donne 3 étoiles, 1 ou 2 donnent 2 étoiles, au-delà c'est 1 étoile. Seul le meilleur
score d'une leçon est gardé.

### Grades

Un grade est obtenu quand toutes ses leçons sont terminées (au moins une étoile). Le grade suivant s'ouvre alors, avec
un nouvel emblème. Le **mode libre** (réglages) ouvre tout le parcours pour qui connaît déjà les bases. Le titre affiché
est le dernier grade obtenu (« Débutant » au départ, « … : tu es un pro ! » à la fin).

### Révisions espacées (boîtes de Leitner)

Chaque exercice réussi devient une carte. Une première réussite met la carte en boîte 1 (révision le lendemain). Une
révision réussie du premier coup la fait monter d'une boîte. Les intervalles sont de 1, 2, 4, 8 puis 16 jours. Une
erreur la renvoie en boîte 1. Une carte en boîte 4 ou plus est « maîtrisée » dans le carnet. Après chaque réponse de
révision, la stratégie « À retenir » est rappelée.

### Badges

**Communs à tous les jeux** :
- premiers pas, sans faute, perfectionniste (3 étoiles sur tout un grade), « du débutant au pro » (tous les grades) ;
- régularité : séries de 3 et 7 jours, objectif du jour atteint 5 fois ;
- mémoire : 10 révisions, 10 stratégies maîtrisées ;
- 3 défis du jour.

**Propres à chaque jeu**, décrits dans son parcours (`badges[].condition`) :
- `themes` : leçons d'un ou plusieurs thèmes terminées (toutes, ou une seule avec `"toutes": false`) ;
- `victoires` : victoires à un niveau, ou au total ;
- `record` : meilleur temps sous un seuil (Démineur) ;
- `compteur` : événements de jeu comptés par la page (belote : contrats réussis, belotes, capots).

### Conseil personnalisé, par ordre de priorité

1. Au moins 3 révisions dues : réviser.
2. Un thème réussi du premier coup moins de 60 % du temps (sur au moins 3 essais) : refaire la leçon la moins réussie de ce thème.
3. La prochaine leçon ouverte et pas encore faite.
4. Une ou deux révisions dues.
5. Une leçon à moins de 3 étoiles.
6. Sinon : aller jouer, avec le message de fin propre au jeu.

### Exercices propres aux jeux

- **Poker (`comparaison`)** : comparer les cinq meilleures cartes de deux joueurs à partir de leurs cartes privées
  et du tableau commun. Le moteur calcule le gagnant, y compris les égalités ; les tests vérifient les situations et
  les explications (full, quinte basse, carte de départage). Trois grades et six leçons ; une manche rapporte
  40 / 10 / 5 XP pour victoire / égalité / défaite, jamais selon le montant misé. Les badges de pratique comptent
  les manches et les abattages. Les défis libres sont sans XP ; le défi quotidien récompensé utilise le socle commun.
- **Échecs (`coup`)** : trouver un coup ou une suite de coups, l'adversaire répondant automatiquement. Les pièges
  fréquents ont une explication sur mesure. Les tests rejouent chaque solution avec le moteur et vérifient qu'en tactique
  elle est le meilleur coup.
- **Démineur (`grille`)** : une position réaliste, c'est-à-dire une disposition de mines puis les cases ouvertes comme en
  vraie partie. **Chaque geste est jugé par le solveur du moteur** : on n'accepte que des certitudes. Un pari est refusé,
  même s'il tombe juste. Buts possibles : une case sûre, une mine, toutes les mines certaines, tout déblayer en chaîne,
  ouverture rapide. Les tests comparent le solveur à une recherche exhaustive.
- **Belote (`pli`, `enchere`)** : choisir la carte à jouer dans un pli en cours (une carte interdite est expliquée par la
  règle qui s'applique : fournir, couper, monter…), ou prendre, passer, choisir l'atout. Les tests vérifient que chaque
  pli suit le sens du jeu, que les solutions sont légales, que les pièges sont jouables mais refusés, et que les réponses
  aux enchères sont celles de l'ordinateur.

### Accessibilité

- Les gains sont annoncés (`role="status"`). Les barres sont des `progressbar` avec un texte.
- Rien ne dépend de la seule couleur : 🔒, ★☆, ✓ et ✗.
- Le focus suit les changements de page, et tout se joue au clavier, à la souris et au toucher.
