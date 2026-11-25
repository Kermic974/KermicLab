# À petits pas — Organisation et attention

Version 1.1.0, 25 novembre 2026. Labo destiné aux adultes, préparé pour /labs/remediation-tdah/.

Application HTML autonome adaptée du plan de remédiation cognitive TDAH adulte fourni par le propriétaire. La source PDF personnelle n’est pas publiée. Aucun diagnostic, score clinique ni promesse de traitement. Les points et badges reconnaissent l’utilisation de l’outil.

## Parcours

Le plan, dépôt des tâches, classement par énergie, trois priorités maximum, mini-étapes, initiation de cinq minutes, cycles 25/5 avec pause longue après trois cycles, aide au blocage, bilan du soir, choix de demain, mises en situation fictives et progression sur quatorze jours. Profil facultatif et objectif adaptable à l’énergie déclarée. La pause longue de quinze minutes est un réglage proposé, sa durée n’est pas fixée dans le plan.

## Données et progression

Stockage local uniquement (clé petits-pas-v1), sans compte ni réseau. Les tâches, ressentis et bilans peuvent contenir des informations privées : ne pas en saisir sur un appareil partagé. Export JSON et import de sauvegardes de la version autonome ; effacement local disponible. Le passage du fichier local au site nécessite un export/import volontaire. Aucun profil réel ni sauvegarde utilisateur n’est versionné.

Points attribués une fois par identifiant de tâche ou d’étape, même après réouverture. Les points acquis restent conservés après suppression. Les quêtes quotidiennes et séances terminées apportent des points supplémentaires ; chaque niveau représente 100 points. Les étoiles dépensées n’abaissent pas le niveau. Pas de série punitive. Les trophées restent dans le labo.

## Publication et contrôle

La liste LABS_PUBLIES de scripts/build.mjs copie la page dans dist/labs/remediation-tdah/index.html. La carte Labs est traduite en français et en anglais ; le labo est en français. Métadonnées KermicLab et CSP à hashes, aucune ressource externe. La page est ajoutée à check:pages.

Avant fusion : CI verte et validation du propriétaire conformément à AGENTS.md, avec relecture du contenu destiné aux adultes.

## Références partagées et rebonds

Huit micro-skills transversaux sont déclarés dans `referentiel/objets/remediation-tdah/`, au statut éditorial `draft` (proposés à la relecture, pas des acquis d’un utilisateur). Ils sont enseignés dans le sens d’une pratique guidée par `notion.transversal.organisation-et-attention` et contribuent à `skill.transversal.organiser-et-ajuster-son-action`. Les relations `relatedTo` indiquent une proximité ou un transfert de méthode, jamais une équivalence ni une validation automatique des compétences disciplinaires.

<a id="externaliser"></a>

### externaliser — Externaliser les tâches et les pensées

Référence : `microskill.transversal.externaliser-les-taches-et-les-pensees`.

Noter les tâches et les idées dans un support unique.

À retenir : Dépose ce qui occupe ton esprit dans la pochette. Une pensée qui arrive pendant le travail peut être notée, puis laissée de côté pour revenir à l’action.

<a id="prioriser"></a>

### prioriser — Choisir des priorités selon son énergie

Référence : `microskill.transversal.prioriser-selon-son-energie`.

Observer son énergie et limiter les priorités de la journée.

À retenir : Classe les tâches de la plus énergivore à la moins énergivore. Choisis trois priorités au maximum ; avec peu d’énergie, une mini-étape peut suffire.

<a id="decomposer"></a>

### decomposer — Découper une tâche en actions simples

Référence : `microskill.transversal.decomposer-une-tache-en-actions-simples`.

Transformer une tâche large en mini-étapes ordonnées et cochables.

À retenir : Une case correspond à une action simple : ouvrir le document, écrire le titre, sortir le dossier. Si la tâche reste trop grosse, redécoupe la prochaine étape.

<a id="commencer"></a>

### commencer — Initier une première petite action

Référence : `microskill.transversal.initier-une-premiere-petite-action`.

Commencer par un geste limité, avec le droit de s’arrêter.

À retenir : Dis-toi : « Je fais seulement la première petite étape. » Lance cinq minutes si cela t’aide. Après ces cinq minutes, tu as le droit d’arrêter.

<a id="recentrer"></a>

### recentrer — Revenir à la tâche après une distraction

Référence : `microskill.transversal.revenir-a-la-tache-apres-une-distraction`.

Préparer un espace monotâche et retrouver le fil de l’action.

À retenir : Garde un seul dossier ouvert, ferme les mails et écarte le téléphone. Si une autre pensée arrive, note-la puis reviens à la tâche.

<a id="recuperer"></a>

### recuperer — Alterner effort et récupération

Référence : `microskill.transversal.alterner-effort-et-recuperation`.

Utiliser les pauses comme repères pour reprendre l’action.

À retenir : Le plan propose vingt-cinq minutes de travail puis cinq minutes de pause. Après trois cycles, prends une pause plus longue. Se lever, boire, bouger ou regarder au loin peut marquer cette coupure.

<a id="ajuster"></a>

### ajuster — Identifier un blocage et ajuster son prochain pas

Référence : `microskill.transversal.identifier-un-blocage-et-ajuster-son-action`.

Nommer un ressenti ou un obstacle pour choisir une réponse concrète.

À retenir : Fatigue : une pause courte. Tâche floue : faire juste le plan. Perfectionnisme : une version imparfaite. Tâche trop grosse : des étapes plus petites. Parle-toi avec bienveillance.

<a id="preparer"></a>

### preparer — Reconnaître ses avancées et préparer la reprise

Référence : `microskill.transversal.faire-un-bilan-et-preparer-la-reprise`.

Faire un bilan simple puis choisir une première tâche pour demain.

À retenir : Coche ce qui est fait et félicite-toi, même pour une petite avancée. Choisis une seule tâche en premier demain. Les jours moyens comptent ; la régularité prime sur la perfection.

### Notions connexes du catalogue

| Notion | Référence partagée | Source du mémo |
|---|---|---|
| problemes-a-etapes-cm | `notion.mathematiques.problemes-a-etapes-cm` | `catalogue/problemes-a-etapes-cm/contenu.json` |
| ecrire-et-reecrire-c4 | `notion.francais.ecrire-et-reecrire-c4` | `catalogue/ecrire-et-reecrire-c4/contenu.json` |
| eps-endurance-et-sante-c4 | `notion.eps.eps-endurance-et-sante-c4` | `catalogue/eps-endurance-et-sante-c4/contenu.json` |
| algorithmes-programmation-cm | `notion.mathematiques.algorithmes-programmation-cm` | `catalogue/algorithmes-programmation-cm/contenu.json` |
| temps | `notion.philosophie.temps` | `catalogue/temps/contenu.json` |
| conception-et-prototypage-c4 | `notion.technologie.conception-et-prototypage-c4` | `catalogue/conception-et-prototypage-c4/contenu.json` |

La table de correspondance est `Sample/lab/remediation-tdah-microskills.json`. Le build résout les identifiants des objets partagés et extrait les vrais champs `niveaux[].aRetenir` du catalogue ; il les embarque dans la page HTML pour une lecture hors ligne. Aucun intitulé ni extrait du catalogue n’est recopié manuellement dans le code de l’interface. Les liens vers la lecture complète ouvrent la route publiée du Worker, uniquement sur clic.

Les gestes observés sont enregistrés localement sous forme de date et de catégorie, sans texte de tâche ni de ressenti supplémentaire. « Pratiqué aujourd’hui » signifie qu’un geste a été observé dans le labo depuis l’ajout de ce suivi ; cela ne mesure ni la maîtrise, ni une évolution clinique. Lire un mémo n’ajoute pas de points. Les anciens exports restent importables.
