# Journal du pilote S4 — Mathématiques

Base V0 : `07e919c8c6ae9faa2fa303680a30e343a980221f`. Périmètre : cercle trigonométrique, Pythagore, fractions et proportionnalité, avec fermeture transitive des prérequis. Le profil curriculaire est éditorial et reproduit les niveaux attribués par le catalogue V0.

## Fiches et placements à examiner

| Fiche | Prérequis V0 | Niveaux V0 | Compétences V0 |
| --- | --- | --- | --- |
| `trigo-cercle` | `pythagore`, `angles` | cycle-4, seconde, premiere, terminale | 4 |
| `pythagore` | `perimetres-aires`, `puissances` | cycle-4, seconde, premiere | 3 |
| `fractions` | Liste vide | cycle-3, cycle-4, seconde | 5 |
| `proportionnalite` | `fractions`, `nombres-decimaux` | cycle-3, cycle-4, seconde | 4 |
| `angles` | Liste vide | cycle-3, cycle-4, seconde | 4 |
| `perimetres-aires` | Liste vide | cycle-3, cycle-4, seconde | 5 |
| `puissances` | `nombres-decimaux` | cycle-4, seconde | 4 |
| `nombres-decimaux` | Liste vide | cycle-3, cycle-4, seconde | 4 |

La V0 ne fournit pas de rôle curriculaire. Les 24 placements restent à créer après le choix humain du rôle par niveau. La projection est activée lors de l’ajout des placements afin de vérifier les trois champs ensemble.

## Journal des objets

Les objets ci-dessous sont ajoutés en `draft`, version canonique 1. Les relations `requires` reproduisent les références existantes. Leur justification reste à renseigner lors d’une revue pédagogique. Les libellés provisoires des MicroSkills reprennent les slugs V0 en texte lisible.

| Source avant migration | ID canonique après migration | Type |
| --- | --- | --- |
| Profil éditorial du pilote, versionné sur la base V0 | `curriculum.mathematiques.kermiclab-v0-fr` | `curriculum` |
| Code de niveau V0 `cycle-3` | `stage.mathematiques.cycle-3` | `stage` |
| Code de niveau V0 `cycle-4` | `stage.mathematiques.cycle-4` | `stage` |
| Code de niveau V0 `seconde` | `stage.mathematiques.seconde` | `stage` |
| Code de niveau V0 `premiere` | `stage.mathematiques.premiere` | `stage` |
| Code de niveau V0 `terminale` | `stage.mathematiques.terminale` | `stage` |
| `catalogue/trigo-cercle/fiche.md` · `titre` et `id` | `notion.mathematiques.trigo-cercle` | `notion` |
| `catalogue/trigo-cercle/fiche.md` · `prerequis` → `pythagore` | `relation.mathematiques.trigo-cercle-requires-pythagore` | `requires` |
| `catalogue/trigo-cercle/fiche.md` · `prerequis` → `angles` | `relation.mathematiques.trigo-cercle-requires-angles` | `requires` |
| `catalogue/trigo-cercle/fiche.md` · `competences` → `relier-cosinus-et-sinus-au-cercle-unite` | `microskill.mathematiques.relier-cosinus-et-sinus-au-cercle-unite` | `microskill` |
| `catalogue/trigo-cercle/fiche.md` · rattachement de `relier-cosinus-et-sinus-au-cercle-unite` | `relation.mathematiques.trigo-cercle-teaches-relier-cosinus-et-sinus-au-cercle-unite` | `teaches` |
| `catalogue/trigo-cercle/fiche.md` · `competences` → `utiliser-les-angles-remarquables` | `microskill.mathematiques.utiliser-les-angles-remarquables` | `microskill` |
| `catalogue/trigo-cercle/fiche.md` · rattachement de `utiliser-les-angles-remarquables` | `relation.mathematiques.trigo-cercle-teaches-utiliser-les-angles-remarquables` | `teaches` |
| `catalogue/trigo-cercle/fiche.md` · `competences` → `convertir-degres-et-radians` | `microskill.mathematiques.convertir-degres-et-radians` | `microskill` |
| `catalogue/trigo-cercle/fiche.md` · rattachement de `convertir-degres-et-radians` | `relation.mathematiques.trigo-cercle-teaches-convertir-degres-et-radians` | `teaches` |
| `catalogue/trigo-cercle/fiche.md` · `competences` → `placer-un-angle-sur-le-cercle` | `microskill.mathematiques.placer-un-angle-sur-le-cercle` | `microskill` |
| `catalogue/trigo-cercle/fiche.md` · rattachement de `placer-un-angle-sur-le-cercle` | `relation.mathematiques.trigo-cercle-teaches-placer-un-angle-sur-le-cercle` | `teaches` |
| `catalogue/pythagore/fiche.md` · `titre` et `id` | `notion.mathematiques.pythagore` | `notion` |
| `catalogue/pythagore/fiche.md` · `prerequis` → `perimetres-aires` | `relation.mathematiques.pythagore-requires-perimetres-aires` | `requires` |
| `catalogue/pythagore/fiche.md` · `prerequis` → `puissances` | `relation.mathematiques.pythagore-requires-puissances` | `requires` |
| `catalogue/pythagore/fiche.md` · `competences` → `calculer-l-hypotenuse` | `microskill.mathematiques.calculer-l-hypotenuse` | `microskill` |
| `catalogue/pythagore/fiche.md` · rattachement de `calculer-l-hypotenuse` | `relation.mathematiques.pythagore-teaches-calculer-l-hypotenuse` | `teaches` |
| `catalogue/pythagore/fiche.md` · `competences` → `calculer-un-cote-de-l-angle-droit` | `microskill.mathematiques.calculer-un-cote-de-l-angle-droit` | `microskill` |
| `catalogue/pythagore/fiche.md` · rattachement de `calculer-un-cote-de-l-angle-droit` | `relation.mathematiques.pythagore-teaches-calculer-un-cote-de-l-angle-droit` | `teaches` |
| `catalogue/pythagore/fiche.md` · `competences` → `prouver-qu-un-triangle-est-rectangle` | `microskill.mathematiques.prouver-qu-un-triangle-est-rectangle` | `microskill` |
| `catalogue/pythagore/fiche.md` · rattachement de `prouver-qu-un-triangle-est-rectangle` | `relation.mathematiques.pythagore-teaches-prouver-qu-un-triangle-est-rectangle` | `teaches` |
| `catalogue/fractions/fiche.md` · `titre` et `id` | `notion.mathematiques.fractions` | `notion` |
| `catalogue/fractions/fiche.md` · `competences` → `comprendre-une-fraction` | `microskill.mathematiques.comprendre-une-fraction` | `microskill` |
| `catalogue/fractions/fiche.md` · rattachement de `comprendre-une-fraction` | `relation.mathematiques.fractions-teaches-comprendre-une-fraction` | `teaches` |
| `catalogue/fractions/fiche.md` · `competences` → `simplifier-une-fraction` | `microskill.mathematiques.simplifier-une-fraction` | `microskill` |
| `catalogue/fractions/fiche.md` · rattachement de `simplifier-une-fraction` | `relation.mathematiques.fractions-teaches-simplifier-une-fraction` | `teaches` |
| `catalogue/fractions/fiche.md` · `competences` → `comparer-des-fractions` | `microskill.mathematiques.comparer-des-fractions` | `microskill` |
| `catalogue/fractions/fiche.md` · rattachement de `comparer-des-fractions` | `relation.mathematiques.fractions-teaches-comparer-des-fractions` | `teaches` |
| `catalogue/fractions/fiche.md` · `competences` → `additionner-des-fractions` | `microskill.mathematiques.additionner-des-fractions` | `microskill` |
| `catalogue/fractions/fiche.md` · rattachement de `additionner-des-fractions` | `relation.mathematiques.fractions-teaches-additionner-des-fractions` | `teaches` |
| `catalogue/fractions/fiche.md` · `competences` → `multiplier-des-fractions` | `microskill.mathematiques.multiplier-des-fractions` | `microskill` |
| `catalogue/fractions/fiche.md` · rattachement de `multiplier-des-fractions` | `relation.mathematiques.fractions-teaches-multiplier-des-fractions` | `teaches` |
| `catalogue/proportionnalite/fiche.md` · `titre` et `id` | `notion.mathematiques.proportionnalite` | `notion` |
| `catalogue/proportionnalite/fiche.md` · `prerequis` → `fractions` | `relation.mathematiques.proportionnalite-requires-fractions` | `requires` |
| `catalogue/proportionnalite/fiche.md` · `prerequis` → `nombres-decimaux` | `relation.mathematiques.proportionnalite-requires-nombres-decimaux` | `requires` |
| `catalogue/proportionnalite/fiche.md` · `competences` → `reconnaitre-une-situation-de-proportionnalite` | `microskill.mathematiques.reconnaitre-une-situation-de-proportionnalite` | `microskill` |
| `catalogue/proportionnalite/fiche.md` · rattachement de `reconnaitre-une-situation-de-proportionnalite` | `relation.mathematiques.proportionnalite-teaches-reconnaitre-une-situation-de-proportionnalite` | `teaches` |
| `catalogue/proportionnalite/fiche.md` · `competences` → `utiliser-un-coefficient-de-proportionnalite` | `microskill.mathematiques.utiliser-un-coefficient-de-proportionnalite` | `microskill` |
| `catalogue/proportionnalite/fiche.md` · rattachement de `utiliser-un-coefficient-de-proportionnalite` | `relation.mathematiques.proportionnalite-teaches-utiliser-un-coefficient-de-proportionnalite` | `teaches` |
| `catalogue/proportionnalite/fiche.md` · `competences` → `calculer-une-quatrieme-proportionnelle` | `microskill.mathematiques.calculer-une-quatrieme-proportionnelle` | `microskill` |
| `catalogue/proportionnalite/fiche.md` · rattachement de `calculer-une-quatrieme-proportionnelle` | `relation.mathematiques.proportionnalite-teaches-calculer-une-quatrieme-proportionnelle` | `teaches` |
| `catalogue/proportionnalite/fiche.md` · `competences` → `appliquer-un-pourcentage` | `microskill.mathematiques.appliquer-un-pourcentage` | `microskill` |
| `catalogue/proportionnalite/fiche.md` · rattachement de `appliquer-un-pourcentage` | `relation.mathematiques.proportionnalite-teaches-appliquer-un-pourcentage` | `teaches` |
| `catalogue/angles/fiche.md` · `titre` et `id` | `notion.mathematiques.angles` | `notion` |
| `catalogue/angles/fiche.md` · `competences` → `nommer-et-mesurer-un-angle` | `microskill.mathematiques.nommer-et-mesurer-un-angle` | `microskill` |
| `catalogue/angles/fiche.md` · rattachement de `nommer-et-mesurer-un-angle` | `relation.mathematiques.angles-teaches-nommer-et-mesurer-un-angle` | `teaches` |
| `catalogue/angles/fiche.md` · `competences` → `utiliser-la-somme-des-angles-d-un-triangle` | `microskill.mathematiques.utiliser-la-somme-des-angles-d-un-triangle` | `microskill` |
| `catalogue/angles/fiche.md` · rattachement de `utiliser-la-somme-des-angles-d-un-triangle` | `relation.mathematiques.angles-teaches-utiliser-la-somme-des-angles-d-un-triangle` | `teaches` |
| `catalogue/angles/fiche.md` · `competences` → `reconnaitre-les-angles-formes-par-des-paralleles` | `microskill.mathematiques.reconnaitre-les-angles-formes-par-des-paralleles` | `microskill` |
| `catalogue/angles/fiche.md` · rattachement de `reconnaitre-les-angles-formes-par-des-paralleles` | `relation.mathematiques.angles-teaches-reconnaitre-les-angles-formes-par-des-paralleles` | `teaches` |
| `catalogue/angles/fiche.md` · `competences` → `calculer-un-angle-manquant` | `microskill.mathematiques.calculer-un-angle-manquant` | `microskill` |
| `catalogue/angles/fiche.md` · rattachement de `calculer-un-angle-manquant` | `relation.mathematiques.angles-teaches-calculer-un-angle-manquant` | `teaches` |
| `catalogue/perimetres-aires/fiche.md` · `titre` et `id` | `notion.mathematiques.perimetres-aires` | `notion` |
| `catalogue/perimetres-aires/fiche.md` · `competences` → `calculer-le-perimetre-d-un-polygone` | `microskill.mathematiques.calculer-le-perimetre-d-un-polygone` | `microskill` |
| `catalogue/perimetres-aires/fiche.md` · rattachement de `calculer-le-perimetre-d-un-polygone` | `relation.mathematiques.perimetres-aires-teaches-calculer-le-perimetre-d-un-polygone` | `teaches` |
| `catalogue/perimetres-aires/fiche.md` · `competences` → `calculer-l-aire-d-un-polygone` | `microskill.mathematiques.calculer-l-aire-d-un-polygone` | `microskill` |
| `catalogue/perimetres-aires/fiche.md` · rattachement de `calculer-l-aire-d-un-polygone` | `relation.mathematiques.perimetres-aires-teaches-calculer-l-aire-d-un-polygone` | `teaches` |
| `catalogue/perimetres-aires/fiche.md` · `competences` → `calculer-perimetre-et-aire-d-un-disque` | `microskill.mathematiques.calculer-perimetre-et-aire-d-un-disque` | `microskill` |
| `catalogue/perimetres-aires/fiche.md` · rattachement de `calculer-perimetre-et-aire-d-un-disque` | `relation.mathematiques.perimetres-aires-teaches-calculer-perimetre-et-aire-d-un-disque` | `teaches` |
| `catalogue/perimetres-aires/fiche.md` · `competences` → `convertir-des-unites-d-aire` | `microskill.mathematiques.convertir-des-unites-d-aire` | `microskill` |
| `catalogue/perimetres-aires/fiche.md` · rattachement de `convertir-des-unites-d-aire` | `relation.mathematiques.perimetres-aires-teaches-convertir-des-unites-d-aire` | `teaches` |
| `catalogue/perimetres-aires/fiche.md` · `competences` → `prevoir-l-effet-d-un-agrandissement-sur-une-aire` | `microskill.mathematiques.prevoir-l-effet-d-un-agrandissement-sur-une-aire` | `microskill` |
| `catalogue/perimetres-aires/fiche.md` · rattachement de `prevoir-l-effet-d-un-agrandissement-sur-une-aire` | `relation.mathematiques.perimetres-aires-teaches-prevoir-l-effet-d-un-agrandissement-sur-une-aire` | `teaches` |
| `catalogue/puissances/fiche.md` · `titre` et `id` | `notion.mathematiques.puissances` | `notion` |
| `catalogue/puissances/fiche.md` · `prerequis` → `nombres-decimaux` | `relation.mathematiques.puissances-requires-nombres-decimaux` | `requires` |
| `catalogue/puissances/fiche.md` · `competences` → `calculer-une-puissance` | `microskill.mathematiques.calculer-une-puissance` | `microskill` |
| `catalogue/puissances/fiche.md` · rattachement de `calculer-une-puissance` | `relation.mathematiques.puissances-teaches-calculer-une-puissance` | `teaches` |
| `catalogue/puissances/fiche.md` · `competences` → `utiliser-les-puissances-de-10` | `microskill.mathematiques.utiliser-les-puissances-de-10` | `microskill` |
| `catalogue/puissances/fiche.md` · rattachement de `utiliser-les-puissances-de-10` | `relation.mathematiques.puissances-teaches-utiliser-les-puissances-de-10` | `teaches` |
| `catalogue/puissances/fiche.md` · `competences` → `ecrire-en-notation-scientifique` | `microskill.mathematiques.ecrire-en-notation-scientifique` | `microskill` |
| `catalogue/puissances/fiche.md` · rattachement de `ecrire-en-notation-scientifique` | `relation.mathematiques.puissances-teaches-ecrire-en-notation-scientifique` | `teaches` |
| `catalogue/puissances/fiche.md` · `competences` → `appliquer-les-regles-de-calcul-des-puissances` | `microskill.mathematiques.appliquer-les-regles-de-calcul-des-puissances` | `microskill` |
| `catalogue/puissances/fiche.md` · rattachement de `appliquer-les-regles-de-calcul-des-puissances` | `relation.mathematiques.puissances-teaches-appliquer-les-regles-de-calcul-des-puissances` | `teaches` |
| `catalogue/nombres-decimaux/fiche.md` · `titre` et `id` | `notion.mathematiques.nombres-decimaux` | `notion` |
| `catalogue/nombres-decimaux/fiche.md` · `competences` → `lire-un-nombre-decimal` | `microskill.mathematiques.lire-un-nombre-decimal` | `microskill` |
| `catalogue/nombres-decimaux/fiche.md` · rattachement de `lire-un-nombre-decimal` | `relation.mathematiques.nombres-decimaux-teaches-lire-un-nombre-decimal` | `teaches` |
| `catalogue/nombres-decimaux/fiche.md` · `competences` → `comparer-des-decimaux` | `microskill.mathematiques.comparer-des-decimaux` | `microskill` |
| `catalogue/nombres-decimaux/fiche.md` · rattachement de `comparer-des-decimaux` | `relation.mathematiques.nombres-decimaux-teaches-comparer-des-decimaux` | `teaches` |
| `catalogue/nombres-decimaux/fiche.md` · `competences` → `arrondir-un-decimal` | `microskill.mathematiques.arrondir-un-decimal` | `microskill` |
| `catalogue/nombres-decimaux/fiche.md` · rattachement de `arrondir-un-decimal` | `relation.mathematiques.nombres-decimaux-teaches-arrondir-un-decimal` | `teaches` |
| `catalogue/nombres-decimaux/fiche.md` · `competences` → `calculer-avec-des-decimaux` | `microskill.mathematiques.calculer-avec-des-decimaux` | `microskill` |
| `catalogue/nombres-decimaux/fiche.md` · rattachement de `calculer-avec-des-decimaux` | `relation.mathematiques.nombres-decimaux-teaches-calculer-avec-des-decimaux` | `teaches` |

## Qualification et retour arrière

- Vérification du corpus préparatoire sur la base ci-dessus : `node scripts/check-referentiel.mjs --json` a donné `PASS`, zéro erreur et zéro avertissement.
- Après choix des rôles, créer les placements en brouillon et la configuration de projection. Comparer les métadonnées et les résultats réels de recommandation et de cahier de vacances. Vérifier que le build ne modifie pas les fiches du pilote quand les champs concordent.
- Avant fusion, rejouer le retour arrière par revert sur une branche de test et comparer à la base V0. Joindre les résultats et le run CI à la PR.
