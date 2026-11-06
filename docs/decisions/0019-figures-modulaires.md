# ADR 0019 — Figures du gabarit modulaires : une page n'embarque que sa figure

- Date : 2026-11-06 — Statut : **proposé** (à valider par le propriétaire)
- Contexte : toutes les figures interactives du gabarit des notions (ADR 0011) vivaient dans l'objet `FIGURES` de
  `gabarit/moteur.js`, recopié en entier dans chaque page générée. Le plan des labs (`docs/plan-pr-labs.md`) prévoit une
  quinzaine de figures nouvelles : chacune aurait modifié les ~170 `page.html` du catalogue, rendu impossible la
  relecture du diff et mis en conflit toutes les PR de labs ouvertes en même temps. Chaque page portait en outre ~18 Ko
  de code de figures qu'elle n'utilise pas.

## Décision

1. Une figure = **un fichier `gabarit/figures/<type>.js`**, qui ajoute sa fonction à l'objet `FIGURES` du moteur
   (`FIGURES.<type> = function <type>(conf) { … };`). Elle utilise les outils du moteur (`h`, `s`, `curseur`, `tuile`,
   `nombreFr`…), car elle est insérée dans sa portée.
2. `gabarit/moteur.js` contient un marqueur unique `// @figure`. Au build, `scripts/lib/gabarit.mjs` le remplace par le
   code de la figure déclarée par `application.figure.type` (sans l'en-tête de commentaires), ou par rien. La page reste
   un seul fichier autonome avec un seul script moteur ; ses hashes CSP sont recalculés comme avant.
3. La liste des types (`TYPES_FIGURE`) est **découverte** dans `gabarit/figures/`. Une figure dont les paramètres ont des
   contraintes fournit `scripts/lib/figures/<type>.mjs`, qui exporte `valider(conf, ou, { exiger, texteNonVide })`.

## Conséquences

- Ajouter une figure ne modifie que la page de la notion qui l'utilise : plusieurs PR de labs peuvent avancer en
  parallèle, et le diff d'une page reste relisible.
- Modifier `gabarit/moteur.js` régénère toujours toutes les pages (comme avant) : à réserver aux évolutions du socle.
- Un test unitaire vérifie qu'une page n'embarque que sa figure et que les `page.html` committées sont à jour.
