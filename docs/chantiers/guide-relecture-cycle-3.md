# Guide de relecture — notions des cycles 2, 3 et 4 (CP à 3e)

Ce guide aide à **valider** les 242 notions ajoutées pour le cycle 2 (CP, CE1, CE2, suffixe `-c2`), le cycle 3 (CM1, CM2 suffixe `-cm`, 6e suffixe `-6e`) et le cycle 4 (5e, 4e, 3e, suffixe `-c4`). Il **ne remplace pas la relecture humaine** : c'est un double contrôle. Les champs `relue`, `relue-version` et `relue-grille` des fiches ne doivent être renseignés qu'après une relecture réelle (grille v1 : [validation-maquettes.md](validation-maquettes.md)).

## 1. Double contrôle automatisé déjà réalisé

| Contrôle | Résultat |
|---|---|
| `npm run ci` (lint, build, contrôle des pages, référentiel, tests unitaires et navigateur) | vert ; chaque exercice est résolu par un test navigateur |
| Questions d'exemple routées vers leur notion, sans doublon avec le catalogue existant | vérifié ; plusieurs doublons corrigés |
| QCM : choix en double | aucun involontaire (quelques choix ne diffèrent que par une majuscule ou un point : c'est voulu) |
| QCM : position de la bonne réponse | **défaut trouvé et corrigé** (cycle 3) : la bonne réponse était le premier choix dans presque tous les QCM (le moteur ne mélange pas). Les choix sont maintenant ordonnés de façon déterministe, avec des positions à peu près équilibrées ; le cycle 2 est généré avec le même ordre |
| Exercices « nombre » : indices présents, réponse cohérente avec la solution | indices présents ; 12 solutions décrivent le raisonnement sans écrire le résultat (à relire, pas d'erreur détectée) |
| Faits vérifiables repris au programme (dates d'histoire, chiffres) | recoupés un à un lors de la rédaction, **mais non validés par une source officielle** |

**Double lecture des corrigés** : le fichier [guide-relecture-cycle-3-corriges.md](guide-relecture-cycle-3-corriges.md) liste, pour chaque notion, la réponse attendue de chaque exercice et les dates et chiffres cités. Sa relecture a fait corriger cinq points : (1) « court » proposé comme verbe, alors qu'il peut être adjectif ; (2) un choix de QCM de proportionnalité mal formulé ; (3) un pourcentage de citoyens athéniens trop précis (désormais « de l'ordre de 10 à 20 % ») ; (4) « ville la plus peuplée du monde », classement variable selon la source (question reformulée sur les mégalopoles de plus de 10 millions d'habitants) ; (5) une explication d'anglais bâclée. Un relecteur humain trouvera probablement d'autres points du même ordre.

**Limites connues** : (a) dans environ 38 % des QCM (47 % avant correction), la bonne réponse reste le choix le plus long ; l'écart marqué (au moins 1,4 fois plus long et 8 caractères de plus) est passé de 102 cas à 2, qui tiennent à la question elle-même (« le plus précis », « Mais est… ») ; 102 mauvaises réponses absurdes ont été réécrites en réponses plausibles ; (b) la matrice de couverture de [catalogue-primaire.md](catalogue-primaire.md) est un rapprochement interne, pas un contrôle du programme officiel ; (c) l'EPS ne traite que les savoirs ; seul l'anglais est couvert en langues vivantes ; (d) pour le cycle 4, la bonne réponse est la plus longue dans environ 49 % des QCM (définitions longues par nature) ; (e) pour le cycle 2, le vocabulaire est volontairement simple : vérifier qu'il reste adapté à des enfants de 6 à 8 ans.

## 2. Comment relire (30 minutes par matière environ)

Pour le **cycle 2**, vérifier en plus : phrases courtes, consignes compréhensibles par un enfant qui apprend à lire, exercices sans piège, bienveillance du ton.

1. Ouvrir l'aperçu de la PR (Cloudflare Pages), page `/catalogue/<id>/page.html`, sur téléphone puis sur ordinateur.
2. Parcourir les trois onglets : Explication (niveaux du plus intuitif au plus formel), S'entraîner, Défi.
3. **Refaire chaque exercice** sans regarder la solution, puis comparer avec la correction.
4. Appliquer les 7 critères de la grille v1 (cases de la section « Relecture pédagogique » de la PR).
5. Noter les corrections à faire dans un commentaire de PR (ou une issue) ; elles seront reprises avant de renseigner `relue*`.

## 3. Points de vigilance par matière

| Matière | À vérifier en priorité |
|---|---|
| mathematiques | Calculs et corrigés (refaire chaque exercice à la main) ; règle énoncée exacte ; unités. |
| francais | Règle de grammaire énoncée sans exception fausse ; une seule bonne réponse par QCM ; exemples corrects. |
| histoire | Dates, noms, lieux ; formulations prudentes (traditions, conventions) ; sujets sensibles (Shoah, esclavage, religions) traités sans simplification abusive. |
| geographie | Chiffres (population, densité, nombre de régions) à jour ; noms de lieux ; neutralité. |
| emc | Neutralité (laïcité, vote), numéros d'urgence exacts (15, 17, 18, 112, 119, 3018), tonalité adaptée à l'âge. |
| svt | Définitions scientifiques exactes ; pas de simplification trompeuse (ex. classification, puberté). |
| physique-chimie | Valeurs (100 °C, 340 m/s, 1,2 g/L d'air…), vocabulaire (fusion, vaporisation), sécurité électrique. |
| technologie | Vocabulaire (besoin, fonction, chaîne d'information) ; matériaux. |
| anglais | Orthographe et prononciation implicite ; tournures naturelles (I am ten) ; cohérence fr/en. |
| arts-plastiques | Attributions d'œuvres et mouvements ; couleurs primaires (modèle soustractif). |
| musique | Valeurs des notes ; noms et dates des compositeurs. |
| eps | Recommandations de santé (60 min/jour) ; consignes de sécurité ; pas de conseil médical. |

## 4. Liste des notions à relire

Cocher la dernière colonne après relecture. « Ex. » = nombre d'exercices (entraînement + défi).

### francais (42)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `accords-cm` | Les accords : sujet-verbe, groupe nominal, participe passé | CM1 / CM2 | 5 | ☐ |
| `conjugaison-cm` | La conjugaison : temps simples et composés | CM1 / CM2 | 5 | ☐ |
| `contes-fables-mythes-6e` | Contes, fables et récits mythologiques | 6e | 5 | ☐ |
| `denoncer-les-travers-de-la-societe-c4` | Dénoncer les travers de la société : satire et fables | 3e | 5 | ☐ |
| `discours-rapporte-cm` | Le discours rapporté et le théâtre | CM2 | 5 | ☐ |
| `ecrire-et-comptines-c2` | Écrire une phrase, un texte, un poème | CP / CE1 / CE2 | 5 | ☐ |
| `ecrire-et-reecrire-c4` | Écrire, argumenter et réécrire au collège | 5e / 4e / 3e | 5 | ☐ |
| `ecrire-pour-raconter-et-decrire-6e` | Écrire pour raconter, décrire et exprimer en 6e | 6e | 5 | ☐ |
| `ecrire-un-recit-cm` | Écrire un récit | CM1 / CM2 | 5 | ☐ |
| `fonctions-dans-la-phrase-cm` | Les fonctions dans la phrase | CM1 / CM2 | 5 | ☐ |
| `formation-des-mots-cm` | La formation des mots | CM1 / CM2 | 5 | ☐ |
| `grammaire-de-la-phrase-5e-c4` | Grammaire de la phrase en 5e : fonctions, expansions, propositions | 5e | 5 | ☐ |
| `groupe-nominal-cm` | Le groupe nominal et ses expansions | CM1 / CM2 | 5 | ☐ |
| `homophones-cm` | Les homophones grammaticaux | CM1 / CM2 | 5 | ☐ |
| `homophones-et-orthographe-c2` | Homophones et mots à connaître | CE1 / CE2 | 5 | ☐ |
| `la-phrase-c2` | La phrase : majuscule, point et sens | CP / CE1 | 5 | ☐ |
| `lecture-comprehension-cm` | Comprendre un texte | CM1 / CM2 | 5 | ☐ |
| `lettres-et-sons-c2` | Les lettres et les sons | CP | 5 | ☐ |
| `lire-et-comprendre-c2` | Lire et comprendre un texte | CP / CE1 / CE2 | 5 | ☐ |
| `nature-des-mots-cm` | La nature des mots | CM1 / CM2 | 5 | ☐ |
| `noms-et-determinants-c2` | Le nom et le déterminant | CE1 | 5 | ☐ |
| `orthographe-grammaticale-6e` | Accords et orthographe grammaticale en 6e | 6e | 5 | ☐ |
| `orthographe-lexicale-cm` | L'orthographe des mots | CM1 / CM2 | 5 | ☐ |
| `poesie-6e` | Le monde poétique en 6e | 6e | 5 | ☐ |
| `poesie-cm` | La poésie : vers, strophes et rimes | CM1 / CM2 | 5 | ☐ |
| `ponctuation-et-dialogue-cm` | La ponctuation et le dialogue | CM1 / CM2 | 5 | ☐ |
| `pronoms-et-reprises-cm` | Pronoms, reprises et cohérence d'un texte | CM2 | 5 | ☐ |
| `recit-d-aventures-6e` | Lire un récit d'aventures | 6e | 5 | ☐ |
| `recits-d-aventures-et-voyages-c4` | Récits d'aventures, voyages et héros | 5e | 5 | ☐ |
| `resumer-et-expliquer-cm` | Résumer, expliquer et écrire un texte documentaire | CM1 / CM2 | 5 | ☐ |
| `singulier-pluriel-masculin-feminin-c2` | Pluriel, féminin et accords | CE1 / CE2 | 5 | ☐ |
| `sujet-verbe-complements-6e` | Sujet, verbe et compléments en 6e | 6e | 5 | ☐ |
| `syllabes-et-mots-c2` | Les syllabes et la lecture de mots | CP | 5 | ☐ |
| `temps-des-verbes-c2` | Passé, présent, futur : conjuguer les verbes | CE1 / CE2 | 5 | ☐ |
| `temps-du-recit-6e` | Les temps du récit : passé simple et imparfait | 6e | 5 | ☐ |
| `types-de-textes-cm` | Les types de textes | CM1 / CM2 | 5 | ☐ |
| `types-et-formes-de-phrases-cm` | Types et formes de phrases | CM1 / CM2 | 5 | ☐ |
| `verbe-sujet-adjectif-c2` | Le verbe, le sujet et l'adjectif | CE1 / CE2 | 5 | ☐ |
| `vocabulaire-cm` | Le vocabulaire : sens des mots, synonymes, contraires | CM1 / CM2 | 5 | ☐ |
| `vocabulaire-et-dictionnaire-c2` | Vocabulaire, ordre alphabétique et dictionnaire | CE1 / CE2 | 5 | ☐ |
| `vocabulaire-et-etymologie-6e` | Vocabulaire, étymologie et familles de mots en 6e | 6e | 5 | ☐ |
| `vocabulaire-et-orthographe-c4` | Vocabulaire, orthographe et accords au collège | 5e / 4e / 3e | 5 | ☐ |

### mathematiques (64)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `addition-c2` | L'addition | CP / CE1 / CE2 | 5 | ☐ |
| `addition-soustraction-posees-cm` | Additions et soustractions posées | CM1 / CM2 | 5 | ☐ |
| `algorithmes-programmation-cm` | Algorithmes et programmation | CM1 / CM2 | 5 | ☐ |
| `algorithmique-6e` | Algorithmes et programmation en 6e | 6e | 5 | ☐ |
| `algorithmique-et-scratch-c4` | Algorithmique et programmation | 5e / 4e / 3e | 5 | ☐ |
| `angles-cm` | Les angles | CM1 / CM2 | 5 | ☐ |
| `calcul-avec-decimaux-cm` | Calculer avec des nombres décimaux | CM2 | 5 | ☐ |
| `calcul-mental-cm` | Le calcul mental | CM1 / CM2 | 5 | ☐ |
| `cercle-compas-cm` | Le cercle et le compas | CM1 / CM2 | 5 | ☐ |
| `comparer-et-ranger-c2` | Comparer et ranger des nombres | CP / CE1 / CE2 | 5 | ☐ |
| `constructions-geometriques-6e` | Droites, cercles et constructions en 6e | 6e | 5 | ☐ |
| `division-et-partage-c2` | Partager et regrouper | CE2 | 5 | ☐ |
| `division-euclidienne-cm` | La division euclidienne | CM1 / CM2 | 5 | ☐ |
| `divisions-6e` | Divisions et multiples en 6e | 6e | 5 | ☐ |
| `doubles-et-moities-c2` | Les doubles et les moitiés | CP / CE1 | 5 | ☐ |
| `droites-cm` | Droites parallèles et perpendiculaires | CM1 / CM2 | 5 | ☐ |
| `durees-et-horaires-cm` | Durées et horaires | CM1 / CM2 | 5 | ☐ |
| `echelle-et-plans-cm` | Échelles et plans | CM2 | 5 | ☐ |
| `entiers-et-operations-6e` | Nombres entiers et opérations en 6e | 6e | 5 | ☐ |
| `figures-planes-c2` | Les figures planes | CP / CE1 / CE2 | 5 | ☐ |
| `fractions-cm` | Les fractions au CM | CM1 / CM2 | 5 | ☐ |
| `fractions-operations-cm` | Fractions : décimales, sommes et comparaisons | CM2 | 5 | ☐ |
| `fractions-simples-c2` | Les fractions simples : moitié, tiers, quart | CE1 / CE2 | 5 | ☐ |
| `grandeurs-et-mesures-6e` | Grandeurs et mesures en 6e : longueurs, durées, masses | 6e | 5 | ☐ |
| `grands-nombres-cm` | Les grands nombres (jusqu'au milliard) | CM1 / CM2 | 5 | ☐ |
| `heure-et-calendrier-c2` | L'heure, les jours et le calendrier | CP / CE1 / CE2 | 5 | ☐ |
| `longueurs-et-mesures-c2` | Mesurer des longueurs | CE1 / CE2 | 5 | ☐ |
| `longueurs-masses-contenances-cm` | Longueurs, masses et contenances | CM1 / CM2 | 5 | ☐ |
| `masses-et-contenances-c2` | Masses et contenances | CE1 / CE2 | 5 | ☐ |
| `monnaie-et-euro-c2` | La monnaie : euros et centimes | CP / CE1 / CE2 | 5 | ☐ |
| `moyenne-et-proportions-cm` | Moyenne, pourcentages et comparaison de données | CM2 | 5 | ☐ |
| `multiples-et-diviseurs-cm` | Multiples, diviseurs et critères de divisibilité | CM2 | 5 | ☐ |
| `multiplication-posee-ce2-c2` | Multiplier un grand nombre (CE2) | CE2 | 5 | ☐ |
| `multiplication-posee-cm` | La multiplication posée et les tables | CM1 / CM2 | 5 | ☐ |
| `nombres-decimaux-cm` | Les nombres décimaux au CM | CM1 / CM2 | 5 | ☐ |
| `nombres-jusqu-a-100-c2` | Les nombres jusqu'à 100 | CP | 5 | ☐ |
| `nombres-jusqu-a-1000-c2` | Les nombres jusqu'à 1 000 | CE1 | 5 | ☐ |
| `nombres-jusqu-a-10000-c2` | Les nombres jusqu'à 10 000 | CE2 | 5 | ☐ |
| `notion-de-fonction-c4` | La notion de fonction | 3e | 5 | ☐ |
| `parallelogrammes-et-symetrie-centrale-c4` | Parallélogrammes et symétrie centrale | 5e | 5 | ☐ |
| `perimetre-aire-cm` | Périmètre et aire | CM1 / CM2 | 5 | ☐ |
| `perimetre-et-calcul-mental-c2` | Périmètre et calcul mental | CE2 | 5 | ☐ |
| `polygones-cm` | Triangles et quadrilatères | CM1 / CM2 | 5 | ☐ |
| `pourcentages-et-evolutions-c4` | Pourcentages, évolutions et taux | 5e / 4e | 5 | ☐ |
| `problemes-a-etapes-cm` | Résoudre des problèmes à plusieurs étapes | CM1 / CM2 | 5 | ☐ |
| `problemes-c2` | Résoudre des petits problèmes | CP / CE1 / CE2 | 5 | ☐ |
| `proportionnalite-cm` | La proportionnalité | CM2 | 5 | ☐ |
| `racines-carrees-c4` | Les racines carrées | 3e | 5 | ☐ |
| `reperage-et-donnees-6e` | Repérage, tableaux et graphiques en 6e | 6e | 5 | ☐ |
| `reperage-plan-cm` | Se repérer : quadrillage, plan et coordonnées | CM1 / CM2 | 5 | ☐ |
| `reproduire-et-agrandir-cm` | Reproduire, décrire et agrandir une figure | CM1 / CM2 | 5 | ☐ |
| `solides-c2` | Les solides | CP / CE1 / CE2 | 5 | ☐ |
| `solides-cm` | Les solides | CM1 / CM2 | 5 | ☐ |
| `soustraction-c2` | La soustraction | CP / CE1 / CE2 | 5 | ☐ |
| `symetrie-axiale-6e` | Symétrie axiale en 6e | 6e | 5 | ☐ |
| `symetrie-axiale-cm` | La symétrie axiale | CM1 / CM2 | 5 | ☐ |
| `symetrie-et-reperage-c2` | Symétrie et repérage sur quadrillage | CE1 / CE2 | 5 | ☐ |
| `tableaux-et-algorithmes-c2` | Tableaux, graphiques et petits programmes | CE1 / CE2 | 5 | ☐ |
| `tableaux-graphiques-cm` | Tableaux et graphiques | CM1 / CM2 | 5 | ☐ |
| `tables-de-multiplication-c2` | Multiplier : sens et tables | CE1 / CE2 | 5 | ☐ |
| `triangles-et-constructions-c4` | Triangles : angles, droites remarquables et constructions | 5e / 4e | 5 | ☐ |
| `triangles-et-quadrilateres-6e` | Triangles et quadrilatères en 6e | 6e | 5 | ☐ |
| `trigonometrie-triangle-rectangle-c4` | Trigonométrie dans le triangle rectangle | 4e / 3e | 5 | ☐ |
| `volumes-contenances-cm` | Volumes et contenances | CM2 | 5 | ☐ |

### histoire (26)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `age-industriel-cm` | L'âge industriel en France | CM2 | 5 | ☐ |
| `chretientes-et-islam-c4` | Chrétientés et islam (VIe-XIIIe siècles) | 5e | 5 | ☐ |
| `clovis-charlemagne-cm` | Clovis et Charlemagne | CM1 | 5 | ☐ |
| `colonisations-c4` | Les colonisations au XIXe siècle | 4e | 5 | ☐ |
| `empire-romain-christianisme-6e` | L'Empire romain et la naissance du christianisme | 6e | 5 | ☐ |
| `feodalite-eglise-et-pouvoirs-c4` | Seigneurs, paysans, Église et pouvoir royal | 5e | 5 | ☐ |
| `france-europe-depuis-1945-cm` | La France depuis 1945 et la construction européenne | CM2 | 5 | ☐ |
| `francois-ier-cm` | François Ier et la Renaissance | CM1 | 5 | ☐ |
| `gaulois-gallo-romains-cm` | Les Gaulois et les Gallo-Romains | CM1 | 5 | ☐ |
| `grandes-periodes-c2` | Les grandes périodes de l'histoire | CE2 | 5 | ☐ |
| `grece-et-citoyennete-6e` | La Grèce antique : citoyens et démocratie | 6e | 5 | ☐ |
| `guerres-mondiales-cm` | Les deux guerres mondiales | CM2 | 5 | ☐ |
| `henri-iv-cm` | Henri IV et l'édit de Nantes | CM1 | 5 | ☐ |
| `louis-ix-cm` | Louis IX (Saint Louis) et le Moyen Âge chrétien | CM1 | 5 | ☐ |
| `louis-xiv-cm` | Louis XIV, le Roi-Soleil | CM1 | 5 | ☐ |
| `monotheisme-juif-6e` | Le monothéisme juif dans un monde polythéiste | 6e | 5 | ☐ |
| `peuplement-neolithique-6e` | Les débuts de l'humanité et le Néolithique | 6e | 5 | ☐ |
| `prehistoire-cm` | De la Préhistoire à l'Antiquité : les premières traces | CM1 | 5 | ☐ |
| `premieres-civilisations-6e` | Mésopotamie et Égypte : les premiers États | 6e | 5 | ☐ |
| `republique-ecole-cm` | La République, l'école et les libertés | CM2 | 5 | ☐ |
| `revolution-empire-cm` | La Révolution française et l'Empire | CM2 | 5 | ☐ |
| `rome-republique-empire-6e` | Rome : de la République à l'Empire | 6e | 5 | ☐ |
| `se-reperer-dans-le-temps-c2` | Se repérer dans le temps : jours, mois, générations | CP / CE1 | 5 | ☐ |
| `societe-et-culture-au-xixe-c4` | Société, droits et culture au XIXe siècle | 4e | 5 | ☐ |
| `traites-et-esclavage-c4` | Les traites négrières et l'esclavage | 4e | 5 | ☐ |
| `voyages-d-ulysse-6e` | Récits fondateurs : les voyages d'Ulysse et la Méditerranée | 6e | 5 | ☐ |

### physique-chimie (15)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `air-et-matiere-cm` | L'air, un gaz qui occupe de la place | CM1 / CM2 | 5 | ☐ |
| `eau-air-et-matiere-c2` | L'eau, l'air et les matières | CE1 / CE2 | 5 | ☐ |
| `electricite-circuits-cm` | Électricité : circuits, conducteurs et sécurité | CM1 / CM2 | 5 | ☐ |
| `energie-et-signaux-6e` | Énergie, signaux lumineux et sonores en 6e | 6e | 5 | ☐ |
| `energie-et-sources-cm` | L'énergie et ses sources | CM1 / CM2 | 5 | ☐ |
| `etats-et-changements-cm` | Les états de la matière et leurs changements | CM1 / CM2 | 5 | ☐ |
| `etats-matiere-et-melanges-6e` | États de la matière, mélanges et masse en 6e | 6e | 5 | ☐ |
| `lumiere-et-ombres-cm` | Lumière, ombres et son | CM1 / CM2 | 5 | ☐ |
| `lumiere-et-son-6e` | Signaux lumineux et sonores en 6e | 6e | 5 | ☐ |
| `masse-et-volume-6e` | Masse, volume et mélanges en 6e | 6e | 5 | ☐ |
| `melanges-et-solutions-cm` | Mélanges, dissolution et séparation | CM1 / CM2 | 5 | ☐ |
| `mouvement-et-vitesse-6e` | Mouvement, vitesse et référentiel en 6e | 6e | 5 | ☐ |
| `mouvement-et-vitesse-cm` | Mouvement et vitesse | CM2 | 5 | ☐ |
| `signaux-et-information-c4` | Signaux, ondes et transmission de l'information | 4e / 3e | 5 | ☐ |
| `transformations-chimiques-c4` | Transformations chimiques et réactions | 4e / 3e | 5 | ☐ |

### svt (21)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `alimentation-digestion-cm` | L'alimentation et la digestion | CM1 / CM2 | 5 | ☐ |
| `animaux-et-plantes-c2` | Les animaux et les plantes | CP / CE1 | 5 | ☐ |
| `besoins-et-vie-c2` | Se nourrir, grandir, se reproduire | CE1 / CE2 | 5 | ☐ |
| `biodiversite-et-chaines-cm` | Biodiversité et chaînes alimentaires | CM1 / CM2 | 5 | ☐ |
| `classification-du-vivant-6e` | Classer le vivant et la biodiversité en 6e | 6e | 5 | ☐ |
| `classification-du-vivant-cm` | Classer les êtres vivants | CM1 / CM2 | 5 | ☐ |
| `corps-et-sante-c2` | Mon corps et ma santé | CP / CE1 / CE2 | 5 | ☐ |
| `developpement-vegetaux-cm` | Le développement des végétaux | CM1 / CM2 | 5 | ☐ |
| `evolution-et-fossiles-cm` | Fossiles et évolution des espèces | CM2 | 5 | ☐ |
| `meteo-et-climat-c4` | Météorologie et climat | 4e | 5 | ☐ |
| `microbes-et-sante-c4` | Micro-organismes, hygiène et santé | 4e | 5 | ☐ |
| `milieux-et-saisons-c2` | Les milieux de vie et les saisons | CE1 / CE2 | 5 | ☐ |
| `nutrition-et-alimentation-6e` | Nutrition et alimentation en 6e | 6e | 5 | ☐ |
| `organisme-et-effort-6e` | Fonctionnement de l'organisme à l'effort | 6e | 5 | ☐ |
| `reproduction-et-cycles-de-vie-6e` | Reproduction et cycles de vie en 6e | 6e | 5 | ☐ |
| `reproduction-et-puberte-cm` | Naissance, croissance et puberté | CM2 | 5 | ☐ |
| `respiration-circulation-cm` | Respiration, cœur et circulation du sang | CM2 | 5 | ☐ |
| `sante-et-prevention-c4` | Santé : sommeil, addictions et prévention | 3e | 5 | ☐ |
| `terre-dans-le-systeme-solaire-6e` | La Terre dans le système solaire en 6e | 6e | 5 | ☐ |
| `terre-et-systeme-solaire-cm` | La Terre, la Lune et le système solaire | CM1 / CM2 | 5 | ☐ |
| `volcans-et-seismes-cm` | Volcans, séismes et risques naturels | CM2 | 5 | ☐ |

### anglais (11)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `anglais-3e-c4` | Anglais 3e : conditionnel, passif et expression de l'opinion | 3e | 5 | ☐ |
| `anglais-4e-c4` | Anglais 4e : present perfect, futur et modaux | 4e | 5 | ☐ |
| `anglais-5e-c4` | Anglais 5e : passé, comparaison et vie quotidienne | 5e | 5 | ☐ |
| `anglais-bonjour-c2` | Anglais : dire bonjour, compter, les couleurs | CP / CE1 | 5 | ☐ |
| `anglais-famille-et-animaux-c2` | Anglais : la famille, les animaux, les objets | CE1 / CE2 | 5 | ☐ |
| `anglais-gouts-et-actions-cm` | Anglais : goûts, nourriture et actions du quotidien | CM2 | 5 | ☐ |
| `anglais-lieux-et-pays-cm` | Anglais : lieux, pays et directions | CM2 | 5 | ☐ |
| `anglais-routine-et-habiletes-6e` | Anglais 6e : routine quotidienne, goûts et capacités | 6e | 5 | ☐ |
| `anglais-se-presenter-6e` | Anglais 6e : se présenter, famille et école | 6e | 5 | ☐ |
| `anglais-se-presenter-cm` | Anglais : se présenter et saluer | CM1 / CM2 | 5 | ☐ |
| `anglais-vocabulaire-quotidien-cm` | Anglais : couleurs, nombres, famille et objets | CM1 / CM2 | 5 | ☐ |

### arts-plastiques (6)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `arts-couleurs-cm` | Arts plastiques : couleurs et matières | CM1 / CM2 | 5 | ☐ |
| `arts-couleurs-et-formes-c2` | Arts plastiques : couleurs, formes et œuvres | CP / CE1 / CE2 | 5 | ☐ |
| `arts-formes-et-composition-cm` | Arts plastiques : lignes, formes, perspective et artistes | CM2 | 5 | ☐ |
| `arts-image-et-representation-c4` | Arts plastiques : l'image, la représentation et les dispositifs | 5e / 4e | 5 | ☐ |
| `arts-oeuvre-et-engagement-c4` | Arts plastiques : art, société et engagement | 3e | 5 | ☐ |
| `arts-representation-et-espace-6e` | Arts plastiques 6e : représenter l'espace, la matière et la couleur | 6e | 5 | ☐ |

### emc (18)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `citoyen-et-engagement-cm` | Être citoyen : voter, s'engager, participer | CM1 / CM2 | 5 | ☐ |
| `defense-et-paix-c4` | Défense, paix et sécurité collective | 3e | 5 | ☐ |
| `devise-republique-cm` | La devise et les symboles de la République | CM1 / CM2 | 5 | ☐ |
| `droit-et-regle-6e` | Le droit et la règle : lois, règlement, justice | 6e | 5 | ☐ |
| `droits-de-l-enfant-cm` | Les droits de l'enfant | CM1 / CM2 | 5 | ☐ |
| `engagement-et-solidarite-6e` | S'engager : solidarité, délégués et vie du collège | 6e | 5 | ☐ |
| `esprit-critique-et-medias-6e` | Esprit critique : s'informer et vérifier | 6e | 5 | ☐ |
| `esprit-critique-et-medias-c4` | Esprit critique, médias et information | 5e / 4e | 5 | ☐ |
| `laicite-et-liberte-cm` | La laïcité et la liberté d'expression | CM2 | 5 | ☐ |
| `numerique-et-donnees-c4` | Le numérique : données personnelles, réseaux et droits | 4e / 3e | 5 | ☐ |
| `numerique-responsable-cm` | Un usage responsable d'Internet et des écrans | CM1 / CM2 | 5 | ☐ |
| `regles-et-justice-cm` | Règles, lois et justice | CM1 / CM2 | 5 | ☐ |
| `regles-vivre-ensemble-6e` | Vivre ensemble : règles, égalité et lutte contre les discriminations | 6e | 5 | ☐ |
| `republique-et-citoyens-c2` | La République, ses symboles et les droits | CE1 / CE2 | 5 | ☐ |
| `respect-et-egalite-cm` | Respect, égalité et lutte contre le harcèlement | CM1 / CM2 | 5 | ☐ |
| `securite-ecrans-et-environnement-c2` | Sécurité, écrans et protection de la planète | CP / CE1 / CE2 | 5 | ☐ |
| `securite-et-prevention-cm` | Sécurité, prévention et premiers secours | CM1 / CM2 | 5 | ☐ |
| `vivre-ensemble-c2` | Vivre ensemble : respect, règles et émotions | CP / CE1 / CE2 | 5 | ☐ |

### geographie (18)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `communiquer-numerique-cm` | Communiquer d'un bout à l'autre du monde | CM2 | 5 | ☐ |
| `croquis-et-cartes-c4` | Lire des cartes, réaliser un croquis | 5e / 4e / 3e | 5 | ☐ |
| `france-europe-monde-cm` | La France, l'Europe et le monde | CM2 | 5 | ☐ |
| `habiter-6e` | Habiter une métropole, un littoral, un désert | 6e | 5 | ☐ |
| `habiter-la-terre-6e` | Habiter la Terre : répartition et inégalités | 6e | 5 | ☐ |
| `habiter-le-littoral-6e` | Habiter le littoral | 6e | 5 | ☐ |
| `habiter-un-espace-de-faible-densite-6e` | Habiter un espace de faible densité | 6e | 5 | ☐ |
| `habiter-une-metropole-6e` | Habiter une métropole | 6e | 5 | ☐ |
| `habiter-ville-campagne-cm` | Habiter en ville ou à la campagne | CM1 | 5 | ☐ |
| `lire-une-carte-cm` | Lire une carte et se repérer | CM1 / CM2 | 5 | ☐ |
| `mieux-habiter-cm` | Mieux habiter : ville durable et risques | CM2 | 5 | ☐ |
| `monde-en-villes-cm` | La Terre : continents, océans et villes du monde | CM2 | 5 | ☐ |
| `paysages-et-habiter-c2` | Les paysages et la façon d'habiter | CE1 / CE2 | 5 | ☐ |
| `paysages-et-ressources-cm` | Paysages de France et ressources | CM1 | 5 | ☐ |
| `planete-terre-et-cartes-c2` | La planète Terre : continents et océans | CE2 | 5 | ☐ |
| `question-demographique-c4` | La question démographique et l'inégal accès aux ressources | 5e | 5 | ☐ |
| `se-deplacer-transports-cm` | Se déplacer et transporter | CM2 | 5 | ☐ |
| `se-reperer-dans-l-espace-c2` | Se repérer dans l'espace, lire un plan | CP / CE1 / CE2 | 5 | ☐ |

### technologie (9)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `conception-et-prototypage-c4` | Technologie : concevoir, prototyper, tester | 5e / 4e / 3e | 5 | ☐ |
| `energie-et-materiaux-c4` | Énergie, matériaux et développement durable | 5e / 4e / 3e | 5 | ☐ |
| `materiaux-et-environnement-6e` | Matériaux, impact environnemental et recyclage en 6e | 6e | 5 | ☐ |
| `materiaux-et-recyclage-cm` | Matériaux, déchets et recyclage | CM1 / CM2 | 5 | ☐ |
| `objets-connectes-et-programmation-c4` | Objets connectés, capteurs et programmation | 4e / 3e | 5 | ☐ |
| `objets-electriques-et-materiaux-c2` | Les objets : matériaux, électricité et mouvement | CE1 / CE2 | 5 | ☐ |
| `objets-techniques-6e` | Objets techniques, matériaux et programmation en 6e | 6e | 5 | ☐ |
| `objets-techniques-cm` | Les objets techniques : besoin, fonction, matériaux | CM1 / CM2 | 5 | ☐ |
| `programmation-et-robots-6e` | Programmer un objet : capteurs, algorithmes et robots | 6e | 5 | ☐ |

### eps (6)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `eps-bouger-et-jouer-c2` | EPS : bouger, jouer et rester en sécurité | CP / CE1 / CE2 | 5 | ☐ |
| `eps-endurance-et-sante-c4` | EPS : endurance, force et santé au collège | 5e / 4e / 3e | 5 | ☐ |
| `eps-endurance-et-sports-collectifs-6e` | EPS 6e : endurance, santé et sports collectifs | 6e | 5 | ☐ |
| `eps-jeux-collectifs-et-athletisme-cm` | EPS : jeux collectifs, athlétisme et natation | CM1 / CM2 | 5 | ☐ |
| `eps-sante-et-echauffement-cm` | EPS : échauffement, santé et effort | CM1 / CM2 | 5 | ☐ |
| `eps-sports-collectifs-et-arbitrage-c4` | EPS : sports collectifs, tactique et arbitrage | 5e / 4e / 3e | 5 | ☐ |

### musique (6)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `musique-creation-et-engagement-c4` | Musique : création, engagement et culture | 3e | 5 | ☐ |
| `musique-genres-et-formes-c4` | Musique : genres, formes et écoute | 5e / 4e | 5 | ☐ |
| `musique-lire-et-chanter-6e` | Musique 6e : rythme, mélodie et écoute | 6e | 5 | ☐ |
| `musique-notes-et-rythme-cm` | Musique : notes, rythme et instruments | CM1 / CM2 | 5 | ☐ |
| `musique-sons-et-chansons-c2` | Musique : les sons, le rythme et les chansons | CP / CE1 / CE2 | 5 | ☐ |
| `musique-voix-et-ecoute-cm` | Musique : voix, chant et culture musicale | CM2 | 5 | ☐ |

