// Angles : normalisation, lecture de saisie, repérage sur le cercle. Aucun accès au DOM.

export const EPS = 1e-10;

// Sans « + 360 » systématique, qui ajoutait du bruit flottant (12.3 → 12.300000000000011).
export function norm(v) { var r = v % 360; return r < 0 ? r + 360 : r + 0; }

export function clean(v) {
  if (Math.abs(v) < EPS) return 0;
  if (Math.abs(v - 1) < EPS) return 1;
  if (Math.abs(v + 1) < EPS) return -1;
  return v;
}

// Arrondit les erreurs flottantes (ex. 59.99999999 → 60).
export function tidy(v) {
  var r = Math.round(v * 1e6) / 1e6;
  return Math.abs(v - r) < 1e-9 ? r : v;
}

export function dist(a, b) {
  var d = Math.abs(norm(a) - norm(b));
  return Math.min(d, 360 - d);
}

export function quadrant(a) {
  var n = norm(a);
  if (n === 0) return 'Axe des abscisses (+x)';
  if (n === 90) return 'Axe des ordonnées (+y)';
  if (n === 180) return 'Axe des abscisses (−x)';
  if (n === 270) return 'Axe des ordonnées (−y)';
  return 'Quadrant ' + (n < 90 ? 'I' : n < 180 ? 'II' : n < 270 ? 'III' : 'IV');
}

// Angle aigu entre le rayon et l'axe des abscisses.
export function refAngle(a) {
  var n = norm(a);
  if (n <= 90) return n;
  if (n <= 180) return 180 - n;
  if (n <= 270) return n - 180;
  return 360 - n;
}

// Lit "45", "22,5", "-30°", "π/4", "2pi/3", "-π"… et renvoie des degrés (NaN si invalide).
export function parseAngle(raw) {
  var s = String(raw).trim().replace(/\s+/g, '').replace(/,/g, '.')
    .replace(/[−–]/g, '-').replace(/pi/gi, 'π').replace(/°$/, '');
  if (!s) return NaN;
  if (s.indexOf('π') >= 0) {
    var m = /^([+-]?)(\d*\.?\d*)\*?π(?:\/(\d*\.?\d+))?$/.exec(s);
    if (!m) return NaN;
    var k = m[2] === '' ? 1 : Number(m[2]);
    var den = m[3] ? Number(m[3]) : 1;
    if (!Number.isFinite(k) || !Number.isFinite(den) || den === 0) return NaN;
    return tidy((m[1] === '-' ? -1 : 1) * k * 180 / den);
  }
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

export function sign(v) { return v === null ? '∅' : v < 0 ? '−' : v > 0 ? '+' : '0'; }
