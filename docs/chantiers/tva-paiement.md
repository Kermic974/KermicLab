# Chantier : TVA et paiement

**Niveau actuel : documenté, non activé**

Cible phase 5 : abonnement Stripe à 0,99 $ HT/mois par login utilisateur ou 9,99 $ HT/an.

Chaîne de prérequis : société → compte Stripe → produits/prix → gestion de la TVA (Stripe Tax, OSS UE) → webhooks vers le Worker.
Rien n'est implémenté dans le MVP.
