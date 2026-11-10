# Projets de développement

Les chantiers de la [feuille de route](../web/feuille-de-route.html) ([en ligne](https://www.kermiclab.online/feuille-de-route.html))
sont suivis sur GitHub sous forme de **projets**. Chaque projet a :

- une **épique** (issue `[Projet] …`, label `epic`), qui reprend l'objectif, la condition de sortie et le point de contrôle humain de la phase ;
- des **sous-issues**, une par tâche de la phase, avec un critère d'acceptation ; la barre d'avancement de l'épique se calcule seule ;
- un label **`projet:<clé>`** et un label **`horizon:<…>`** (maintenant, ensuite, plus-tard, sous-condition).

La source unique du lien roadmap ↔ GitHub est [`.github/projets.json`](../.github/projets.json). Le test
`tests/unit/projets.test.mjs` vérifie que chaque projet a ses labels dans `.github/labels.json`, que son ancre existe dans la
roadmap et que la roadmap affiche le lien vers son épique.

## Ordre de priorité

La priorité découle des dépendances et des points de contrôle de la roadmap, pas d'un calendrier.

| Priorité | Projet | Roadmap | Épique | Horizon | Bloqué par |
|---|---|---|---|---|---|
| 1 | 0 · Socle fiable | [phase 0](../web/feuille-de-route.html#phase-0) | [#164](https://github.com/Kermic974/KermicLab/issues/164) | maintenant | protection de `main` (action manuelle) |
| 2 | 1 · Référentiel et contrat des labs | [phase 1](../web/feuille-de-route.html#phase-1) | [#165](https://github.com/Kermic974/KermicLab/issues/165) | maintenant | — (en parallèle du socle) |
| 3 | Catalogue, accueil et jeux | [Gantt](../web/feuille-de-route.html#planning) | [#172](https://github.com/Kermic974/KermicLab/issues/172) | maintenant (continu) | relectures du CODEOWNER |
| 4 | 2 · Parcours et cahier de vacances, sans compte | [phase 2](../web/feuille-de-route.html#phase-2) | [#166](https://github.com/Kermic974/KermicLab/issues/166) | ensuite | projets 0 et 1 |
| 5 | Piste parallèle · Cercle trigonométrique | [piste](../web/feuille-de-route.html#piste-cercle) | [#171](https://github.com/Kermic974/KermicLab/issues/171) | ensuite | — |
| 6 | 4 · Comptes et familles | [phase 4](../web/feuille-de-route.html#phase-4) | [#168](https://github.com/Kermic974/KermicLab/issues/168) | sous condition | validation juridique (la préparation, [#195](https://github.com/Kermic974/KermicLab/issues/195), démarre maintenant) |
| 7 | 3 · Tuteur borné | [phase 3](../web/feuille-de-route.html#phase-3) | [#167](https://github.com/Kermic974/KermicLab/issues/167) | sous condition | projet 1 (indices écrits), budget IA |
| 8 | 5 · Fabrique de contenus | [phase 5](../web/feuille-de-route.html#phase-5) | [#169](https://github.com/Kermic974/KermicLab/issues/169) | plus tard | qualité et contrat stables |
| 9 | 6 · Options conditionnelles | [phase 6](../web/feuille-de-route.html#phase-6) | [#170](https://github.com/Kermic974/KermicLab/issues/170) | sous condition | déclencheur mesuré (pas de sous-issue tant qu'il n'est pas atteint) |

Le projet 4 passe avant le projet 3 parce que sa préparation juridique est longue, ne dépend pas du code et doit
démarrer tôt ; le code des comptes, lui, attend la validation.

## Tâches à démarrer maintenant

- Socle : [#173](https://github.com/Kermic974/KermicLab/issues/173) protéger `main` · [#174](https://github.com/Kermic974/KermicLab/issues/174) tests navigateur obligatoires · [#176](https://github.com/Kermic974/KermicLab/issues/176) grille de relecture et statut « relue » · [#260](https://github.com/Kermic974/KermicLab/issues/260) audit SEO et indexation · [#261](https://github.com/Kermic974/KermicLab/issues/261) tests de fumée post-déploiement · [#263](https://github.com/Kermic974/KermicLab/issues/263) audit WCAG 2.2 AA.
- Référentiel : [#179](https://github.com/Kermic974/KermicLab/issues/179) champs de `fiche.md` · [#180](https://github.com/Kermic974/KermicLab/issues/180) graphe vérifié en CI · [#181](https://github.com/Kermic974/KermicLab/issues/181) contrat d'événements.
- Catalogue et jeux : [#207](https://github.com/Kermic974/KermicLab/issues/207) valider le poker.
- Tuteur : [#262](https://github.com/Kermic974/KermicLab/issues/262) jeu d'évaluation pédagogique IA (sous réserve du point de contrôle budget de #167).
- Familles : [#195](https://github.com/Kermic974/KermicLab/issues/195) préparation juridique (en parallèle).

## Règles de suivi

1. **Nouvelle tâche** : ouvrir une issue, lui mettre le label `projet:<clé>` et un label `horizon:…`, puis l'ajouter
   comme sous-issue de l'épique. Une tâche hors roadmap n'a pas de label `projet:` tant que la roadmap ne la mentionne pas.
2. **PR** : mettre « Closes #N » sur la sous-issue ; l'épique avance seule.
3. **Fin de projet** : fermer l'épique quand sa condition de sortie est vérifiée (pas seulement quand toutes les
   sous-issues sont fermées), et mettre à jour la phase dans la roadmap.
4. **Changement de roadmap** (nouvelle phase, ancre renommée, re-priorisation) : modifier `web/feuille-de-route.html`,
   `.github/projets.json`, ce tableau et `.github/labels.json` dans la même PR ; `npm test` vérifie la cohérence.
5. **Tableaux GitHub Projects** (facultatif, vue Kanban) : `scripts/configurer-projets.sh` crée un tableau par projet
   et y ajoute les issues de son label (action manuelle du propriétaire, voir `docs/actions-manuelles.md`).
