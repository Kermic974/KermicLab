// Point d'entrée de l'Interface : construction, abonnement du rendu à l'état, autotests.

import { $ } from './dom.js';
import { store, setAngle } from './state.js';
import { buildCircle } from './circle.js';
import { render } from './render.js';
import { checkTask } from './learn.js';
import { setMode } from './modes.js';
import { bind } from './input.js';
import { runUiChecks } from './selftest.js';
import { compute, runCoreChecks } from '../api.js';

const VERSION = '1.4.0';

store.subscribe(function (s, meta) {
  render(s, meta);
  if (s.mode === 'learn') checkTask(compute(s.angle));
});

function start() {
  buildCircle();
  bind();
  setMode('explore');
  setAngle(45);
  var core = runCoreChecks(), ui = runUiChecks();
  var fails = core.fail.concat(ui.fail), total = core.count + ui.count, status = $('status');
  status.textContent = fails.length ? fails.length + ' test(s) en échec' : 'Prêt · ' + total + ' tests OK';
  status.classList.toggle('warn', fails.length > 0);
  $('diag').textContent = (fails.length ? 'Échecs :\n' + fails.join('\n') : 'Tous les autotests sont réussis (' + total + ').') +
    '\nMoteur : ' + core.count + ' · Interface : ' + ui.count +
    (ui.skipped.length ? '\nNon exécutés : ' + ui.skipped.join(', ') : '') +
    '\nScénario 60° synchronisé.\nVersion : ' + VERSION + '\nPointer Events : ' + ('PointerEvent' in window ? 'oui' : 'non');
}

try {
  start();
} catch (err) {
  $('status').textContent = 'Erreur de démarrage';
  $('status').classList.add('warn');
  $('diag').textContent = String(err && err.stack || err);
}
