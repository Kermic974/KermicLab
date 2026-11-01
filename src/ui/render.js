// Rendu synchronisé : abonné à l'état, il met à jour le cercle, les valeurs et les contrôles.

import { $, attrs } from './dom.js';
import { C, R, polar, arcPath } from './geometry.js';
import { compute, fmt, sign, dist, solutionContext } from '../api.js';
import { methodsOf, resolveMethod, buildMethodRadios, renderMethod } from './method.js';

export const HINT = 'Degrés (45 ; 22,5 ; −30) ou multiple de π (π/4 ; 2pi/3).';

export function render(s, meta) {
  var a = s.angle, c = compute(a), p = polar(c.n), e = c.exact;

  attrs($('point'), { cx: p.x, cy: p.y });
  attrs($('halo'), { cx: p.x, cy: p.y });
  attrs($('ray'), { x2: p.x, y2: p.y });
  attrs($('px'), { x1: p.x, y1: p.y, x2: p.x, y2: C });
  attrs($('py'), { x1: p.x, y1: p.y, x2: C, y2: p.y });
  attrs($('segx'), { x2: p.x });
  attrs($('segy'), { y2: p.y });
  $('arc').setAttribute('d', arcPath(a, 88, false));
  $('sector').setAttribute('d', arcPath(a, 88, true));

  if (c.t === null) {
    $('tanRay').setAttribute('visibility', 'hidden');
    $('tanPt').setAttribute('visibility', 'hidden');
  } else {
    var ty = C - R * c.t;
    $('tanRay').setAttribute('visibility', 'visible');
    $('tanPt').setAttribute('visibility', 'visible');
    attrs($('tanRay'), { x2: C + R, y2: ty });
    attrs($('tanPt'), { cx: C + R, cy: ty });
  }

  var tp = polar(a === 360 ? 30 : Math.max(18, a / 2), 120);
  attrs($('angleText'), { x: tp.x, y: tp.y + 7 });
  $('angleText').textContent = fmt(a, 1) + '°';

  $('deg').textContent = fmt(a, 3) + '°';
  $('quad').textContent = c.quadrant;
  $('rad').textContent = fmt(a * Math.PI / 180);
  $('radx').textContent = e ? e[0] : '≈ ' + fmt(a / 180, 4).replace(/^1$/, '') + 'π';
  $('cos').textContent = fmt(c.x);
  $('cosx').textContent = e ? 'exact : ' + e[1] : 'valeur approchée';
  $('sin').textContent = fmt(c.y);
  $('sinx').textContent = e ? 'exact : ' + e[2] : 'valeur approchée';
  $('tan').textContent = fmt(c.t);
  $('tanx').textContent = e ? (c.t === null ? 'cos θ = 0' : 'exact : ' + e[3]) : (c.t === null ? 'cos θ = 0' : 'valeur approchée');
  $('coords').textContent = '(' + fmt(c.x) + ' ; ' + fmt(c.y) + ')';
  $('coordsx').textContent = e ? 'exact : (' + e[1] + ' ; ' + e[2] + ')' : 'coordonnées approchées';
  $('signs').textContent = 'cos ' + sign(c.x) + ' · sin ' + sign(c.y) + ' · tan ' + sign(c.t);
  $('ref').textContent = 'Angle de référence : ' + fmt(c.ref, 1) + '°';
  var methods = methodsOf(s.mode), method = resolveMethod(methods, s.method);
  buildMethodRadios(methods, method);
  renderMethod(method ? method.solve(solutionContext(c)) : null);

  $('range').value = a;
  if (document.activeElement !== $('input')) $('input').value = fmt(a, 3);
  $('input').removeAttribute('aria-invalid');
  $('hint').classList.remove('err');
  $('hint').textContent = HINT;

  var svg = $('svg');
  svg.setAttribute('aria-valuenow', a);
  svg.setAttribute('aria-valuetext', fmt(a, 1) + ' degrés, cosinus ' + fmt(c.x, 3) + ', sinus ' + fmt(c.y, 3));

  Array.prototype.forEach.call($('quick').children, function (b) {
    b.classList.toggle('on', dist(c.n, Number(b.dataset.a)) < 1e-7);
    b.setAttribute('aria-pressed', b.classList.contains('on'));
  });

  if (meta.announce && s.mode !== 'play') {
    $('live').textContent = 'Angle ' + fmt(a, 1) + ' degrés, cosinus ' + fmt(c.x, 4) + ', sinus ' + fmt(c.y, 4) +
      ', tangente ' + fmt(c.t, 4) + '.';
  }
}
