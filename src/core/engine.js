// Moteur mathématique partagé : seule source des valeurs trigonométriques.

import { EPS, norm, clean, tidy, quadrant, refAngle, parseAngle } from './angle.js';
import { exact } from './exact-values.js';

export function calc(a) {
  var n = norm(a), r = n * Math.PI / 180;
  var x = clean(Math.cos(r)), y = clean(Math.sin(r));
  return { n: n, r: r, x: x, y: y, t: Math.abs(x) < EPS ? null : clean(y / x) };
}

// Tout ce qu'une vue ou une solution peut afficher pour un angle donné.
export function compute(a) {
  var c = calc(a);
  return {
    angle: a, n: c.n, r: c.r, x: c.x, y: c.y, t: c.t,
    exact: exact(a), quadrant: quadrant(a), ref: refAngle(a)
  };
}

// Transforme une saisie (nombre ou texte) en angle d'état dans [0 ; 360], ou null si invalide.
// keep360 : conserver 360 au lieu de 0 quand l'utilisateur le demande explicitement.
export function resolveAngle(raw, keep360) {
  var num = typeof raw === 'number' ? raw : parseAngle(raw);
  if (!Number.isFinite(num)) return null;
  num = tidy(num);
  var a = norm(num);
  if (keep360 && num !== 0 && a === 0) a = 360;
  return a;
}
