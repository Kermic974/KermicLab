# ADR 0040 — Graphe du référentiel dans le back-office

- Date : 2026-11-23 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : une maquette « Graphe universel V7.3 3D » montre le référentiel (notions, MicroSkills, prérequis) en 3D,
  avec filtres, isolement d'un voisinage et plus court chemin. Elle charge three.js et 3d-force-graph depuis unpkg et
  lit `projection-v0.json` sur raw.githubusercontent.com. Le propriétaire demande d'en faire un module du back-office.

## Décision

1. **Nouvel écran « Graphe du référentiel »** (`#graphe`) du back-office : tuiles (notions, MicroSkills, prérequis,
   MicroSkills transdisciplinaires), exploration 3D, tableau par discipline (notions sans prérequis, sans MicroSkill).
   Fonctions de la maquette reprises : filtre par discipline, recherche (avec voisins directs), MicroSkills et
   prérequis affichables ou non, « transdisciplinaires seules », légende cliquable, rotation, détails d'un nœud,
   isoler le voisinage, plus court chemin. Ajouts : voisins classés (prérequis, ouvre vers, MicroSkills) et cliquables,
   résultats de recherche cliquables (accès au clavier), flèches du clavier et +/− sur le canvas.
2. **Aucune dépendance ajoutée.** La CSP du site n'autorise que les scripts de même origine (`script-src 'self'`) et le
   projet limite les dépendances (AGENTS.md §4). Le rendu est un `<canvas>` 2D avec projection en perspective
   (`web/admin/graphe-vue.js`, ~200 lignes) au lieu de three.js + 3d-force-graph (~1,3 Mo).
3. **Disposition calculée au build**, pas dans le navigateur : `npm run build` construit le graphe à partir de
   `referentiel/projection-v0.json` et calcule une disposition 3D par forces, déterministe (graine fixe), écrite dans
   `dist/admin/referentiel-graphe.json` (~220 Ko, forme compacte). Le navigateur ne fait que tourner, filtrer et
   dessiner. Les fonctions sont pures et partagées (`web/admin/graphe-referentiel.js`).
4. **Données** : uniquement le référentiel, déjà public dans le dépôt ; aucune donnée personnelle, aucun appel à l'API.
   Le fichier est servi sous `/admin/` (non indexé), comme le reste du back-office.

## Conséquences

- Une MicroSkill est « transdisciplinaire » quand des notions d'au moins deux disciplines la mobilisent. Dans la
  projection actuelle, **aucune** ne l'est (chaque identifiant `microskill.<discipline>.…` n'est rattaché qu'à sa
  discipline) : l'écran l'indique par un bandeau. Mutualiser des MicroSkills entre disciplines relève du chantier
  référentiel.
- Le rendu canvas 2D est moins riche qu'un moteur WebGL (pas d'éclairage ni de particules) mais tient sans
  ralentissement les ~2 500 nœuds et ~2 650 relations actuels.
- Preuves : `tests/unit/graphe-referentiel.test.mjs`, `tests/e2e/backoffice.test.mjs` (écran sous la CSP du site).
