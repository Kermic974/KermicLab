# Chantier : Espace Métiers, compléter le référentiel et alimenter le graphe

**Niveau actuel : 4 (format v2, import, règles, graphe et vague pilote livrés ; en attente de l'instantané ONISEP)**

Décisions : [ADR 0041](../decisions/0041-espace-metiers.md) (Espace Métiers) et
[ADR 0042](../decisions/0042-referentiel-metiers-onisep.md) (format v2, import ONISEP, proposé). Données :
`referentiel/metiers-v0.json`, forme décrite par `referentiel/metiers.schema.json`, cohérence vérifiée par
`verifierMetiers` (`web/metiers.js`) au build.

## État au 2026-11-24 (après la vague pilote)

Le build affiche la ligne « Couverture métiers » (`couvertureMetiers`, information non bloquante).

| Indicateur | Valeur |
|---|---|
| Métiers | 79 en 9 familles : 38 de la maquette V5 (`v5`), 41 de la vague pilote (`proposition`) |
| Disciplines | 40 : 14 issues de la maquette V5, 26 « proposition » à relire |
| Métiers rattachés à l'ONISEP / au ROME / avec niveau d'accès | 0 / 0 / 40 |
| Notions du référentiel reliées à un métier | 114 sur 477 (au départ : 60) |

Notions reliées par matière :

| Matière | Reliées / total |
|---|---|
| Mathématiques | 16 / 114 |
| Français | 6 / 58 |
| SVT | 24 / 51 |
| Histoire | 5 / 50 |
| Physique-chimie | 20 / 46 |
| Géographie | 6 / 40 |
| EMC | 6 / 36 |
| Philosophie | 2 / 19 |
| SES | 6 / 14 |
| Technologie | 7 / 14 |
| Anglais | 4 / 14 |
| Arts plastiques | 5 / 7 |
| Musique | 4 / 7 |
| EPS | 3 / 7 |

## Source visée : l'ONISEP

L'ONISEP documente de l'ordre de 800 fiches métiers (`https://www.onisep.fr/recherche?context=metier`, chiffre à
confirmer) et publie le jeu ouvert « Idéo – Fiches métiers » (`opendata.onisep.fr`, data.gouv.fr). Champs attendus,
**à vérifier sur le fichier** : identifiant `MET.<n>`, libellés masculin et féminin, synonymes, codes ROME, domaines et
sous-domaines, centres d'intérêt, secteurs, niveau d'accès minimum, formations, lien vers la fiche. Le ROME 4.0 de
France Travail (open data) peut compléter les savoir-faire.

Règles :

- La licence doit être confirmée avant tout import (Licence Ouverte Etalab attendue). La source et la date de
  l'instantané sont citées dans les données publiées.
- Les textes descriptifs des fiches ne sont pas recopiés : les gestes métier sont des formulations courtes, propres à
  KermicLab.
- La CI n'appelle pas le réseau : l'import part d'un instantané daté, versionné dans le dépôt.
- Public mineur : seuls des contenus publics sur les métiers sont traités, aucune donnée personnelle ; l'onglet
  « Mon positionnement » reste exclu (ADR 0041 §6).

## Plan

| Lot | Contenu | Statut |
|---|---|---|
| 0 | Accès aux données : récupérer l'instantané Idéo, confirmer la licence, le déposer sous `referentiel/sources/onisep/` (daté) ; analyse chiffrée réelle (domaines, niveaux, centres d'intérêt) | À faire, action manuelle ([actions manuelles](../actions-manuelles.md#espace-métiers-chantier-métiers)) |
| 1 | **Format v2** : statut des associations métier → disciplines (`correspondance` : `v5` / `proposition` / `validee`, `validee` exige une date `relue` humaine), champs `onisep`, `rome`, `niveauAcces`, `domaines` ; schéma JSON `referentiel/metiers.schema.json` ; validation étendue ; indicateurs de couverture au build | Fait (ce lot) |
| 2 | Script d'import déterministe `npm run import:onisep -- <instantané>` (`scripts/importer-onisep.mjs`, `scripts/lib/onisep.mjs`) : CSV (`;` ou `,`) ou JSON, colonnes reconnues par alias, candidats normalisés (slug, ROME, niveau), rattachement des métiers existants par identifiant ou intitulé, `--appliquer` complète `onisep`, `rome`, `niveauAcces`, `domaines` sans écraser, rapport (`--json`) ; aucun appel réseau | Fait, testé sur une fixture fictive (`tests/unit/onisep.test.mjs`) ; à lancer sur l'instantané réel |
| 3 | Rattachement métier → disciplines → notions : règles ROME → disciplines (`referentiel/regles-metiers.json`, préfixe le plus long, trois disciplines au plus), appliquées aux candidats de l'import (`disciplinesProposees`) ; 14 nouvelles disciplines (langues vivantes, sciences du sport, musique, mécanique, électricité, nutrition, expression écrite, calcul professionnel, droit, histoire de l'art, agronomie, physiologie, chimie analytique, géologie). Les propositions sont préparées par un agent dans la PR (aucun appel de modèle à l'exécution) et restent en `proposition` jusqu'à la relecture humaine | Fait (règles et disciplines à relire) |
| 4 | Alimenter le graphe : couche « métiers » dans `dist/referentiel-graphe.json` (nœuds `metier.<id>`, reliés aux notions de leurs disciplines, libellés publiés), indicateurs (`metiers`, `notionsAvecMetier`, « notions sans métier » par discipline, `notionsDemandees`), plus court chemin notion ↔ métier ; back-office : case « Métiers » (masquée par défaut), légende, détails d'un métier, tuiles, classement des notions les plus demandées | Fait (`tests/unit/graphe-referentiel.test.mjs`, `tests/e2e/backoffice.test.mjs`) |
| 5 | Passage à l'échelle de l'écran : anneaux regroupés par domaine (dépliables), filtre par niveau d'accès, recherche par synonymes, liste paginée comme chemin principal sur mobile ; tests e2e | À faire |
| 6 | Montée en charge par vagues. **Pilote livré** : 41 métiers (CAP à bac+5, BTP, alimentation, droit, sport, musique, langues, agriculture) et 3 familles (Bâtiment, industrie et transport ; Services, droit, sport et tourisme ; Agriculture et nature), sans code ROME (l'import ONISEP l'apporte, les écarts de niveau sont signalés en conflits). Vagues suivantes : un domaine ONISEP par PR à partir des candidats de l'import. Cible : au moins 5 métiers par matière, 50 % des notions reliées | Pilote fait ; vagues ONISEP après le lot 0 |

Chaque lot : `npm run ci` vert, cette fiche et `docs/actions-manuelles.md` à jour, validation du CODEOWNER.

## Importer un instantané ONISEP

1. Déposer le fichier sous `referentiel/sources/onisep/` (nom daté, voir le README du dossier).
2. `npm run import:onisep -- referentiel/sources/onisep/<fichier>` : rapport et `candidats.json` à côté de l'instantané.
   Si les colonnes indispensables ne sont pas reconnues, ajouter l'alias dans `COLONNES` (`scripts/lib/onisep.mjs`).
3. Relire les rattachements du rapport, puis relancer avec `--appliquer`.
4. Les candidats alimentent les vagues du lot 6 : un métier n'entre dans le référentiel qu'avec ses disciplines et
   ses gestes, en `correspondance: "proposition"`.

## Format v2 en bref

```json
{
  "id": "geometre-topographe",
  "nom": "Géomètre-topographe",
  "categorie": "disc",
  "disciplines": ["geometrie", "geographie"],
  "gestes": ["Relevé de terrain", "Calcul de surfaces"],
  "contexte": "…",
  "correspondance": "proposition",
  "onisep": "MET.123",
  "rome": ["F1107"],
  "niveauAcces": "bac+2",
  "domaines": ["Construction"]
}
```

Les champs `onisep`, `rome`, `niveauAcces`, `domaines` et `relue` sont facultatifs. `relue` n'est renseigné que par
un humain, comme dans les fiches du catalogue. L'exemple illustre la forme : ses identifiants ne sont pas réels.
