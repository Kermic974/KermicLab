// Méthode tabulaire : lecture des valeurs remarquables, symétrie, signes et périodicité.

import { EXACT } from '../core/exact-values.js';
import { fmt } from '../core/format.js';

export const tabularSolution = {
  id: 'tabular',
  label: 'Méthode tabulaire',
  supportedModes: ['explore', 'learn', 'compare'],
  supports: function (ctx) { return !ctx || !ctx.mode || this.supportedModes.indexOf(ctx.mode) >= 0; },
  solve: function (ctx) {
    var v = ctx.values, angleText = fmt(v.angle, 3) + '°';
    if (!v.exact) {
      var why = angleText + ' n\'est pas un angle remarquable : sa valeur n\'est pas dans la table.';
      return {
        solutionId: 'tabular',
        status: 'unsupported',
        title: 'Méthode tabulaire non applicable',
        result: null,
        steps: [{ id: 'why', title: 'Pourquoi ?', text: why }],
        explanation: why,
        warnings: [{ code: 'NOT_APPLICABLE', message: 'La méthode tabulaire ne s’applique qu’aux angles remarquables.' }]
      };
    }

    var reference = EXACT[v.ref], exact = v.exact, axis = v.n % 90 === 0;
    var steps = [{
      id: 'lookup',
      title: 'Lire la table',
      text: 'À α = ' + fmt(v.ref, 3) + '°, la table donne cos α = ' + reference[1] +
        ', sin α = ' + reference[2] + ' et tan α = ' + reference[3] + '.'
    }];
    if (!axis && v.quadrant !== 'Quadrant I') {
      var symmetry = v.quadrant === 'Quadrant II'
        ? 'Symétrie par rapport à l’axe des ordonnées : θ = 180° − α.'
        : v.quadrant === 'Quadrant III'
          ? 'Symétrie par rapport à l’origine : θ = 180° + α.'
          : 'Symétrie par rapport à l’axe des abscisses : θ = 360° − α.';
      steps.push({ id: 'symmetry', title: 'Appliquer la symétrie', text: symmetry });
    }
    var cosSign = exact[1].charAt(0) === '−' ? '−' : exact[1] === '0' ? '0' : '+';
    var sinSign = exact[2].charAt(0) === '−' ? '−' : exact[2] === '0' ? '0' : '+';
    var tanSign = exact[3] === 'non définie' ? 'non définie' :
      exact[3].charAt(0) === '−' ? '−' : exact[3] === '0' ? '0' : '+';
    steps.push({
      id: 'signs',
      title: 'Lire le tableau des signes',
      text: 'cos θ : ' + cosSign + ' ; sin θ : ' + sinSign + ' ; tan θ : ' + tanSign + '.'
    });
    steps.push({
      id: 'values',
      title: 'Lire les valeurs',
      text: 'cos ' + angleText + ' = ' + exact[1] + ' ; sin ' + angleText + ' = ' + exact[2] +
        ' ; tan ' + angleText + ' = ' + exact[3] + '.'
    });
    steps.push({
      id: 'period',
      title: 'Rappeler la périodicité',
      text: 'Pour tout entier k, θ + 360° k conserve les mêmes valeurs trigonométriques.'
    });
    var warnings = [];
    if (exact[3] === 'non définie') {
      warnings.push({ code: 'TANGENT_UNDEFINED', message: 'La tangente n\'est pas définie lorsque cos θ = 0.' });
    }
    return {
      solutionId: 'tabular',
      status: 'success',
      title: 'Lecture dans la table des angles remarquables',
      confidence: 'exact',
      result: { angle: exact[0], cos: exact[1], sin: exact[2], tan: exact[3] === 'non définie' ? null : exact[3] },
      steps: steps,
      explanation: steps.map(function (s) { return s.text; }).join(' '),
      warnings: warnings
    };
  }
};
