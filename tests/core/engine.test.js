// Moteur : angles, moteur de calcul, formatage, état central.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { norm, dist, refAngle, quadrant, parseAngle } from '../../src/core/angle.js';
import { compute, resolveAngle } from '../../src/core/engine.js';
import { fmt, unfmt } from '../../src/core/format.js';
import { createStore } from '../../src/core/store.js';
import { runCoreChecks } from '../../src/selfcheck.js';

test('les autotests du Moteur intégrés à la page passent tous', () => {
  const r = runCoreChecks();
  assert.deepEqual(r.fail, []);
  assert.ok(r.count > 500);
});

test('scénario de référence 60° (SPEC.md)', () => {
  const v = compute(60);
  assert.equal(v.exact[0], 'π/3');
  assert.equal(fmt(v.x), '0,5');
  assert.equal(fmt(v.y), '0,866025');
  assert.equal(fmt(v.t), '1,732051');
  assert.equal('(' + fmt(v.x) + ' ; ' + fmt(v.y) + ')', '(0,5 ; 0,866025)');
});

test('normalisation sans bruit flottant', () => {
  assert.equal(norm(12.3), 12.3);
  assert.equal(norm(-30), 330);
  assert.equal(norm(390), 30);
  assert.equal(norm(-360), 0);
  assert.ok(Object.is(norm(-0), 0));
  assert.equal(dist(350, 10), 20);
});

test('saisies de référence (ARCHITECTURE.md § Tests comparatifs)', () => {
  const cases = { '0': 0, '30': 30, '360': 360, '-30': 330, '390': 30, 'π/3': 60, '2π/3': 120, '2pi/3': 120, '22,5': 22.5, '−45°': 315 };
  for (const [input, expected] of Object.entries(cases)) assert.equal(resolveAngle(input, true), expected, input);
  assert.equal(resolveAngle('360', false), 0);
  for (const bad of ['', 'abc', 'π/0', '1,2,3', '--5']) assert.equal(resolveAngle(bad, true), null, bad);
  assert.ok(Number.isNaN(parseAngle('')));
});

test('quadrants, axes et angle de référence', () => {
  assert.equal(quadrant(150), 'Quadrant II');
  assert.equal(quadrant(270), 'Axe des ordonnées (−y)');
  assert.deepEqual([45, 120, 210, 300, 360].map(refAngle), [45, 60, 30, 60, 0]);
  assert.equal(compute(90).t, null);
  assert.equal(compute(270).t, null);
});

test('formatage français et lecture inverse', () => {
  assert.equal(fmt(-0.5), '−0,5');
  assert.equal(fmt(null), 'non définie');
  assert.equal(fmt(1e-12), '0');
  assert.equal(unfmt('−0,866025'), -0.866025);
  assert.ok(Number.isNaN(unfmt('√3/2')));
});

test('état central : une seule source, notifications et clés contrôlées', () => {
  const store = createStore({ angle: 45, snap: true, mode: 'explore', locked: false });
  const seen = [];
  store.subscribe((s, meta) => seen.push([s.angle, !!meta.announce]));
  assert.equal(store.setAngle('2π/3', { announce: true }), true);
  assert.equal(store.setAngle('', {}), false);
  assert.equal(store.setAngle(720, { keep360: true }), true);
  assert.deepEqual(seen, [[120, true], [360, false]]);
  assert.throws(() => { store.get().angle = 1; }, TypeError);
  assert.throws(() => store.patch({ inconnu: 1 }), /Clé d'état inconnue/);
  store.patch({ mode: 'learn' });
  assert.equal(seen.length, 2, 'patch ne déclenche pas de rendu');
  assert.equal(store.get().mode, 'learn');
});
