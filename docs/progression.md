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

## Tests

- `tests/unit/temps-actif.test.mjs` : règles du moteur (horloge manuelle, déterministe).
- `tests/unit/progression-v2.test.mjs` : migration (aucune donnée, v1, v2, champs manquants), découvertes, temps,
  reclassement, synchronisation, badges.
- `tests/unit/experiences.test.mjs` : registre, arbre, compteurs et états vides (Éducation seule, Jeux seuls,
  plusieurs types).
- `tests/e2e/progression.test.mjs` : temps actif à horloge virtuelle, intégration du Démineur servi (signal réel),
  découvertes, migration dans le navigateur, accessibilité.
