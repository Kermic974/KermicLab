# ADR 0042 — Référentiel des métiers : format v2 et import depuis l'ONISEP

- Date : 2026-11-24 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : l'Espace Métiers (ADR 0041) relie 38 métiers, saisis à la main depuis la maquette V5, à 60 des 477
  notions du référentiel. Le propriétaire demande de compléter le référentiel à partir des métiers documentés par
  l'ONISEP et d'alimenter le graphe. Plan détaillé : [chantier Métiers](../chantiers/metiers.md).

## Décision

1. **Format v2** de `referentiel/metiers-v0.json` (`version: 2`), décrit par `referentiel/metiers.schema.json`
   (JSON Schema 2020-12, vérifié par les tests) ; la cohérence entre éléments reste vérifiée au build par
   `verifierMetiers` (`web/metiers.js`).
   - Chaque métier porte, comme chaque discipline, le statut de sa correspondance : `v5` (maquette), `proposition`
     (agent ou import) ou `validee`. Une correspondance `validee` exige une date `relue`, renseignée par un humain.
   - Champs facultatifs d'un métier : `onisep` (`MET.<n>`, unique), `rome` (codes `A0000`), `niveauAcces` (niveaux de
     l'ONISEP : `sans-diplome`, `cap`, `bac`, `bac+1` à `bac+9`), `domaines`, `synonymes`. À la racine, `sources`
     cite les bases dont dérivent ces champs (producteur, licence, date).
   - Le nom du fichier est conservé pour ne pas casser les liens (build, tests, ADR 0041).
2. **Source ONISEP par extrait daté** : les jeux « Idéo-Fiches métiers » (XML) et « Idéo-Métiers Onisep » (CSV),
   publiés par l'ONISEP sur data.gouv.fr **sous licence ODbL 1.0**, sont réduits à un extrait compact versionné
   (`referentiel/sources/onisep/ideo-metiers-AAAA-MM-JJ.json` : identifiants, intitulés, synonymes, ROME, niveau,
   domaines, lien) ; un script d'import déterministe en tire rattachements et candidats. La CI ne fait aucun appel
   réseau. L'attribution figure dans les données (`sources`, extrait) et sous l'écran Métiers. L'ODbL impose le partage
   à l'identique d'une base dérivée publiée : `referentiel/metiers-v0.json` et `dist/metiers.json` sont publiés sous
   ODbL pour leurs champs issus de l'ONISEP (décision du propriétaire à confirmer).
3. **Pas de recopie des textes** des fiches ONISEP : les gestes métier sont des formulations courtes propres à
   KermicLab ; seuls les identifiants et classifications sont repris.
4. **Validation humaine** : tout rattachement produit par un import ou par l'IA entre en `proposition` et reste
   signalé à l'écran (« en cours de relecture ») jusqu'à sa validation.
5. **Règles de rattachement** (`referentiel/regles-metiers.json`) : préfixe de code ROME → disciplines, appliquées aux
   candidats de l'import. Les propositions de disciplines, de gestes et de notions sont préparées par un agent dans une
   PR ; aucun modèle n'est appelé à l'exécution ni par un script (les appels restent réservés à `worker/src/llm.js`).
6. **Indicateurs de couverture** (`couvertureMetiers`) affichés par le build, non bloquants : métiers rattachés à
   l'ONISEP et au ROME, statuts, notions reliées par matière. Ils guident le choix des vagues d'import.

## Conséquences

- Les 38 métiers existants passent en `correspondance: "v5"` ; aucun n'est encore validé. La vague pilote ajoute 41
  métiers, 14 disciplines et 3 familles en `proposition`. L'import du 2026-11-24 rattache 74 des 79 métiers à l'ONISEP
  (53 par l'intitulé, 21 par une correspondance choisie par l'agent) et leur apporte niveaux, codes ROME, domaines et
  synonymes ; pour les fiches `proposition`, les valeurs de l'ONISEP remplacent les estimations de l'agent, ailleurs
  les écarts sont signalés comme conflits et jamais écrasés.
- L'écran filtre par niveau d'accès, cherche dans les synonymes, domaines et codes ROME, signale les fiches en
  `proposition` et limite les anneaux aux métiers du filtre au-delà de 120 métiers (lot 5).
- Preuves : `tests/unit/metiers.test.mjs` (validation, statuts, identifiants, couverture, schéma),
  `tests/unit/onisep.test.mjs` (import, rapprochement, conflits, règles ROME), `tests/e2e/metiers.test.mjs`.
