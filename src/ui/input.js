// Entrées : pointeur (souris, tactile, stylet), saisie, curseur, incréments, clavier, onglets, boutons.
// Toutes passent par setAngle() ou store.refresh() : jamais de rendu direct.

import { $, each } from './dom.js';
import { svgPoint, angleAt, nearCenter } from './geometry.js';
import { store, setAngle } from './state.js';
import { HINT } from './render.js';
import { syncOptions } from './options.js';
import { lesson, showLesson } from './learn.js';
import { game, startGame, showMenu, advanceGame } from './play.js';
import { setMode } from './modes.js';
import { chooseMethod, nextMethod } from './method.js';
import { fmt, LESSONS } from '../api.js';

function bindPointer() {
  var hit = $('hit'), svg = $('svg'), pid = null, pending = null, raf = 0;

  function flush() { raf = 0; if (pending !== null) { setAngle(pending); pending = null; } }
  function queue(a) { pending = a; if (!raf) raf = requestAnimationFrame(flush); }
  function stop() {
    pid = null;
    svg.classList.remove('dragging');
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (pending !== null) { setAngle(pending); pending = null; }
  }

  hit.addEventListener('pointerdown', function (e) {
    if (store.get().locked || (e.pointerType === 'mouse' && e.button !== 0)) return;
    var pt = svgPoint(e);
    if (nearCenter(pt)) return;
    e.preventDefault();
    svg.focus({ preventScroll: true });
    pid = e.pointerId;
    svg.classList.add('dragging');
    try { hit.setPointerCapture(pid); } catch (_) { /* pointeur synthétique ou navigateur ancien */ }
    setAngle(angleAt(pt, store.get().snap));
  });
  hit.addEventListener('pointermove', function (e) {
    if (e.pointerId !== pid) return;
    e.preventDefault();
    var pt = svgPoint(e);
    if (!nearCenter(pt)) queue(angleAt(pt, store.get().snap));
  });
  hit.addEventListener('pointerup', function (e) {
    if (e.pointerId !== pid) return;
    e.preventDefault();
    var pt = svgPoint(e);
    if (!nearCenter(pt)) pending = angleAt(pt, store.get().snap);
    stop();
    store.refresh({ announce: true });
  });
  hit.addEventListener('pointercancel', function (e) { if (e.pointerId === pid) stop(); });
  hit.addEventListener('lostpointercapture', function (e) { if (e.pointerId === pid) stop(); });
}

function bindControls() {
  function applyInput() {
    var input = $('input');
    if (setAngle(input.value, true, true)) {
      input.value = fmt(store.get().angle, 3);
    } else {
      input.setAttribute('aria-invalid', 'true');
      $('hint').classList.add('err');
      $('hint').textContent = 'Valeur non reconnue. Exemples : 60 ; −45 ; 22,5 ; π/3 ; 3pi/4.';
    }
  }
  $('hint').textContent = HINT;
  $('apply').addEventListener('click', applyInput);
  $('input').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); applyInput(); } });

  $('range').addEventListener('input', function () { setAngle(Number(this.value), Number(this.value) === 360); });
  $('range').addEventListener('change', function () { store.refresh({ announce: true }); });

  each('[data-step]', function (b) {
    b.addEventListener('click', function () { setAngle(store.get().angle + Number(b.dataset.step), false, true); });
  });

  $('snap').addEventListener('change', function () { store.patch({ snap: this.checked }); });
  ['showProj', 'showLabels', 'radLabels', 'showTan'].forEach(function (id) {
    $(id).addEventListener('change', syncOptions);
  });
}

function bindModes() {
  each('[data-tab]', function (b) {
    b.addEventListener('click', function () { setMode(b.dataset.tab); });
  });
  $('lprev').addEventListener('click', function () { showLesson(lesson.i - 1); });
  $('lnext').addEventListener('click', function () {
    if (lesson.i < LESSONS.length - 1) showLesson(lesson.i + 1);
    else setMode('play');
  });
  each('[data-game]', function (b) {
    b.addEventListener('click', function () { startGame(b.dataset.game); });
  });
  $('gGo').addEventListener('click', advanceGame);
  $('gQuit').addEventListener('click', showMenu);
  $('gMenuBtn').addEventListener('click', showMenu);
  $('gAgain').addEventListener('click', function () { startGame(game.last); });
}

function bindMethods() {
  var group = $('mradio');
  group.addEventListener('click', function (e) {
    var b = e.target.closest('[role=radio]');
    if (b) chooseMethod(b.dataset.method);
  });
  group.addEventListener('keydown', function (e) {
    var b = e.target.closest('[role=radio]');
    var id = b && nextMethod(b.dataset.method, e.key);
    if (!id) return;
    e.preventDefault();
    chooseMethod(id, true);
  });
}

function bindKeyboard() {
  $('svg').addEventListener('keydown', function (e) {
    var s = store.get();
    if (e.key === 'Enter' && s.mode === 'play' && game.kind) { e.preventDefault(); advanceGame(); return; }
    if (s.locked) return;
    var a = null, step = e.shiftKey ? 5 : 1;
    switch (e.key) {
      case 'ArrowLeft': case 'ArrowDown': a = s.angle - step; break;
      case 'ArrowRight': case 'ArrowUp': a = s.angle + step; break;
      case 'PageDown': a = s.angle - 15; break;
      case 'PageUp': a = s.angle + 15; break;
      case 'Home': a = 0; break;
      case 'End': a = 360; break;
    }
    if (a !== null) { e.preventDefault(); setAngle(a, a === 360, true); }
  });
}

export function bind() {
  bindPointer();
  bindControls();
  bindModes();
  bindMethods();
  bindKeyboard();
}
