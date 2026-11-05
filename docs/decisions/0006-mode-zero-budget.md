# ADR 0006 — Mode zéro budget pour la mise en ligne

- Date : 2026-10-31 — Statut : accepté (décision du propriétaire)
- Contexte : aucun budget disponible au lancement. Le domaine `kermiclab.ai` (≈ 160 €) et les crédits API Anthropic sont payants.
- Décision : mettre en ligne sur les offres gratuites (Cloudflare Free, GitHub) avec l'adresse `kermiclab.pages.dev`, sans clé Anthropic.
- Conséquences : le catalogue fonctionne normalement (routage déterministe sans token) ; les questions hors catalogue reçoivent une réponse de repli et les issues `maquette-manquante` sont créées manuellement. Le Worker gère déjà l'absence de clé (`sans-modele` dans les KPI) : aucun changement de code requis pour activer la clé plus tard.
- Révision : à l'arrivée d'un budget, ajouter `ANTHROPIC_API_KEY` (avec plafond de dépense) puis le domaine.
- État révisé : cette décision décrit le lancement initial. Le routage LLM actif passe à Workers AI, avec Anthropic facultatif en repli ; voir l'ADR 0016. Les coûts et quotas Cloudflare doivent être vérifiés avant activation.
