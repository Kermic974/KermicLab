# Agent À petits pas — cadrage V1.1.0
Statut : proposition à arbitrer, indépendante de la PR #446.

## Mission
Assistant adulte d'organisation, non clinique. Aider à trier les pochettes, choisir au plus trois priorités, décomposer une tâche, proposer un démarrage de cinq minutes et préparer demain. Ne jamais diagnostiquer ni prescrire. Ne pas inférer un état de santé. Ton non culpabilisant, une action à la fois.

## Architecture
Conserver le HTML autonome et petits-pas-v1. Première tranche : harness déterministe local, sans réseau, lecture seule, propositions explicites. Deuxième tranche optionnelle : route Worker dédiée, désactivée par défaut, réutilisant llm.js et le registre de configuration, modération, quotas et télémétrie sans contenu. Aucun Durable Object, D1 ou R2 pour les pochettes. Pas de nouveau fournisseur. La CSP connect-src none reste intacte en tranche 1. Toute ouverture réseau exige une décision de gouvernance, une revue de confidentialité et une liste d'origines exacte.

## Contrat
Entrée locale : tâches sélectionnées, identifiants, énergie déclarée, mini-étapes, objectif choisi. Pas de lecture automatique des bilans, ressentis, profil ou sauvegardes. Pour une future inférence distante, ne transmettre que des catégories et identifiants éphémères et des descriptions explicitement sélectionnées et expurgées, après aperçu et consentement par requête. La pseudonymisation existante ne garantit pas l'anonymat, notamment des données de santé : exclure ces données du transfert. Vérifier les conditions de rétention fournisseur avant activation.
Sortie : propositions structurées, références aux tâches autorisées, raison courte, première action, aucune écriture automatique. Rejeter les identifiants inconnus, les actions hors liste, les sorties trop longues et les instructions issues des données. Afficher en texte, jamais HTML généré.
Outils envisagés : lire_selection, proposer_priorites, proposer_mini_etapes, proposer_plan, proposer_report. Les écritures sont des opérations locales déterministes après confirmation individuelle, contrôle de fraîcheur et possibilité d'annuler. Pas de suppression, d'envoi externe ou de modification des points par l'agent.

## UX
Entrées contextuelles dans Aujourd'hui, Vider la tête, Classer, Agir. Bouton « Aide-moi à choisir », carte de proposition, accepter/modifier/ignorer. Mode local disponible hors ligne, aucune fenêtre intrusive, aucun score clinique. Limiter à trois propositions et une première action.

## Recette
Tests unitaires : sélection vide, énergie basse, tâches terminées, identifiants dupliqués/inconnus, injection dans les titres, limites de taille, absence de mutation. E2E : consentement, annulation, sauvegarde inchangée avant validation, clavier, mobile, hors ligne. Tranche distante : refus sans consentement, absence de contenu dans journaux/cache/stockage, quotas, panne fournisseur, validation stricte des sorties, sécurité adulte et mineurs. CI verte et validation humaine avant fusion.

## Arbitrage
Autoriser ou non la tranche distante et son exception au contrat autonome. Revue sécurité et confidentialité requise avant toute donnée réelle. Pas de déploiement ni de changement de CSP dans ce chantier de cadrage.
