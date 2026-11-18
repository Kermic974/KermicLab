# ADR 0033 — Catégorisation et suivi des jeux

- Date : 2026-11-18 — Statut : **proposé**, implémentation préparée pour revue.
- Demande : reprendre les neuf jeux, documenter leurs contrats, mesurer engagement et réussite, partager les bilans avec les tuteurs rattachés.
- Sources : [S6.1](https://app.notion.com/p/41a0c40cec288140b448cebf8af4bb6a), [S6.2](https://app.notion.com/p/41a0c40cec2881598af9ca75067b03fe), S7–S9 (propositions documentaires), ADR 0015, 0025, 0029, 0030 et 0032.

## Extension proposée

Le registre applicatif `web/contrat-jeux.js` distingue famille de navigation, intention, type pédagogique principal, interaction, restitution, difficulté éditoriale et cibles canoniques. La page ludique est une manipulation ; les leçons sont des activités guidées, les révisions et défis des exercices. Aucun niveau de jeu n'est un Stage ou un état de maîtrise. Toutes les fiches restent `review` ; aucun contrat Notion ni relecture humaine n'est automatiquement validé.

Les liens historiques `notions-liees` restent disponibles pour la navigation. Ils ne donnent pas accès au suivi professeur. Une cible explicite du nouveau registre doit correspondre à la projection canonique et au catalogue effectivement servi. Seul 2048 → `notion.mathematiques.puissances` est retenu ici : ses tuiles représentent les puissances successives de deux. Il s'agit d'une occasion de mobilisation, pas d'une évaluation des règles de calcul des puissances. Les huit autres jeux attendent une qualification pédagogique de leurs cibles ; ils restent visibles par le parent.

## Protocole applicatif Jeux v2

Le pont `gabarit/jeux/suivi.js` réutilise les types de messages de l'ADR 0025 avec `v: 2`, sans modifier le protocole scolaire v1. Poignée de main par origine HTTP(S) déclarée, source vérifiée et identifiant du cadre attendu ; aucune écoute ni émission sans origine déclarée. Le parent exige l'origine opaque de l'iframe sandboxée.

Chaque événement porte `notion` (jeu historique), `version` (SemVer), `tentative` (UUID aléatoire), `activite` (identifiant éditorial, jamais un mot personnel), `mode` (partie/lecon/revision/defi/orthographe), `sequence` et `evenement` :

| Événement | Complément |
|---|---|
| `demarre` | séquence 0, première action effective ; ouvrir ou restaurer une page ne suffit pas |
| `interaction` | action non évaluée, notamment déplacement ou saisie |
| `reponse` | `correct`, booléen ; aucune réponse saisie |
| `indice` | aide effectivement présentée |
| `termine` | `resultat` : reussite, echec, abandon ou neutre |
| `efface` | effacement explicite dans l'Académie |

Seuls les champs du schéma sont acceptés. Séquences contiguës, résultat terminal immuable, identité/version/mode/activité stables. Les doublons et événements désordonnés sont ignorés. Les canaux partie, Académie et orthographe sont indépendants. Nouvelle activité sur un canal actif, sortie de séance, retrait du cadre, rechargement ou reprise après fermeture marquent un abandon ; jamais un échec scolaire. Les parties libres à deux aux échecs sont terminées avec résultat neutre, sans attribuer une victoire à un apprenant identifié.

## Persistance et métriques

L'enveloppe locale existante `kermiclab:evenements` reste en v1 et reçoit une clé facultative `jeux`. Le protocole de transport Jeux est v2 ; les versions de stockage et de transport ne sont pas interchangeables. Les anciennes sauvegardes n'acquièrent aucune tentative fictive. Les nouveaux faits ne passent jamais par `maitriseNotion`, les cartes de révision scolaires ou les gains d'XP scolaire.

Conservation : **64 dernières tentatives par jeu**, avec les sept derniers jours actifs de chacune. Les compteurs sont recalculés sur cette fenêtre ; le bilan affiche la dernière version pratiquée et ses dénominateurs. Les acquis et points historiques restent dans les trophées ; le temps actif cumulé provient du moteur existant, toutes versions confondues, ce que l'écran indique. Pas d'horodatage précis, de liste personnelle ou de réponse dans le journal.

- Complétion : terminées hors abandon / commencées. Une partie nulle est terminée.
- Réussite : réussies / terminées évaluables (réussite ou échec). Abandons, nulles et tentatives en cours exclus du dénominateur.
- Autonomie : réussites sans erreur ni aide / réussites dont les erreurs sont observables. Non mesurée pour les parties sans correction observable (notamment 2048, échecs, belote, poker).
- Consolidation : révisions réussies sans erreur ni aide / réalisées ; les tentatives abandonnées n'en font pas partie.
- Jours actifs : jours distincts des sept derniers jours, dans la fenêtre conservée. Les dates futures ne comptent pas.
- Aucun dénominateur : « Non mesuré », sans pourcentage fabriqué.

Les faits suivent session/mémorisation, export/import et synchronisation chiffrée existants. Les limites de taille du compte local restent inchangées : son allègement existant peut omettre l'enveloppe facultative si l'ensemble est trop volumineux. Une page autonome garde ses trophées locaux ; le suivi partagé est disponible seulement dans le tableau de bord, sans réseau dans les jeux.

## Partage et compatibilité

Ajout facultatif `bilan.jeux = { v: 1, jour, jeux: { [id]: compteurs } }`, relu par `normaliserBilanJeux` dans les routes existantes. Maximum neuf identifiants connus, compteurs bornés à la fenêtre, contrôles de cohérence, aucun journal de tentatives envoyé. Les dates et versions sont contrôlées ; les champs inconnus sont supprimés. Aucun changement de table ni migration D1 : les bilans existants sont des JSON remplacés à chaque envoi.

Le parent rattaché reçoit tous les jeux mesurés. Le serveur applique `bilanPourProfesseur` aux cibles explicites et aux matières suivies avant transmission. Aucun total Jeux global ne traverse ce filtre. Les statistiques globales historiques du bilan (XP/temps toutes activités, ADR 0030) restent distinctes des compteurs Jeux filtrés. Les interfaces précisent la provenance déclarative et la fraîcheur des données ; ce n'est pas un relevé certifié côté serveur.

Les permissions, rattachements, accord existant, consentement parental, cadence d'envoi et effacement en cascade restent ceux des espaces Famille et Professeur. Pas de notification ni d'export externe ajouté. Revue du propriétaire requise avant fusion et ouverture du nouveau partage.

## Validation

Matrice et limites par jeu : [guide français](../jeux-suivi.fr.md), [English guide](../jeux-suivi.md). Tests : `suivi-jeux.test.mjs`, parcours navigateur `suivi-jeux.test.mjs`, tests existants des neuf moteurs, pages, stockage, Famille et Professeur. La CI complète reste obligatoire.
