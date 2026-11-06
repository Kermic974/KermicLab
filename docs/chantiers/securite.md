# Chantier : Sécurité et abus

**Niveau actuel : 0 (rate limiting simple)**

- Limitation de débit par IP en mémoire de l'isolat (`LIMITE_PAR_MINUTE`, défaut 20/min) ; l'IP n'est jamais stockée.
- Taille maximale des messages (`TAILLE_MAX_MESSAGE`, défaut 500 caractères).
- Modération des entrées et sorties (`worker/src/moderation.js`) + prompt système orienté sécurité des enfants ; refus journalisés anonymement (raison seule).
- CORS restreint aux origines autorisées ; `frame-ancestors` sur les maquettes ; CSP stricte sur le chat (`dist/_headers`) et les maquettes.
- Secrets uniquement dans Cloudflare et GitHub Secrets ; lint anti-secrets ; Gitleaks ; CodeQL ; revue des dépendances ; revue IA de sécurité.
- LLM : activation explicite `LLM_ACTIF=true`, cookie de session signé par `LLM_SESSION_SECRET`, expiration absolue de 24 h. Quota D1 atomique de **1 000 tokens générés** par session, tous fournisseurs et essais compris ; réservation maximale de 500 par appel et refus des appels concurrents. Pas de nouvelle tentative SDK ; usage manquant/erreur facturé prudemment à la réservation entière.
- Périmètre LLM fermé : relances pédagogiques reconnues, normalisées côté serveur, seulement sur la dernière page servie à la session. Le client ne choisit pas sa source et n'envoie plus son historique. Sources versionnées tirées de cette page, aucun lien inventé par le modèle, métadonnées modèle/harness affichées en fin de réponse.
- Les données de quota ne contiennent ni IP ni conversation. Purge quotidienne des lignes expirées ; validation juridique du cookie technique et des conditions fournisseurs requise avant activation.

Prochaines étapes :
- Abonnement obligatoire pour l'accès LLM : [backlog paiement](tva-paiement.md). L'accès gratuit actuel est provisoire. Avant authentification, supprimer le cookie ou utiliser un autre navigateur crée une autre session : ce quota n'est ni un plafond par personne ni un plafond financier global. Un identifiant anonyme seul ne prévient pas la création volontaire de sessions multiples.
- Niveau 1 : binding Cloudflare Rate Limiting (compteur global) et Turnstile en cas d'abus.
- Niveau 2 : modération par un classifieur dédié ; tests d'injection de prompt automatisés.
- Note : tant que le dépôt est privé, CodeQL tourne sans envoi à GitHub et `scripts/verifier-sarif.mjs` bloque la CI en cas d'alerte.
