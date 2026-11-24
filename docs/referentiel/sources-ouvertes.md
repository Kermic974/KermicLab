# Sources ouvertes : évaluations nationales et programmes

> Fichier généré par `npm run sources:rapport` (ADR 0042). Ne pas modifier à la main.

Sources : [data.education.gouv.fr](https://data.education.gouv.fr), Licence Ouverte v2.0 (Etalab). Évaluations Repères (DEPP), taux de maîtrise
nationaux, population « Ensemble » : CP 2025, CE1 2025, CE2 2025, CM1 2025, CM2 2025. Programmes d'enseignement (DGESCO), textes en vigueur.
Instantanés : `referentiel/sources-ouvertes/`. Correspondances : statut **proposition**, seuil 60 %.

## Notions prioritaires

Notions du catalogue visées par au moins une compétence maîtrisée par moins de 60 % des élèves
(taux le plus bas retenu). Elles passent en tête pour l'enrichissement et la relecture.

| Notion | Taux le plus bas | Compétences nationales |
|---|---|---|
| Le calcul mental (`calcul-mental-cm`) | 34,3 % | CM1 « Mémoriser des faits numériques » 34,3 % ; CM2 « Mémoriser des faits numériques » 38,7 % ; CM2 « Mémoriser des procédures » 43,5 % ; CM1 « Mémoriser des procédures » 45,6 % |
| La multiplication posée et les tables (`multiplication-posee-cm`) | 34,3 % | CM1 « Mémoriser des faits numériques » 34,3 % ; CM2 « Mémoriser des faits numériques » 38,7 % ; CM2 « Poser et calculer » 45,9 % ; CM1 « Poser et calculer » 52,1 % |
| Additions et soustractions posées (`addition-soustraction-posees-cm`) | 45,9 % | CM2 « Poser et calculer » 45,9 % ; CM1 « Poser et calculer » 52,1 % |
| La division euclidienne (`division-euclidienne-cm`) | 45,9 % | CM2 « Poser et calculer » 45,9 % ; CM1 « Poser et calculer » 52,1 % |
| Résoudre des petits problèmes (`problemes-c2`) | 47,7 % | CE2 « Résoudre des problèmes » 47,7 % ; CE1 « Résoudre des problèmes » 48,0 % ; CP « Résoudre des problèmes » 69,3 % |
| Les accords : sujet-verbe, groupe nominal, participe passé (`accords-cm`) | 47,8 % | CM2 « Maîtriser l'accord du verbe conjugué » 47,8 % ; CM1 « Identifier la relation sujet - verbe » 55,2 % ; CM2 « Utiliser des marques d'accord pour les noms et adjectifs » 60,5 % ; CM1 « Utiliser des marques d'accord pour les noms et adjectifs » 61,7 % |
| La conjugaison : temps simples et composés (`conjugaison-cm`) | 47,8 % | CM2 « Maîtriser l'accord du verbe conjugué » 47,8 % ; CM1 « Mémoriser des temps de conjugaison » 50,3 % |
| L'addition (`addition-c2`) | 48,3 % | CE2 « Poser et calculer » 48,3 % ; CE1 « Additionner » 62,3 % ; CE1 « Calculer mentalement » 76,5 % |
| Multiplier un grand nombre (CE2) (`multiplication-posee-ce2-c2`) | 48,3 % | CE2 « Poser et calculer » 48,3 % |
| La soustraction (`soustraction-c2`) | 48,3 % | CE2 « Poser et calculer » 48,3 % ; CE1 « Soustraire » 63,2 % |
| Résoudre des problèmes à plusieurs étapes (`problemes-a-etapes-cm`) | 50,6 % | CM2 « Résoudre des problèmes » 50,6 % ; CM1 « Résoudre des problèmes » 61,1 % |
| Multiplier : sens et tables (`tables-de-multiplication-c2`) | 53,5 % | CE2 « Mémoriser des faits numériques » 53,5 % |
| Les fonctions dans la phrase (`fonctions-dans-la-phrase-cm`) | 54,5 % | CM2 « Reconnaître les principaux constituants de la phrase » 54,5 % ; CM1 « Identifier la relation sujet - verbe » 55,2 % ; CM1 « Reconnaître les principaux constituants de la phrase » 57,0 % |
| Le verbe, le sujet et l'adjectif (`verbe-sujet-adjectif-c2`) | 55,2 % | CE2 « Reconnaître les principaux constituants de la phrase » 55,2 % ; CE2 « Différencier les principales classes de mots » 61,8 % |
| Comprendre un texte (`lecture-comprehension-cm`) | 56,1 % | CM2 « Comprendre un texte lu seul(e) » 56,1 % ; CM1 « Comprendre un texte lu seul(e) » 67,3 % |
| Périmètre et calcul mental (`perimetre-et-calcul-mental-c2`) | 56,2 % | CE2 « Mémoriser des procédures » 56,2 % |
| Les fractions au CM (`fractions-cm`) | 58,0 % | CM2 « Placer un nombre sur une ligne graduée » 58,0 % ; CM2 « Utiliser différentes représentations des nombres » 61,2 % ; CM1 « Placer un nombre sur une ligne graduée » 75,8 % |
| Les nombres décimaux au CM (`nombres-decimaux-cm`) | 58,0 % | CM2 « Placer un nombre sur une ligne graduée » 58,0 % ; CM2 « Utiliser différentes représentations des nombres » 61,2 % ; CM1 « Placer un nombre sur une ligne graduée » 75,8 % |

## Compétences sans notion au catalogue

Candidates à une issue `maquette-manquante` (ou à un complément d'une notion existante).

| Niveau | Discipline | Compétence | Taux |
|---|---|---|---|
| CP | Français | Comprendre des mots à l'oral | 71,9 % |
| CP | Français | Comprendre des phrases à l'oral | 83,9 % |
| CP | Français | Comprendre des textes à l'oral | 85,3 % |
| CE1 | Français | Comprendre des phrases à l'oral | 82,3 % |
| CE1 | Français | Lire à voix haute des mots | 71,5 % |
| CE1 | Français | Lire à voix haute un texte | 67,5 % |
| CE2 | Français | Comprendre un texte et des phrases à l'oral | 81,3 % |
| CE2 | Français | Lire à voix haute un texte | 67,9 % |
| CM1 | Français | Comprendre des textes à l'oral | 78,4 % |
| CM1 | Français | Lire à voix haute un texte | 57,7 % |
| CM2 | Français | Comprendre des textes à l'oral | 75,4 % |
| CM2 | Français | Lire à voix haute un texte | 53,2 % |

## Toutes les compétences

| Niveau | Année | Discipline | Compétence | Taux | Notions |
|---|---|---|---|---|---|
| CP | 2025 | Français | Comprendre des mots à l'oral | 71,9 % | — |
| CP | 2025 | Français | Comprendre des phrases à l'oral | 83,9 % | — |
| CP | 2025 | Français | Comprendre des textes à l'oral | 85,3 % | — |
| CP | 2025 | Français | Connaître le nom des lettres et le son qu'elles produisent | 83,7 % | `lettres-et-sons-c2` |
| CP | 2025 | Français | Manipuler des phonèmes | 83,0 % | `lettres-et-sons-c2` |
| CP | 2025 | Français | Manipuler des syllabes | 81,2 % | `syllabes-et-mots-c2` |
| CP | 2025 | Français | Reconnaître les différentes écritures d’une lettre | 68,7 % | `lettres-et-sons-c2` |
| CP | 2025 | Mathématiques | Comparer des nombres | 80,6 % | `comparer-et-ranger-c2` |
| CP | 2025 | Mathématiques | Écrire des nombres entiers | 89,6 % | `nombres-jusqu-a-100-c2` |
| CP | 2025 | Mathématiques | Lire des nombres entiers | 92,2 % | `nombres-jusqu-a-100-c2` |
| CP | 2025 | Mathématiques | Placer un nombre sur une ligne graduée | 77,9 % | `comparer-et-ranger-c2` |
| CP | 2025 | Mathématiques | Quantifier des collections | 85,1 % | `nombres-jusqu-a-100-c2` |
| CP | 2025 | Mathématiques | Reproduire un assemblage | 83,8 % | `figures-planes-c2` |
| CP | 2025 | Mathématiques | Résoudre des problèmes | 69,3 % | `problemes-c2` |
| CE1 | 2025 | Français | Comprendre des mots à l'oral | 77,0 % | `vocabulaire-et-dictionnaire-c2` |
| CE1 | 2025 | Français | Comprendre des phrases à l'oral | 82,3 % | — |
| CE1 | 2025 | Français | Comprendre des phrases lues seul(e) | 82,4 % | `la-phrase-c2`, `lire-et-comprendre-c2` |
| CE1 | 2025 | Français | Comprendre un texte lu seul(e) | 83,2 % | `lire-et-comprendre-c2` |
| CE1 | 2025 | Français | Écrire des mots | 72,4 % | `homophones-et-orthographe-c2` |
| CE1 | 2025 | Français | Écrire des syllabes | 86,2 % | `syllabes-et-mots-c2` |
| CE1 | 2025 | Français | Lire à voix haute des mots | 71,5 % | — |
| CE1 | 2025 | Français | Lire à voix haute un texte | 67,5 % | — |
| CE1 | 2025 | Mathématiques | Additionner | 62,3 % | `addition-c2` |
| CE1 | 2025 | Mathématiques | Calculer mentalement | 76,5 % | `addition-c2`, `doubles-et-moities-c2` |
| CE1 | 2025 | Mathématiques | Écrire des nombres entiers | 76,6 % | `nombres-jusqu-a-1000-c2` |
| CE1 | 2025 | Mathématiques | Lire des nombres entiers | 78,4 % | `nombres-jusqu-a-1000-c2` |
| CE1 | 2025 | Mathématiques | Placer un nombre sur une ligne graduée | 64,0 % | `comparer-et-ranger-c2` |
| CE1 | 2025 | Mathématiques | Reproduire un assemblage | 83,9 % | `figures-planes-c2` |
| CE1 | 2025 | Mathématiques | Résoudre des problèmes | 48,0 % | `problemes-c2` |
| CE1 | 2025 | Mathématiques | Soustraire | 63,2 % | `soustraction-c2` |
| CE2 | 2025 | Français | Comprendre des phrases lues seul(e) | 81,4 % | `lire-et-comprendre-c2` |
| CE2 | 2025 | Français | Comprendre un texte et des phrases à l'oral | 81,3 % | — |
| CE2 | 2025 | Français | Comprendre un texte lu seul(e) | 62,7 % | `lire-et-comprendre-c2` |
| CE2 | 2025 | Français | Différencier les principales classes de mots | 61,8 % | `noms-et-determinants-c2`, `verbe-sujet-adjectif-c2` |
| CE2 | 2025 | Français | Écrire des mots | 66,1 % | `homophones-et-orthographe-c2` |
| CE2 | 2025 | Français | Lire à voix haute un texte | 67,9 % | — |
| CE2 | 2025 | Français | Mémoriser des temps de conjugaison | 65,2 % | `temps-des-verbes-c2` |
| CE2 | 2025 | Français | Reconnaître les principaux constituants de la phrase | 55,2 % | `verbe-sujet-adjectif-c2` |
| CE2 | 2025 | Français | Utiliser des marques d'accord pour les noms et adjectifs | 60,4 % | `singulier-pluriel-masculin-feminin-c2` |
| CE2 | 2025 | Mathématiques | Écrire des nombres entiers | 83,5 % | `nombres-jusqu-a-10000-c2` |
| CE2 | 2025 | Mathématiques | Lire des nombres entiers | 88,5 % | `nombres-jusqu-a-10000-c2` |
| CE2 | 2025 | Mathématiques | Mémoriser des faits numériques | 53,5 % | `tables-de-multiplication-c2` |
| CE2 | 2025 | Mathématiques | Mémoriser des procédures | 56,2 % | `perimetre-et-calcul-mental-c2` |
| CE2 | 2025 | Mathématiques | Ordonner des nombres | 69,2 % | `comparer-et-ranger-c2` |
| CE2 | 2025 | Mathématiques | Placer un nombre sur une ligne graduée | 64,6 % | `comparer-et-ranger-c2` |
| CE2 | 2025 | Mathématiques | Poser et calculer | 48,3 % | `addition-c2`, `multiplication-posee-ce2-c2`, `soustraction-c2` |
| CE2 | 2025 | Mathématiques | Reconnaître un nombre à partir de sa décomposition additive | 68,5 % | `nombres-jusqu-a-10000-c2` |
| CE2 | 2025 | Mathématiques | Résoudre des problèmes | 47,7 % | `problemes-c2` |
| CM1 | 2025 | Français | Comprendre des textes à l'oral | 78,4 % | — |
| CM1 | 2025 | Français | Comprendre un texte lu seul(e) | 67,3 % | `lecture-comprehension-cm` |
| CM1 | 2025 | Français | Différencier les principales classes de mots | 62,8 % | `nature-des-mots-cm` |
| CM1 | 2025 | Français | Écrire des mots | 60,7 % | `orthographe-lexicale-cm` |
| CM1 | 2025 | Français | Identifier la relation sujet - verbe | 55,2 % | `accords-cm`, `fonctions-dans-la-phrase-cm` |
| CM1 | 2025 | Français | Lire à voix haute un texte | 57,7 % | — |
| CM1 | 2025 | Français | Mémoriser des temps de conjugaison | 50,3 % | `conjugaison-cm` |
| CM1 | 2025 | Français | Reconnaître les principaux constituants de la phrase | 57,0 % | `fonctions-dans-la-phrase-cm` |
| CM1 | 2025 | Français | Savoir trouver des mots de la même famille | 73,6 % | `formation-des-mots-cm` |
| CM1 | 2025 | Français | Savoir trouver des synonymes | 61,0 % | `vocabulaire-cm` |
| CM1 | 2025 | Français | Utiliser des marques d'accord pour les noms et adjectifs | 61,7 % | `accords-cm`, `groupe-nominal-cm` |
| CM1 | 2025 | Mathématiques | Écrire des nombres entiers | 84,9 % | `grands-nombres-cm` |
| CM1 | 2025 | Mathématiques | Mémoriser des faits numériques | 34,3 % | `calcul-mental-cm`, `multiplication-posee-cm` |
| CM1 | 2025 | Mathématiques | Mémoriser des procédures | 45,6 % | `calcul-mental-cm` |
| CM1 | 2025 | Mathématiques | Placer un nombre sur une ligne graduée | 75,8 % | `fractions-cm`, `nombres-decimaux-cm` |
| CM1 | 2025 | Mathématiques | Poser et calculer | 52,1 % | `addition-soustraction-posees-cm`, `division-euclidienne-cm`, `multiplication-posee-cm` |
| CM1 | 2025 | Mathématiques | Reconnaître un nombre à partir de sa décomposition additive | 63,8 % | `grands-nombres-cm` |
| CM1 | 2025 | Mathématiques | Résoudre des problèmes | 61,1 % | `problemes-a-etapes-cm` |
| CM2 | 2025 | Français | Comprendre des textes à l'oral | 75,4 % | — |
| CM2 | 2025 | Français | Comprendre un texte lu seul(e) | 56,1 % | `lecture-comprehension-cm` |
| CM2 | 2025 | Français | Différencier les principales classes de mots | 61,6 % | `nature-des-mots-cm` |
| CM2 | 2025 | Français | Écrire des mots | 65,0 % | `orthographe-lexicale-cm` |
| CM2 | 2025 | Français | Lire à voix haute un texte | 53,2 % | — |
| CM2 | 2025 | Français | Maîtriser l'accord du verbe conjugué | 47,8 % | `accords-cm`, `conjugaison-cm` |
| CM2 | 2025 | Français | Reconnaître les principaux constituants de la phrase | 54,5 % | `fonctions-dans-la-phrase-cm` |
| CM2 | 2025 | Français | Savoir trouver des synonymes et des mots de la même famille | 73,9 % | `formation-des-mots-cm`, `vocabulaire-cm` |
| CM2 | 2025 | Français | Utiliser des marques d'accord pour les noms et adjectifs | 60,5 % | `accords-cm`, `groupe-nominal-cm` |
| CM2 | 2025 | Mathématiques | Écrire des nombres entiers | 80,8 % | `grands-nombres-cm` |
| CM2 | 2025 | Mathématiques | Mémoriser des faits numériques | 38,7 % | `calcul-mental-cm`, `multiplication-posee-cm` |
| CM2 | 2025 | Mathématiques | Mémoriser des procédures | 43,5 % | `calcul-mental-cm` |
| CM2 | 2025 | Mathématiques | Placer un nombre sur une ligne graduée | 58,0 % | `fractions-cm`, `nombres-decimaux-cm` |
| CM2 | 2025 | Mathématiques | Poser et calculer | 45,9 % | `addition-soustraction-posees-cm`, `division-euclidienne-cm`, `multiplication-posee-cm` |
| CM2 | 2025 | Mathématiques | Résoudre des problèmes | 50,6 % | `problemes-a-etapes-cm` |
| CM2 | 2025 | Mathématiques | Utiliser différentes représentations des nombres | 61,2 % | `fractions-cm`, `fractions-operations-cm`, `nombres-decimaux-cm` |

## Programmes officiels

Textes en vigueur retenus : cycle-1 1, cycle-2 1, cycle-3 1, cycle-4 1, seconde 26, premiere 34, terminale 40. Entrée en vigueur la plus
récente du jeu : rentrée 2020. **Attention** : le jeu ne contient pas les programmes publiés depuis
(cycles 1 à 3 de 2024, EMC 2024) ; pour l'école et le collège, le texte rattaché peut être remplacé.

Fiches rattachées à au moins un texte : 477 sur 477.

### Fiches sans texte officiel

| Fiche | Matière | Niveaux |
|---|---|---|
| (aucune) | | |

### Textes et nombre de fiches rattachées

| Niveau | Discipline | Texte | Rentrée | Fiches |
|---|---|---|---|---|
| cycle-2 | toutes | [Arrêté du 17-7-2020 et J.O. du 28-7-2020](https://cache.media.education.gouv.fr/file/31/88/5/ensel714_annexe1_1312885.pdf) | 2020 | 51 |
| cycle-3 | toutes | [Arrêté du 17-7-2020 et J.O. du 28-7-2020](https://cache.media.education.gouv.fr/file/31/88/7/ensel714_annexe2_1312887.pdf) | 2020 | 165 |
| cycle-4 | toutes | [Arrêté du 17-7-2020 et J.O. du 28-7-2020](https://cache.media.education.gouv.fr/file/31/89/1/ensel714_annexe3_1312891.pdf) | 2020 | 130 |
| seconde | Éducation physique et sportive | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/91/9/spe574_annexe1_1062919.pdf) | 2019 | 1 |
| seconde | Enseignement moral et civique | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/90/0/spe572_annexe1_1062900.pdf) | 2019 | 5 |
| seconde | Enseignement optionnel d'arts | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/69/3/spe566_annexe1CORR_1063693.pdf) | 2019 | 2 |
| seconde | Français | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/92/8/spe575_annexe1_1062928.pdf) | 2019 | 5 |
| seconde | Histoire-géographie | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/69/9/spe577_annexe1CORR_1063699.pdf) | 2019 | 21 |
| seconde | Langues vivantes | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/95/2/spe585_annexe1_1062952.pdf) | 2019 | 2 |
| seconde | Mathématiques | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/95/7/spe631_annexe_1062957.pdf) | 2019 | 27 |
| seconde | Physique-chimie | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/98/9/spe634_annexe_1062989.pdf) | 2019 | 16 |
| seconde | Sciences de la vie et de la Terre | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/00/8/spe647_annexe_1063008.pdf) | 2019 | 11 |
| seconde | Sciences économiques et sociales | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/05/3/spe638_annexe_1063053.pdf) | 2019 | 7 |
| seconde | Sciences numériques et technologie | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/08/5/spe641_annexe_1063085.pdf) | 2019 | 2 |
| premiere | Éducation physique et sportive | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/91/9/spe574_annexe1_1062919.pdf) | 2019 | 1 |
| premiere | Enseignement de spécialité d'arts | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/84/6/spe567_annexe_22-1_1063846.pdf) | 2019 | 1 |
| premiere | Enseignement moral et civique | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/84/8/spe572_annexe2_22-1_1063848.pdf) | 2019 | 3 |
| premiere | Enseignement optionnel d'arts | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/69/5/spe566_annexe2CORR_1063695.pdf) | 2019 | 2 |
| premiere | Enseignement scientifique | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/13/4/spe573_annexe_1063134.pdf) | 2019 | 21 |
| premiere | Français | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/93/0/spe575_annexe2_1062930.pdf) | 2019 | 7 |
| premiere | Histoire-géographie | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/93/9/spe577_annexe2_1062939.pdf) | 2019 | 12 |
| premiere | Histoire-géographie, géopolitique et sciences politiques | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/92/5/spe576_annexe_1062925.pdf) | 2019 | 2 |
| premiere | Humanités, littérature et philosophie | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/00/2/spe578_annexe_1063002.pdf) | 2019 | 1 |
| premiere | Langues vivantes | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/70/3/spe585_annexe2CORR_1063703.pdf) | 2019 | 3 |
| premiere | Langues, littératures et cultures étrangères et régionales - anglais | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/85/0/spe590_annexe2_22-1_1063850.pdf) | 2019 | 3 |
| premiere | Mathématiques | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/16/8/spe632_annexe_1063168.pdf) | 2019 | 14 |
| premiere | Numérique et sciences informatiques | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/26/8/spe633_annexe_1063268.pdf) | 2019 | 2 |
| premiere | Physique-chimie | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/43/2/spe635_annexe_1063432.pdf) | 2019 | 13 |
| premiere | Sciences de l'ingénieur | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/43/6/spe640_annexe_1063436.pdf) | 2019 | 1 |
| premiere | Sciences de la vie et de la Terre | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/54/2/spe648_annexe_1063542.pdf) | 2019 | 8 |
| premiere | Sciences économiques et sociales | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/54/4/spe639_annexe_1063544.pdf) | 2019 | 13 |
| terminale | Éducation physique et sportive | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/91/9/spe574_annexe1_1062919.pdf) | 2020 | 1 |
| terminale | Enseignement de spécialité d'arts (musique) | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/84/6/spe567_annexe_22-1_1063846.pdf) | 2020 | 1 |
| terminale | Enseignement moral et civique | [arrêté du 19-7-2019 - J.O. du 23-7-2019](https://cache.media.education.gouv.fr/file/SPE8_MENJ_25_7_2019/89/7/spe244_annexe_1158897.pdf) | 2020 | 1 |
| terminale | Enseignement optionnel d'arts (Arts plastiques, Cinéma-audiovisuel, Danse, Histoire des arts, Théâtre) | [arrêté du 19-7-2019 - J.O. du 23-7-2019](https://cache.media.education.gouv.fr/file/SPE8_MENJ_25_7_2019/15/4/spe263_annexe_1159154.pdf) | 2020 | 1 |
| terminale | Enseignement optionnel d'arts (musique) | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/69/5/spe566_annexe2CORR_1063695.pdf) | 2019 | 1 |
| terminale | Enseignement scientifique | [arrêté du 19-7-2019 - J.O. du 23-7-2019](https://cache.media.education.gouv.fr/file/SPE8_MENJ_25_7_2019/84/7/spe241_annexe_1158847.pdf) | 2020 | 23 |
| terminale | Histoire-géographie | [arrêté du 19-7-2019 - J.O. du 23-7-2019](https://cache.media.education.gouv.fr/file/SPE8_MENJ_25_7_2019/17/2/spe243_annexe1_1159172.pdf) | 2020 | 19 |
| terminale | Histoire-géographie, géopolitique et sciences politiques | [arrêté du 19-7-2019 - J.O. du 23-7-2019](https://cache.media.education.gouv.fr/file/SPE8_MENJ_25_7_2019/18/0/spe254_annexe_1159180.pdf) | 2020 | 2 |
| terminale | Humanités, littérature et philosophie | [arrêté du 19-7-2019 - J.O. du 23-7-2019](https://cache.media.education.gouv.fr/file/SPE8_MENJ_25_7_2019/92/0/spe255_annexe_1158920.pdf) | 2020 | 1 |
| terminale | Langues vivantes | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/70/3/spe585_annexe2CORR_1063703.pdf) | 2020 | 2 |
| terminale | Langues, littératures et cultures étrangères et régionales - anglais | [arrêté du 19-7-2019 - J.O. du 23-7-2019](https://cache.media.education.gouv.fr/file/SPE8_MENJ_25_7_2019/99/9/spe256_annexe2_1158999.pdf) | 2020 | 2 |
| terminale | Mathématiques | [arrêté du 19-7-2019 - J.O. du 23-7-2019](https://cache.media.education.gouv.fr/file/SPE8_MENJ_25_7_2019/90/7/spe246_annexe_1158907.pdf) | 2020 | 19 |
| terminale | Mathématiques complémentaires | [arrêté du 19-7-2019 - J.O. du 23-7-2019](https://cache.media.education.gouv.fr/file/SPE8_MENJ_25_7_2019/13/4/spe265_annexe_1159134.pdf) | 2020 | 19 |
| terminale | Mathématiques expertes | [arrêté du 19-7-2019 - J.O. du 23-7-2019](https://cache.media.education.gouv.fr/file/SPE8_MENJ_25_7_2019/82/5/spe264_annexe_1158825.pdf) | 2020 | 19 |
| terminale | Numérique et sciences informatiques | [arrêté du 19-7-2019 - J.O. du 23-7-2019](https://cache.media.education.gouv.fr/file/SPE8_MENJ_25_7_2019/93/3/spe247_annexe_1158933.pdf) | 2020 | 2 |
| terminale | Philosophie | [arrêté du 19-7-2019 - J.O. du 23-7-2019](https://cache.media.education.gouv.fr/file/SPE8_MENJ_25_7_2019/15/9/spe238_annexe1_1159159.pdf) | 2020 | 18 |
| terminale | Physique-chimie | [arrêté du 19-7-2019 - J.O. du 23-7-2019](https://cache.media.education.gouv.fr/file/SPE8_MENJ_25_7_2019/92/9/spe249_annexe_1158929.pdf) | 2020 | 12 |
| terminale | Sciences de l'ingénieur | [arrêté du 17-1-2019 - J.O. du 20-1-2019](http://cache.media.education.gouv.fr/file/SP1-MEN-22-1-2019/43/6/spe640_annexe_1063436.pdf) | 2020 | 1 |
| terminale | Sciences de la vie et de la Terre | [arrêté du 19-7-2019 - J.O. du 23-7-2019](https://cache.media.education.gouv.fr/file/SPE8_MENJ_25_7_2019/11/4/spe252_annexe_1159114.pdf) | 2020 | 11 |
| terminale | Sciences économiques et sociales | [arrêté du 19-7-2019 - J.O. du 23-7-2019](https://cache.media.education.gouv.fr/file/SPE8_MENJ_25_7_2019/82/1/spe253_annexe_1158821.pdf) | 2020 | 6 |
