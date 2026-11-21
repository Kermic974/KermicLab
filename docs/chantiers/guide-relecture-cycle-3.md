# Guide de relecture — notions du cycle 3 (CM1, CM2, 6e)

Ce guide aide à **valider** les 152 notions ajoutées par la PR #398. Il **ne remplace pas la relecture humaine** : c'est un double contrôle. Les champs `relue`, `relue-version` et `relue-grille` des fiches ne doivent être renseignés qu'après une relecture réelle (grille v1 : [validation-maquettes.md](validation-maquettes.md)).

## 1. Double contrôle automatisé déjà réalisé

| Contrôle | Résultat |
|---|---|
| `npm run ci` (lint, build, contrôle des pages, référentiel, tests unitaires et navigateur) | vert ; chaque exercice est résolu par un test navigateur |
| Questions d'exemple routées vers leur notion, sans doublon avec le catalogue existant | vérifié ; plusieurs doublons corrigés |
| QCM : choix en double | aucun (479 QCM) |
| QCM : position de la bonne réponse | **défaut trouvé et corrigé** : la bonne réponse était le premier choix dans 478 QCM sur 479 (le moteur ne mélange pas). Les choix sont maintenant ordonnés de façon déterministe : positions 1 à 4 ≈ 23 % / 25 % / 26 % / 26 % |
| Exercices « nombre » : indices présents, réponse cohérente avec la solution | indices présents ; 12 solutions décrivent le raisonnement sans écrire le résultat (à relire, pas d'erreur détectée) |
| Faits vérifiables repris au programme (dates d'histoire, chiffres) | recoupés un à un lors de la rédaction, **mais non validés par une source officielle** |

**Double lecture des corrigés** : le fichier [guide-relecture-cycle-3-corriges.md](guide-relecture-cycle-3-corriges.md) liste, pour chaque notion, la réponse attendue de chaque exercice et les dates et chiffres cités. Sa relecture a fait corriger cinq points : (1) « court » proposé comme verbe, alors qu'il peut être adjectif ; (2) un choix de QCM de proportionnalité mal formulé ; (3) un pourcentage de citoyens athéniens trop précis (désormais « de l'ordre de 10 à 20 % ») ; (4) « ville la plus peuplée du monde », classement variable selon la source (question reformulée sur les mégalopoles de plus de 10 millions d'habitants) ; (5) une explication d'anglais bâclée. Un relecteur humain trouvera probablement d'autres points du même ordre.

**Limites connues** : (a) dans environ 38 % des QCM (47 % avant correction), la bonne réponse reste le choix le plus long ; l'écart marqué (au moins 1,4 fois plus long et 8 caractères de plus) est passé de 102 cas à 2, qui tiennent à la question elle-même (« le plus précis », « Mais est… ») ; 102 mauvaises réponses absurdes ont été réécrites en réponses plausibles ; (b) la matrice de couverture de [catalogue-primaire.md](catalogue-primaire.md) est un rapprochement interne, pas un contrôle du programme officiel ; (c) l'EPS ne traite que les savoirs ; seul l'anglais est couvert en langues vivantes.

## 2. Comment relire (30 minutes par matière environ)

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

### francais (26)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `accords-cm` | Les accords : sujet-verbe, groupe nominal, participe passé | CM1 / CM2 | 5 | ☐ |
| `conjugaison-cm` | La conjugaison : temps simples et composés | CM1 / CM2 | 5 | ☐ |
| `contes-fables-mythes-6e` | Contes, fables et récits mythologiques | 6e | 5 | ☐ |
| `discours-rapporte-cm` | Le discours rapporté et le théâtre | CM2 | 5 | ☐ |
| `ecrire-pour-raconter-et-decrire-6e` | Écrire pour raconter, décrire et exprimer en 6e | 6e | 5 | ☐ |
| `ecrire-un-recit-cm` | Écrire un récit | CM1 / CM2 | 5 | ☐ |
| `fonctions-dans-la-phrase-cm` | Les fonctions dans la phrase | CM1 / CM2 | 5 | ☐ |
| `formation-des-mots-cm` | La formation des mots | CM1 / CM2 | 5 | ☐ |
| `groupe-nominal-cm` | Le groupe nominal et ses expansions | CM1 / CM2 | 5 | ☐ |
| `homophones-cm` | Les homophones grammaticaux | CM1 / CM2 | 5 | ☐ |
| `lecture-comprehension-cm` | Comprendre un texte | CM1 / CM2 | 5 | ☐ |
| `nature-des-mots-cm` | La nature des mots | CM1 / CM2 | 5 | ☐ |
| `orthographe-grammaticale-6e` | Accords et orthographe grammaticale en 6e | 6e | 5 | ☐ |
| `orthographe-lexicale-cm` | L'orthographe des mots | CM1 / CM2 | 5 | ☐ |
| `poesie-6e` | Le monde poétique en 6e | 6e | 5 | ☐ |
| `poesie-cm` | La poésie : vers, strophes et rimes | CM1 / CM2 | 5 | ☐ |
| `ponctuation-et-dialogue-cm` | La ponctuation et le dialogue | CM1 / CM2 | 5 | ☐ |
| `pronoms-et-reprises-cm` | Pronoms, reprises et cohérence d'un texte | CM2 | 5 | ☐ |
| `recit-d-aventures-6e` | Lire un récit d'aventures | 6e | 5 | ☐ |
| `resumer-et-expliquer-cm` | Résumer, expliquer et écrire un texte documentaire | CM1 / CM2 | 5 | ☐ |
| `sujet-verbe-complements-6e` | Sujet, verbe et compléments en 6e | 6e | 5 | ☐ |
| `temps-du-recit-6e` | Les temps du récit : passé simple et imparfait | 6e | 5 | ☐ |
| `types-de-textes-cm` | Les types de textes | CM1 / CM2 | 5 | ☐ |
| `types-et-formes-de-phrases-cm` | Types et formes de phrases | CM1 / CM2 | 5 | ☐ |
| `vocabulaire-cm` | Le vocabulaire : sens des mots, synonymes, contraires | CM1 / CM2 | 5 | ☐ |
| `vocabulaire-et-etymologie-6e` | Vocabulaire, étymologie et familles de mots en 6e | 6e | 5 | ☐ |

### mathematiques (36)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `addition-soustraction-posees-cm` | Additions et soustractions posées | CM1 / CM2 | 5 | ☐ |
| `algorithmes-programmation-cm` | Algorithmes et programmation | CM1 / CM2 | 5 | ☐ |
| `algorithmique-6e` | Algorithmes et programmation en 6e | 6e | 5 | ☐ |
| `angles-cm` | Les angles | CM1 / CM2 | 5 | ☐ |
| `calcul-avec-decimaux-cm` | Calculer avec des nombres décimaux | CM2 | 5 | ☐ |
| `calcul-mental-cm` | Le calcul mental | CM1 / CM2 | 5 | ☐ |
| `cercle-compas-cm` | Le cercle et le compas | CM1 / CM2 | 5 | ☐ |
| `constructions-geometriques-6e` | Droites, cercles et constructions en 6e | 6e | 5 | ☐ |
| `division-euclidienne-cm` | La division euclidienne | CM1 / CM2 | 5 | ☐ |
| `divisions-6e` | Divisions et multiples en 6e | 6e | 5 | ☐ |
| `droites-cm` | Droites parallèles et perpendiculaires | CM1 / CM2 | 5 | ☐ |
| `durees-et-horaires-cm` | Durées et horaires | CM1 / CM2 | 5 | ☐ |
| `echelle-et-plans-cm` | Échelles et plans | CM2 | 5 | ☐ |
| `entiers-et-operations-6e` | Nombres entiers et opérations en 6e | 6e | 5 | ☐ |
| `fractions-cm` | Les fractions au CM | CM1 / CM2 | 5 | ☐ |
| `fractions-operations-cm` | Fractions : décimales, sommes et comparaisons | CM2 | 5 | ☐ |
| `grandeurs-et-mesures-6e` | Grandeurs et mesures en 6e : longueurs, durées, masses | 6e | 5 | ☐ |
| `grands-nombres-cm` | Les grands nombres (jusqu'au milliard) | CM1 / CM2 | 5 | ☐ |
| `longueurs-masses-contenances-cm` | Longueurs, masses et contenances | CM1 / CM2 | 5 | ☐ |
| `moyenne-et-proportions-cm` | Moyenne, pourcentages et comparaison de données | CM2 | 5 | ☐ |
| `multiples-et-diviseurs-cm` | Multiples, diviseurs et critères de divisibilité | CM2 | 5 | ☐ |
| `multiplication-posee-cm` | La multiplication posée et les tables | CM1 / CM2 | 5 | ☐ |
| `nombres-decimaux-cm` | Les nombres décimaux au CM | CM1 / CM2 | 5 | ☐ |
| `perimetre-aire-cm` | Périmètre et aire | CM1 / CM2 | 5 | ☐ |
| `polygones-cm` | Triangles et quadrilatères | CM1 / CM2 | 5 | ☐ |
| `problemes-a-etapes-cm` | Résoudre des problèmes à plusieurs étapes | CM1 / CM2 | 5 | ☐ |
| `proportionnalite-cm` | La proportionnalité | CM2 | 5 | ☐ |
| `reperage-et-donnees-6e` | Repérage, tableaux et graphiques en 6e | 6e | 5 | ☐ |
| `reperage-plan-cm` | Se repérer : quadrillage, plan et coordonnées | CM1 / CM2 | 5 | ☐ |
| `reproduire-et-agrandir-cm` | Reproduire, décrire et agrandir une figure | CM1 / CM2 | 5 | ☐ |
| `solides-cm` | Les solides | CM1 / CM2 | 5 | ☐ |
| `symetrie-axiale-6e` | Symétrie axiale en 6e | 6e | 5 | ☐ |
| `symetrie-axiale-cm` | La symétrie axiale | CM1 / CM2 | 5 | ☐ |
| `tableaux-graphiques-cm` | Tableaux et graphiques | CM1 / CM2 | 5 | ☐ |
| `triangles-et-quadrilateres-6e` | Triangles et quadrilatères en 6e | 6e | 5 | ☐ |
| `volumes-contenances-cm` | Volumes et contenances | CM2 | 5 | ☐ |

### histoire (19)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `age-industriel-cm` | L'âge industriel en France | CM2 | 5 | ☐ |
| `clovis-charlemagne-cm` | Clovis et Charlemagne | CM1 | 5 | ☐ |
| `empire-romain-christianisme-6e` | L'Empire romain et la naissance du christianisme | 6e | 5 | ☐ |
| `france-europe-depuis-1945-cm` | La France depuis 1945 et la construction européenne | CM2 | 5 | ☐ |
| `francois-ier-cm` | François Ier et la Renaissance | CM1 | 5 | ☐ |
| `gaulois-gallo-romains-cm` | Les Gaulois et les Gallo-Romains | CM1 | 5 | ☐ |
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
| `voyages-d-ulysse-6e` | Récits fondateurs : les voyages d'Ulysse et la Méditerranée | 6e | 5 | ☐ |

### physique-chimie (12)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `air-et-matiere-cm` | L'air, un gaz qui occupe de la place | CM1 / CM2 | 5 | ☐ |
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

### svt (14)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `alimentation-digestion-cm` | L'alimentation et la digestion | CM1 / CM2 | 5 | ☐ |
| `biodiversite-et-chaines-cm` | Biodiversité et chaînes alimentaires | CM1 / CM2 | 5 | ☐ |
| `classification-du-vivant-6e` | Classer le vivant et la biodiversité en 6e | 6e | 5 | ☐ |
| `classification-du-vivant-cm` | Classer les êtres vivants | CM1 / CM2 | 5 | ☐ |
| `developpement-vegetaux-cm` | Le développement des végétaux | CM1 / CM2 | 5 | ☐ |
| `evolution-et-fossiles-cm` | Fossiles et évolution des espèces | CM2 | 5 | ☐ |
| `nutrition-et-alimentation-6e` | Nutrition et alimentation en 6e | 6e | 5 | ☐ |
| `organisme-et-effort-6e` | Fonctionnement de l'organisme à l'effort | 6e | 5 | ☐ |
| `reproduction-et-cycles-de-vie-6e` | Reproduction et cycles de vie en 6e | 6e | 5 | ☐ |
| `reproduction-et-puberte-cm` | Naissance, croissance et puberté | CM2 | 5 | ☐ |
| `respiration-circulation-cm` | Respiration, cœur et circulation du sang | CM2 | 5 | ☐ |
| `terre-dans-le-systeme-solaire-6e` | La Terre dans le système solaire en 6e | 6e | 5 | ☐ |
| `terre-et-systeme-solaire-cm` | La Terre, la Lune et le système solaire | CM1 / CM2 | 5 | ☐ |
| `volcans-et-seismes-cm` | Volcans, séismes et risques naturels | CM2 | 5 | ☐ |

### anglais (6)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `anglais-gouts-et-actions-cm` | Anglais : goûts, nourriture et actions du quotidien | CM2 | 5 | ☐ |
| `anglais-lieux-et-pays-cm` | Anglais : lieux, pays et directions | CM2 | 5 | ☐ |
| `anglais-routine-et-habiletes-6e` | Anglais 6e : routine quotidienne, goûts et capacités | 6e | 5 | ☐ |
| `anglais-se-presenter-6e` | Anglais 6e : se présenter, famille et école | 6e | 5 | ☐ |
| `anglais-se-presenter-cm` | Anglais : se présenter et saluer | CM1 / CM2 | 5 | ☐ |
| `anglais-vocabulaire-quotidien-cm` | Anglais : couleurs, nombres, famille et objets | CM1 / CM2 | 5 | ☐ |

### arts-plastiques (3)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `arts-couleurs-cm` | Arts plastiques : couleurs et matières | CM1 / CM2 | 5 | ☐ |
| `arts-formes-et-composition-cm` | Arts plastiques : lignes, formes, perspective et artistes | CM2 | 5 | ☐ |
| `arts-representation-et-espace-6e` | Arts plastiques 6e : représenter l'espace, la matière et la couleur | 6e | 5 | ☐ |

### emc (12)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `citoyen-et-engagement-cm` | Être citoyen : voter, s'engager, participer | CM1 / CM2 | 5 | ☐ |
| `devise-republique-cm` | La devise et les symboles de la République | CM1 / CM2 | 5 | ☐ |
| `droit-et-regle-6e` | Le droit et la règle : lois, règlement, justice | 6e | 5 | ☐ |
| `droits-de-l-enfant-cm` | Les droits de l'enfant | CM1 / CM2 | 5 | ☐ |
| `engagement-et-solidarite-6e` | S'engager : solidarité, délégués et vie du collège | 6e | 5 | ☐ |
| `esprit-critique-et-medias-6e` | Esprit critique : s'informer et vérifier | 6e | 5 | ☐ |
| `laicite-et-liberte-cm` | La laïcité et la liberté d'expression | CM2 | 5 | ☐ |
| `numerique-responsable-cm` | Un usage responsable d'Internet et des écrans | CM1 / CM2 | 5 | ☐ |
| `regles-et-justice-cm` | Règles, lois et justice | CM1 / CM2 | 5 | ☐ |
| `regles-vivre-ensemble-6e` | Vivre ensemble : règles, égalité et lutte contre les discriminations | 6e | 5 | ☐ |
| `respect-et-egalite-cm` | Respect, égalité et lutte contre le harcèlement | CM1 / CM2 | 5 | ☐ |
| `securite-et-prevention-cm` | Sécurité, prévention et premiers secours | CM1 / CM2 | 5 | ☐ |

### geographie (13)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `communiquer-numerique-cm` | Communiquer d'un bout à l'autre du monde | CM2 | 5 | ☐ |
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
| `paysages-et-ressources-cm` | Paysages de France et ressources | CM1 | 5 | ☐ |
| `se-deplacer-transports-cm` | Se déplacer et transporter | CM2 | 5 | ☐ |

### eps (3)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `eps-endurance-et-sports-collectifs-6e` | EPS 6e : endurance, santé et sports collectifs | 6e | 5 | ☐ |
| `eps-jeux-collectifs-et-athletisme-cm` | EPS : jeux collectifs, athlétisme et natation | CM1 / CM2 | 5 | ☐ |
| `eps-sante-et-echauffement-cm` | EPS : échauffement, santé et effort | CM1 / CM2 | 5 | ☐ |

### technologie (5)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `materiaux-et-environnement-6e` | Matériaux, impact environnemental et recyclage en 6e | 6e | 5 | ☐ |
| `materiaux-et-recyclage-cm` | Matériaux, déchets et recyclage | CM1 / CM2 | 5 | ☐ |
| `objets-techniques-6e` | Objets techniques, matériaux et programmation en 6e | 6e | 5 | ☐ |
| `objets-techniques-cm` | Les objets techniques : besoin, fonction, matériaux | CM1 / CM2 | 5 | ☐ |
| `programmation-et-robots-6e` | Programmer un objet : capteurs, algorithmes et robots | 6e | 5 | ☐ |

### musique (3)

| Notion | Titre | Classes | Ex. | Relue |
|---|---|---|---|---|
| `musique-lire-et-chanter-6e` | Musique 6e : rythme, mélodie et écoute | 6e | 5 | ☐ |
| `musique-notes-et-rythme-cm` | Musique : notes, rythme et instruments | CM1 / CM2 | 5 | ☐ |
| `musique-voix-et-ecoute-cm` | Musique : voix, chant et culture musicale | CM2 | 5 | ☐ |

