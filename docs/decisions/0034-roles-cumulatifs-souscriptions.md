# ADR 0034 — Rôles cumulatifs, souscription choisie par le compte et coûts affinés

- Date : 2026-11-18 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : un compte n'avait qu'un rôle (`attributions_roles.role_id`) ; un enseignant parent devait choisir entre
  Professeur et Parent. Le propriétaire demande des rôles **cumulatifs**, une édition complète des souscriptions (limites
  et tarifs), le chargement des **tarifs exposés par Cloudflare** (AI Gateway), une gestion des coûts plus fine,
  l'affichage du niveau de souscription dans le compte de l'utilisateur et un changement de niveau à la demande. Le
  paiement viendra plus tard : pendant la phase de développement, il est considéré comme acquis.

## Décision

### 1. Rôles cumulatifs (`worker/src/attributions.js`)

- Migration D1 `0009` : colonne `attributions_roles.roles`, liste JSON des rôles attribués à la main. `role_id` en reste
  le premier élément (lu par la version précédente du Worker ; colonne historique `comptes.role` alignée sur le premier
  rôle qu'elle accepte). Liste vide : `role_id` seul, comme avant.
- **Rôles effectifs** = rôles manuels ∪ rôle de la souscription du compte. « Visiteur » s'efface dès qu'un autre rôle
  est présent. **Permissions effectives** = union des permissions de ces rôles.
- Une seule lecture, `attributionDuCompte()`, sert l'Espace famille (permission `famille`), l'expérience Professeur
  (`professeur`), les contributions (rôle de contribution déduit des permissions cumulées, « admin » prioritaire) et le
  back-office. `GET /api/famille/moi` et `GET /api/professeur/moi` ajoutent `roles` à `role` (premier rôle).
- Décision d'accès (`accesAutorise`, contrôle activé) : l'un des rôles cumulés doit permettre la fonctionnalité, puis
  l'offre doit l'inclure (règle de l'ADR 0031 inchangée : l'offre restreint), puis la stratégie (un rôle cumulé suffit).
- Back-office : cases à cocher par compte (Utilisateurs), simulateur à plusieurs rôles (Rôles et accès). Un rôle
  personnalisé attribué, seul ou cumulé, ne se supprime pas.

### 2. Souscriptions entièrement modifiables

- Tous les champs des limites et des tarifs sont modifiables, « Gratuit » compris : ses limites de consommation sont
  écrites dans le registre (mêmes bornes que Harness, plafonds de la table de quota compris), qui reste la seule source.
- Nouveau champ `prix.prixAnnuelHT` : prix annuel saisi directement (0 = douze mois moins la remise) ; la remise
  effective est affichée. Le champ calculé par le mode (prix ou marge) reste en lecture seule, jamais désactivé.

### 3. Tarifs Cloudflare (`worker/src/tarifs-cloudflare.js`)

- Bouton « Charger les tarifs Cloudflare (AI Gateway) » : `POST /api/admin/finances/tarifs-cloudflare` interroge le
  catalogue de modèles commun à AI Gateway et Workers AI (`GET /accounts/{compte}/ai/models/search?format=openrouter`,
  prix par token ; le format natif, prix par million, est aussi lu) pour les trois modèles des modules.
- Aperçu seulement : les prix d'entrée, de sortie et de cache remplissent le formulaire ; « Enregistrer les
  hypothèses » les garde (date de chargement conservée). Une erreur par modèle n'empêche pas les autres.
- Il faut `CLOUDFLARE_ACCOUNT_ID` et un jeton `CLOUDFLARE_TARIFS_TOKEN` en lecture seule (Workers AI Read), secrets du
  Worker ; sans eux, le bouton est désactivé (action manuelle). Le jeton ne sort jamais du Worker.

### 4. Coûts affinés (`web/admin/financier.js`)

Par module (tuteur, défi, cahiers) : identifiant du modèle au catalogue, prix d'entrée, de sortie et **d'entrée lue en
cache**, ratio entrée / sortie, **part de l'entrée servie par le cache**, **frais de plateforme** (par exemple 5 % sur les
crédits Unified Billing) et **taille moyenne d'une génération** (0 = maximum du registre). Coût d'un token généré =
(sortie + ratio × (entrée × (1 − cache %) + cache × cache %)) × (1 + frais %).

- **Coûts fixes détaillés** en postes (12 au plus) ; `coutsFixesMensuels` en est la somme.
- **Télémétrie** : la consommation mesurée sur 30 jours (appels, tokens générés par appel, ratio entrée / sortie,
  table `telemetrie_llm`) est affichée par module ; « Reprendre la mesure » remplace l'hypothèse par la mesure.
- Les hypothèses enregistrées avant cet ADR sont reprises sans perte (valeurs par défaut pour les nouveaux champs, un
  seul poste fixe pour l'ancien total).

### 5. Souscription choisie par le compte (`worker/src/souscription-compte.js`)

- « Mon compte » → **Mon abonnement** (compte en ligne) : niveau actuel et prix TTC, rôles cumulés, offres proposées
  avec prix mensuel et annuel TTC, limites principales et rôle apporté. Jamais de coût de revient ni de marge.
- `GET /api/compte-local/souscription` et `POST /api/compte-local/souscription { niveau }` (session porteuse ; refusé
  pendant un mot de passe provisoire). Confirmation en deux temps dans l'interface.
- Le changement garde les rôles manuels ; le rôle de la nouvelle offre se cumule (l'Espace famille s'ouvre avec l'offre
  Parent, par exemple). Chaque changement est noté dans `souscriptions_changements` (niveau quitté, niveau choisi, mode
  de paiement, date au jour près ; aucun montant ni moyen de paiement), visible dans « Ce que Kermiclab sait de moi » et
  dans l'export du back-office, effacé avec le compte.
- **Phase de développement** : paramètre `SOUSCRIPTIONS_LIBRE_CHOIX` (registre, `true` par défaut) — paiement considéré
  comme acquis (`paiement = 'dev'`), offres « en projet » proposées. À `false` : seules les offres « actives » sont
  proposées et une offre payante répond `402 paiement-requis` jusqu'au chantier du paiement (issue #121).

## Conséquences

- Migration D1 `0009_roles_cumulatifs_souscriptions.sql` (ajouts seulement) ; nouvelle table décrite dans le registre
  des traitements (`worker/src/donnees.js`).
- Secrets à créer pour les tarifs Cloudflare ; paramètre à repasser à `false` à l'ouverture du paiement (actions manuelles).
- Le contrôle d'accès reste inactif pendant la bêta : rôles et souscriptions n'ouvrent ni ne ferment encore rien, sauf
  les espaces déjà gardés par une permission (Espace famille, Professeur, contributions), qui lisent les rôles cumulés.
- Limites connues : le paiement, la facturation et la TVA par pays restent à faire ; le passage d'une offre à l'autre
  est immédiat (pas de prorata) ; les comptes famille OAuth (`comptes`) n'ont pas encore d'écran « Mon abonnement ».
