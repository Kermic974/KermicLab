// Contrat Moteur → Interface : seul module que src/ui/ a le droit d'importer.
// Ajouter un export est sans risque ; en retirer ou en renommer un est un changement de contrat
// (voir AGENTS.md § Contrat entre agents). Une ligne par module source.

export { EPS, norm, clean, tidy, dist, quadrant, refAngle, parseAngle, sign } from './core/angle.js';
export { NOTABLE, OFF_AXIS, EXACT, exact, exactNum } from './core/exact-values.js';
export { fmt, unfmt } from './core/format.js';
export { calc, compute, resolveAngle } from './core/engine.js';
export { createStore } from './core/store.js';
export { LESSONS } from './pedagogy/lessons.js';
export { ROUND, rnd, pick, placeQuestion, quizQuestion, scorePlacement, quizExplanation, starsFor } from './pedagogy/challenges.js';
export { solutionContext, checkSolutionResult } from './solutions/registry.js';
export { compareResults, resultNumber } from './solutions/compare.js';
export { solutions } from './solutions/catalog.js';
export { runCoreChecks } from './selfcheck.js';
