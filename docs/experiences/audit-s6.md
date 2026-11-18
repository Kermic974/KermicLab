# Audit initial S6 — sources publiques réelles

Relevé du 18 novembre 2026 sur `main` à `123d3338ea7f5111fa446bf4378557c58ac9fbad` (PR #380 incluse). Il décrit l’existant, pas une implémentation S6. Le [snapshot détaillé](inventaire-s6.json) conserve les chemins, versions et SHA-256 après normalisation LF. Les empreintes attestent ce point de départ ; elles ne remplacent pas le futur contrôle des unités liées.

## Périmètre compté

| Source | Quantité | Conséquence |
| --- | ---: | --- |
| Fiches publiques `catalogue/*/fiche.md` | 174 | 165 notions et 9 jeux |
| Contenus gabarit `contenu.json` | 164 | Référencer les unités et ajouter leurs IDs persistants |
| Niveaux d’explication | 631 | Explications, avec granularité attestée par la source |
| Exemples associés aux niveaux | 295 | Type example, sans dupliquer le texte |
| Exercices d’application | 819 | QCM ou réponse numérique |
| Étapes de mise en situation | 512 | Tâches contextualisées, pas automatiquement missions |
| Total des exercices | 1 331 | 823 QCM et 508 réponses numériques |
| Figures du gabarit | 9 | Visualisations attachées, alternatives à examiner |
| Notion manuelle `trigo-cercle` | 1 | Page HTML et modules pédagogiques du cercle |
| Jeux manuels | 9 | Sources HTML et modules partagés/propres à inventorier au niveau des unités |
| Lab publié | 1 | `Sample/lab/systeme-solaire.html`, route `/labs/systeme-solaire/` |

Par matière : mathématiques 36, physique-chimie 23, SVT 24, histoire 16, géographie 17, français 10, EMC 12, SES 10, philosophie 17, jeux 9. Les 631 niveaux et 1 331 exercices sont des unités observées, pas un objectif de nombre d’objets : des introductions, mémos, ressources et interactions supplémentaires sont à rapprocher lors de chaque lot.

## Écarts et adaptations nécessaires

- **Pas de corpus S6** : les 1 873 objets existants et leurs huit schémas sont S4. Créer un espace séparé, des schémas fermés et des contrôles S6 ; ne pas étendre la liste des types S4 aux expériences.
- **Sources sans identité persistante suffisante** : les niveaux, exemples et exercices du JSON sont principalement positionnels. Ajouter des IDs explicites conservés au réordonnancement ; extraire les unités HTML au moyen d’un parseur. Les anciens IDs d’événements servent aux progressions existantes : conserver un mapping, ne pas les remplacer.
- **Contenus variés** : les blocs du gabarit, les 8 leçons pures de `src/pedagogy/lessons.js`, les défis paramétriques, les académies de jeux et les missions du lab exigent des adaptateurs différents. Ne pas exporter les fonctions `check` ni le code des moteurs dans les objets.
- **Cibles jeux/lab** : réutiliser les cibles S4 attestées quand elles conviennent, compléter uniquement les connaissances nécessaires. Ne pas créer de placements curriculaires sans preuve. Les quatre jeux déclarant `notions-liees` dans l’ADR 0032 fournissent des associations éditoriales à examiner, pas des relations canoniques validées.
- **Évolution de main** : la gamification ajoute des gains d’XP, des liens jeux–notions et des prérequis V0 dans 51 fiches hors mathématiques. Aucun objet S4 n’a changé entre la baseline de qualification S5 (`92d0eb7e`) et ce relevé. Examiner la cohérence avec la projection S4 avant les lots ; ne pas écraser ni canoniser silencieusement ces ajouts. Le ticket #382 conserve la relecture humaine correspondante.
- **Publication** : les sources sont déjà publiques et leurs cibles S4 sont en review. Un manifeste explicite est nécessaire pour maintenir cet existant sans confondre publication et validation pédagogique.
- **Accessibilité** : le lab comporte un secours textuel et des commandes clavier, mais la relecture humaine scientifique et l’équivalence pédagogique restent à faire. Les pages/figures demandent le même examen. Un test navigateur ne remplace pas cette revue.
- **S5 à étendre** : le catalogue de règles est limité au préfixe S4. Ajouter S6 à son contrôle, indexer les sources précises, couvrir chaque règle par un diagnostic prouvé et conserver le rapport CI.

## Fermeture attendue

Chaque lot enrichit le manifeste des unités réellement recensées, du mapping source/expérience, des associations aux événements et des exclusions motivées. Les fonctions techniques, styles, sauvegardes et compteurs sont exclus avec leur rôle explicite. Une famille sans instance attestée reste à zéro ; ses fixtures vérifient son contrat. Le bilan final recalcule la couverture sur la révision livrée et contrôle toute nouvelle source publique apparue depuis ce relevé.
