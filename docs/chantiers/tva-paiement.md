# Chantier : TVA et paiement

**Niveau actuel : documenté, non activé**

Cible phase 5 : abonnement Stripe à 0,99 $ HT/mois par login utilisateur ou 9,99 $ HT/an.

Chaîne de prérequis : société → compte Stripe → produits/prix → gestion de la TVA (Stripe Tax, OSS UE) → webhooks vers le Worker.
Rien n'est implémenté dans le MVP.

## Backlog : accès LLM conditionné à un abonnement

Suivi : [issue #121](https://github.com/Kermic974/trigoLab/issues/121).

L'accès LLM reste **gratuit provisoirement**, à la demande du propriétaire (2026-11-05). La possession d'une clé, le cookie technique de quota et `LLM_ACTIF` ne constituent pas une preuve d'abonnement.

- Vérifier côté Worker, **avant réservation de tokens ou appel de tout fournisseur**, l'authentification parent et un droit d'accès actif établi par le serveur.
- Alimenter les droits avec les webhooks de paiement signés et idempotents ; gérer activation, renouvellement, expiration, résiliation, impayé et remboursement. Ne jamais faire confiance à un statut envoyé par le navigateur.
- Appliquer ce contrôle également au repli Anthropic et à la future comparaison croisée ; conserver le quota de 1 000 tokens générés par session.
- Laisser les pages du catalogue accessibles sans abonnement et sans appel modèle.
- Ajouter les tests : non abonné/expiré/refusé → zéro appel, abonné actif → quota appliqué, panne du service de droits → refus sûr, repli soumis au même droit.
- Avant activation : validation juridique pour le public mineur, contrôle du consentement parent et information tarifaire claire. Ne pas activer un paiement ou collecter de données bancaires dans cette contribution.
