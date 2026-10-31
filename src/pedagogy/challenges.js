// Mode « Jouer » : génération des énoncés, propositions du quiz et barème. Logique pure.
// rng : générateur aléatoire injectable (Math.random par défaut) pour des tests reproductibles.
// used : angles déjà tirés dans la partie, complété à chaque tirage.

import { quadrant, refAngle } from '../core/angle.js';
import { NOTABLE, OFF_AXIS, EXACT } from '../core/exact-values.js';
import { calc } from '../core/engine.js';
import { fmt } from '../core/format.js';

export const ROUND = 8;
export const VALUES = ['0', '1', '−1', '1/2', '−1/2', '√2/2', '−√2/2', '√3/2', '−√3/2'];
export const POOL = { cos: VALUES, sin: VALUES, tan: ['0', '1', '−1', '√3', '−√3', '√3/3', '−√3/3', 'non définie'] };
const COL = { cos: 1, sin: 2, tan: 3 };
const INVERSE = { '√3': '√3/3', '√3/3': '√3', '−√3': '−√3/3', '−√3/3': '−√3' };

export function rnd(n, rng) { return Math.floor((rng || Math.random)() * n); }
export function pick(list, rng) { return list[rnd(list.length, rng)]; }
export function shuffle(list, rng) {
  for (var i = list.length - 1; i > 0; i--) { var j = rnd(i + 1, rng), t = list[i]; list[i] = list[j]; list[j] = t; }
  return list;
}
function opposite(s) {
  if (s === '0' || s === 'non définie') return null;
  return s.charAt(0) === '−' ? s.slice(1) : '−' + s;
}
function freshAngle(list, used, rng) {
  var left = list.filter(function (d) { return used.indexOf(d) < 0; });
  var a = pick(left.length ? left : list, rng);
  used.push(a);
  return a;
}
function angleName(a, rad) { return rad ? EXACT[a][0] : a + '°'; }

// Énoncé « place le point » : chaque condition désigne un seul angle (vérifié par les autotests).
export function placeQuestion(i, used, rng) {
  var a, c, prompt;
  if (i < 3) {
    a = freshAngle(NOTABLE, used, rng);
    prompt = 'θ = ' + EXACT[a][0] + (a === 0 ? '' : ' rad');
  } else if (i < 6) {
    a = freshAngle(OFF_AXIS, used, rng); c = calc(a);
    prompt = (rng || Math.random)() < .5
      ? 'cos θ = ' + EXACT[a][1] + ' et sin θ ' + (c.y > 0 ? '> 0' : '< 0')
      : 'sin θ = ' + EXACT[a][2] + ' et cos θ ' + (c.x > 0 ? '> 0' : '< 0');
  } else {
    a = freshAngle(OFF_AXIS, used, rng); c = calc(a);
    prompt = 'tan θ = ' + EXACT[a][3] + ' et cos θ ' + (c.x > 0 ? '> 0' : '< 0');
  }
  return { target: a, prompt: prompt };
}

// Quatre propositions : la bonne, son opposée, la valeur « échangée », puis du hasard.
export function quizOptions(a, fn, rng) {
  var correct = EXACT[a][COL[fn]], opts = [correct], cand = [];
  var o = opposite(correct);
  if (o) cand.push(o);
  if (fn === 'tan') { if (INVERSE[correct]) cand.push(INVERSE[correct]); }
  else cand.push(EXACT[a][fn === 'cos' ? 2 : 1]);
  cand = cand.concat(shuffle(POOL[fn].slice(), rng));
  cand.forEach(function (v) { if (opts.length < 4 && opts.indexOf(v) < 0) opts.push(v); });
  return { correct: correct, options: shuffle(opts, rng) };
}

export function quizQuestion(i, used, rng) {
  var a = freshAngle(NOTABLE, used, rng), fn = pick(['cos', 'sin', 'tan'], rng), q = quizOptions(a, fn, rng);
  q.target = a;
  q.fn = fn;
  q.label = fn + ' ' + angleName(a, i >= 4);
  q.prompt = q.label + ' = ?';
  return q;
}

// Barème « place le point » selon l'écart en degrés.
export function scorePlacement(err) {
  return { points: err <= 1.5 ? 100 : err <= 5 ? 70 : err <= 10 ? 30 : 0, good: err <= 5 };
}

export function quizExplanation(q) {
  return q.fn === 'tan' && calc(q.target).t === null
    ? 'cos θ = 0, donc la tangente n\'est pas définie.'
    : quadrant(q.target) + ', angle de référence ' + fmt(refAngle(q.target), 1) + '°.';
}

// Seuils en pourcentage entier : .55 * 800 vaut 440.00000000000006 en flottant et privait 440 points de la 2e étoile.
export function starsFor(score, max) {
  var pct = score * 100;
  return pct >= 85 * max ? 3 : pct >= 55 * max ? 2 : pct >= 25 * max ? 1 : 0;
}
