# Chantier : Espace Métiers, compléter le référentiel et alimenter le graphe

**Niveau actuel : 7 (lots 0 à 5, vague pilote et ROME 4.0 livrés ; marché du travail, BMO et vagues de nouveaux métiers à venir)**

Décisions : [ADR 0041](../decisions/0041-espace-metiers.md) (Espace Métiers),
[ADR 0042](../decisions/0042-referentiel-metiers-onisep.md) (format v2, import ONISEP, proposé) et
[ADR 0043](../decisions/0043-donnees-france-travail-metiers.md) (données de France Travail, proposé). Données :
`referentiel/metiers-v0.json`, forme décrite par `referentiel/metiers.schema.json`, cohérence vérifiée par
`verifierMetiers` (`web/metiers.js`) au build.

## État au 2026-11-24 (après la vague pilote et l'import ONISEP)

Le build affiche la ligne « Couverture métiers » (`couvertureMetiers`, information non bloquante).

| Indicateur | Valeur |
|---|---|
| Métiers | 79 en 9 familles : 38 de la maquette V5 (`v5`), 41 de la vague pilote (`proposition`) |
| Disciplines | 40 : 14 issues de la maquette V5, 26 « proposition » à relire |
| Métiers rattachés à l'ONISEP / au ROME / avec niveau d'accès | 74 / 79 / 76 (sur 79) |
| Métiers avec contextes de travail / transition / métiers proches (ROME 4.0) | 79 / 39 / 48 (sur 79) |
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

## Source : l'ONISEP (analyse du 2026-11-24)

Le moteur `https://www.onisep.fr/recherche?context=metier` s'appuie sur le référentiel métiers de l'ONISEP, publié en
données ouvertes sur data.gouv.fr (organisation ONISEP, 59 jeux ; `opendata.onisep.fr` était en maintenance et y
renvoie). **Licence : ODbL 1.0** (Open Database License), et non la Licence Ouverte Etalab supposée au départ.

| Jeu | Contenu | Format | Volume |
|---|---|---|---|
| [Idéo-Fiches métiers](https://www.data.gouv.fr/datasets/ideo-fiches-metiers) | Une fiche par métier : identifiant `MET.<n>`, intitulé (écriture inclusive « boulanger/ère »), formes masculine et féminine, synonymes, codes ROME (v3), niveau d'accès minimum, statuts, secteurs, centres d'intérêt (refondus en octobre 2026), métiers associés, textes descriptifs (compétences, nature du travail, accès, salaire) | XML (zip) | 1 138 métiers ; 931 avec code ROME, 734 avec synonymes |
| [Idéo-Métiers Onisep](https://www.data.gouv.fr/datasets/ideo-metiers-onisep) | Une ligne par métier et par publication : intitulé, lien de la fiche (`…/slug/MET.<n>`), publication, GFE, code ROME, domaines/sous-domaines séparés par « \| » | CSV `;`, JSON, XML | 1 560 lignes |
| [Nomenclature domaines et sous-domaines](https://www.data.gouv.fr/datasets/ideo-nomenclature-onisep-domaines-et-sous-domaines) | 132 couples domaine / sous-domaine | CSV, JSON | 132 lignes |

Niveaux d'accès minimum des 1 138 fiches : bac + 5 (332), CAP (207), bac + 2 (176), bac (158), bac + 3 (158),
bac + 8 (22), sans diplôme ou 3e (22), bac + 9 et plus (16), bac + 4 (12), bac + 7 (12), bac + 6 (7), bac + 1 (6),
autre (10). Domaines les plus fournis : santé-social-sport (121), arts-culture-artisanat (111),
environnement-énergies (90), industries (86), sciences (79), armée-sécurité (74), mécanique (70).

Règles :

- **ODbL** : l'attribution « Onisep, Idéo-Fiches métiers / Idéo-Métiers Onisep, licence ODbL » figure dans les données
  (`sources` de `metiers-v0.json`, extrait) et sous l'écran Métiers ; une base dérivée publiée doit rester sous ODbL
  (partage à l'identique) : décision du propriétaire à confirmer (actions manuelles).
- Les textes descriptifs des fiches ne sont pas repris : seuls identifiants et classifications entrent dans l'extrait ;
  les gestes métier sont des formulations courtes propres à KermicLab.
- La CI n'appelle pas le réseau : l'import part de l'extrait daté versionné
  (`referentiel/sources/onisep/ideo-metiers-2026-11-24.json`, 1 138 fiches, champs utilisés seulement).
- Public mineur : seuls des contenus publics sur les métiers sont traités, aucune donnée personnelle ; l'onglet
  « Mon positionnement » reste exclu (ADR 0041 §6).

## Source : France Travail (analyse du 2026-11-24, ADR 0043)

Le catalogue `francetravail.io` est inaccessible depuis l'environnement cloud ; les fiches des API sont lues sur
data.gouv.fr (organisation France Travail). Toutes les données utiles sont indexées par **code ROME**, déjà présent dans
le référentiel.

| Source | Apport | Accès | Lot |
|---|---|---|---|
| ROME 4.0, « Toutes les données du ROME » (JSON) | Contextes de travail (horaires, lieux, conditions, statuts), transitions écologique et numérique, mobilités, compétences, savoirs ; 1 923 fiches (version 62, 2026-10-19) | Libre, Licence Ouverte 2.0 (`api.francetravail.fr`) | 7, fait |
| API Marché du travail | Tension de recrutement, offres, embauches, demandeurs d'emploi, salaire proposé, dynamique ; par ROME et territoire, trimestriel (France Travail, ACOSS, CCMSA, DARES) | Compte francetravail.io (OAuth2) | 8 |
| Enquête BMO (2016 à 2026) | Projets de recrutement, part difficile, part saisonnière, par bassin d'emploi | Libre, Licence Ouverte (`www.francetravail.org`) ; codée en FAP 2021 | 9 |
| Nomenclature FAP 2021 (DARES) | Libellés des 341 FAP ; **sans** passage vers le ROME | Libre (`data.dares.travail-emploi.gouv.fr`) | 9 |
| Sortants de formation, La Bonne Boîte, Offres d'emploi | Hors périmètre élève (adultes, entreprises nommées, offres) | — | non retenues |

## Plan

| Lot | Contenu | Statut |
|---|---|---|
| 0 | Accès aux données et analyse : jeux ONISEP sur data.gouv.fr (licence ODbL), formats réels, extrait daté `referentiel/sources/onisep/ideo-metiers-2026-11-24.json` (XML Idéo-Fiches métiers complété par le CSV Idéo-Métiers Onisep) ; 74 des 79 métiers rattachés (53 par l'intitulé, 21 par une correspondance choisie par l'agent), niveaux, codes ROME, domaines et synonymes appliqués | Fait ; acceptation de l'ODbL à confirmer ([actions manuelles](../actions-manuelles.md#espace-métiers-chantier-métiers)) |
| 1 | **Format v2** : statut des associations métier → disciplines (`correspondance` : `v5` / `proposition` / `validee`, `validee` exige une date `relue` humaine), champs `onisep`, `rome`, `niveauAcces`, `domaines` ; schéma JSON `referentiel/metiers.schema.json` ; validation étendue ; indicateurs de couverture au build | Fait (ce lot) |
| 2 | Import déterministe `npm run import:onisep` (`scripts/importer-onisep.mjs`, `scripts/lib/onisep.mjs`) : XML Idéo, CSV (identifiant lu dans le lien, lignes par publication fusionnées), extrait compact ; rapprochement en trois passes (identifiant, intitulé, synonyme ou forme masculine / féminine), un rattachement par métier ; candidats au slug unique ; `--appliquer` complète sans écraser, `--remplacer-propositions` laisse l'ONISEP corriger les fiches en `proposition`, conflits signalés ; aucun appel réseau | Fait (`tests/unit/onisep.test.mjs`, fixtures de même structure que les jeux réels) |
| 3 | Rattachement métier → disciplines → notions : règles ROME → disciplines (`referentiel/regles-metiers.json`, préfixe le plus long, trois disciplines au plus), appliquées aux candidats de l'import (`disciplinesProposees`) ; 14 nouvelles disciplines (langues vivantes, sciences du sport, musique, mécanique, électricité, nutrition, expression écrite, calcul professionnel, droit, histoire de l'art, agronomie, physiologie, chimie analytique, géologie). Les propositions sont préparées par un agent dans la PR (aucun appel de modèle à l'exécution) et restent en `proposition` jusqu'à la relecture humaine | Fait (règles et disciplines à relire) |
| 4 | Alimenter le graphe : couche « métiers » dans `dist/referentiel-graphe.json` (nœuds `metier.<id>`, reliés aux notions de leurs disciplines, libellés publiés), indicateurs (`metiers`, `notionsAvecMetier`, « notions sans métier » par discipline, `notionsDemandees`), plus court chemin notion ↔ métier ; back-office : case « Métiers » (masquée par défaut), légende, détails d'un métier, tuiles, classement des notions les plus demandées | Fait (`tests/unit/graphe-referentiel.test.mjs`, `tests/e2e/backoffice.test.mjs`) |
| 5 | Passage à l'échelle de l'écran : filtre par niveau d'accès (niveaux présents seulement), recherche étendue aux synonymes, domaines et codes ROME (synonymes repris de l'ONISEP), anneaux limités aux métiers du filtre au-delà de 120 métiers (`metiersDesAnneaux`, disposition recalculée), liste par pages de 50 (« Afficher plus »), niveau d'accès et statut « Fiche proposée, en cours de relecture » dans le détail | Fait (`tests/unit/metiers.test.mjs`, `tests/e2e/metiers.test.mjs`) |
| 6 | Montée en charge par vagues. **Pilote livré** : 41 métiers et 3 familles en `proposition`, corrigés par l'ONISEP (niveaux, codes ROME). **Vagues suivantes** : 1 064 candidats de l'import, avec disciplines proposées par les règles ROME ; un domaine ONISEP par PR, chaque métier avec ses gestes (formulés par KermicLab) et sa relecture. Cible : au moins 5 métiers par matière, 50 % des notions reliées | Pilote fait ; vagues à planifier (une PR par domaine) |

| 7 | **ROME 4.0** : `npm run import:rome` (`scripts/importer-rome.mjs`, `scripts/lib/rome.mjs`), extrait `referentiel/sources/france-travail/rome-4.0-v62.json` ; champs dérivés `contextes` (dictionnaire `contextesTravail`), `transitions`, `proches` ; `--preciser` (codes v3 → fiche ROME 4.0 de même intitulé, 13 métiers) ; 7 codes ROME choisis par l'agent pour les métiers sans code (`designer-ux-ui` E1206, `charge-daffaires` D1407, `eco-concepteur` H1206, `journaliste-scientifique` E1106, `mediateur-scientifique` G1242, `technicien-reseaux` M1816, `conseiller-bancaire` C1206) ; détail d'un métier : transitions, conditions de travail, métiers proches ; `--candidats` complète les candidats des vagues par compétences et savoirs | Fait (`tests/unit/rome.test.mjs`) ; codes choisis par l'agent à relire |
| 8 | **Marché du travail** : script `import:marche` (identifiants francetravail.io hors du dépôt), extrait trimestriel `referentiel/sources/france-travail/marche-AAAA-TN.json` réduit aux codes ROME du référentiel ; champ `perspectives` (palier « recrute beaucoup / moyennement / peu » tiré de l'indicateur de tension, période, portée France puis région, source) ; bloc « Perspectives » dans le détail, phrase de prudence, filtre éventuel « métiers qui recrutent » | À faire après les actions manuelles (compte, conditions d'utilisation, hôtes réseau) |
| 9 | **BMO** : import du fichier annuel (`Base-open-data-BMO-AAAA.xlsx`), agrégé par FAP au niveau France et région ; passage FAP ↔ ROME de la DARES (table à récupérer à la main : le site de la DARES bloque les téléchargements automatisés) ; complète `perspectives` (projets de recrutement, part difficile, part saisonnière) | À faire (table FAP ↔ ROME) |
| 10 | Vagues du lot 6 outillées par le ROME : compétences et savoirs du ROME proposés pour formuler disciplines et gestes ; règles ROME → disciplines revues à partir des savoirs | À planifier avec les vagues |

Chaque lot : `npm run ci` vert, cette fiche et `docs/actions-manuelles.md` à jour, validation du CODEOWNER.

## Mettre à jour l'extrait ONISEP

1. Télécharger sur data.gouv.fr le zip d'« Idéo-Fiches métiers » (XML) et le CSV d'« Idéo-Métiers Onisep ».
2. `npm run import:onisep -- "Ideo-Fiches metiers.xml" --complement 5fa5949243f97.csv --extrait referentiel/sources/onisep/ideo-metiers-AAAA-MM-JJ.json --date AAAA-MM-JJ`
   (seul l'extrait est versionné ; si une colonne n'est pas reconnue, ajouter l'alias dans `COLONNES`).
3. `npm run import:onisep -- referentiel/sources/onisep/ideo-metiers-AAAA-MM-JJ.json` : rapport et `candidats.json` ;
   relire les rattachements, puis relancer avec `--appliquer` (et `--remplacer-propositions` si besoin).
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
  "onisep": "MET.408",
  "rome": ["F1107"],
  "niveauAcces": "bac+2",
  "domaines": ["construction, architecture, travaux publics/études et conception"]
}
```

Les champs `onisep`, `rome`, `niveauAcces` (de `sans-diplome` à `bac+9`), `domaines`, `synonymes`, `relue` et les
champs dérivés du ROME 4.0 (`contextes`, `transitions`, `proches`, recalculés par `npm run import:rome`) sont
facultatifs ; `sources` (racine) porte l'attribution des bases dont dérivent ces champs. `relue` n'est renseigné que par
un humain, comme dans les fiches du catalogue. L'exemple illustre la forme ; ses domaines sont indicatifs.
