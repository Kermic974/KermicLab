// L'outillage refuse bien ce qu'il doit refuser : chaque cas casse une copie temporaire du dépôt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function sandbox(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'trigolab-'));
  cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true });
  cpSync(join(ROOT, 'scripts'), join(dir, 'scripts'), { recursive: true });
  cpSync(join(ROOT, 'web'), join(dir, 'web'), { recursive: true });
  mutate((file, fn) => { const p = join(dir, file); writeFileSync(p, fn(readFileSync(p, 'utf8'))); });
  return dir;
}

function run(dir, script, ...args) {
  const r = spawnSync('python3', [join(dir, 'scripts', script), ...args], { cwd: dir, encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  return { code: r.status, out: r.stdout + r.stderr };
}

function build(mutate) { return run(sandbox(mutate), 'build-standalone.py', '--out', 'out.html'); }
function boundaries(mutate) { return run(sandbox(mutate), 'check_boundaries.py'); }

test('la copie intacte se construit et respecte les frontières', () => {
  assert.equal(build(() => {}).code, 0);
  assert.equal(boundaries(() => {}).code, 0);
});

test('build : import d\'un nom non exporté', () => {
  const r = build(edit => edit('src/ui/state.js', s => s.replace('import { createStore }', 'import { createStore, inexistant }')));
  assert.equal(r.code, 1);
  assert.match(r.out, /inexistant.*non exporté/);
});

test('build : nom de niveau module déclaré deux fois', () => {
  const r = build(edit => edit('src/ui/dom.js', s => s + '\nexport function fmt() {}\n'));
  assert.equal(r.code, 1);
  assert.match(r.out, /nom « fmt » déclaré/);
});

test('build : dépendance circulaire', () => {
  const r = build(edit => edit('src/ui/dom.js', s => "import { polar } from './geometry.js';\n" + s));
  assert.equal(r.code, 1);
  assert.match(r.out, /dépendance circulaire/);
});

test('build : export default interdit', () => {
  const r = build(edit => edit('src/ui/dom.js', s => s + '\nexport default 1;\n'));
  assert.equal(r.code, 1);
  assert.match(r.out, /export default interdit/);
});

test('frontières : DOM interdit dans le Moteur', () => {
  const r = boundaries(edit => edit('src/core/engine.js', s => s + '\nexport function titre() { return document.title; }\n'));
  assert.equal(r.code, 1);
  assert.match(r.out, /« document » interdit dans le Moteur/);
});

test('frontières : l\'Interface contourne src/api.js', () => {
  const r = boundaries(edit => edit('src/ui/render.js', s => "import { norm } from '../core/angle.js';\n" + s));
  assert.equal(r.code, 1);
  assert.match(r.out, /via src\/api\.js/);
});

test('frontières : le Moteur importe l\'Interface', () => {
  const r = boundaries(edit => edit('src/core/engine.js', s => "import { $ } from '../ui/dom.js';\n" + s));
  assert.equal(r.code, 1);
  assert.match(r.out, /le Moteur n'importe que du Moteur/);
});

test('frontières : logique ajoutée dans le contrat', () => {
  const r = boundaries(edit => edit('src/api.js', s => s + '\nexport const X = 1;\n'));
  assert.equal(r.code, 1);
  assert.match(r.out, /que des réexportations/);
});
