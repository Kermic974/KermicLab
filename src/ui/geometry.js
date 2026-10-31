// Géométrie de la vue : passage angle ↔ coordonnées SVG (viewBox 760 × 760).

import { $ } from './dom.js';
import { NOTABLE, norm, dist } from '../api.js';

export const C = 380;          // centre du cercle (unités SVG)
export const R = 260;          // rayon du cercle
export const SNAP = 3;         // tolérance d'aimantation en degrés
export const DEAD_ZONE = 24;   // rayon central ignoré (angle indéfini)

export function polar(a, r) {
  var q = a * Math.PI / 180, rr = r === undefined ? R : r;
  return { x: C + rr * Math.cos(q), y: C - rr * Math.sin(q) };
}

export function arcPath(a, r, close) {
  var start = (close ? 'M ' + C + ' ' + C + ' L ' : 'M ') + (C + r) + ' ' + C;
  if (a <= 0) return '';
  if (a >= 359.999) {
    return start + ' A ' + r + ' ' + r + ' 0 1 0 ' + (C - r) + ' ' + C +
      ' A ' + r + ' ' + r + ' 0 1 0 ' + (C + r) + ' ' + C + (close ? ' Z' : '');
  }
  var p = polar(a, r);
  return start + ' A ' + r + ' ' + r + ' 0 ' + (a > 180 ? 1 : 0) + ' 0 ' + p.x + ' ' + p.y + (close ? ' Z' : '');
}

export function svgPoint(ev) {
  var r = $('svg').getBoundingClientRect();
  return { x: (ev.clientX - r.left) * 760 / r.width, y: (ev.clientY - r.top) * 760 / r.height };
}

export function angleAt(pt, snap) {
  var a = norm(Math.atan2(C - pt.y, pt.x - C) * 180 / Math.PI);
  if (snap) {
    var best = a, bd = Infinity;
    NOTABLE.forEach(function (v) { var z = dist(a, v); if (z < bd) { bd = z; best = v; } });
    if (bd <= SNAP) a = best;
  }
  return a;
}

export function nearCenter(pt) { return Math.hypot(pt.x - C, pt.y - C) < DEAD_ZONE; }
