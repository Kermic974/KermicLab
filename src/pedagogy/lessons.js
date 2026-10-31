// Parcours « Apprendre » : contenu des 8 étapes et consignes vérifiables.
// check(v) reçoit le résultat de compute() pour l'angle courant.

import { dist } from '../core/angle.js';

export const LESSONS = [
  {
    title: 'Le cercle unité',
    text: 'Le cercle trigonométrique a pour centre O et pour rayon 1. Un angle θ se mesure depuis l\'axe des x, ' +
      'dans le sens inverse des aiguilles d\'une montre : il place un point P sur le cercle.',
    start: 45, task: 'Fais tourner P jusqu\'à 90° (un quart de tour).',
    check: function (c) { return dist(c.n, 90) < .5; }
  },
  {
    title: 'Le cosinus, c\'est l\'abscisse',
    text: 'Projette P sur l\'axe horizontal : le segment bleu mesure cos θ. ' +
      'À droite de O, cos θ > 0 ; à gauche, cos θ < 0.',
    start: 60, task: 'Rends cos θ négatif.',
    check: function (c) { return c.x < -1e-9; }
  },
  {
    title: 'Le sinus, c\'est l\'ordonnée',
    text: 'Projette P sur l\'axe vertical : le segment orange mesure sin θ. Au-dessus de O, sin θ > 0 ; en dessous, ' +
      'sin θ < 0. Comme le rayon vaut 1, sin θ reste toujours entre −1 et 1.',
    start: 60, task: 'Amène sin θ à sa valeur minimale : −1.',
    check: function (c) { return c.y < -1 + 1e-9; }
  },
  {
    title: 'cos² θ + sin² θ = 1',
    text: 'Le segment bleu, le segment orange et le rayon forment un triangle rectangle d\'hypoténuse 1. ' +
      'Le théorème de Pythagore donne la relation fondamentale : cos² θ + sin² θ = 1.',
    start: 30, task: 'Trouve un angle où cos θ = sin θ.',
    check: function (c) { return Math.abs(c.x - c.y) < 5e-3; }
  },
  {
    title: 'Quadrants et signes',
    text: 'Les axes découpent le cercle en 4 quadrants. I : cos +, sin + · II : cos −, sin + · ' +
      'III : cos −, sin − · IV : cos +, sin −. Observe la carte « Signes » en changeant de quadrant.',
    start: 45, task: 'Place P dans le quadrant où cos θ < 0 et sin θ > 0.',
    check: function (c) { return c.x < -1e-9 && c.y > 1e-9; }
  },
  {
    title: 'Symétries et angle de référence',
    text: '30°, 150°, 210° et 330° sont symétriques par rapport aux axes : leurs cosinus et sinus sont égaux au signe près. ' +
      'L\'angle aigu commun (ici 30°) s\'appelle l\'angle de référence.',
    start: 30, task: 'Trouve l\'autre angle entre 0° et 360° tel que sin θ = 1/2.',
    check: function (c) { return Math.abs(c.y - .5) < 2e-3 && c.x < 0; }
  },
  {
    title: 'La tangente',
    text: 'tan θ = sin θ / cos θ. Prolonge le rayon jusqu\'à la droite rose x = 1 : l\'ordonnée du point T vaut tan θ. ' +
      'Quand cos θ = 0, le rayon est parallèle à cette droite : la tangente n\'est pas définie.',
    start: 45, opts: { showTan: true }, task: 'Trouve un angle où tan θ n\'est pas définie.',
    check: function (c) { return c.t === null; }
  },
  {
    title: 'Les radians',
    text: 'Un tour complet mesure 360°, soit 2π radians : 180° = π. Pour convertir, radians = degrés × π / 180. ' +
      'Les repères du cercle sont maintenant affichés en radians.',
    start: 90, opts: { radLabels: true }, task: 'Place P à 3π/4.',
    check: function (c) { return dist(c.n, 135) < .5; }
  }
];
