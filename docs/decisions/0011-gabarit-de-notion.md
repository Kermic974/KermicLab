# ADR 0011 — Gabarit de notion : le contenu est une donnée

- Date : 2026-11-01 — Statut : **proposé** (pilote : Pythagore, fractions, proportionnalité ; à valider par le propriétaire)
- Contexte : étendre le catalogue au-delà de la trigonométrie. Écrire chaque page à la main (≈ 16 Ko de HTML et JS par notion) ne passe pas à l'échelle : pages hétérogènes, relecture longue, correctifs (sécurité, accessibilité, mobile) à reporter partout.
- Décision :
  - Un **gabarit commun** (`gabarit/page.html`, `gabarit/style.css`, `gabarit/moteur.js`) porte le socle : registre d'onglets, stockage abstrait, bouton de connexion masqué, accessibilité, mobile, mode sombre.
  - Une notion = `fiche.md` + **`contenu.json`** (niveaux d'explication, figure interactive, exercices, mise en situation). `npm run build` génère `page.html` (`scripts/lib/gabarit.mjs`), qui reste un fichier autonome conforme au contrat (AGENTS.md §5) et est committé comme les autres pages.
  - Le contenu est rendu par le moteur **sans innerHTML** (mini-balisage `**gras**` et `*italique*` seulement) ; il est validé au build (`validerContenu`) avec des messages explicites.
  - Composants réutilisables : exercices `qcm` et `nombre` (décimaux à virgule, fractions, tolérance, indices progressifs, fraction irréductible exigée), figures `pythagore`, `fraction`, `proportion`. Une nouvelle figure s'ajoute dans `moteur.js` et `TYPES_FIGURE`.
  - Les pages écrites à la main (`trigo-cercle`) restent acceptées : le gabarit ne s'applique qu'aux dossiers qui ont un `contenu.json`.
  - Un `page.html` généré modifié à la main est détecté par `check:pages` (« page obsolète ») : on modifie `contenu.json` ou le gabarit, jamais la page.
- Conséquences :
  - Ajouter une notion = écrire un JSON (guide : `docs/gabarit.md`) ; un agent (Sonnet, AGENTS.md §4) peut en préparer un premier jet depuis une issue `maquette-manquante`. La **validation humaine de l'exactitude** reste obligatoire.
  - Modifier le gabarit régénère toutes les pages concernées : leur `version` ne change pas, mais le diff des `page.html` doit être relu.
  - Étoiles par exercice gardées en `localStorage` par page (indisponible dans l'iframe isolée du chat : la progression se garde en ouvrant la page en plein écran, comme les scores de `trigo-cercle`).
