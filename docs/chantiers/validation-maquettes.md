# Chantier : Validation des maquettes

**Niveau actuel : 1 (relecture humaine tracée dans chaque fiche)**

Processus (voir AGENTS.md §6) : issue `maquette-manquante` → branche → maquette candidate (agent, Sonnet 5.5) → `npm run ci` (routage des questions d'exemple, contrôle de sécurité des pages, contrat navigateur de chaque page servie : onglets au clavier, CSP sans violation, rendu mobile) → PR → revue IA → **validation du CODEOWNER** → fusion → déploiement.

Fait : contrat navigateur générique de chaque page servie, catalogue privé compris (`tests/e2e/contrat-pages.test.mjs`, #174).

Fait : grille intégrée à la revue des PR de notion ([issue #202](https://github.com/Kermic974/KermicLab/issues/202)). Le modèle de PR porte la section « Relecture pédagogique » (les 6 critères de la grille v1, plus l'ouverture de l'aperçu Cloudflare Pages, sur téléphone et ordinateur). Le contrôle « Grille de relecture » (`.github/workflows/relecture-pr.yml`, `scripts/verifier-grille-pr.mjs`) échoue tant qu'une case reste vide, **seulement** si la PR change une notion : `contenu.json` modifié, nouvelle notion ou version de fiche augmentée. Une PR qui ne fait que régénérer des pages (moteur, CSP) n'est pas concernée. Il est relancé quand le corps de la PR est modifié : le relecteur coche les cases, le contrôle passe au vert.

Prochaines étapes :
- Relire d'abord les 20 notions les plus servies (requête « Maquettes les plus servies » de [`kpi.md`](kpi.md)), avec la grille ci-dessous.


## Grille de relecture v1

Relecture humaine d'une notion, faite **par un adulte**, page ouverte sur téléphone et sur ordinateur. Une notion est
« relue » quand chaque critère est satisfait ; sinon, corriger d'abord (nouvelle version de la notion), puis relire.

| # | Critère | Ce qu'on vérifie |
|---|---|---|
| 1 | Exactitude | Définitions, propriétés, formules, dates et chiffres justes ; exemples et corrigés sans erreur ; pas de simplification qui devienne fausse |
| 2 | Progression | Niveaux du plus intuitif au plus formel, cohérents avec `niveaux` de la fiche et avec les programmes (collège → lycée) ; chaque niveau s'appuie sur le précédent |
| 3 | Adaptation à l'âge | Vocabulaire expliqué, phrases courtes, exemples parlants ; aucun contenu choquant, anxiogène ou inadapté à un mineur |
| 4 | Exercices | Énoncés sans ambiguïté, une seule bonne réponse, indices utiles sans donner la réponse, explications qui corrigent l'erreur fréquente |
| 5 | Neutralité et sources | Faits distingués des opinions, sujets sensibles présentés de façon équilibrée, sources fiables citées dans la fiche quand c'est utile |
| 6 | Données personnelles | Aucune question à l'élève sur sa vie, son identité ou sa famille ; aucun lien externe |

**Tracer la relecture** dans le front matter de `fiche.md` (les trois champs vont ensemble, vérifiés par `npm run build`) :

```yaml
relue: 2026-11-07        # date de la relecture (AAAA-MM-JJ, pas dans le futur)
relue-version: 1.0.0     # version de la notion relue (au plus `version`)
relue-grille: v1         # grille utilisée
```

Aucun nom de relecteur n'est stocké dans le dépôt : la PR de relecture et sa validation par le CODEOWNER tracent qui a relu.
Quand une notion change de `version` sans nouvelle relecture, elle compte « à revoir ». Le build affiche l'indicateur de
la feuille de route : « Relecture : N notion(s) relue(s) sur M, K à revoir ». Une nouvelle grille (`v2`) s'ajoute dans
`GRILLES_RELECTURE` (`scripts/lib/catalogue.mjs`) et dans cette page ; les relectures `v1` restent valides.

## Grille de relecture jeux-v1

Relecture humaine d'un jeu intégré ([issue #175](https://github.com/Kermic974/KermicLab/issues/175)), par un adulte,
en jouant au moins une partie sur téléphone et une sur ordinateur. Suivi par jeu : [`docs/jeux.md`](../jeux.md#4-relecture-des-jeux-intégrés).

| # | Critère | Ce qu'on vérifie |
|---|---|---|
| 1 | Règles | L'onglet « explication » décrit les règles réellement appliquées par le moteur, sans erreur ni oubli important |
| 2 | Académie et conseils | Leçons justes, progression du débutant au pro, conseils qui ne trompent pas le joueur ; exercices à une seule bonne réponse |
| 3 | Commandes | Souris, tactile et clavier ; chaque action au clic droit ou à l'appui long a un bouton ; focus visible |
| 4 | Lisibilité | Aucun état indiqué par la seule couleur ; textes lisibles sur téléphone, sans défilement horizontal de la page |
| 5 | Adaptation à l'âge | Vocabulaire et contenus adaptés à un mineur ; jeux d'argent : jetons fictifs, aucune incitation à miser de l'argent réel |
| 6 | Données personnelles | Records et préférences sur l'appareil seulement ; aucune question personnelle, aucun lien externe |

Tracer : `relue`, `relue-version`, `relue-grille: jeux-v1` dans `fiche.md` (la grille `v1` est refusée pour un jeu, et
`jeux-v1` pour une notion).

## Premier lot de notions à relire (issue #176)

Liste tirée des KPI D1 le 2026-11-07 (requête « Maquettes les plus servies », jeux exclus). Les 15 premières sont
servies au moins deux fois ; au-delà, toutes les notions sont à égalité (servies une fois) : les 5 dernières sont
départagées en faveur des mathématiques, qui alimentent le référentiel et les parcours de la phase 2. Les volumes sont
encore faibles : refaire la requête avant le lot suivant.

| # | Notion | Servie | Relue |
|---|---|---|---|
| 1 | `trigo-cercle` | 17 | à relire |
| 2 | `puissances` | 10 | à relire |
| 3 | `thales` | 6 | à relire |
| 4 | `proportionnalite` | 5 | à relire |
| 5 | `statistiques` | 4 | à relire |
| 6 | `produit-scalaire` | 4 | à relire |
| 7 | `gravitation-et-satellites` | 4 | à relire |
| 8 | `fractions` | 4 | à relire |
| 9 | `pythagore` | 3 | à relire |
| 10 | `probabilites-conditionnelles` | 3 | à relire |
| 11 | `equations` | 3 | à relire |
| 12 | `meiose-et-brassage-genetique` | 2 | à relire |
| 13 | `evolution` | 2 | à relire |
| 14 | `calcul-litteral` | 2 | à relire |
| 15 | `accords` | 2 | à relire |
| 16 | `angles` | 1 | à relire |
| 17 | `arithmetique` | 1 | à relire |
| 18 | `vecteurs` | 1 | à relire |
| 19 | `volumes` | 1 | à relire |
| 20 | `transformations` | 1 | à relire |

Une PR par lot de notions relues ; la colonne « Relue » reçoit la date, et `fiche.md` les trois champs `relue`.

## Catalogue de géographie : mondialisation

Les huit notions publiques ajoutées le 2026-11-01 suivent le gabarit commun, avec niveaux collège → lycée,
exercices corrigés et références dans leurs fiches. Les tests vérifient le routage, les repères sensibles,
les calculs, les indices après erreur et le rendu mobile ; ils ne remplacent pas la relecture géographique humaine.
La validation pédagogique du CODEOWNER reste à faire : voir l'action 25 dans [les actions manuelles](../actions-manuelles.md).
