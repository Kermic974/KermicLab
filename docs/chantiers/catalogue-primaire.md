# Chantier : catalogue du primaire (cycle 2 — CP, CE1, CE2 ; cycle 3 — CM1, CM2, 6e)

**Niveau actuel : 51 notions de cycle 2 (suffixe `-c2`), 102 notions CM1/CM2 et 50 notions de 6e rédigées, 12 matières, relecture humaine à faire** — décision : [ADR 0037](../decisions/0037-niveau-primaire-cm1-cm2.md).

Méthode : gabarit commun (`contenu.json`, trois onglets), niveau `primaire`, classes `CM1` / `CM2`, cycle `cycle-3`. Chaque notion a deux niveaux de
lecture (intuition, puis CM), trois exercices d'entraînement (QCM ou nombre, avec indices) et un défi en deux étapes.

| Matière | Notions |
|---|---|
| Mathématiques (20) | `grands-nombres-cm`, `addition-soustraction-posees-cm`, `multiplication-posee-cm`, `division-euclidienne-cm`, `calcul-mental-cm`, `multiples-et-diviseurs-cm`, `fractions-cm`, `nombres-decimaux-cm`, `proportionnalite-cm`, `problemes-a-etapes-cm`, `longueurs-masses-contenances-cm`, `durees-et-horaires-cm`, `perimetre-aire-cm`, `angles-cm`, `droites-cm`, `polygones-cm`, `cercle-compas-cm`, `symetrie-axiale-cm`, `solides-cm`, `volumes-contenances-cm`, `reperage-plan-cm`, `echelle-et-plans-cm`, `tableaux-graphiques-cm`, `algorithmes-programmation-cm` |
| Français (13) | `nature-des-mots-cm`, `fonctions-dans-la-phrase-cm`, `types-et-formes-de-phrases-cm`, `groupe-nominal-cm`, `conjugaison-cm`, `accords-cm`, `homophones-cm`, `vocabulaire-cm`, `formation-des-mots-cm`, `lecture-comprehension-cm`, `ecrire-un-recit-cm`, `types-de-textes-cm`, `ponctuation-et-dialogue-cm`, `poesie-cm`, `orthographe-lexicale-cm` |
| Histoire (11) | de la Préhistoire à la Ve République et à l'Union européenne (`prehistoire-cm` … `france-europe-depuis-1945-cm`) |
| Géographie (8) | `lire-une-carte-cm` … `monde-en-villes-cm` |
| EMC (6) | `respect-et-egalite-cm`, `regles-et-justice-cm`, `laicite-et-liberte-cm`, `devise-republique-cm`, `citoyen-et-engagement-cm`, `droits-de-l-enfant-cm`, `numerique-responsable-cm` |
| Sciences (SVT, physique-chimie) et technologie | `classification-du-vivant-cm` … `materiaux-et-recyclage-cm` |

## Points d'attention

- **Relecture humaine obligatoire** avant fusion (idéalement par un enseignant du premier degré) : exactitude des dates, des définitions et des corrections.
- Les matières anglais, arts plastiques, musique et EPS ont été ajoutées (libellés fr/en) ; autres langues vivantes que l'anglais non couvertes.
- Les notions de collège équivalentes (`fractions`, `nombres-decimaux`…) restent la suite naturelle (6e) : pas de prérequis croisé automatique.

## 6e (fin du cycle 3)

Les notions `*-6e` (niveau `college`, classe `6e`, cycle 3) complètent les notions de 6e déjà présentes (`fractions`, `nombres-decimaux`, `perimetres-aires`, `proportionnalite`, `angles`, `volumes`, `transformations`, `antiquite`, `conjugaison-temps`, `espaces-ruraux`, `ecosystemes-et-biodiversite`, `la-cellule`, `photosynthese`). La 6e couvre désormais **les 12 matières** :

| Matière | Notions de 6e |
|---|---|
| Mathématiques (15) | entiers et opérations, divisions, grandeurs et mesures, triangles et quadrilatères, constructions, symétrie, repérage et données, algorithmique + les notions existantes |
| Français (9) | temps du récit, sujet-verbe-compléments, orthographe grammaticale, récit d'aventures, contes-fables-mythes, poésie, vocabulaire et étymologie, écrire pour raconter et décrire + `conjugaison-temps` |
| Histoire (8) | Néolithique, premières civilisations, Grèce, Rome, voyages d'Ulysse, monothéisme juif, empire romain et christianisme + `antiquite` |
| Géographie (6) | habiter en général, la Terre, une métropole, le littoral, un espace de faible densité + `espaces-ruraux` |
| EMC (4) | vivre ensemble, esprit critique et médias, droit et règle, engagement et solidarité |
| SVT (8) | classification, organisme et effort, nutrition, reproduction, Terre dans le système solaire + existantes |
| Physique-chimie (5) | états et mélanges, énergie et signaux, mouvement et vitesse, lumière et son, masse et volume |
| Technologie (3) | objets techniques, matériaux et environnement, programmation et robots |
| Anglais (2), Arts plastiques (1), Musique (1), EPS (1) | une notion au moins par matière |

## Parcours CM1 → CM2 → 6e

Chaque notion du cycle 3 déclare ses **prérequis** (champ `prerequis` de la fiche). Le parcours suit trois règles :

1. **Dans une matière, un fil logique** : par exemple `grands-nombres-cm` → `addition-soustraction-posees-cm` → `multiplication-posee-cm` → `division-euclidienne-cm` → `fractions-cm` → `nombres-decimaux-cm` ; en histoire, la frise de `prehistoire-cm` à `france-europe-depuis-1945-cm`.
2. **Du primaire vers la 6e** : chaque notion de 6e (nouvelle ou déjà présente) pointe vers la ou les notions de CM1/CM2 qu'elle prolonge, par exemple `fractions` ← `fractions-cm`, `fractions-operations-cm` ; `grece-et-citoyennete-6e` ← `premieres-civilisations-6e` ← `peuplement-neolithique-6e` ← `prehistoire-cm`.
3. **Jamais à rebours** : un prérequis ne commence pas dans une classe plus avancée que la notion (vérifié au build, `scripts/lib/catalogue.mjs`, avec un test). Le graphe est aussi vérifié sans cycle.

La modification des prérequis des notions de 6e déjà présentes ne change que leurs métadonnées (pas leur version).

## Cycle 2 (CP, CE1, CE2)

Les notions `*-c2` (niveau `primaire`, classes `CP` / `CE1` / `CE2`, cycle `cycle-2`) suivent le programme du cycle 2, avec un vocabulaire volontairement simple (enfants de 6 à 8 ans). Une notion enseignée sur plusieurs années déclare toutes ses classes (par exemple `addition-c2` : CP, CE1, CE2).

| Matière | Notions du cycle 2 |
|---|---|
| Mathématiques (21) | nombres jusqu'à 100, 1 000 et 10 000, comparer et ranger, addition, soustraction, doubles et moitiés, tables de multiplication, multiplication posée, partage, monnaie, longueurs, masses et contenances, heure et calendrier, problèmes, fractions simples, figures planes, solides, symétrie et repérage, tableaux et algorithmes, périmètre et calcul mental |
| Français (11) | lettres et sons, syllabes, la phrase, nom et déterminant, verbe-sujet-adjectif, pluriel et féminin, temps des verbes, homophones, vocabulaire et dictionnaire, lire et comprendre, écrire et comptines |
| Questionner le monde (12) | animaux et plantes, besoins et vie, corps et santé, milieux et saisons, eau-air-matière, objets électriques et matériaux, se repérer dans le temps, grandes périodes, se repérer dans l'espace, paysages et habiter, planète Terre |
| EMC (3), Anglais (2), Arts (1), Musique (1), EPS (1) | vivre ensemble, République et citoyens, sécurité-écrans-environnement ; bonjour, famille et animaux ; couleurs et formes ; sons et chansons ; bouger et jouer |

Le parcours est continu **CP → CE1 → CE2 → CM1 → CM2 → 6e** : les notions du cycle 3 déclarent des prérequis vers le cycle 2 (par exemple `grands-nombres-cm` ← `nombres-jusqu-a-10000-c2`, `conjugaison-cm` ← `temps-des-verbes-c2`), et le build vérifie qu'un prérequis ne commence jamais dans une classe plus avancée.

## Matrice de couverture du programme de cycle 3 (BO 2020)

| Domaine du programme | Notions du catalogue | Statut |
|---|---|---|
| Maths : nombres entiers, calcul | `grands-nombres-cm`, `addition-soustraction-posees-cm`, `multiplication-posee-cm`, `division-euclidienne-cm`, `calcul-mental-cm`, `multiples-et-diviseurs-cm`, `entiers-et-operations-6e`, `divisions-6e` | couvert |
| Maths : fractions et décimaux | `fractions-cm`, `fractions-operations-cm`, `nombres-decimaux-cm`, `calcul-avec-decimaux-cm` (+ `fractions`, `nombres-decimaux` en 6e) | couvert |
| Maths : grandeurs et mesures | `longueurs-masses-contenances-cm`, `durees-et-horaires-cm`, `perimetre-aire-cm`, `volumes-contenances-cm`, `proportionnalite-cm`, `echelle-et-plans-cm`, `moyenne-et-proportions-cm` | couvert |
| Maths : espace et géométrie | `reperage-plan-cm`, `angles-cm`, `droites-cm`, `polygones-cm`, `cercle-compas-cm`, `symetrie-axiale-cm`, `solides-cm`, `reproduire-et-agrandir-cm`, `constructions-geometriques-6e`, `symetrie-axiale-6e` | couvert |
| Maths : organisation de données, algorithmique, problèmes | `tableaux-graphiques-cm`, `problemes-a-etapes-cm`, `algorithmes-programmation-cm`, `reperage-et-donnees-6e`, `algorithmique-6e` | couvert |
| Français : étude de la langue | `nature-des-mots-cm`, `fonctions-dans-la-phrase-cm`, `types-et-formes-de-phrases-cm`, `groupe-nominal-cm`, `conjugaison-cm`, `accords-cm`, `homophones-cm`, `vocabulaire-cm`, `formation-des-mots-cm`, `orthographe-lexicale-cm`, `pronoms-et-reprises-cm`, `temps-du-recit-6e`, `sujet-verbe-complements-6e`, `orthographe-grammaticale-6e` | couvert |
| Français : lecture, écriture, oral | `lecture-comprehension-cm`, `ecrire-un-recit-cm`, `types-de-textes-cm`, `ponctuation-et-dialogue-cm`, `poesie-cm`, `discours-rapporte-cm`, `resumer-et-expliquer-cm`, `contes-fables-mythes-6e` | couvert |
| Histoire (CM1, CM2, 6e) | Préhistoire, Gaulois, Clovis et Charlemagne, Louis IX, François Ier, Henri IV, Louis XIV, Révolution et Empire, âge industriel, République, guerres mondiales, depuis 1945 ; en 6e Néolithique, Mésopotamie et Égypte, Grèce, Rome | couvert |
| Géographie (CM1, CM2, 6e) | `lire-une-carte-cm`, `habiter-ville-campagne-cm`, `paysages-et-ressources-cm`, `se-deplacer-transports-cm`, `communiquer-numerique-cm`, `mieux-habiter-cm`, `france-europe-monde-cm`, `monde-en-villes-cm`, `habiter-6e`, `habiter-la-terre-6e` | couvert |
| EMC | `respect-et-egalite-cm`, `regles-et-justice-cm`, `laicite-et-liberte-cm`, `devise-republique-cm`, `citoyen-et-engagement-cm`, `droits-de-l-enfant-cm`, `numerique-responsable-cm`, `securite-et-prevention-cm`, `regles-vivre-ensemble-6e` | couvert |
| Sciences et technologie | vivant (classification, végétaux, nutrition, respiration, reproduction, biodiversité, évolution), Terre (système solaire, risques), matière (états, mélanges, air), énergie, électricité, lumière et son, mouvement ; technologie (objets techniques, matériaux) | couvert |
| Anglais | `anglais-se-presenter-cm`, `anglais-vocabulaire-quotidien-cm`, `anglais-gouts-et-actions-cm`, `anglais-lieux-et-pays-cm` | couvert (matière `anglais`, notions rédigées en français avec le vocabulaire anglais) |
| Arts plastiques | `arts-couleurs-cm`, `arts-formes-et-composition-cm` | couvert (matière `arts-plastiques`) |
| Éducation musicale | `musique-notes-et-rythme-cm`, `musique-voix-et-ecoute-cm` | couvert (matière `musique`) |
| EPS | `eps-sante-et-echauffement-cm`, `eps-jeux-collectifs-et-athletisme-cm` | couvert pour les savoirs (matière `eps`) ; la pratique motrice ne se fait pas sur une page |

Guide de double contrôle et liste de relecture : [guide-relecture-cycle-3.md](guide-relecture-cycle-3.md).
