// Méthode géométrique : lecture sur le cercle (projections, quadrant, angle de référence).
// Elle lit les valeurs du moteur dans le contexte et ne recalcule rien.

import { fmt } from '../core/format.js';

export const geometricSolution = {
  id: 'geometric',
  label: 'Méthode géométrique',
  supportedModes: ['explore', 'learn', 'compare'],
  supports: function () { return true; },
  solve: function (ctx) {
    var v = ctx.values, e = v.exact, refTxt = fmt(v.ref, 1) + '°', axis = v.n % 90 === 0;
    var steps = [
      { id: 'place', title: 'Placer le point', text: v.quadrant + ' : P est le point du cercle d\'angle ' + fmt(v.angle, 3) + '°.' },
      { id: 'project', title: 'Projeter sur les axes', text: 'cos θ = abscisse de P = ' + fmt(v.x) + ' ; sin θ = ordonnée de P = ' + fmt(v.y) + '.' }
    ];
    var explanation = v.quadrant + '. P = (cos θ ; sin θ) : la projection sur l\'axe horizontal donne le cosinus (' +
      fmt(v.x) + '), la projection sur l\'axe vertical donne le sinus (' + fmt(v.y) + ').';
    if (!axis) {
      var rel = 'cos θ = ' + (v.x < 0 ? '−' : '') + 'cos ' + refTxt + ' et sin θ = ' + (v.y < 0 ? '−' : '') + 'sin ' + refTxt;
      steps.push({ id: 'reference', title: 'Angle de référence', text: 'Angle de référence ' + refTxt + ' : ' + rel + '.' });
      explanation += ' Angle de référence ' + refTxt + ' : ' + rel + '.';
    }
    var warnings = [];
    if (v.t === null) {
      warnings.push({ code: 'TANGENT_UNDEFINED', message: 'La tangente n\'est pas définie lorsque cos θ = 0.' });
      steps.push({ id: 'tangent', title: 'Tangente', text: 'cos θ = 0 : la tangente n\'est pas définie.' });
      explanation += ' Ici cos θ = 0 : la tangente n\'est pas définie.';
    } else {
      steps.push({ id: 'tangent', title: 'Tangente', text: 'tan θ = sin θ / cos θ = ' + fmt(v.t) + '.' });
      explanation += ' La tangente vaut sin θ / cos θ = ' + fmt(v.t) + '.';
    }
    return {
      solutionId: 'geometric',
      status: 'success',
      title: 'Lecture sur le cercle trigonométrique',
      confidence: e ? 'exact' : 'approx',
      result: {
        angle: e ? e[0] : fmt(v.angle, 3) + '°',
        cos: e ? e[1] : fmt(v.x),
        sin: e ? e[2] : fmt(v.y),
        tan: v.t === null ? null : e ? e[3] : fmt(v.t)
      },
      steps: steps,
      explanation: explanation,
      warnings: warnings
    };
  }
};
