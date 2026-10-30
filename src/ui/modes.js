// Navigation entre les modes Explorer / Apprendre / Jouer.

import { each } from './dom.js';
import { store } from './state.js';
import { lesson, showLesson } from './learn.js';
import { showMenu, stopGame } from './play.js';

export function setMode(m) {
  store.patch({ mode: m });
  each('[data-tab]', function (b) { b.setAttribute('aria-selected', b.dataset.tab === m); });
  each('[data-mode]', function (s) { s.classList.toggle('hidden', s.dataset.mode.split(' ').indexOf(m) < 0); });
  if (m === 'play') showMenu(); else stopGame();
  if (m === 'learn') showLesson(lesson.i);
}
