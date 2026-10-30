// Construction des éléments statiques : graduations, repères, boutons d'angles remarquables.

import { $, attrs, NS } from './dom.js';
import { R, polar } from './geometry.js';
import { setAngle } from './state.js';
import { NOTABLE, EXACT } from '../api.js';

export function buildLabels() {
  var g = $('labels'), rad = $('radLabels').checked;
  g.textContent = '';
  NOTABLE.forEach(function (d) {
    var p = polar(d, 303), cx = Math.cos(d * Math.PI / 180), t = document.createElementNS(NS, 'text');
    attrs(t, { 'class': 'lab', x: p.x, y: p.y + 5, 'text-anchor': cx > .2 ? 'start' : cx < -.2 ? 'end' : 'middle' });
    t.textContent = rad ? (d === 0 ? '0 / 2π' : EXACT[d][0]) : (d === 0 ? '0° / 360°' : d + '°');
    g.appendChild(t);
  });
}

export function buildCircle() {
  for (var d = 0; d < 360; d += 15) {
    var major = NOTABLE.indexOf(d) >= 0, p1 = polar(d, R + 3), p2 = polar(d, R + (major ? 18 : 10));
    var l = document.createElementNS(NS, 'line');
    attrs(l, { 'class': 'tick', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    $('ticks').appendChild(l);
  }
  buildLabels();
  NOTABLE.forEach(function (d) {
    var b = document.createElement('button');
    b.type = 'button';
    b.dataset.a = d;
    b.innerHTML = d + '°<small>' + EXACT[d][0] + '</small>';
    b.setAttribute('aria-label', d + ' degrés, ' + EXACT[d][0] + ' radians');
    b.addEventListener('click', function () { setAngle(d, false, true); });
    $('quick').appendChild(b);
  });
}
