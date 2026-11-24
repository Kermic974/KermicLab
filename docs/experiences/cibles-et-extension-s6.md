# Cibles S6 et extension de la migration

Proposition de la PR 04, après [#421](https://github.com/Kermic974/KermicLab/pull/421). L’adoption relève de la revue et de la fusion humaines ; aucun champ de relecture pédagogique n’est renseigné par ce lot.

## Relevé et périmètre

À `6f121846a91f8629616a7e64f7860d19fcc7442a`, le catalogue public compte 486 fiches : 477 notions et 9 jeux. Le lab solaire est publié séparément. Le référentiel contient 8 250 objets ; les 477 notions ont toutes leur correspondance S4, dont 165 en review et 312 en draft. Les notions et compétences du système solaire existent déjà : il est inutile de les recréer.

L’[annexe de migration](../../experiences/perimetre-migration-v1.json) fixe les 487 entrées, les chemins des sources, leurs empreintes SHA-256 après normalisation LF et les cibles autorisées par entrée. Les sources du cercle comprennent ses deux modules pédagogiques. Le relevé initial de 174 fiches reste conservé dans `inventaire-s6.json` : il n’est pas réécrit pour lui attribuer les arrivées ultérieures.

## Candidats canoniques

Le [journal des promotions](promotions-cibles-s6.json) détaille 2 473 propositions de passage draft → review : 312 Notions, 1 849 MicroSkills et 312 Skills. Chaque version entière augmente d’une unité. Aucun libellé, provenance, contenu, lien, rôle ni placement existant ne change. Les relations, CurriculumMappings et Stages gardent leur statut. Les cibles sont celles des notions publiées et de leurs liens teaches/contributesTo existants, sans créer de relation supplémentaire.

**Review signifie candidat soumis à revue, pas contenu validé.** Le lot propose ces statuts pour adoption humaine ; il ne prétend pas qu’un enseignant a relu les 2 473 objets. Les réserves des journaux de densification restent ouvertes, notamment la pertinence des compétences et liens. Aucun objet ne passe en validated, aucun champ `relue*` ni aucune attestation de revue S6 ne sont créé ou modifié.

Les tests comparent le corpus de préparation au corpus Git de départ : seules les transitions et versions listées sont autorisées. Ils vérifient aussi les empreintes des sources à la révision publique figée. Ces contrôles attestent une conservation technique, pas l’exactitude pédagogique.

## Cibles des jeux

Ces treize Notions sont des connaissances ou contraintes explicites, indépendantes d’une partie jouée. Elles ne sont ni des expériences S6, ni des résultats d’élève, ni des objets de maîtrise attribués automatiquement. Elles sont proposées en review avec provenance éditoriale. Aucun CurriculumMapping, prérequis ou niveau scolaire n’est ajouté pour les jeux.

| ID | Connaissance proposée | Sources éditoriales existantes |
| --- | --- | --- |
| `notion.jeux.fusion-de-tuiles` | Fusion de tuiles de même valeur | [2048](../../catalogue/2048/fiche.md) : préparer les fusions |
| `notion.jeux.planification-sur-grille` | Planification des déplacements sur une grille | [2048](../../catalogue/2048/fiche.md) : garder une grille lisible et préparer les coups |
| `notion.jeux.voisinage-sur-grille` | Voisinage chiffré sur une grille | [Démineur](../../catalogue/demineur/fiche.md) : chiffres, cases vides et drapeaux |
| `notion.jeux.deduction-par-contraintes` | Déduction logique à partir de contraintes | [Démineur](../../catalogue/demineur/fiche.md), [Sudoku](../../catalogue/sudoku/fiche.md) : déduire les cases possibles |
| `notion.jeux.unicite-sur-grille` | Contraintes d’unicité sur une grille | [Sudoku](../../catalogue/sudoku/fiche.md) : lignes, colonnes et carrés sans répétition |
| `notion.jeux.deplacement-des-pieces-echecs` | Déplacement et contrôle des pièces aux échecs | [Échecs](../../catalogue/echecs/fiche.md) : déplacements, roque, promotion et prise en passant |
| `notion.jeux.echec-mat-et-pat` | Échec, mat, pat et conditions de fin de partie | [Échecs](../../catalogue/echecs/fiche.md) : fins de partie et énigmes de mats |
| `notion.jeux.tactiques-echecs` | Motifs tactiques aux échecs | [Échecs](../../catalogue/echecs/fiche.md) : Académie, mats et tactique |
| `notion.jeux.hierarchie-des-mains-poker` | Classement des mains au poker Texas Hold’em | [Poker](../../catalogue/poker-texas-holdem/fiche.md) : classement et comparaisons vérifiées |
| `notion.jeux.information-incomplete` | Raisonnement avec une information incomplète | [Poker](../../catalogue/poker-texas-holdem/fiche.md), [Belote](../../catalogue/belote/fiche.md) : cartes cachées et choix de jeu |
| `notion.jeux.plis-et-atouts` | Plis, atouts et obligations de jeu à la belote | [Belote](../../catalogue/belote/fiche.md) : fournir, couper et jouer selon l’atout |
| `notion.jeux.comptage-des-cartes` | Suivi des cartes jouées dans un jeu de plis | [Belote](../../catalogue/belote/fiche.md) : règles et leçons de l’Académie |
| `notion.francais.contraintes-lexicales` | Contraintes de lettres et définitions pour identifier un mot | [Pendu](../../catalogue/pendu/fiche.md), [Mots croisés](../../catalogue/mots-croises/fiche.md), [Mots fléchés](../../catalogue/mots-fleches/fiche.md) |

Les liens V0 notions-liees des quatre jeux concernés restent des associations éditoriales à relire (#382). Ils fournissent des cibles disponibles dans l’annexe, sans devenir des relations S4. Chaque unité S6 devra sélectionner les cibles qu’elle travaille réellement ; la liste de l’annexe n’est pas appliquée indistinctement à tous les exercices.

## Cibles du lab solaire

Le lab réutilise `notion.svt.terre-et-systeme-solaire-cm` et les MicroSkills existantes `nommer-les-planetes-du-systeme-solaire`, `expliquer-l-alternance-du-jour-et-de-la-nuit` et `expliquer-les-saisons-par-l-inclinaison-de-la-terre`. Leurs sources sont les contenus CM et 6e déjà présents. Les critères proposés dans [le journal du lab](../../Sample/lab/systeme-solaire.md) restent à relire humainement. Aucun résultat au quiz, score, XP ou état de progression local n’est transféré dans le Knowledge Core.

## Publication et retour arrière

L’[ADR 0042](../decisions/0042-extension-migration-s6.md) propose une extension explicite de D6-1 à ces sources publiques figées. Les règles D6-3 restent strictes : expériences review sous manifeste explicite, cibles review/validated, pas de publication avec des cibles draft. L’annexe n’est pas un manifeste de publication et ne crée aucune expérience exportée. Les adaptateurs, ancres, correspondances d’événements et le manifeste du pilote suivent après adoption de cette PR.

Le retour arrière remet ensemble les versions/statuts d’origine, retire les treize nouvelles cibles et l’annexe proposée, puis relance les contrôles. Si une livraison S6 dépend déjà de ces IDs ou versions, corriger ou retirer d’abord ses références. Les contenus et les progressions existants ne sont pas modifiés par cette préparation.
