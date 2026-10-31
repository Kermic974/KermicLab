// Affichage des nombres à la française : virgule décimale, signe moins typographique.

import { clean } from './angle.js';

export function fmt(v, digits) {
  if (v === null) return 'non définie';
  var s = clean(v).toFixed(digits === undefined ? 6 : digits);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s.replace('.', ',').replace('-', '−');
}

// Inverse de fmt pour une valeur approchée ('−0,5' → −0.5) ; NaN si illisible.
export function unfmt(s) {
  var t = String(s).replace(',', '.').replace('−', '-');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}
