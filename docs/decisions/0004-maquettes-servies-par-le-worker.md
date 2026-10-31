# ADR 0004 — Les maquettes sont embarquées et servies par le Worker

- Date : 2026-10-31 — Statut : accepté
- Décision : `npm run build` embarque les pages du catalogue (public + privé) dans `worker/src/generated/catalogue.js` ; le Worker les sert telles quelles sur `/maquettes/:id?lang=`. Les maquettes privées n'apparaissent donc jamais dans le site Pages ni dans ce dépôt.
- CSP : hashes `sha256` des scripts en ligne recalculés au build et réécrits dans les sources (pages lisibles hors ligne).
