# ADR 0033 — Adoption des contrats S6 et migration des expériences

- Date : 2026-11-18.
- Statut : adopté par la [PR #385](https://github.com/Kermic974/KermicLab/pull/385), fusionnée le 18 novembre 2026 à `8eb022e92405def7cc80cd05d5b92beca86c3cf6` ; arbitrages de périmètre confirmés par le propriétaire dans le chat.
- Suivi : [#384](https://github.com/Kermic974/KermicLab/issues/384).

## Contexte

S4 décrit le Knowledge Core et S5 ses artefacts. Les pages Notion S6.1 à S6.8 sont des propositions issues du notebook Copilot, sans contrat JSON exécutable adopté. Le corpus public contient déjà des explications, exercices, jeux et un lab, avec des sources et des moteurs différents. Créer un second contenu éditorial désynchroniserait ces sources.

## Décisions confirmées

| Décision | Conséquence vérifiable |
| --- | --- |
| D6-1 — Tout le corpus public | 165 fiches de notions, 9 jeux et le lab solaire ; catalogue privé hors périmètre de cette migration |
| D6-2 — Intégration au build | Définitions et index public déterministes ; interfaces préparées pour S7–S9, sans nouvelle navigation apprenant |
| D6-3 — Migration en `review` | Publication historique maintenue par manifeste explicite, sans promouvoir S4 ou S6 en `validated` |
| D6-4 — Sources actuelles | Références aux JSON, pages et modules actuels ; aucune réécriture générale des contenus |
| D6-5 — Ancres explicites | Identifiants persistants dans les unités sources ; correspondance conservée avec les IDs d’événements existants |
| D6-6 — Variantes distinctes | Identité et version propres, référence à la révision exacte de la base |
| D6-7 — Accessibilité graduée | Lacunes signalées en WARNING en `review`, ERROR avant `validated` ; revue humaine requise |

La [norme S6 v1.0.0](../referentiel/normes/S6-v1.0.0.md) précise ces décisions. Sa fusion adopte ce contrat Git ; la copie Notion signale séparément le statut proposé puis adopté. Le notebook et ses fichiers joints restent des sources de provenance : cette consolidation ne prétend pas en vérifier les originaux binaires.

## Mise en œuvre et dépendances

Les objets S6 vivent dans `experiences/`, hors des huit espaces S4. Les validateurs S4 et S5 restent actifs. Les sources pédagogiques continuent d’être les sources de rendu ; les définitions S6 les référencent et leur changement effectif exige une révision S6.

Ajv 8 déjà verrouillé est réutilisé. Pour les pages manuelles, prévoir **parse5**, parseur HTML conforme WHATWG ([documentation primaire](https://github.com/inikulin/parse5)), plutôt qu’une extraction par expressions régulières ou l’exécution de scripts de page. Son ajout effectif, sa version verrouillée et son audit feront partie de la PR des adaptateurs. Aucune dépendance ni commande nouvelle n’est introduite par la présente adoption.

Les liens `notions-liees` et les prérequis V0 de l’ADR 0032 ne deviennent pas automatiquement des relations S4. Leur relecture (#382) demeure distincte. Les points de jeu, XP, scores et états individuels restent hors des définitions S6.

## Livraison

Le [plan lié](../experiences/livraison-s6.md) décrit seize PR vers `main`, leurs dépendances, preuves et retours arrière. La PR d’adoption doit être fusionnée avant l’implémentation technique. Chaque PR requiert CI verte et validation humaine conformément à AGENTS.md. Ni une fixture valide ni un build réussi ne constituent une validation pédagogique.

English summary: adopt a separate experience-definition contract over existing public content; migrate as review with explicit legacy-publication compatibility, stable source anchors, pinned variants and human accessibility review. Keep learner observations, progress and runtime state outside S6.
