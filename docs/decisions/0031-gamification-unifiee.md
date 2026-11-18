# ADR 0031 — Gamification unifiée : XP d'apprentissage, jeux reliés aux notions, vocabulaire

- Date : 2026-11-18 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : l'analyse de la gamification (session du 2026-11-17) relève trois systèmes qui cohabitent sans se
  parler : le tableau de bord (`web/progression.js`, XP globale), les pages de notions (étoiles, contrat d'événements,
  maîtrise, ADR 0025) et l'Académie des jeux (XP, grades, badges propres à chaque jeu, ADR 0014 et 0015). Conséquences :
  l'XP globale récompensait l'**ouverture** d'une page (25 XP) mais pas la **réussite** de ses exercices (0 XP) ; les jeux
  n'étaient reliés à aucune notion ; « XP », « niveau », « étoiles » et « défi du jour » désignaient des choses
  différentes selon l'écran ; le graphe des prérequis n'existait qu'en mathématiques (33 fiches sur 174).

## Décision

### 1. L'XP globale récompense l'apprentissage

`gainsApprentissage(avant, apres, ev)` (`web/evenements.js`, fonction pure) compare l'agrégat du contrat d'événements
avant et après chaque événement ; `enregistrerApprentissage` (`web/progression.js`) convertit les gains en XP
(`XP_APPRENTISSAGE`) :

| Fait (une seule fois) | XP |
|---|---|
| Exercice d'une notion réussi la première fois, du premier coup | 10 |
| Exercice réussi la première fois, après plusieurs essais | 5 |
| Notion validée la première fois (tous les exercices réussis, événement `termine`) | 30 |
| Révision réussie (nouvelle validation un autre jour, ADR 0025 / issue #185) | 15 |
| Première ouverture d'une notion ou d'un jeu (exploration, `XP_NOTION`) | 10 (au lieu de 25) |

Rien n'est gagné deux fois pour le même fait : rouvrir une page ou réussir de nouveau un exercice déjà réussi ne
rapporte rien ; une validation est comptée au plus une fois par jour (règle existante de l'agrégat). Un gain compte
comme un jour actif (série). Une page ouverte hors du tableau de bord n'émet pas d'événements : elle ne rapporte pas
d'XP globale (inchangé). Les XP déjà acquises ne sont pas recalculées.

### 2. Jeux reliés aux notions

Champ facultatif `notions-liees` dans la fiche d'un **jeu** (6 au plus) : les notions que le jeu fait travailler.
Le build refuse le champ sur une notion, un identifiant inconnu ou un autre jeu (`verifierGraphePrerequis`).
`/api/catalogue` l'expose (`notionsLiees`) seulement s'il existe. Le tableau de bord :

- affiche sur la carte du jeu « Fait travailler : … », chaque notion s'ouvrant d'un geste ;
- quand une notion est validée pour la première fois, propose un jeu qui la fait travailler (notification).

Les jeux restent exclus de la maîtrise et de la recommandation : ce sont des prolongements ludiques, pas des preuves
d'apprentissage. Premiers liens : Poker (probabilités, dénombrement, probabilités conditionnelles), Belote
(probabilités, dénombrement), Démineur (probabilités), 2048 (puissances).

### 3. Prérequis hors mathématiques

51 fiches publiques d'histoire, géographie, EMC, philosophie, SES et français déclarent désormais leurs prérequis
(chronologie en histoire, notion fondatrice ailleurs), contrôlés par le build (prérequis connus, pas de cycle, niveau de
début cohérent). La recommandation par prérequis (issue #186) et l'ordre du cahier de vacances (issue #188)
fonctionnent donc aussi dans ces matières. Ce sont des métadonnées : la version des notions ne change pas (AGENTS.md
§6 ter). Le catalogue privé reste à compléter de la même façon.

### 4. Vocabulaire

| Terme | Sens unique |
|---|---|
| **XP** | Points du tableau de bord (questions, exploration, exercices réussis, notions validées, défi express). Un seul niveau global, tous les 100 XP. |
| **Points de jeu** | XP interne d'une Académie de jeu. Jamais additionnés à l'XP ni entre jeux. Le tableau de bord les affiche sous ce nom (« Points de jeu », « Niveau de jeu »). |
| **Maîtrise** | Seul indicateur scolaire : état d'une notion (non commencée, découverte, en cours, maîtrisée, à revoir). |
| **Étoiles** | Notion : une par exercice réussi. Académie : 1 à 3 par leçon, selon les erreurs et les indices. |
| **Défi express** | Défi du tableau de bord (5 questions, révisions dues comprises). |
| **Défi du jour** | Exercice quotidien d'une Académie de jeu. |

Les pages des jeux gardent leur libellé « XP » à l'intérieur de l'Académie (changer leur texte imposerait une nouvelle
version des neuf jeux) ; le renommage dans les pages est laissé à une prochaine version de l'Académie.

### 5. Synchronisation de la maîtrise : décision laissée au propriétaire

L'agrégat du contrat d'événements (`kermiclab:evenements` : maîtrise, cartes de révision) ne suit pas la
synchronisation du compte local (ADR 0024 et ADR 0025 §3). Seuls l'état de maîtrise par notion et des compteurs en
sortent aujourd'hui, dans le bilan famille ou professeur (ADR 0029, 0030). Options :

1. **Statu quo** : la maîtrise reste sur l'appareil ; l'export en fichier (issue #189) suffit pour changer d'appareil.
2. **Synchroniser l'agrégat**, pseudonymisé comme le reste (ADR 0024) : identifiants de notions et d'exercices,
   compteurs, dates au jour près ; aucun texte. Recommandé : c'est la seule donnée de progression qui se perd
   aujourd'hui en changeant d'appareil, et elle ne contient rien de personnel.
3. **Synchroniser seulement l'état de maîtrise** par notion (sans les cartes de révision).

Aucune option n'est mise en œuvre tant que le propriétaire n'a pas choisi (`docs/actions-manuelles.md`).

## Conséquences

- Un élève qui travaille gagne plus d'XP qu'un élève qui ouvre des pages ; les objectifs d'XP des professeurs
  (ADR 0030) mesurent donc mieux le travail.
- Tests : `tests/unit/gamification-unifiee.test.mjs` (gains, XP, liens jeux ↔ notions, contrôle du build).
- English summary: global XP now rewards learning (first success of an exercise, first validation of a concept,
  successful review) more than exploration (first opening lowered from 25 to 10 XP); games may declare
  `notions-liees`, shown on game cards and suggested when a concept is first mastered; 51 non-maths public concepts now
  declare prerequisites; a single glossary separates XP, game points and mastery; syncing the mastery aggregate is left
  to the owner.
- Références : ADR 0014, 0015, 0021, 0024, 0025, 0029, 0030 ; `docs/gamification.md`, `docs/progression.md`.
