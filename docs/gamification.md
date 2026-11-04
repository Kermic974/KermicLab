# La gamification des jeux Kermiclab

Décisions : [ADR 0014](decisions/0014-academie-echecs-gamification-locale.md) (progression gardée dans la page) et
[ADR 0015](decisions/0015-modules-partages-des-jeux.md) (modules partagés). Code : `gabarit/jeux/`.

## Synthèse

Chaque jeu (Échecs, Démineur) a un onglet **Académie** : un parcours **du débutant au pro**, découpé en **grades**
(6 aux échecs, 5 au Démineur). Chaque grade contient des **leçons**, et chaque leçon a une explication courte, une
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

**Propres à chaque jeu**, décrits dans son parcours : leçons d'un thème terminées, victoires à un niveau ou au total,
record de temps.

### Conseil personnalisé, par ordre de priorité

1. Au moins 3 révisions dues : réviser.
2. Un thème réussi du premier coup moins de 60 % du temps (sur au moins 3 essais) : refaire la leçon la moins réussie de ce thème.
3. La prochaine leçon ouverte et pas encore faite.
4. Une ou deux révisions dues.
5. Une leçon à moins de 3 étoiles.
6. Sinon : aller jouer, avec le message de fin propre au jeu.

### Exercices propres aux jeux

- **Échecs (`coup`)** : trouver un coup ou une suite de coups, l'adversaire répondant automatiquement. Les pièges
  fréquents ont une explication sur mesure. Les tests rejouent chaque solution avec le moteur et vérifient qu'en tactique
  elle est le meilleur coup.
- **Démineur (`grille`)** : une position réaliste, c'est-à-dire une disposition de mines puis les cases ouvertes comme en
  vraie partie. **Chaque geste est jugé par le solveur du moteur** : on n'accepte que des certitudes. Un pari est refusé,
  même s'il tombe juste. Buts possibles : une case sûre, une mine, toutes les mines certaines, tout déblayer en chaîne,
  ouverture rapide. Les tests comparent le solveur à une recherche exhaustive.

### Accessibilité

- Les gains sont annoncés (`role="status"`). Les barres sont des `progressbar` avec un texte.
- Rien ne dépend de la seule couleur : 🔒, ★☆, ✓ et ✗.
- Le focus suit les changements de page, et tout se joue au clavier, à la souris et au toucher.
