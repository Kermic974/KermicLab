// Méthode algébrique : conversion en radians, réduction au premier quadrant, formules de réduction.
// Les valeurs viennent uniquement du contexte (moteur) : aucun calcul trigonométrique ici.

import { fmt } from '../core/format.js';

var REDUCTION = {
  'Quadrant I': { arg: 'α', write: 'θ = α', cos: 'cos α', sin: 'sin α', neg: [false, false] },
  'Quadrant II': { arg: '180° − α', write: 'θ = 180° − α', cos: '−cos α', sin: 'sin α', neg: [true, false] },
  'Quadrant III': { arg: '180° + α', write: 'θ = 180° + α', cos: '−cos α', sin: '−sin α', neg: [true, true] },
  'Quadrant IV': { arg: '360° − α', write: 'θ = 360° − α', cos: 'cos α', sin: '−sin α', neg: [false, true] }
};

export const algebraicSolution = {
  id: 'algebraic',
  label: 'Méthode algébrique',
  supportedModes: ['explore', 'learn', 'compare'],
  supports: function (ctx) { return !ctx || !ctx.mode || this.supportedModes.indexOf(ctx.mode) >= 0; },
  solve: function (ctx) {
    var v = ctx.values, e = v.exact, axis = v.n % 90 === 0;
    var ang = fmt(v.angle, 3) + '°', alpha = fmt(v.ref, 3) + '°';
    var steps = [];
    steps.push({
      id: 'convert', title: 'Conversion en radians',
      text: e ? 'θ = ' + ang + ' = ' + fmt(v.angle, 3) + ' × π / 180 = ' + e[0] + ' rad.'
        : 'θ = ' + ang + ' ≈ ' + fmt(v.angle * Math.PI / 180) + ' rad.'
    });
    var red = REDUCTION[v.quadrant];
    if (axis) {
      steps.push({ id: 'reduce', title: 'Réduction au premier quadrant', text: 'θ est sur l\'' + v.quadrant.toLowerCase() + ' : lecture directe.' });
    } else {
      steps.push({
        id: 'reduce', title: 'Réduction au premier quadrant',
        text: 'θ est dans le quadrant ' + v.quadrant.slice(9) + ' : ' + red.write.replace('α', alpha) + ', avec α = ' + alpha + '.'
      });
      steps.push({
        id: 'formulas', title: 'Formules de réduction',
        text: red.arg === 'α' ? 'cos θ = cos α et sin θ = sin α.'
          : 'cos(' + red.arg + ') = ' + red.cos + ' et sin(' + red.arg + ') = ' + red.sin + '.'
      });
    }
    var valuesText;
    if (e) {
      if (axis) {
        valuesText = 'cos ' + ang + ' = ' + e[1] + ' ; sin ' + ang + ' = ' + e[2] + '.';
      } else {
        valuesText = 'cos ' + ang + ' = ' + (red.neg[0] ? '−' : '') + 'cos ' + alpha + ' = ' + e[1] +
          ' ; sin ' + ang + ' = ' + (red.neg[1] ? '−' : '') + 'sin ' + alpha + ' = ' + e[2] + '.';
      }
    } else {
      valuesText = 'cos ' + ang + ' ≈ ' + fmt(v.x) + ' ; sin ' + ang + ' ≈ ' + fmt(v.y) + '.';
    }
    steps.push({ id: 'values', title: 'Valeurs', text: valuesText });
    var warnings = [], tanText;
    if (v.t === null) {
      warnings.push({ code: 'TANGENT_UNDEFINED', message: 'La tangente n\'est pas définie lorsque cos θ = 0.' });
      tanText = 'cos θ = 0 : la tangente n\'est pas définie.';
    } else if (e) {
      tanText = 'tan ' + ang + ' = sin θ / cos θ = (' + e[2] + ') / (' + e[1] + ') = ' + e[3] + '.';
    } else {
      tanText = 'tan ' + ang + ' = sin θ / cos θ ≈ ' + fmt(v.t) + '.';
    }
    steps.push({ id: 'tangent', title: 'Tangente', text: tanText });
    return {
      solutionId: 'algebraic',
      status: 'success',
      title: 'Calcul par réduction au premier quadrant',
      confidence: e ? 'exact' : 'approx',
      result: {
        angle: e ? e[0] : ang,
        cos: e ? e[1] : fmt(v.x),
        sin: e ? e[2] : fmt(v.y),
        tan: v.t === null ? null : e ? e[3] : fmt(v.t)
      },
      steps: steps,
      explanation: steps.map(function (s) { return s.text; }).join(' '),
      warnings: warnings
    };
  }
};
