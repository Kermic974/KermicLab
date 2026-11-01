// Autotests du Moteur : exécutés par `node --test` et par le diagnostic de la page.
// Renvoie { count, fail } ; chaque échec est une ligne lisible.

import { norm, dist, refAngle, parseAngle } from './core/angle.js';
import { NOTABLE, OFF_AXIS, EXACT, exactNum } from './core/exact-values.js';
import { fmt, unfmt } from './core/format.js';
import { calc, compute, resolveAngle } from './core/engine.js';
import { LESSONS } from './pedagogy/lessons.js';
import { quizOptions } from './pedagogy/challenges.js';
import { solutions } from './solutions/catalog.js';
import { solutionContext, checkSolutionResult } from './solutions/registry.js';

// Angles de référence partagés par toutes les méthodes (ARCHITECTURE.md § Tests comparatifs).
export const REFERENCE_INPUTS = ['0', '30', '45', '60', '90', '120', '135', '150', '180', '270', '360', '-30', '390', 'π/3', '2π/3', '22,5', '137,5'];

// Valeur numérique d'une chaîne de résultat (forme exacte ou approchée).
export function resultNumber(s) {
  var e = exactNum(s);
  return e === undefined ? unfmt(s) : e;
}

export function runCoreChecks() {
  var fail = [], count = 0;
  function ok(name, v) { count++; if (!v) fail.push(name); }
  function near(a, b, tol) { return Math.abs(a - b) < (tol || 1e-9); }

  for (var d = 0; d < 360; d++) {
    var c = calc(d);
    ok('cos²+sin² ' + d, near(c.x * c.x + c.y * c.y, 1));
  }
  var c60 = calc(60);
  ok('60 cos', near(c60.x, .5));
  ok('60 sin', near(c60.y, Math.sqrt(3) / 2));
  ok('60 tan', near(c60.t, Math.sqrt(3)));
  ok('90 tan', calc(90).t === null);
  ok('270 tan', calc(270).t === null);
  ok('ref 120', refAngle(120) === 60);
  ok('ref 210', refAngle(210) === 30);
  ok('ref 300', refAngle(300) === 60);
  ok('norm sans bruit', norm(12.3) === 12.3 && norm(-30) === 330 && norm(390) === 30);
  ok('parse 45', parseAngle('45') === 45);
  ok('parse 22,5', parseAngle('22,5') === 22.5);
  ok('parse −30°', parseAngle('−30°') === -30);
  ok('parse π/3', parseAngle('π/3') === 60);
  ok('parse 2pi/3', parseAngle('2pi/3') === 120);
  ok('parse -π', parseAngle('-π') === -180);
  ok('parse vide', isNaN(parseAngle('')));
  ok('parse abc', isNaN(parseAngle('abc')));
  ok('parse π/0', isNaN(parseAngle('π/0')));
  ok('fmt négatif', fmt(-0.5) === '−0,5');

  // Table exacte cohérente avec les calculs.
  NOTABLE.forEach(function (d) {
    var c = calc(d), e = EXACT[d], t = exactNum(e[3]);
    ok('table cos ' + d, near(exactNum(e[1]), c.x));
    ok('table sin ' + d, near(exactNum(e[2]), c.y));
    ok('table tan ' + d, t === null ? c.t === null : near(t, c.t));
    ok('table rad ' + d, near(parseAngle(e[0]), d));
  });
  // Énoncés « place le point » : une seule solution entre 0° et 359°.
  function unique(a, pred) {
    var hits = [];
    for (var k = 0; k < 360; k++) if (pred(calc(k))) hits.push(k);
    return hits.length === 1 && hits[0] === a;
  }
  OFF_AXIS.forEach(function (a) {
    var c = calc(a), e = EXACT[a];
    ok('énoncé cos ' + a, unique(a, function (k) { return near(k.x, exactNum(e[1])) && k.y * c.y > 0; }));
    ok('énoncé sin ' + a, unique(a, function (k) { return near(k.y, exactNum(e[2])) && k.x * c.x > 0; }));
    ok('énoncé tan ' + a, unique(a, function (k) { return k.t !== null && near(k.t, exactNum(e[3])) && k.x * c.x > 0; }));
  });
  // Quiz : 4 propositions distinctes dont la bonne.
  NOTABLE.forEach(function (a) {
    ['cos', 'sin', 'tan'].forEach(function (fn) {
      var q = quizOptions(a, fn), set = {};
      q.options.forEach(function (v) { set[v] = 1; });
      ok('quiz ' + fn + ' ' + a, q.options.length === 4 && Object.keys(set).length === 4 && q.options.indexOf(q.correct) >= 0);
    });
  });
  // Leçons : la consigne n'est pas déjà remplie au départ et reste réalisable.
  LESSONS.forEach(function (L, i) {
    var solvable = false;
    for (var k = 0; k < 360 && !solvable; k++) solvable = L.check(calc(k));
    ok('leçon ' + (i + 1), !L.check(calc(L.start)) && solvable);
  });
  // Contrat et cohérence de chaque méthode enregistrée avec le moteur.
  solutions.list().forEach(function (s) {
    REFERENCE_INPUTS.forEach(function (input) {
      var v = compute(resolveAngle(input, true));
      var res;
      try { res = s.solve(solutionContext(v)); } catch (err) { ok(s.id + ' ' + input + ' : ' + err.message, false); return; }
      var problems = checkSolutionResult(res, s.id);
      ok(s.id + ' contrat ' + input + (problems.length ? ' (' + problems.join(', ') + ')' : ''), !problems.length);
      if (problems.length) return;
      if (res.status === 'success') {
        var tol = res.confidence === 'exact' ? 1e-9 : 1e-6;
        ok(s.id + ' cos ' + input, near(resultNumber(res.result.cos), v.x, tol));
        ok(s.id + ' sin ' + input, near(resultNumber(res.result.sin), v.y, tol));
        ok(s.id + ' tan ' + input, res.result.tan === null ? v.t === null : near(resultNumber(res.result.tan), v.t, tol));
      }
    });
  });
  // Cas de référence 60° (SPEC.md).
  var r60 = solutions.get('geometric').solve(solutionContext(compute(60))).result;
  ok('référence 60°', r60.angle === 'π/3' && r60.cos === '1/2' && r60.sin === '√3/2' && r60.tan === '√3');
  ok('distance circulaire', dist(350, 10) === 20);

  return { count: count, fail: fail };
}
