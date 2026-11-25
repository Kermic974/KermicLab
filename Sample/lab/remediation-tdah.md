# À petits pas — Organisation et attention

Version 1.0.0, 25 novembre 2026. Labo destiné aux adultes, préparé pour /labs/remediation-tdah/.

Application HTML autonome adaptée du plan de remédiation cognitive TDAH adulte fourni par le propriétaire. La source PDF personnelle n’est pas publiée. Aucun diagnostic, score clinique ni promesse de traitement. Les points et badges reconnaissent l’utilisation de l’outil.

## Parcours

Le plan, dépôt des tâches, classement par énergie, trois priorités maximum, mini-étapes, initiation de cinq minutes, cycles 25/5 avec pause longue après trois cycles, aide au blocage, bilan du soir, choix de demain, mises en situation fictives et progression sur quatorze jours. Profil facultatif et objectif adaptable à l’énergie déclarée. La pause longue de quinze minutes est un réglage proposé, sa durée n’est pas fixée dans le plan.

## Données et progression

Stockage local uniquement (clé petits-pas-v1), sans compte ni réseau. Les tâches, ressentis et bilans peuvent contenir des informations privées : ne pas en saisir sur un appareil partagé. Export JSON et import de sauvegardes de la version autonome ; effacement local disponible. Le passage du fichier local au site nécessite un export/import volontaire. Aucun profil réel ni sauvegarde utilisateur n’est versionné.

Points attribués une fois par identifiant de tâche ou d’étape, même après réouverture. Les points acquis restent conservés après suppression. Les quêtes quotidiennes et séances terminées apportent des points supplémentaires ; chaque niveau représente 100 points. Les étoiles dépensées n’abaissent pas le niveau. Pas de série punitive. Les trophées restent dans le labo.

## Publication et contrôle

La liste LABS_PUBLIES de scripts/build.mjs copie la page dans dist/labs/remediation-tdah/index.html. La carte Labs est traduite en français et en anglais ; le labo est en français. Métadonnées KermicLab et CSP à hashes, aucune ressource externe. La page est ajoutée à check:pages.

Avant fusion : CI verte et validation du propriétaire conformément à AGENTS.md, avec relecture du contenu destiné aux adultes.
