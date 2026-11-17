# Lab pilote « Le système solaire »

Statut éditorial : `publié` (version 1.0.0, 17 novembre 2026), à l’adresse `/labs/systeme-solaire/` et depuis la carte « Le système solaire » de la section Labs. Source : [prototype HTML au commit 32adf01](https://github.com/Kermic974/KermicLab/blob/32adf01ee72076d552752bb0bd723fb1e260dbf4/Sample/lab/systeme-solaire.html). Contrat de travail : [S6.5](https://app.notion.com/p/41a0c40cec288101aaa2e727f1843fd7).

- Objectif : reconnaître les huit planètes, les ordonner à partir du Soleil et expliquer le jour, la nuit et les saisons à l’aide du modèle.
- Une mission, « Observatoire », utilise le modèle interactif, le cours et un quiz de cinq questions. Les échelles du modèle sont illustratives.
- Critères de réussite proposés : ordonner les planètes, relier l’alternance jour/nuit à la rotation de la Terre et relier les saisons à l’inclinaison de son axe.
- Cibles canoniques à résoudre avant validation : système solaire, rotation terrestre et saisons. Ces libellés sont des candidats, pas des identifiants.
- Vérifié avant publication : périodes de révolution (88 j à 165 ans), rotation terrestre (environ 24 h), révolution lunaire (environ 27 j), inclinaisons de la Terre (23,4°), de Saturne (26,7°) et d’Uranus (98°), temps de trajet de la lumière (environ 8 min) et réponses du quiz. Navigation au clavier des onglets, parcours textuel sans WebGL, aucune requête réseau. Le résultat du quiz est calculé en mémoire pour la visite.
- Reste à faire : relecture par une personne compétente en sciences (grille de `docs/chantiers/validation-maquettes.md`), puis traduction anglaise ; la page est servie en français dans toutes les langues en attendant.

## Publication

`npm run build` copie la page dans `dist/labs/systeme-solaire/index.html` (liste `LABS_PUBLIES` de `scripts/build.mjs`), avec ses hashes CSP recalculés. La page porte sa propre CSP en meta : la CSP globale du site est retirée pour `/labs/*` dans `dist/_headers`, comme pour `/cercle/*`. `npm run check:pages` contrôle la page comme celles du catalogue. On peut aussi ouvrir `systeme-solaire.html` directement pour une revue hors ligne.
