# ADR 0041 — Espace Métiers : des notions KermicLab aux gestes professionnels

- Date : 2026-11-23 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : la maquette « Des disciplines aux gestes professionnels » (KermicLab V5) relie 38 métiers à des disciplines
  académiques, à leurs savoir-faire et à des gestes métier, avec une table de correspondance vers les notions du
  référentiel. Le propriétaire demande d'en faire un nouvel espace du site, croisé avec le graphe des notions
  (ADR 0040).

## Décision

1. **Nouvel espace « Métiers »** (`#metiers`), sixième destination de la navigation (barre latérale et barre du bas),
   avec sa couleur d'espace. Configurable comme les autres entrées (`navigation` de `web/config.json`).
2. **Quatre anneaux reliés** : notions KermicLab (centre) → disciplines académiques → métiers → gestes métier. Choisir un
   élément (métier, discipline, notion ou geste) allume toute la chaîne qui le relie, dans les deux sens. Filtres par
   famille de métiers et recherche (jusqu'aux titres des notions). La liste des métiers donne l'accès au clavier.
3. **Détail croisé avec le référentiel** : disciplines, gestes, savoir-faire des disciplines, **notions KermicLab** à
   travailler (ouvrables dans la bulle, comme dans Éducation, avec leur nombre de MicroSkills) et **graphe 3D des
   notions** : ces notions, leurs prérequis directs et leurs MicroSkills, avec une disposition propre au sous-graphe
   (`sousGraphe` de `web/graphe-referentiel.js`, rendu de `web/graphe-vue.js`, partagés avec le back-office).
4. **Données** : `referentiel/metiers-v0.json` (6 familles, 26 disciplines, 38 métiers), extrait de la maquette V5. Le
   build le valide contre `referentiel/projection-v0.json` (échec si une notion est inconnue) et publie
   `dist/metiers.json`, enrichi des titres du catalogue et des **MicroSkills réelles** de chaque notion.
   - Les 46 notions de la table V5 existent ; 37 de ses 48 identifiants de MicroSkills (`…-action-1`) avaient disparu
     avec la densification du référentiel : ils sont remplacés par les MicroSkills de la projection.
   - 12 disciplines sans correspondance dans la V5 (Informatique, Réseaux, Arts plastiques, Design produit…) reçoivent
     une correspondance marquée `"correspondance": "proposition"`, signalée à l'écran (« en cours de relecture »).
5. **Pas de dépendance** : SVG et canvas faits main (CSP `script-src 'self'`). Les modules et les données chargés par
   `app.js` reçoivent l'empreinte de leur contenu (`?v=`), comme les autres ressources du site.
6. **Exclu** : l'onglet « Mon positionnement » de la maquette décrit un profil personnel ; il n'a pas sa place sur un
   site public destiné à des mineurs et n'est pas repris.

## Conséquences

- Les noms de métiers, gestes et savoir-faire sont en français seulement (contenu, comme le catalogue) ; l'interface
  est traduite (`web/i18n`).
- Les correspondances « proposition » et les associations métier ↔ discipline de la V5 sont à relire avant de quitter
  le statut proposé.
- Sur téléphone, les étiquettes des anneaux sont petites : la liste des métiers et le détail restent le chemin
  principal.
- Preuves : `tests/unit/metiers.test.mjs`, `tests/unit/graphe-referentiel.test.mjs`, `tests/e2e/metiers.test.mjs`
  (écran sous la CSP du site, ordinateur et mobile).
