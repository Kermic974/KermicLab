# Chantier : Espace Métiers, compléter le référentiel et alimenter le graphe

**Niveau actuel : 1 (format v2 livré, import ONISEP non commencé)**

Décisions : [ADR 0041](../decisions/0041-espace-metiers.md) (Espace Métiers) et
[ADR 0042](../decisions/0042-referentiel-metiers-onisep.md) (format v2, import ONISEP, proposé). Données :
`referentiel/metiers-v0.json`, forme décrite par `referentiel/metiers.schema.json`, cohérence vérifiée par
`verifierMetiers` (`web/metiers.js`) au build.

## État au 2026-11-24

Le build affiche la ligne « Couverture métiers » (`couvertureMetiers`, information non bloquante).

| Indicateur | Valeur |
|---|---|
| Métiers | 38 en 6 familles (santé 10, sciences 8, communication 6, numérique 5, commerce 5, artisanat 4) |
| Disciplines | 26 : 14 issues de la maquette V5, 12 « proposition » à relire |
| Associations métier → disciplines | 38 « v5 », aucune validée |
| Métiers rattachés à l'ONISEP / au ROME / avec niveau d'accès | 0 / 0 / 0 |
| Notions du référentiel reliées à un métier | 60 sur 477 (13 %) |

Notions reliées par matière :

| Matière | Reliées / total | Matière | Reliées / total |
|---|---|---|---|
| Mathématiques | 13 / 114 | EMC | 3 / 36 |
| Français | 3 / 58 | Philosophie | 1 / 19 |
| SVT | 6 / 51 | SES | 6 / 14 |
| Histoire | 2 / 50 | Technologie | 6 / 14 |
| Physique-chimie | 10 / 46 | Anglais | 0 / 14 |
| Géographie | 6 / 40 | Arts plastiques | 4 / 7 |
| Musique | 0 / 7 | EPS | 0 / 7 |

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
| 2 | Script d'import déterministe `scripts/importer-onisep.mjs` : instantané → candidats normalisés (slug, dédoublonnage, rattachement des 38 métiers existants à leur `MET.<n>`), rapport de couverture ; aucun appel réseau | À faire, après le lot 0 |
| 3 | Rattachement métier → disciplines → notions : règles (domaine, ROME → disciplines), nouvelles disciplines (langues, EPS, musique, mécanique, électricité…), préparation par IA (`claude-sonnet-5-5` via `llm.js`) marquée `proposition`, validation humaine (back-office ou PR) | À faire |
| 4 | Alimenter le graphe : couche « métiers » facultative dans `referentiel-graphe.json` (nœuds métier et discipline), indicateurs (notions les plus demandées, notions orphelines, métiers sans notion, plus court chemin notion → métier) dans le back-office | À faire |
| 5 | Passage à l'échelle de l'écran : anneaux regroupés par domaine (dépliables), filtre par niveau d'accès, recherche par synonymes, liste paginée comme chemin principal sur mobile ; tests e2e | À faire |
| 6 | Montée en charge par vagues : pilote d'environ 40 métiers ciblant les matières peu couvertes (mathématiques, français, langues, EPS) et les métiers accessibles en CAP ou bac pro ; puis un domaine ONISEP par PR. Cible : au moins 5 métiers par matière, 50 % des notions reliées | À faire |

Chaque lot : `npm run ci` vert, cette fiche et `docs/actions-manuelles.md` à jour, validation du CODEOWNER.

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
