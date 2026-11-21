# Chantier : catalogue du cycle 4 (5e, 4e, 3e)

**Niveau actuel : 39 notions ajoutées (suffixe `-c4`) aux 89 notions déjà classées en 5e, 4e ou 3e ; les 12 matières sont couvertes à chaque niveau ; relecture humaine à faire.**

## État des lieux (avant)

- **Matières absentes en 5e-4e-3e** : technologie, anglais, arts plastiques, musique, EPS (aucune notion).
- **Zones maigres** : SVT 4e (2 notions), histoire 5e (3), géographie 5e (3), français 5e (6) ; aucune notion de trigonométrie, d'algorithmique, de racines carrées ni de notion de fonction.
- **Chaîne de prérequis** : 78 notions sur 89 n'avaient aucun prérequis, et aucune notion de 5e ne pointait vers la 6e ou le cycle 3.

## Ce qui a été ajouté

| Matière | Notions du cycle 4 |
|---|---|
| Mathématiques (7) | triangles et constructions (5e-4e), parallélogrammes et symétrie centrale (5e), trigonométrie du triangle rectangle (4e-3e), algorithmique et programmation (5e-3e), racines carrées (3e), notion de fonction (3e), pourcentages et évolutions (5e-4e) |
| Français (5) | grammaire de la phrase en 5e, récits d'aventures et de voyages (5e), vocabulaire et orthographe (5e-3e), écrire et réécrire (5e-3e), dénoncer les travers de la société (3e) |
| Histoire (5) | chrétientés et islam (5e), féodalité, Église et pouvoirs (5e), traites négrières et esclavage (4e), colonisations (4e), société et culture au XIXe siècle (4e) |
| Géographie (2) | question démographique (5e), lire des cartes et réaliser un croquis (5e-3e) |
| EMC (3) | esprit critique et médias (5e-4e), numérique et données (4e-3e), défense et paix (3e) |
| SVT (3) | météorologie et climat (4e), micro-organismes et santé (4e), santé et prévention (3e) |
| Physique-chimie (2) | transformations chimiques (4e-3e), signaux et information (4e-3e) |
| Technologie (3) | concevoir et prototyper, objets connectés et programmation, énergie et matériaux |
| Anglais (3), Arts plastiques (2), Musique (2), EPS (2) | anglais 5e, 4e et 3e ; image et représentation, art et engagement ; genres et formes, création et engagement ; endurance et santé, sports collectifs et arbitrage |

Couverture par niveau après ajout (notions classées 5e / 4e / 3e) : français 10/10/10, maths 16/17/14, histoire 5/7/8, géographie 5/9/6, EMC 4/7/6, SVT 5/4/4, physique-chimie 4/7/6, technologie 2/3/3, anglais, arts, musique 1/1/1, EPS 2/2/2.

## Parcours 6e → 5e → 4e → 3e → seconde

Les 39 nouvelles notions déclarent leurs prérequis : vers la 6e (par exemple `grammaire-de-la-phrase-5e-c4` ← `sujet-verbe-complements-6e`, `anglais-5e-c4` ← `anglais-routine-et-habiletes-6e`), entre elles (`anglais-5e-c4` → `anglais-4e-c4` → `anglais-3e-c4`) et vers les notions existantes (`trigonometrie-triangle-rectangle-c4` ← `pythagore`). Le build vérifie qu'un prérequis ne commence jamais dans une classe plus avancée.

**Limite importante** : les 89 notions déjà présentes (et toutes les notions de la V0) sont **projetées depuis le référentiel canonique S4** ; leurs prérequis sont générés au build à partir de `referentiel/objets/` et ne se modifient pas dans la fiche. Leurs liens vers la 6e, le cycle 3 et le cycle 2 sont **proposés** (98 notions, 127 liens) dans [propositions-liens-cycles-2-3-4.md](../referentiel/propositions-liens-cycles-2-3-4.md), à qualifier par le processus S4 (justification documentaire, objets en brouillon, relecture).

## Points d'attention

- **Relecture humaine obligatoire** avant fusion : exactitude (dates, formules, définitions, corrigés), sujets sensibles (traite négrière, colonisation, défense, addictions, numérique) traités sans simplification abusive.
- Qualité des QCM : bonne réponse la plus longue dans 49 % des QCM du cycle 4 (la plupart des énoncés du collège sont des définitions) ; 6 écarts nets subsistent car l'énoncé est long par nature.
- Les notions existantes du cycle 4 n'ont pas été réécrites : leur contenu n'a pas été relu dans ce chantier.
