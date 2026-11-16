# Chantier : RGPD

**Niveau actuel : 0 (page statique)**

- Aucune donnée personnelle collectée ; le chat rappelle de ne jamais partager nom, adresse, école, photo.
- KPI anonymes uniquement (type d'événement, maquette, sujet, langue, raison de refus) — ni IP, ni texte.
- Page `web/confidentialite.html` décrivant les traitements ; Cloudflare Web Analytics sans cookie.
- Google Analytics 4 (ADR 0027) : **seulement après accord** dans un bandeau (refus par défaut), sur le tableau de bord
  et la page Confidentialité ; signaux publicitaires désactivés ; jamais dans les pages du catalogue. Exception
  explicite au principe « aucune donnée personnelle collectée », limitée aux visiteurs qui acceptent.
- Stockage local uniquement dans le navigateur (scores, langue, onglet).

Prochaines étapes (phase 3) :
- Validation juridique de Google Analytics (base légale, mineurs de moins de 15 ans, transfert hors UE) —
  **point de contrôle humain / juridique** (`docs/actions-manuelles.md`).
- Registre des traitements, analyse d'impact (public mineur), sous-traitants (Cloudflare, Anthropic, GitHub).
- Consentement parental pour les moins de 15 ans avant « Mon compte » — **point de contrôle humain / juridique**.
