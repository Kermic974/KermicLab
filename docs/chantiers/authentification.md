# Chantier : Authentification (OAuth)

**Niveau actuel : 0 (backlog — en attente)**

Décision du propriétaire (2026-11-01) : le chantier OAuth est **mis en backlog**. Aucun code d'authentification
n'est présent dans le dépôt ; seul le modèle de données est proposé (ADR 0010, phase C).

État :
- Boutons « Se connecter » et « Mon compte » présents dans l'en-tête du chat, masqués tant que
  `connexionActive` vaut `false` (`dist/config.json`, écrit par `scripts/build.mjs`).
- Progression locale sans compte (`web/progression.js`, stockée dans le navigateur) : elle servira de source
  à la synchronisation vers la table `progres` quand un profil élève sera actif.

Prérequis avant de reprendre :
- Valider l'ADR 0010 (comptes parent, profils élèves, progression).
- Choisir le fournisseur (OAuth Google/Apple/Microsoft, magic link Worker, Cloudflare Access, tiers) — ADR à écrire.
- RGPD niveau 1 et consentement parental < 15 ans (`docs/chantiers/rgpd.md`) — **point de contrôle humain / juridique**.

Prochaines étapes (quand le chantier sortira du backlog) :
- Flux OAuth côté Worker (PKCE, `state`, cookie de session `HttpOnly; Secure; SameSite=Lax`), secrets en Cloudflare Secrets.
- Tables `comptes` / `eleves` / `progres` (migration D1), effacement en cascade.
- Activer `connexionActive`, synchroniser la progression locale vers le compte au premier login.
