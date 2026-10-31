# Chantier : Sécurité et abus

**Niveau actuel : 0 (rate limiting simple)**

- Limitation de débit par IP en mémoire de l'isolat (`LIMITE_PAR_MINUTE`, défaut 20/min) ; l'IP n'est jamais stockée.
- Taille maximale des messages (`TAILLE_MAX_MESSAGE`, défaut 500 caractères).
- Modération des entrées et sorties (`worker/src/moderation.js`) + prompt système orienté sécurité des enfants ; refus journalisés anonymement (raison seule).
- CORS restreint aux origines autorisées ; `frame-ancestors` sur les maquettes ; CSP stricte sur le chat (`dist/_headers`) et les maquettes.
- Secrets uniquement dans Cloudflare et GitHub Secrets ; lint anti-secrets ; Gitleaks ; CodeQL ; revue des dépendances ; revue IA de sécurité.

Prochaines étapes :
- Niveau 1 : binding Cloudflare Rate Limiting (compteur global) et Turnstile en cas d'abus.
- Niveau 2 : modération par un classifieur dédié ; tests d'injection de prompt automatisés.
