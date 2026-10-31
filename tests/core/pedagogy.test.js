// Moteur : énoncés du mode Jouer et parcours Apprendre, avec un hasard reproductible.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROUND, placeQuestion, quizQuestion, scorePlacement, starsFor } from '../../src/pedagogy/challenges.js';
import { LESSONS } from '../../src/pedagogy/lessons.js';
import { calc } from '../../src/core/engine.js';

function seeded(seed) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
}

test('une partie ne répète pas les angles et suit la progression de difficulté', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const used = [], rng = seeded(seed);
    const prompts = [];
    for (let i = 0; i < ROUND; i++) prompts.push(placeQuestion(i, used, rng).prompt);
    assert.equal(new Set(used).size, ROUND, 'angles distincts');
    prompts.slice(0, 3).forEach(p => assert.match(p, /^θ = /));
    prompts.slice(3, 6).forEach(p => assert.match(p, /^(cos|sin) θ = .* et (sin|cos) θ [<>] 0$/));
    prompts.slice(6).forEach(p => assert.match(p, /^tan θ = .* et cos θ [<>] 0$/));
  }
});

test('le même germe donne la même partie', () => {
  const a = [], b = [];
  const qa = quizQuestion(0, a, seeded(7)), qb = quizQuestion(0, b, seeded(7));
  assert.deepEqual(qa, qb);
});

test('quiz : radians à partir de la 5e question', () => {
  const used = [], rng = seeded(3);
  for (let i = 0; i < ROUND; i++) {
    const q = quizQuestion(i, used, rng);
    if (i < 4) assert.match(q.label, /\d+°$/);
    else assert.doesNotMatch(q.label, /°$/);
  }
});

test('barème et étoiles', () => {
  assert.deepEqual(scorePlacement(1), { points: 100, good: true });
  assert.deepEqual(scorePlacement(4), { points: 70, good: true });
  assert.deepEqual(scorePlacement(8), { points: 30, good: false });
  assert.deepEqual(scorePlacement(40), { points: 0, good: false });
  assert.deepEqual([800, 680, 440, 200, 0].map(s => starsFor(s, 800)), [3, 3, 2, 1, 0]);
});

test('parcours : 8 étapes complètes', () => {
  assert.equal(LESSONS.length, 8);
  for (const L of LESSONS) {
    assert.ok(L.title && L.text && L.task && typeof L.check === 'function');
    assert.equal(L.check(calc(L.start)), false, L.title + ' : consigne déjà remplie au départ');
  }
});
