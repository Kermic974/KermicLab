# Chantier : Validation des maquettes

**Niveau actuel : 1 (relecture humaine tracée dans chaque fiche)**

Processus (voir AGENTS.md §6) : issue `maquette-manquante` → branche → maquette candidate (agent, Sonnet 5.5) → `npm run ci` (routage des questions d'exemple, contrôle de sécurité des pages, contrat navigateur de chaque page servie : onglets au clavier, CSP sans violation, rendu mobile) → PR → revue IA → **validation du CODEOWNER** → fusion → déploiement.

Fait : contrat navigateur générique de chaque page servie, catalogue privé compris (`tests/e2e/contrat-pages.test.mjs`, #174).

Prochaines étapes :
- Relire d'abord les 20 notions les plus servies (requête « Maquettes les plus servies » de [`kpi.md`](kpi.md)), avec la grille ci-dessous.
- Intégrer la grille à la revue des PR de notions (feuille de route, phase 5).

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

## Catalogue de géographie : mondialisation

Les huit notions publiques ajoutées le 2026-11-01 suivent le gabarit commun, avec niveaux collège → lycée,
exercices corrigés et références dans leurs fiches. Les tests vérifient le routage, les repères sensibles,
les calculs, les indices après erreur et le rendu mobile ; ils ne remplacent pas la relecture géographique humaine.
La validation pédagogique du CODEOWNER reste à faire : voir l'action 25 dans [les actions manuelles](../actions-manuelles.md).
