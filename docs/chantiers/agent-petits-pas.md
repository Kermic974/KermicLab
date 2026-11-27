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

## Intégration au back-office — proposition du 27 novembre
Sources : ADR 0026, configuration.js, reglages.js, assistant-utilisateurs.js (ADR 0035).
- Réutiliser configurationAdmin, envAvecReglages, lireConfiguration et les routes /api/admin/harness ; aucun second back-office. Le registre SKILLS inclut un futur skill petits-pas, mais Object.keys(SKILLS) active actuellement tous les skills par défaut : prévoir une exclusion explicite et un interrupteur indépendant PETITS_PAS_IA_ACTIF=false, combiné à LLM_ACTIF et skillActif. Pas de route distante avant arbitrage.
- Paramètres proposés : MODELE_PETITS_PAS=custom/haiku (alias à vérifier), MAX_TOKENS_PETITS_PAS=800 (200–1500), PETITS_PAS_PLANS_JOUR=5 (0–10), INSTRUCTIONS_PETITS_PAS (privé, 2000 caractères). Valeurs provisoires à valider ; documenter wrangler.toml, .env.example, traductions fr/en, module et tests de registre. Ne pas réutiliser les quotas tuteur sans vérifier les contraintes CHECK de sessions_llm ; définir une réservation atomique dédiée si nécessaire.
- Réutiliser systemeComplet et le contrôle des instructions complémentaires ; socle non modifiable en code, schéma strict, actions autorisées et validation des références comme assistant-utilisateurs.js. Données navigateur exclusivement dans le message, jamais dans le système.
- Télémétrie agrégée par module, modèle et statut ; aucune tâche, titre, ressenti, bilan, identifiant de pochette ni plan dans D1, R2, journaux, cache ou analytics. Ajouter la future route au test de non-conservation. Ne pas exposer les pochettes dans l'écran Utilisateurs ni à l'assistant administrateur.
- Accès adulte et consentement explicite par requête indépendants de CONTROLE_ACCES_ACTIF et GARDE_FOUS_ACTIFS (actuellement observation). Ne pas traiter une déclaration de détresse ou un niveau d'énergie comme un signal de sanction. Prévoir refus et repli local en cas d'incertitude sur l'accès.
- Préparer une fonctionnalité de souscription sans activer la facturation ni modifier les offres existantes ; afficher coût agrégé dans Finance après vérification des tarifs et métriques.
- Étudier l'inventaire des labs publiés : ADR 0026 indique que les labs ne sont pas un type distinct du catalogue. Proposer un inventaire en lecture seule puis un mécanisme de masquage compatible avec les pages autonomes ; ne pas promettre que le masquage actuel bloque les URL statiques.
- Charte : conserver l'identité locale et vérifier contraste/focus ; éventuelle intégration des thèmes sans rendre le mode hors ligne dépendant du réseau.
- Recette : réglages à chaud et retour défaut, refus d'instructions contraires au socle, paramètres privés absents de la vue publique, arrêt distant même en cas de configuration invalide, contrôle des quotas, validation des plans, absence de données privées dans toutes les tables, isolation entre utilisateurs, mode hors ligne inchangé.
Cette extension est documentaire ; aucune configuration de production modifiée. Les réglages effectifs du back-office déployé n'ont pas été consultés.
