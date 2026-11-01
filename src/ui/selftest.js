// Autotests de l'Interface : géométrie de la vue et tests DOM étendus sur la vraie page.
// Ils pilotent la page (clics, saisie, clavier, pointeur, onglets) puis restaurent l'état initial.

import { $ } from './dom.js';
import { C, R, polar } from './geometry.js';
import { store, setAngle } from './state.js';
import { getOptions, setOptions } from './options.js';
import { setMode } from './modes.js';
import { renderMethod, UNSUPPORTED } from './method.js';
import { NOTABLE, EXACT, LESSONS, norm, dist, solutions, solutionContext, compute } from '../api.js';

export function runUiChecks() {
  var fail = [], count = 0, skipped = [];
  function ok(name, v) { count++; if (!v) fail.push('UI · ' + name); }
  function near(a, b, t) { return Math.abs(a - b) < (t || 1e-6); }
  function num(id, at) { return Number($(id).getAttribute(at)); }
  function angle() { return store.get().angle; }
  function key(el, k, shift) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey: !!shift, bubbles: true, cancelable: true }));
  }
  function typeApply(v) { $('input').value = v; $('apply').click(); }
  function slide(v) { $('range').value = v; $('range').dispatchEvent(new Event('input', { bubbles: true })); }
  function step(s) { document.querySelector('[data-step="' + s + '"]').click(); }
  function toggle(id) { var el = $(id); el.checked = !el.checked; el.dispatchEvent(new Event('change', { bubbles: true })); }
  function visible(id) { return !$(id).closest('section').classList.contains('hidden'); }

  var saved = { angle: angle(), snap: store.get().snap, options: getOptions() };

  // Géométrie de la vue : aller-retour angle ↔ point SVG.
  for (var d = 0; d < 360; d++) {
    var p = polar(d), back = norm(Math.atan2(C - p.y, p.x - C) * 180 / Math.PI);
    ok('angle ' + d, dist(d, back) < 1e-8);
    ok('rayon ' + d, Math.abs(Math.hypot(p.x - C, p.y - C) - R) < 1e-8);
  }

  // Scénario de référence 60° et saisies
  setAngle(60);
  ok('UI 60', $('deg').textContent === '60°' && $('range').value === '60' && $('radx').textContent === 'π/3');
  ok('UI 60 coordonnées', $('coords').textContent === '(0,5 ; 0,866025)');
  typeApply('120');
  ok('saisie 120', $('deg').textContent === '120°' && $('quad').textContent === 'Quadrant II' &&
    $('ref').textContent === 'Angle de référence : 60°' && $('radx').textContent === '2π/3');
  typeApply('22,5');
  ok('virgule décimale', angle() === 22.5 && $('deg').textContent === '22,5°' && $('input').value === '22,5');
  typeApply('');
  ok('saisie vide ignorée', angle() === 22.5 && $('input').getAttribute('aria-invalid') === 'true' && $('hint').classList.contains('err'));
  typeApply('abc');
  ok('saisie invalide ignorée', angle() === 22.5);
  typeApply('-30');
  ok('angle négatif', angle() === 330 && !$('input').hasAttribute('aria-invalid'));
  typeApply('720');
  ok('720° conservé à 360°', angle() === 360 && $('deg').textContent === '360°' && $('radx').textContent === '2π');
  typeApply('2pi/3');
  ok('saisie en radians', angle() === 120);
  $('input').value = '60';
  key($('input'), 'Enter');
  ok('touche Entrée', angle() === 60);

  // Curseur
  slide('360');
  ok('curseur 360', $('deg').textContent === '360°');
  slide('90');
  ok('curseur 90', $('tan').textContent === 'non définie' && $('signs').textContent === 'cos 0 · sin + · tan ∅');
  slide('12.3');
  ok('curseur décimal', angle() === 12.3 && $('radx').textContent.indexOf('≈') === 0);

  // Incréments
  setAngle(0);
  step(-15); ok('−15° depuis 0', angle() === 345);
  step(15); ok('+15° revient à 0', angle() === 0 && $('deg').textContent === '0°');
  step(1); step(1); step(1); ok('+1° ×3', angle() === 3);
  step(-5); ok('−5° franchit 0', angle() === 358);

  // Angles remarquables : chaque bouton synchronise toutes les valeurs exactes
  Array.prototype.forEach.call($('quick').children, function (b) {
    b.click();
    var d = Number(b.dataset.a), e = EXACT[d], on = $('quick').querySelectorAll('.on');
    ok('remarquable ' + d, angle() === d && $('radx').textContent === e[0] && $('cosx').textContent === 'exact : ' + e[1] &&
      $('sinx').textContent === 'exact : ' + e[2] &&
      $('tanx').textContent === (e[3] === 'non définie' ? 'cos θ = 0' : 'exact : ' + e[3]) &&
      $('coordsx').textContent === 'exact : (' + e[1] + ' ; ' + e[2] + ')' && on.length === 1 && on[0] === b &&
      b.getAttribute('aria-pressed') === 'true');
  });
  ok('16 angles remarquables', $('quick').children.length === NOTABLE.length);

  // Clavier sur le cercle
  var svg = $('svg');
  setAngle(10);
  key(svg, 'ArrowRight'); ok('flèche droite', angle() === 11);
  key(svg, 'ArrowUp', true); ok('Maj + flèche haut', angle() === 16);
  key(svg, 'ArrowLeft'); ok('flèche gauche', angle() === 15);
  key(svg, 'PageUp'); ok('Page précédente', angle() === 30);
  key(svg, 'PageDown'); ok('Page suivante', angle() === 15);
  key(svg, 'Home'); ok('Début', angle() === 0);
  key(svg, 'ArrowDown'); ok('flèche bas franchit 0', angle() === 359);
  key(svg, 'End'); ok('Fin', angle() === 360 && $('deg').textContent === '360°');
  key(svg, 'a'); ok('touche sans effet', angle() === 360);

  // Géométrie SVG synchronisée
  [0, 45, 137.5, 270].forEach(function (d) {
    setAngle(d);
    var p = polar(d);
    ok('géométrie ' + d, near(num('point', 'cx'), p.x) && near(num('point', 'cy'), p.y) &&
      near(num('halo', 'cx'), p.x) && near(num('ray', 'x2'), p.x) && near(num('ray', 'y2'), p.y) &&
      near(num('px', 'x2'), p.x) && near(num('px', 'y2'), C) && near(num('py', 'x2'), C) && near(num('py', 'y2'), p.y) &&
      near(num('segx', 'x2'), p.x) && near(num('segy', 'y2'), p.y) &&
      num('svg', 'aria-valuenow') === d && Number($('range').value) === d);
  });
  setAngle(90);
  ok('tangente masquée à 90°', $('tanPt').getAttribute('visibility') === 'hidden');
  setAngle(45);
  ok('point T à 45°', $('tanPt').getAttribute('visibility') === 'visible' && near(num('tanPt', 'cy'), C - R));

  // Signes par quadrant
  [[45, 'cos + · sin + · tan +'], [135, 'cos − · sin + · tan −'], [225, 'cos − · sin − · tan +'], [315, 'cos + · sin − · tan −']]
    .forEach(function (s) { setAngle(s[0]); ok('signes ' + s[0], $('signs').textContent === s[1]); });

  // Options d'affichage
  setOptions({ showProj: true, showLabels: true, radLabels: false, showTan: false });
  toggle('showProj'); ok('masquer projections', $('projs').classList.contains('hidden'));
  toggle('showProj'); ok('afficher projections', !$('projs').classList.contains('hidden'));
  toggle('showLabels'); ok('masquer repères', $('labels').classList.contains('hidden'));
  toggle('showLabels'); ok('afficher repères', !$('labels').classList.contains('hidden'));
  toggle('radLabels'); ok('repères en radians', $('labels').textContent.indexOf('π/6') >= 0);
  toggle('radLabels'); ok('repères en degrés', $('labels').textContent.indexOf('30°') >= 0);
  toggle('showTan'); ok('axe des tangentes', !$('tanGroup').classList.contains('hidden'));
  toggle('showTan');
  toggle('snap'); ok('aimantation basculée', store.get().snap === !saved.snap);
  toggle('snap'); ok('aimantation rétablie', store.get().snap === saved.snap);

  // Annonce aux lecteurs d'écran et explication de la méthode géométrique
  $('live').textContent = '';
  typeApply('30');
  ok('annonce aria-live', $('live').textContent.indexOf('Angle 30 degrés') === 0);
  ok('explication', $('explain').textContent.indexOf('Quadrant I.') === 0);

  // Pointeur (souris, tactile, stylet)
  var r = svg.getBoundingClientRect();
  if (r.width > 0 && typeof PointerEvent === 'function') {
    var ptr = function (type, d, rad, extra) {
      var p = polar(d, rad), init = {
        clientX: r.left + p.x * r.width / 760, clientY: r.top + p.y * r.height / 760,
        pointerId: 7, pointerType: 'mouse', button: 0, bubbles: true, cancelable: true
      };
      for (var k in extra || {}) init[k] = extra[k];
      $('hit').dispatchEvent(new PointerEvent(type, init));
    };
    store.patch({ snap: true });
    setAngle(100);
    ptr('pointerdown', 32); ok('appui aimanté (32° → 30°)', angle() === 30);
    ptr('pointermove', 200); ptr('pointerup', 200); ok('glisser puis relâcher', near(angle(), 200, .5));
    ok('relâcher annonce', $('live').textContent.indexOf('Angle 200') === 0);
    store.patch({ snap: false });
    ptr('pointerdown', 32); ptr('pointerup', 32); ok('appui libre (32°)', near(angle(), 32, .5));
    ptr('pointerdown', 50, 150, { pointerType: 'touch' }); ptr('pointerup', 50, 150, { pointerType: 'touch' });
    ok('toucher à l\'intérieur du cercle', near(angle(), 50, .5));
    setAngle(100);
    ptr('pointerdown', 0, 0); ok('centre ignoré', angle() === 100);
    ptr('pointerdown', 200, R, { button: 2 }); ok('clic droit ignoré', angle() === 100);
    ptr('pointermove', 200); ok('survol sans appui ignoré', angle() === 100);
    store.patch({ locked: true });
    ptr('pointerdown', 200); ok('point verrouillé', angle() === 100);
    store.patch({ locked: false, snap: saved.snap });
  } else {
    skipped.push('pointeur (page non affichée)');
  }

  // Modes
  document.querySelector('[data-tab=learn]').click();
  ok('onglet Apprendre', visible('ltitle') && visible('deg') && !visible('quick') && $('ltitle').textContent === LESSONS[0].title);
  setAngle(90);
  ok('consigne validée', $('ltaskOk').textContent === '✓ Réussi !');
  document.querySelector('[data-tab=play]').click();
  ok('onglet Jouer', !$('gMenu').classList.contains('hidden') && !visible('deg'));
  document.querySelector('[data-game=quiz]').click();
  ok('quiz : point verrouillé', store.get().locked && svg.classList.contains('locked') && $('gOptions').children.length === 4);
  $('gQuit').click();
  ok('quitter déverrouille', !store.get().locked && !$('gMenu').classList.contains('hidden'));
  setMode('explore');
  ok('retour Explorer', visible('quick') && store.get().mode === 'explore');

  // Sélecteur de méthode (A-04)
  var opts = function () { return Array.prototype.slice.call($('mradio').querySelectorAll('[role=radio]')); };
  var methods = solutions.list({ mode: 'explore' });
  setAngle(150);
  ok('options de méthode', opts().length === methods.length && $('mradio').getAttribute('role') === 'radiogroup');
  var before = [$('cos').textContent, $('sin').textContent, $('tan').textContent], prevTitle = null, allSame = true;
  opts().forEach(function (o) {
    o.click();
    var res = solutions.get(o.dataset.method).solve(solutionContext(compute(150)));
    ok('méthode ' + o.dataset.method + ' : titre', $('mtitle').textContent === res.title && o.getAttribute('aria-checked') === 'true');
    ok('méthode ' + o.dataset.method + ' : étapes', $('msteps').children.length === res.steps.length);
    ok('méthode ' + o.dataset.method + ' : avertissements', $('mwarn').children.length === res.warnings.length);
    if (prevTitle !== null && prevTitle !== $('mtitle').textContent) allSame = false;
    if (prevTitle !== null) ok('le titre change avec la méthode', prevTitle !== $('mtitle').textContent);
    prevTitle = $('mtitle').textContent;
    ok('valeurs inchangées (' + o.dataset.method + ')', $('cos').textContent === before[0] && $('sin').textContent === before[1] &&
      $('tan').textContent === before[2]);
  });
  ok('titre unique par méthode', opts().length < 2 || !allSame);
  var chosen = opts()[opts().length - 1];
  setAngle(30);
  ok('méthode conservée (angle)', store.get().method === chosen.dataset.method && opts()[opts().length - 1].getAttribute('aria-checked') === 'true');
  document.querySelector('[data-tab=learn]').click();
  setMode('explore');
  ok('méthode conservée (mode)', store.get().method === chosen.dataset.method && opts()[opts().length - 1].getAttribute('aria-checked') === 'true');
  $('live').textContent = '';
  if (opts().length > 1) {
    key(opts()[opts().length - 1], 'ArrowRight');
    ok('flèche dans le groupe', store.get().method === opts()[0].dataset.method && $('live').textContent.indexOf('Méthode : ') === 0);
  }
  var fake = {
    solutionId: 'fake', status: 'unsupported', title: 'Fausse méthode', result: null,
    steps: [{ id: 'why', title: 'Pourquoi', text: 'Parce que.' }], explanation: 'Sans objet.',
    warnings: [{ code: 'NOT_APPLICABLE', message: 'Non applicable.' }]
  }, threw = false;
  try { renderMethod(fake); } catch (_) { threw = true; }
  ok('résultat non applicable', !threw && $('mtitle').textContent === UNSUPPORTED && $('msteps').children.length === 1 &&
    $('mwarn').children.length === 1 && $('explain').textContent === '');
  threw = false;
  try { renderMethod({ status: 'unsupported' }); } catch (_) { threw = true; }
  ok('résultat non applicable incomplet', !threw && $('msteps').children.length === 0);
  store.patch({ method: 'geometric' });
  store.refresh();

  // Restauration
  setOptions(saved.options);
  store.patch({ snap: saved.snap });
  $('snap').checked = saved.snap;
  setAngle(saved.angle);
  $('live').textContent = '';
  return { count: count, fail: fail, skipped: skipped };
}
