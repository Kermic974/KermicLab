# Progression, temps actif et découvertes

Référence technique de l'écran **Progression** et des données locales qui l'alimentent (ADR 0021).
Tout est calculé et conservé sur l'appareil ; rien n'est mesuré par le réseau.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `web/temps-actif.js` | Moteur unique du temps actif. Logique pure, horloge injectée (`maintenant`), testable sans navigateur. |
| `web/progression.js` | Schéma de progression (v2), migration, événements (`enregistrerNotion`, `enregistrerExperience`, `decouvrir`, `ajouterTemps`, `reclasser`…), badges. |
| `web/experiences.js` | Registre dérivé du catalogue : type d'une expérience, arbre Éducation, compteurs, progression par matière, expériences découvertes, durées. |
| `web/signal-activite.js` | Signal d'activité des pages ouvertes en bulle, injecté au service (`scripts/lib/idees.mjs`, `preparerPageServie`). |
| `web/app.js` | Branchement : interactions, visibilité, messages des iframes, enregistrement périodique, rendu des 5 destinations. |

## Temps actif

Règle : un instant compte si **la page est visible** (`document.hidden` faux) **et** qu'une interaction a eu lieu
depuis moins de `SEUIL_INACTIVITE_MS` (**60 s**). Interactions : `pointerdown`, `keydown`, `touchstart`, `wheel` sur
le tableau de bord, plus le signal `{ type: "kermiclab:activite" }` d'une page ouverte en bulle.

- Page cachée (onglet en arrière-plan, écran verrouillé) : le compte s'arrête ; il ne reprend qu'à la prochaine
  interaction réelle, même si la page redevient visible.
- Une seule source : chaque intervalle est ajouté une fois au total, puis attribué au **contexte** courant —
  section (destination affichée) et, si une bulle est ouverte, expérience (`"jeu:demineur"`, `"notion:pythagore"`).
  Les ventilations ne sont jamais additionnées au total : pas de double comptage.
- Relevé toutes les 15 s, à `visibilitychange` (page cachée) et à `pagehide` ; `ajouterTemps` ignore les relevés
  nuls, négatifs, non finis ou supérieurs à 24 h (horloge déréglée).
- Affichage : `2 h 14 min`, `5 min` ou « moins d'une minute » ; jamais de secondes. Une tuile n'apparaît qu'à partir
  d'une minute.

Le signal d'une page ne contient aucune donnée (ni touche, ni position, ni contenu), part au plus toutes les 10 s,
n'existe pas hors iframe et ne touche ni au réseau ni au stockage. Le parent ne l'accepte que de la fenêtre d'une
iframe `[data-module]` connue, d'origine opaque (même contrôle que les trophées).

## Découvertes génériques

`decouvertes[type][id] = { premiere: "AAAA-MM-JJ" | null, ouvertures: n }`, pour n'importe quel type :

| Type | Enregistré quand |
| --- | --- |
| `section` | une destination est affichée pour la première fois (sans XP) |
| `matiere` | un accordéon de matière est ouvert dans Éducation (sans XP) |
| `notion` | une notion est ouverte (bulle, chat) — XP de première ouverture, comme avant |
| `jeu` | un jeu est ouvert — même XP d'exploration la première fois ; ne compte pas comme une notion |

Le type d'une entrée du catalogue vient de sa catégorie (`sujet: jeux/<id>` → `jeu`, sinon `notion`) : un nouveau
jeu ou une nouvelle notion est pris en charge sans modifier le code. `derniere = { type, id }` alimente « Reprendre »,
affiché seulement si l'expérience existe encore au catalogue. Limites : 12 types, 500 identifiants par type.

## Schéma v2 et migration

Ajouts à la v1, sans rien retirer : `tempsActif { total, sections, experiences }` (ms), `jours[j].s` (ms, présent
seulement s'il est non nul), `decouvertes`, `derniere`. `notions[]` et `derniereNotion` restent la référence des
badges et de la synchronisation.

- **Aucune donnée** → état v2 vide.
- **v1 valide** → champs conservés ; chaque notion devient une découverte `{ premiere: null, ouvertures: 0 }`
  (« pas encore compté » : aucune date ni ouverture inventée) ; `derniere` reprend `derniereNotion`.
- **Champs manquants ou invalides** → valeurs par défaut, champ par champ (jamais NaN, null affiché ou undefined).
- **Jeu enregistré comme notion** (avant la séparation Éducation / Jeux) → `reclasser`, au chargement du catalogue :
  l'identifiant quitte `notions[]` pour `decouvertes.jeu` ; XP, badges et reprise sont conservés. Un identifiant
  inconnu du catalogue n'est pas touché.
- **Compte enfant** (ADR 0017) : la fusion distante ajoute les notions du serveur sans rien retirer ni inventer
  d'XP ; l'envoi se limite à `{ notions: { id: {} } }`. Temps et découvertes ne quittent jamais l'appareil.

## Écran Progression

Divulgation progressive : chaque bloc n'apparaît que s'il a quelque chose de réel à montrer.

1. **État vide** (aucune activité comptée, aucune XP, aucun module lancé) : un message et deux entrées.
2. **Vue d'ensemble** : temps actif, notions explorées, matières explorées (matières des notions explorées retrouvées
   au catalogue), jeux découverts, questions, jours de suite, badges — uniquement les valeurs non nulles.
3. **Progression par matière** : matières commencées, `explorées / publiées` (dénominateur = catalogue), sans
   pourcentage.
4. **Cette semaine** : temps actif, questions, notions, XP, jours actifs et graphique.
5. **Expériences découvertes** : Éducation › matières › notions ; Jeux › jeux, avec ouvertures (comptées depuis la
   v2), temps attribué et chiffres du module de trophées, seulement s'ils existent.
6. **Mes badges** : obtenus, les deux plus proches (« À portée »), modules réellement lancés. Voir
   `docs/gamification.md`.

## Maîtrise par notion (issue #185)

Calculée localement par `maitriseNotion(n, aujourdhui)` (`web/evenements.js`) à partir de l'agrégat du contrat
d'événements (ADR 0025), sans IA ni serveur, et affichée dans la carte de la notion de « Mes trophées ». Règles
déterministes, appliquées dans cet ordre :

| # | Condition | État |
|---|---|---|
| 1 | aucune activité enregistrée | non commencée |
| 2 | au moins une **validation** (tous les exercices réussis lors d'une visite : événement `termine`) et révision due | à revoir |
| 2 bis | au moins une validation, révision pas encore due | maîtrisée |
| 3 | au moins un exercice tenté (une réponse) | en cours |
| 4 | page ouverte seulement (un indice lu sans réponse ne compte pas) | découverte |

- **Révision due** : aujourd'hui ≥ dernière validation + intervalle. L'intervalle dépend du nombre de validations :
  7 jours après la première, 30 après la deuxième, 90 ensuite (`INTERVALLES_REVISION`).
- **Réviser** : refaire la page jusqu'à « tous les exercices réussis » un autre jour compte une nouvelle validation et
  repousse la révision suivante ; le même jour, une seule validation est comptée.
- Les réussites après indice restent un fait affiché à part : elles ne bloquent pas la maîtrise.
- Stockage : champs `validations` et `derniereValidation` (date du jour seulement) de chaque notion, sous la clé
  `kermiclab:evenements`, avec le même stockage et le même effacement que la progression. Un agrégat antérieur est relu
  sans perte : une notion déjà terminée compte une validation, datée de son dernier jour d'activité.
- Les révisions espacées des exercices (Leitner, issue #187) et la recommandation (issue #186) s'appuieront sur ces
  états.

## Recommandation (issue #186)

`recommander({ notions, maitrise, matiere })` (`web/recommandation.js`) propose **une** prochaine notion à l'accueil,
avec sa raison, à partir du catalogue (`prerequis`, `niveaux`, exposés par `/api/catalogue`) et de la maîtrise locale.
Fonction pure : mêmes données, même proposition. Règles, dans cet ordre :

1. **Révision due** : la notion « à revoir » dont la révision est la plus ancienne (puis par identifiant). Raison :
   « Ta révision de « … » est prévue depuis le … ». Bouton « Réviser ».
2. **Prérequis maîtrisés** : une notion pas encore acquise dont tous les prérequis (au moins un) sont maîtrisés ou à
   revoir. Départage : même matière que la dernière notion ouverte, puis niveau de début le plus jeune, puis ordre du
   catalogue. Raison : « Parce que tu maîtrises « … » et « … », tu es prêt pour cette notion. »
3. Sinon, aucune recommandation : l'accueil garde sa suggestion habituelle (même matière, notion pas encore ouverte).

Une recommandation passe avant « Reprendre » : l'accueil ne montre qu'une prochaine action. Les jeux ne sont jamais
proposés. Raisons traduites (fr, en) ; rien n'est envoyé au serveur.

## Révisions des exercices et défi express (issue #187)

Les exercices des notions réutilisent les boîtes de Leitner de l'Académie : **une seule source**,
`gabarit/jeux/progression.js` (ADR 0015), dont `planifierCarte` et `cartesDues` servent aux jeux comme au tableau de
bord. Le build en publie une copie en module ES (`dist/progression-jeux.js`) ; il n'existe pas de second moteur.

- **Carte d'un exercice** : à chaque réponse juste reçue par le contrat d'événements, la carte de l'exercice est
  planifiée. Réussi du premier coup → boîte suivante ; réussi après plusieurs essais → boîte 1. Intervalles du module
  partagé : 1, 2, 4, 8, 16 jours. Une réponse fausse ne crée ni ne modifie de carte. Stockage : champs `boite` et
  `prochaine` de l'exercice dans `kermiclab:evenements` (une carte invalide est écartée, les faits de l'exercice restent).
- **Défi express** : jusqu'à 3 révisions dues, les plus en retard d'abord, ouvrent le défi parmi ses 5 questions
  (étiquette « Révision · titre de la notion »). Seuls les QCM sont repris, lus dans `dist/contenus/<id>.json`
  (exercices `app-N` de l'onglet Application, étapes `defi-N` de la mise en situation). Une réponse juste fait avancer
  la carte, une réponse fausse la remet en boîte 1. Le reste du défi est inchangé (questions fixes ou générées).
- Les révisions de notion (7, 30, 90 jours, « à revoir ») restent au niveau de la notion ; les cartes de Leitner
  travaillent exercice par exercice.

## Changer d'appareil : export et import en fichier (issue #189)

Écran Progression, carte « Changer d'appareil », toujours visible (même sans progression, pour importer sur un appareil
neuf). Module pur `web/fichier-progression.js` ; rien n'est envoyé au serveur : le fichier reste chez l'utilisateur.

- **Format** : `{ "format": "kermiclab-progression", "v": 1, "cree": "AAAA-MM-JJ", "donnees": { … } }`, JSON indenté,
  fichier `kermiclab-progression-AAAA-MM-JJ.json`. Champs : `pseudo`, `progression`, `trophees`, `evenements` (activité,
  maîtrise et cartes de révision) et `cahiers`, soit les clés du stockage local de l'appareil.
- **Import** : le fichier est validé avant tout changement : taille (2 Mo au plus), JSON, format, version (une version
  plus récente est refusée avec un message clair), date, aucun champ inconnu. Chaque champ passe ensuite par la fonction
  de chargement de son module, qui écarte les entrées invalides. Un champ refusé fait refuser tout le fichier.
- **Remplacement complet** après confirmation (« Remplacer ma progression ») : champs du fichier écrits, champs absents
  effacés, puis la page se recharge. L'état en mémoire est abandonné juste avant, pour que l'enregistrement du temps actif
  au départ de la page ne réécrive pas l'ancienne progression.
- Ce fichier n'est pas la synchronisation du compte local (ADR 0024) : il contient aussi l'agrégat du contrat
  d'événements (ADR 0025), puisqu'il ne quitte jamais l'appareil sans l'action de l'utilisateur.

## Tests

- `tests/unit/temps-actif.test.mjs` : règles du moteur (horloge manuelle, déterministe).
- `tests/unit/progression-v2.test.mjs` : migration (aucune donnée, v1, v2, champs manquants), découvertes, temps,
  reclassement, synchronisation, badges.
- `tests/unit/experiences.test.mjs` : registre, arbre, compteurs et états vides (Éducation seule, Jeux seuls,
  plusieurs types).
- `tests/e2e/progression.test.mjs` : temps actif à horloge virtuelle, intégration du Démineur servi (signal réel),
  découvertes, migration dans le navigateur, accessibilité.
