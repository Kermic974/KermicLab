// Méthode tabulaire : lecture des valeurs remarquables, symétries et cas non applicables (S-05, S-06).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solutions } from '../../src/solutions/catalog.js';
import { solutionContext } from '../../src/solutions/registry.js';
import { compute, resolveAngle } from '../../src/core/engine.js';
import { NOTABLE } from '../../src/core/exact-values.js';
import { REFERENCE_INPUTS } from '../../src/selfcheck.js';

const tabular = solutions.get('tabular');
const algebraic = solutions.get('algebraic');
const solve = (angle) => tabular.solve(solutionContext(compute(angle)));

test('tabulaire : unsupported exactement pour les saisies non remarquables de référence', () => {
  const unsupportedInputs = REFERENCE_INPUTS.filter(input => !compute(resolveAngle(input, true)).exact);
  assert.deepEqual(unsupportedInputs, ['22,5', '137,5']);
  for (const input of REFERENCE_INPUTS) {
    const res = tabular.solve(solutionContext(compute(resolveAngle(input, true))));
    assert.equal(res.status, compute(resolveAngle(input, true)).exact ? 'success' : 'unsupported', input);
  }
  const res = solve(37);
  assert.equal(res.status, 'unsupported');
  assert.equal(res.result, null);
  assert.equal(res.steps[0].id, 'why');
  assert.equal(res.steps[0].text, '37° n\'est pas un angle remarquable : sa valeur n\'est pas dans la table.');
  assert.deepEqual(res.warnings.map(warning => warning.code), ['NOT_APPLICABLE']);
});

test('tabulaire : symétries des quadrants II, III et IV', () => {
  const expected = {
    150: 'Symétrie par rapport à l’axe des ordonnées',
    210: 'Symétrie par rapport à l’origine',
    330: 'Symétrie par rapport à l’axe des abscisses'
  };
  for (const [angle, text] of Object.entries(expected)) {
    const res = solve(Number(angle));
    const symmetry = res.steps.find(step => step.id === 'symmetry');
    assert.ok(symmetry, angle + ' symmetry');
    assert.ok(symmetry.text.includes(text), angle + ' symmetry');
  }
  assert.equal(solve(30).steps.some(step => step.id === 'symmetry'), false);
  assert.equal(solve(90).steps.some(step => step.id === 'symmetry'), false);
});

test('tabulaire : même résultat algébrique sur les 16 angles remarquables', () => {
  for (const angle of NOTABLE) {
    const ctx = solutionContext(compute(angle));
    assert.deepEqual(tabular.solve(ctx).result, algebraic.solve(ctx).result, angle);
  }
});
