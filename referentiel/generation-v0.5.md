# Génération des lots S4 v0.5

L’inventaire `inventaire-v0.5.json` fixe les 165 fiches publiques et leur SHA de référence. Chaque discipline fournit une proposition JSON rédigée avec assistance IA à partir des fiches, du contenu pédagogique existant et de sources institutionnelles identifiables pour les niveaux qui restent à établir. La commande s’exécute hors ligne.

## Format d’une proposition

- `discipline` est la clé de l’inventaire.
- `objets` contient les nouveaux JSON S4 complets avec `status: "draft"`, `version: 1` et une provenance documentaire. Réutiliser les IDs existants dans les références. Le générateur refuse leur modification.
- `projection` contient les ajouts aux dictionnaires `notions`, `competences` et `fiches` décrits dans le README. Inclure dans `fiches` chaque fiche à qualifier dans ce lot, y compris une fiche déjà projetée si le lot complète ses Skills. Déclarer les nouveaux slugs dans l’ordre prévu.
- `journal` associe à chaque slug de `projection.fiches` une note qui explique les sources, les choix nouveaux et les cas à revoir. Y distinguer les données recopiées de la V0 et les propositions nouvelles.

Exécuter `node scripts/generer-lot-s4.mjs proposition.json --check` depuis un clone complet. Le rapport donne les champs avant/après, les IDs proposés et les avertissements. Avec `--write`, la commande écrit les objets et la configuration après les contrôles. Lancer ensuite `npm run build` pour générer les champs des fiches et `npm run ci` pour vérifier le lot.

Réutiliser le Curriculum et les Stages du pilote. Appliquer `introduced` au premier niveau sourcé et `reinforced` aux suivants. Les prérequis nouveaux exigent une justification documentaire. Un classement ou un niveau ne suffit pas à établir un prérequis. Chaque MicroSkill projetée doit contribuer à une Skill étayée. Les données insuffisamment sourcées restent dans le journal de revue. Une fiche sans niveau ou compétence empêche de livrer le lot comme complet.

Inclure dans chaque PR le rapport de génération, la comparaison de la recommandation et du cahier de vacances, et le test de retour arrière. Les valeurs V0 existantes doivent rester identiques. Identifier séparément les effets attendus des nouveaux champs. Garder les objets en brouillon jusqu’à la relecture.
