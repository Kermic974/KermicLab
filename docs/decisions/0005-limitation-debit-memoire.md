# ADR 0005 — Limitation de débit en mémoire (niveau 0)

- Date : 2026-10-31 — Statut : accepté, à réviser au niveau 1
- Décision : compteur par IP dans la mémoire de l'isolat, fenêtre d'une minute, sans persistance de l'IP.
- Limite connue : compteur par isolat (approximatif). Évolution : binding Cloudflare Rate Limiting.
