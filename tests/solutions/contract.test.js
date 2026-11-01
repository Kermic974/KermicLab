// Contrat commun : chaque méthode enregistrée passe la même suite (ARCHITECTURE.md § Contrat de solution).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solutions } from '../../src/solutions/catalog.js';
import { createRegistry, solutionContext, checkSolutionResult } from '../../src/solutions/registry.js';
import { compute, resolveAngle } from '../../src/core/engine.js';
import { REFERENCE_INPUTS } from '../../src/selfcheck.js';
import { resultNumber } from '../../src/solutions/compare.js';

for (const s of solutions.list()) {
  test(`${s.id} : contrat respecté sur toutes les saisies de référence`, () => {
    for (const input of REFERENCE_INPUTS) {
      const res = s.solve(solutionContext(compute(resolveAngle(input, true))));
      assert.deepEqual(checkSolutionResult(res, s.id), [], input);
    }
  });

  test(`${s.id} : résultat identique au moteur commun`, () => {
    for (const input of REFERENCE_INPUTS) {
      const v = compute(resolveAngle(input, true));
      const r = s.solve(solutionContext(v)).result;
      assert.ok(Math.abs(resultNumber(r.cos) - v.x) < 1e-6, input + ' cos');
      assert.ok(Math.abs(resultNumber(r.sin) - v.y) < 1e-6, input + ' sin');
      if (v.t === null) assert.equal(r.tan, null, input + ' tan');
      else assert.ok(Math.abs(resultNumber(r.tan) - v.t) < 1e-6, input + ' tan');
    }
  });

  test(`${s.id} : ne modifie jamais son contexte`, () => {
    const ctx = solutionContext(compute(150));
    const before = JSON.stringify(ctx);
    s.solve(ctx);
    assert.equal(JSON.stringify(ctx), before);
    assert.ok(Object.isFrozen(ctx.values));
  });
}

test('géométrique : tangente non définie signalée, pas de statut spécial', () => {
  const res = solutions.get('geometric').solve(solutionContext(compute(90)));
  assert.equal(res.status, 'success');
  assert.equal(res.result.tan, null);
  assert.deepEqual(res.warnings.map(w => w.code), ['TANGENT_UNDEFINED']);
});

test('géométrique : angle non remarquable en valeur approchée', () => {
  const res = solutions.get('geometric').solve(solutionContext(compute(37)));
  assert.equal(res.confidence, 'approx');
  assert.equal(res.result.cos, '0,798636');
});

test('registre : refuse une solution incomplète ou en double', () => {
  const reg = createRegistry();
  assert.throws(() => reg.register({ id: 'x' }), /Solution invalide/);
  const ok = { id: 'x', label: 'X', supports: () => true, solve: () => null };
  reg.register(ok);
  assert.throws(() => reg.register(ok), /déjà enregistrée/);
  assert.equal(reg.list({}).length, 1);
});

test('contrat : une solution qui tente de modifier le contexte échoue', () => {
  const ctx = solutionContext(compute(30));
  assert.throws(() => { 'use strict'; ctx.values.x = 2; }, TypeError);
});
