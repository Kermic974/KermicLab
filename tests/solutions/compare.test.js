// Concordance des méthodes avec le moteur (S-08).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solutions } from '../../src/solutions/catalog.js';
import { solutionContext } from '../../src/solutions/registry.js';
import { compute, resolveAngle } from '../../src/core/engine.js';
import { compareResults, resultNumber } from '../../src/api.js';
import { REFERENCE_INPUTS } from '../../src/selfcheck.js';

test('resultNumber : formes exacte, approchée et non définie', () => {
  assert.equal(resultNumber('1/2'), .5);
  assert.equal(resultNumber('−√2/2'), -Math.SQRT2 / 2);
  assert.equal(resultNumber('0,87'), .87);
  assert.equal(resultNumber('non définie'), null);
});

test('les méthodes enregistrées concordent avec le moteur', () => {
  for (const input of REFERENCE_INPUTS) {
    const v = compute(resolveAngle(input, true));
    const results = solutions.list().map(s => s.solve(solutionContext(v)));
    const cmp = compareResults(results, v);
    assert.equal(cmp.agree, true, input + ' ' + JSON.stringify(cmp.mismatches));
    assert.equal(cmp.checked + cmp.skipped.length, results.length);
  }
});

test('une divergence injectée est détectée avec le bon champ', () => {
  const v = compute(60);
  const res = solutions.get('geometric').solve(solutionContext(v));
  const faux = { ...res, result: { ...res.result, sin: '1/2' } };
  const cmp = compareResults([faux], v);
  assert.equal(cmp.agree, false);
  assert.equal(cmp.mismatches.length, 1);
  assert.equal(cmp.mismatches[0].solutionId, 'geometric');
  assert.equal(cmp.mismatches[0].field, 'sin');
  assert.equal(cmp.mismatches[0].got, .5);
  assert.ok(Math.abs(cmp.mismatches[0].expected - Math.sqrt(3) / 2) < 1e-12);
});

test('tan définie contre non définie est une divergence', () => {
  const v = compute(90);
  const res = solutions.get('geometric').solve(solutionContext(v));
  const faux = { ...res, result: { ...res.result, tan: '1' } };
  const m = compareResults([faux], v).mismatches;
  assert.deepEqual(m.map(x => [x.field, x.expected, x.got]), [['tan', null, 1]]);
});

test('un résultat unsupported va dans skipped', () => {
  const v = compute(60);
  const ok = solutions.get('geometric').solve(solutionContext(v));
  const cmp = compareResults([ok, { solutionId: 'tabulaire', status: 'unsupported' }], v);
  assert.deepEqual(cmp.skipped, ['tabulaire']);
  assert.equal(cmp.checked, 1);
  assert.equal(cmp.agree, true);
});
