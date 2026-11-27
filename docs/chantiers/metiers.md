# Chantier : Espace Métiers, compléter le référentiel et alimenter le graphe

**Niveau actuel : 8 (lots 0 à 7 et 9 livrés : vagues ONISEP, ROME 4.0, BMO ; lot 8 préparé ; relectures humaines en cours)**

Décisions : [ADR 0041](../decisions/0041-espace-metiers.md) (Espace Métiers),
[ADR 0042](../decisions/0042-referentiel-metiers-onisep.md) (format v2, import ONISEP, proposé) et
[ADR 0044](../decisions/0044-donnees-france-travail-metiers.md) (données de France Travail, proposé). Données :
`referentiel/metiers-v0.json`, forme décrite par `referentiel/metiers.schema.json`, cohérence vérifiée par
`verifierMetiers` (`web/metiers.js`) au build.

## État au 2026-11-24 (après la vague 1 du lot 6)

Le build affiche la ligne « Couverture métiers » (`couvertureMetiers`, information non bloquante).

| Indicateur | Valeur |
|---|---|
| Métiers | 111 en 9 familles : 38 de la maquette V5 (`v5`), 41 de la vague pilote et 32 de la vague 1 (`proposition`) |
| Disciplines | 51 : 14 issues de la maquette V5, 37 « proposition » à relire |
| Métiers rattachés à l'ONISEP / au ROME / avec niveau d'accès | 106 / 103 / 108 (sur 111) |
| Notions du référentiel reliées à un métier | **370 sur 477** (78 % ; 60 au départ, cible 50 %) |
| Métiers avec code ROME 4.0 / contextes de travail / transition / métiers proches (ROME 4.0, après fusion des vagues) | 935 / 935 / 402 / 920 (sur 1 131) |
| Métiers avec perspectives de recrutement (BMO 2026) | 66 sur 1 131 (30 fort, 19 moyen, 17 faible) : maquette V5 et vague pilote seulement |

| Matière | Notions reliées / total | Métiers qui la mobilisent (cible : 5) |
|---|---|---|
| Mathématiques | 63 / 114 | 56 |
| Français | 37 / 58 | 31 |
| SVT | 47 / 51 | 51 |
| Histoire | 43 / 50 | 14 |
| Physique-chimie | 43 / 46 | 45 |
| Géographie | 29 / 40 | 18 |
| EMC | 26 / 36 | 11 |
| Philosophie | 19 / 19 | 16 |
| SES | 14 / 14 | 30 |
| Technologie | 14 / 14 | 16 |
| Anglais | 14 / 14 | 8 |
| Arts plastiques | 7 / 7 | 10 |
| Musique | 7 / 7 | 7 |
| EPS | 7 / 7 | 10 |

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

## Source : France Travail (analyse du 2026-11-24, ADR 0044)

Le catalogue `francetravail.io` est inaccessible depuis l'environnement cloud ; les fiches des API sont lues sur
data.gouv.fr (organisation France Travail). Toutes les données utiles sont indexées par **code ROME**, déjà présent dans
le référentiel.

| Source | Apport | Accès | Lot |
|---|---|---|---|
| ROME 4.0, « Toutes les données du ROME » (JSON) | Contextes de travail (horaires, lieux, conditions, statuts), transitions écologique et numérique, mobilités, compétences, savoirs ; 1 923 fiches (version 62, 2026-10-19) | Libre, Licence Ouverte 2.0 (`api.francetravail.fr`) | 7, fait |
| API Marché du travail | Tension de recrutement, offres, embauches, demandeurs d'emploi, salaire proposé, dynamique ; par ROME et territoire, trimestriel (France Travail, ACOSS, CCMSA, DARES) | Compte francetravail.io (OAuth2) | 8 |
| Enquête BMO (2016 à 2026) | Projets de recrutement, part difficile, part saisonnière, par bassin d'emploi | Libre, Licence Ouverte (`www.francetravail.org`) ; codée en FAP 2021 | 9, fait |
| Nomenclature FAP 2021 (DARES) | Libellés des 341 FAP ; **sans** passage vers le ROME (table de passage seulement sur le site de la DARES, qui bloque les téléchargements automatisés) | Libre (`data.dares.travail-emploi.gouv.fr`) | 9 |
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
| 6 | Montée en charge par vagues. **Pilote** : 41 métiers et 3 familles. **Vague 1** : 32 métiers issus des fiches ONISEP (sport, musique, langues, lettres, histoire, géographie, statistiques, droit, social, sciences), 11 nouvelles disciplines et notions ajoutées aux disciplines « proposition » (calcul professionnel, expression écrite, langues, droit, physiologie…). **Cible atteinte** : chaque matière mobilisée par au moins 7 métiers, 78 % des notions reliées. Vagues complémentaires 2 à 11 : 1 020 fiches ONISEP de plus (voir « Vagues complémentaires ») | Fait ; 12 fiches écartées à arbitrer |

| 7 | **ROME 4.0** : `npm run import:rome` (`scripts/importer-rome.mjs`, `scripts/lib/rome.mjs`), extrait `referentiel/sources/france-travail/rome-4.0-v62.json` ; champs dérivés `contextes` (dictionnaire `contextesTravail`), `transitions`, `proches` ; `--preciser` (codes v3 → fiche ROME 4.0 de même intitulé, 57 métiers après fusion des vagues) ; 7 codes ROME choisis par l'agent pour les métiers sans code (`designer-ux-ui` E1206, `charge-daffaires` D1407, `eco-concepteur` H1206, `journaliste-scientifique` E1106, `mediateur-scientifique` G1242, `technicien-reseaux` M1816, `conseiller-bancaire` C1206) ; détail d'un métier : transitions, conditions de travail, métiers proches ; `--candidats` complète les candidats des vagues par compétences et savoirs | Fait (`tests/unit/rome.test.mjs`) ; codes choisis par l'agent à relire |
| 8 | **Marché du travail** : `npm run import:marche` (`scripts/importer-marche.mjs`, `scripts/lib/marche.mjs`) ; `--codes` liste les 81 codes ROME à interroger ; lecture de réponses JSON enregistrées depuis la console francetravail.io (forme supposée, refus explicite sinon) ; extrait `referentiel/sources/france-travail/marche-AAAA-TN.json` ; champ `marche` (tension 1 à 5, période) affiché dans « Perspectives de recrutement » | Préparé sans données (`tests/unit/marche.test.mjs`, réponses factices) ; import réel après les actions manuelles |
| 9 | **BMO** : `npm run import:bmo` (`scripts/importer-bmo.mjs`, `scripts/lib/bmo.mjs`, lecture xlsx sans dépendance), extrait `referentiel/sources/france-travail/bmo-2026.json` (217 métiers BMO, totaux France minimaux, paliers par tiers) ; champ `fap` choisi par l'agent pour 66 métiers (maquette V5 et vague pilote ; les métiers des vagues ONISEP restent à rattacher) ; 13 sans code (concours publics : professeurs, gardien de la paix, greffier, bibliothécaire, météorologue, archéologue ; équivalent incertain : urbaniste, médiateur scientifique, fleuriste, restaurateur d'œuvres d'art, ambulancier) ; champ dérivé `perspectives` ; bloc « Perspectives de recrutement » (palier, chiffres du groupe BMO, portée, prudence). Contrôle croisé avec la table FAP ↔ ROME de la DARES quand elle sera fournie | Fait (`tests/unit/bmo.test.mjs`) ; 66 rattachements à relire |
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

## Vagues complémentaires

Après le lot 6, les fiches ONISEP encore candidates (1 032 au 2026-11-24) entrent par vagues, une PR par vague.
Outil : `npm run vague:metiers` (`scripts/vague-metiers.mjs`, `scripts/lib/vagues.mjs`, sans réseau).

1. `npm run vague:metiers -- --restants` : domaines ONISEP encore candidats et leur nombre.
2. `npm run vague:metiers -- --numero NN --domaines "domaine 1 ; domaine 2"` : squelette
   `referentiel/vagues/vague-NN.json` (un métier par fiche candidate : identifiant ONISEP, slug, nom affiché
   « Moniteur, monitrice d'escalade », famille déduite du domaine, disciplines proposées : règle ROME précise, sinon
   domaine ONISEP de `referentiel/regles-metiers.json`, sinon règle ROME générale).
3. Rédiger pour chaque métier **3 gestes** courts et **une phrase de contexte** (mots de KermicLab, compréhensibles dès
   7 ans), vérifier famille et disciplines ; écarter un métier inadapté par `"exclu": "<raison>"` (listé dans la PR).
4. `npm run vague:metiers -- --verifier referentiel/vagues/vague-NN.json`, puis `--appliquer` : métiers ajoutés en
   `proposition`, avec niveau, codes ROME, domaines et synonymes de l'extrait. Une reprise de 8 mots d'un texte de
   l'extrait est refusée (garde anti-recopie ; la relecture humaine reste la garde principale).
5. `npm run ci`, PR, relecture humaine.

Au-delà de 120 métiers, les anneaux ne dessinent que les métiers du filtre (lot 5). Essai à pleine échelle (toutes
les fiches fusionnées avec des gestes provisoires, non publié) : 1 143 métiers, `dist/referentiel-graphe.json` 740 Ko
(32 039 relations), `dist/metiers.json` 880 Ko, build complet en 7 s ; les tests e2e Métiers et back-office passent.
Le seuil d'alerte (graphe > 2 Mo ou build > 10 s, alors relier les métiers aux disciplines plutôt qu'aux notions) n'est
pas atteint ; la mesure est refaite à chaque vague.

| Vague | Domaines ONISEP | Candidats | Statut |
|---|---|---|---|
| 0 | Outillage (`vague:metiers`, repli par domaine, tests, essai à pleine échelle) | — | Fait |
| 2 | santé, social, sport | 100 | Fait (100 retenus ; 211 métiers, graphe 308 Ko) |
| 3 | arts, culture, artisanat | 99 | Fait (99 retenus ; 310 métiers, graphe 345 Ko) |
| 4 | environnement, énergies ; agriculture, animaux | 123 | Fait (123 retenus ; 433 métiers, graphe 399 Ko) |
| 5 | matières premières, industries ; électricité, électronique | 112 | Fait (112 retenus) |
| 6 | mécanique ; construction, travaux publics | 102 | Fait (102 retenus) |
| 7 | armée, sécurité ; logistique, transport | 112 | Fait (100 retenus ; 12 métiers de combat armé écartés, à arbitrer en relecture) |
| 8 | sciences ; informatique, Internet | 115 | Fait (115 retenus) |
| 9 | information-communication ; lettres, langues, enseignement ; histoire-géographie, psychologie | 95 | Fait (95 retenus) |
| 10 | économie, droit ; gestion, comptabilité | 90 | Fait (90 retenus) |
| 11 | commerce ; banque, assurance ; hôtellerie, tourisme | 84 | Fait (84 retenus ; 1 131 métiers, graphe 724 Ko, `dist/metiers.json` 1 Mo) |

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

Le Lab Business Plan est accessible depuis le détail des métiers qui disposent d’un scénario associé. Le lien ouvre le simulateur avec le catalogue, les charges et l’équipe du scénario.
