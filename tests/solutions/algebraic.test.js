// Méthode algébrique (S-04) et filtrage par mode (S-07).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solutions } from '../../src/solutions/catalog.js';
import { solutionContext } from '../../src/solutions/registry.js';
import { compute, resolveAngle } from '../../src/core/engine.js';
import { refAngle } from '../../src/core/angle.js';
import { REFERENCE_INPUTS } from '../../src/selfcheck.js';

const algebraic = solutions.get('algebraic');
const geometric = solutions.get('geometric');
const solve = (a) => algebraic.solve(solutionContext(compute(a)));

test('algébrique : étapes dans l\'ordre à 150°', () => {
  const res = solve(150);
  assert.deepEqual(res.steps.map(s => s.id), ['convert', 'reduce', 'formulas', 'values', 'tangent']);
  assert.equal(res.confidence, 'exact');
  assert.match(res.steps[0].text, /5π\/6 rad/);
  assert.match(res.steps[1].text, /180° − 30°.*α = 30°/);
  assert.match(res.steps[3].text, /−√3\/2.*1\/2/);
  assert.match(res.steps[4].text, /−√3\/3/);
});

test('algébrique : lecture directe sur un axe, sans étape formulas', () => {
  const res = solve(90);
  assert.deepEqual(res.steps.map(s => s.id), ['convert', 'reduce', 'values', 'tangent']);
  assert.match(res.steps[1].text, /lecture directe/);
  assert.equal(res.result.tan, null);
  assert.deepEqual(res.warnings.map(w => w.code), ['TANGENT_UNDEFINED']);
});

test('algébrique : angle non remarquable en valeur approchée, sans √ ni π', () => {
  const res = solve(37);
  assert.equal(res.confidence, 'approx');
  assert.match(res.steps[0].text, /≈ 0,645772 rad/);
  const values = res.steps.find(s => s.id === 'values').text;
  assert.ok(!/[√π]/.test(values), values);
});

test('algébrique : même résultat que la méthode géométrique sur les saisies de référence', () => {
  for (const input of REFERENCE_INPUTS) {
    const ctx = solutionContext(compute(resolveAngle(input, true)));
    assert.deepEqual(algebraic.solve(ctx).result, geometric.solve(ctx).result, input);
  }
});

test('modes : list({ mode }) ne renvoie que les méthodes qui le prennent en charge', () => {
  assert.deepEqual(solutions.list({ mode: 'play' }).map(s => s.id), []);
  for (const mode of ['explore', 'learn', 'compare']) {
    assert.deepEqual(solutions.list({ mode }).map(s => s.id), ['geometric', 'algebraic', 'tabular'], mode);
  }
  assert.equal(solutions.list().length, 3);
});

test('formules de réduction vérifiées numériquement de 0° à 359°', () => {
  for (let n = 0; n < 360; n++) {
    const v = compute(n), a = compute(refAngle(n));
    const [sc, ss] = n <= 90 ? [1, 1] : n <= 180 ? [-1, 1] : n <= 270 ? [-1, -1] : [1, -1];
    assert.ok(Math.abs(v.x - sc * a.x) < 1e-9, n + ' cos');
    assert.ok(Math.abs(v.y - ss * a.y) < 1e-9, n + ' sin');
  }
});
