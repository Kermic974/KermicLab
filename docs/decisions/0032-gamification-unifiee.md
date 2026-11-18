# ADR 0032 — Gamification unifiée : XP d'apprentissage, jeux reliés aux notions, vocabulaire

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
| **Points de jeu** | Points internes d'une Académie de jeu. Jamais additionnés à l'XP ni entre jeux. Même nom dans les pages des jeux (« +20 points de jeu », « Niveau 2 · 140 points de jeu ») et dans le tableau de bord (« Points de jeu », « Niveau de jeu »). |
| **Maîtrise** | Seul indicateur scolaire : état d'une notion (non commencée, découverte, en cours, maîtrisée, à revoir). |
| **Étoiles** | Notion : une par exercice réussi. Académie : 1 à 3 par leçon, selon les erreurs et les indices. |
| **Défi express** | Seul défi quotidien du tableau de bord (5 questions, révisions dues comprises), qui rapporte de l'XP. |
| **Défi de l'Académie** | Exercice quotidien d'une Académie de jeu (anciennement « défi du jour »), qui rapporte des points de jeu. |

Les deux défis quotidiens ne se confondent plus : un seul s'appelle « défi » côté tableau de bord, l'autre porte le nom
de l'Académie.

**Mise en œuvre en deux temps.** Le tableau de bord affiche déjà « Points de jeu » et « Niveau de jeu » (cette PR). Le
renommage dans les pages des jeux (module partagé `gabarit/jeux/academie.js`, textes propres à la Belote, au Démineur,
aux Échecs et au Poker) fait l'objet d'une PR séparée : il change le contenu vu par l'élève dans six jeux, qui passent
en version corrective et demandent leur propre relecture humaine. Les identifiants internes (`xp`, `XP.defi`) ne
changent pas : les progressions enregistrées restent lisibles.

### 5. Synchronisation de la maîtrise

L'agrégat du contrat d'événements (`kermiclab:evenements` : maîtrise, cartes de révision) ne suivait pas la
synchronisation du compte local (ADR 0024 ; ADR 0025 §3 : « l'étendre demandera une décision »). C'était la seule donnée
de progression perdue en changeant d'appareil. Options étudiées :

1. statu quo (l'export en fichier, issue #189, suffit) ;
2. **synchroniser l'agrégat** dans l'instantané chiffré du compte local ;
3. synchroniser seulement l'état de maîtrise par notion.

**Option 2 retenue et mise en œuvre**, sous réserve de la validation de cette ADR par le propriétaire :

- L'agrégat rejoint l'instantané **chiffré sur l'appareil** (AES-GCM, clé dérivée de la phrase secrète, ADR 0024) : le
  serveur ne reçoit qu'un chiffré sous pseudonyme, comme pour la progression et les cahiers. Le contenu ne contient que
  des identifiants du catalogue, des compteurs et des dates au jour près, jamais de texte saisi.
- Clé **facultative** (`CLES_FACULTATIVES`, `web/app.js`) : `alleger` (`web/compte-local.js`) la retire si l'instantané
  dépasse `TAILLE_MAX_INSTANTANE` (250 000 caractères avant chiffrement, sous la limite du serveur) ; `restaurer` garde
  la maîtrise locale quand l'instantané lu n'en contient pas (instantané antérieur ou allégé) au lieu de l'effacer.
- À la restauration, l'agrégat est relu par `evenements.charger`, qui écarte toute entrée invalide.
- Le bilan famille et professeur (ADR 0029, 0030) est inchangé : il ne contient toujours que l'état de maîtrise.

Pour revenir à l'option 1, il suffit de retirer la clé de `CLES_FACULTATIVES`.

## Conséquences

- Un élève qui travaille gagne plus d'XP qu'un élève qui ouvre des pages ; les objectifs d'XP des professeurs
  (ADR 0030) mesurent donc mieux le travail.
- Tests : `tests/unit/gamification-unifiee.test.mjs` (gains, XP, liens jeux ↔ notions, contrôle du build).
- English summary: global XP now rewards learning (first success of an exercise, first validation of a concept,
  successful review) more than exploration (first opening lowered from 25 to 10 XP); games may declare
  `notions-liees`, shown on game cards and suggested when a concept is first mastered; 51 non-maths public concepts now
  declare prerequisites; a single glossary separates XP, game points and mastery
  (game points on the dashboard now; renaming inside the game pages, including the "Academy challenge", ships in a
  separate PR); the
  mastery aggregate now joins the encrypted local-account snapshot (optional key, trimmed when too large, never erased
  by an older snapshot).
- Références : ADR 0014, 0015, 0021, 0024, 0025, 0029, 0030 ; `docs/gamification.md`, `docs/progression.md`.
