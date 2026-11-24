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
   - Champs facultatifs d'un métier : `onisep` (`MET.<n>`, unique), `rome` (codes `A0000`), `niveauAcces` (`cap`,
     `bac`, `bac+2`, `bac+3`, `bac+5`, `bac+8`), `domaines`.
   - Le nom du fichier est conservé pour ne pas casser les liens (build, tests, ADR 0041).
2. **Source ONISEP par instantané** : le jeu ouvert « Idéo – Fiches métiers » est déposé, daté, dans le dépôt ; un
   script d'import déterministe en tire des candidats. La CI ne fait aucun appel réseau. La licence est confirmée
   avant le premier import et la source citée dans les données publiées.
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
  métiers, 14 disciplines et 3 familles en `proposition`, sans code ROME (l'import les apporte ; les écarts de niveau
  d'accès sont signalés comme conflits et jamais écrasés).
- L'écran n'affiche pas encore les nouveaux champs (lot 5 du chantier).
- Preuves : `tests/unit/metiers.test.mjs` (validation, statuts, identifiants, couverture, schéma),
  `tests/unit/onisep.test.mjs` (import, rapprochement, conflits, règles ROME), `tests/e2e/metiers.test.mjs`.
