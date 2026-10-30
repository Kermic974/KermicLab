# Changelog

## v1.0.0

Version finale du draft « Studio V5 ».

### Corrections

- Angle de référence faux dans les quadrants II, III et IV (120° affichait 30° au lieu de 60°).
- Un champ de saisie vide ramenait l'angle à 0° ; une saisie invalide est désormais signalée sans modifier l'angle.
- Un toucher au centre du cercle (angle indéfini) produisait un saut à 0° ; une zone morte centrale l'ignore.
- La virgule décimale (`22,5`) est acceptée.
- Fin de glissement fiabilisée (`lostpointercapture`, `pointercancel`).

### Nouveautés

- Saisie en radians : `π/3`, `2pi/3`, `-π`…
- Axe des tangentes (option) avec le point T = (1 ; tan θ).
- Repères du cercle en degrés ou en radians.
- Segments cos/sin colorés sur les axes et explication contextuelle (angle de référence, signes).
- Clavier : PageUp/PageDown (±15°) ; `aria-valuetext` et boutons `aria-pressed`.
- Glissement fluide via `requestAnimationFrame` ; cercle fixe à l'écran sur desktop.
- Code source lisible et commenté ; 1 118 autotests intégrés.

## v0.0.0

- Première version autonome du cercle trigonométrique interactif.
- Interface responsive mobile/desktop.
- Source d'état unique pour l'angle.
- Interactions Pointer Events.
- Valeurs exactes et approximatives.
- Diagnostic et autotests.
- Package VS Code et déploiement GitHub Pages.
