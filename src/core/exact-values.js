// Angles remarquables et valeurs exactes : [radians, cos, sin, tan].

import { norm } from './angle.js';

export const NOTABLE = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
export const OFF_AXIS = NOTABLE.filter(function (d) { return d % 90 !== 0; });

export const EXACT = {
  0: ['0', '1', '0', '0'],
  30: ['π/6', '√3/2', '1/2', '√3/3'],
  45: ['π/4', '√2/2', '√2/2', '1'],
  60: ['π/3', '1/2', '√3/2', '√3'],
  90: ['π/2', '0', '1', 'non définie'],
  120: ['2π/3', '−1/2', '√3/2', '−√3'],
  135: ['3π/4', '−√2/2', '√2/2', '−1'],
  150: ['5π/6', '−√3/2', '1/2', '−√3/3'],
  180: ['π', '−1', '0', '0'],
  210: ['7π/6', '−√3/2', '−1/2', '√3/3'],
  225: ['5π/4', '−√2/2', '−√2/2', '1'],
  240: ['4π/3', '−1/2', '−√3/2', '√3'],
  270: ['3π/2', '0', '−1', 'non définie'],
  300: ['5π/3', '1/2', '−√3/2', '−√3'],
  315: ['7π/4', '√2/2', '−√2/2', '−1'],
  330: ['11π/6', '√3/2', '−1/2', '−√3/3'],
  360: ['2π', '1', '0', '0']
};

export function exact(a) { return a === 360 ? EXACT[360] : (EXACT[norm(a)] || null); }

// Valeur numérique d'une forme exacte ('−√3/2' → −0,866…) ; null si non définie, undefined si inconnue.
export function exactNum(s) {
  if (s === 'non définie') return null;
  var neg = s.charAt(0) === '−', k = neg ? s.slice(1) : s;
  var v = { '0': 0, '1': 1, '1/2': .5, '√2/2': Math.SQRT2 / 2, '√3/2': Math.sqrt(3) / 2, '√3': Math.sqrt(3), '√3/3': Math.sqrt(3) / 3 }[k];
  if (v === undefined) return undefined;
  return neg ? -v : v;
}
