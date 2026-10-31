// Mode « Apprendre » : affichage du parcours guidé et validation des consignes.

import { $ } from './dom.js';
import { setAngle } from './state.js';
import { setOptions } from './options.js';
import { LESSONS } from '../api.js';

export const lesson = { i: 0, done: false };

export function showLesson(i) {
  lesson.i = Math.max(0, Math.min(LESSONS.length - 1, i));
  lesson.done = false;
  var L = LESSONS[lesson.i], last = lesson.i === LESSONS.length - 1, o = L.opts || {};
  setOptions({ showProj: true, showLabels: true, showTan: !!o.showTan, radLabels: !!o.radLabels });
  $('lstep').textContent = 'Étape ' + (lesson.i + 1) + ' / ' + LESSONS.length;
  $('lbar').style.width = (100 * lesson.i / LESSONS.length) + '%';
  $('ltitle').textContent = L.title;
  $('ltext').textContent = L.text;
  $('ltaskText').textContent = L.task;
  $('ltaskOk').textContent = '';
  $('ltask').classList.remove('done');
  $('lprev').disabled = lesson.i === 0;
  $('lnext').textContent = last ? 'Relever les défis 🎮' : 'Suivant →';
  setAngle(L.start);
}

export function checkTask(c) {
  if (lesson.done || !LESSONS[lesson.i].check(c)) return;
  lesson.done = true;
  $('ltask').classList.add('done');
  $('ltaskOk').textContent = '✓ Réussi !';
  $('lbar').style.width = (100 * (lesson.i + 1) / LESSONS.length) + '%';
}
