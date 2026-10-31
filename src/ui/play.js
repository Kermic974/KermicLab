// Mode « Jouer » : déroulement des parties, score, record. La logique des énoncés vient du Moteur.

import { $, attrs } from './dom.js';
import { polar } from './geometry.js';
import { store, setAngle } from './state.js';
import { setOptions } from './options.js';
import {
  EXACT, norm, dist, fmt, rnd, pick, ROUND, placeQuestion, quizQuestion, scorePlacement, quizExplanation, starsFor
} from '../api.js';

export const game = { kind: null, last: 'place', i: 0, score: 0, streak: 0, bestStreak: 0, q: null, answered: false, used: [] };

function loadBest(kind) {
  try { return Number(localStorage.getItem('trigolab.best.' + kind)) || 0; } catch (_) { return 0; }
}
function saveBest(kind, v) {
  try { localStorage.setItem('trigolab.best.' + kind, String(v)); } catch (_) { /* stockage indisponible */ }
}

export function setLocked(v) {
  store.patch({ locked: v });
  $('svg').classList.toggle('locked', v);
  $('svg').setAttribute('aria-disabled', v);
}

function showPanel(id) {
  ['gMenu', 'gPlay', 'gEnd'].forEach(function (p) { $(p).classList.toggle('hidden', p !== id); });
}

export function stopGame() {
  game.kind = null;
  setLocked(false);
  $('target').classList.add('hidden');
}

export function showMenu() {
  stopGame();
  showPanel('gMenu');
  [['place', 'bestPlace'], ['quiz', 'bestQuiz']].forEach(function (g) {
    var b = loadBest(g[0]);
    $(g[1]).textContent = b ? '🏆 Record : ' + b + ' / ' + ROUND * 100 : 'Pas encore de record';
  });
}

export function startGame(kind) {
  game.kind = game.last = kind;
  game.i = 0; game.score = 0; game.streak = 0; game.bestStreak = 0; game.used = [];
  setOptions({ showProj: true, showLabels: true, showTan: false, radLabels: false });
  showPanel('gPlay');
  nextQuestion();
}

function updateHud() {
  $('gQ').textContent = 'Question ' + (game.i + 1) + ' / ' + ROUND;
  $('gScore').textContent = '⭐ ' + game.score + ' pts';
  $('gStreak').textContent = '🔥 Série : ' + game.streak;
}

function nextQuestion() {
  if (game.i >= ROUND) { endGame(); return; }
  game.answered = false;
  $('target').classList.add('hidden');
  $('gFeedback').textContent = '';
  $('gFeedback').className = 'feedback';
  $('gOptions').textContent = '';
  updateHud();
  if (game.kind === 'place') {
    game.q = placeQuestion(game.i, game.used);
    setLocked(false);
    setAngle(norm(game.q.target + 60 + rnd(240)));
    $('gHelp').textContent = 'Déplace P (glisser, toucher ou flèches du clavier), puis valide.';
    $('gGo').textContent = 'Valider';
    $('gGo').classList.remove('hidden');
  } else {
    game.q = quizQuestion(game.i, game.used);
    setLocked(true);
    setAngle(game.q.target);
    $('gHelp').textContent = 'Choisis la valeur exacte.';
    $('gGo').classList.add('hidden');
    game.q.options.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = v;
      b.addEventListener('click', function () { answerQuiz(b, v); });
      $('gOptions').appendChild(b);
    });
  }
  $('gPrompt').textContent = game.q.prompt;
}

function award(points, good, message) {
  game.answered = true;
  game.score += points;
  game.streak = good ? game.streak + 1 : 0;
  game.bestStreak = Math.max(game.bestStreak, game.streak);
  if (good && game.streak >= 3) message += ' 🔥 ' + game.streak + ' d\'affilée !';
  $('gFeedback').textContent = message;
  $('gFeedback').className = 'feedback ' + (good ? 'good' : 'bad');
  $('gGo').textContent = game.i === ROUND - 1 ? 'Voir le résultat' : 'Suivant →';
  $('gGo').classList.remove('hidden');
  setLocked(true);
  updateHud();
}

function validatePlace() {
  var t = game.q.target, err = dist(store.get().angle, t), p = polar(t), sc = scorePlacement(err);
  attrs($('target'), { cx: p.x, cy: p.y });
  $('target').classList.remove('hidden');
  var answer = t + '° (' + EXACT[t][0] + ')';
  award(sc.points, sc.good, sc.good
    ? pick(['Bravo !', 'Dans le mille !', 'Excellent !']) + ' ' + answer + ' · +' + sc.points + ' pts'
    : (sc.points ? 'Presque ! ' : 'Raté ! ') + 'La cible était ' + answer + ', écart ' + fmt(err, 1) + '°.' +
      (sc.points ? ' +' + sc.points + ' pts' : ''));
}

function answerQuiz(btn, v) {
  if (game.answered) return;
  var q = game.q, good = v === q.correct;
  Array.prototype.forEach.call($('gOptions').children, function (b) {
    b.disabled = true;
    if (b.textContent === q.correct) b.classList.add('good');
  });
  if (!good) btn.classList.add('bad');
  award(good ? 100 : 0, good, (good ? 'Exact ! ' : 'Non : ') + q.label + ' = ' + q.correct + '. ' + quizExplanation(q));
}

export function advanceGame() {
  if (!game.kind) return;
  if (game.answered) { game.i++; nextQuestion(); }
  else if (game.kind === 'place') validatePlace();
}

function endGame() {
  var kind = game.kind, max = ROUND * 100, best = loadBest(kind), record = game.score > best;
  var stars = starsFor(game.score, max);
  if (record) saveBest(kind, game.score);
  stopGame();
  showPanel('gEnd');
  $('gStars').textContent = '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars);
  $('gStars').setAttribute('aria-label', stars + ' étoile(s) sur 3');
  $('gSummary').textContent = ['Passe par le mode Apprendre, puis retente ta chance !',
    'Bon début, rejoue pour progresser !', 'Très bien joué !', 'Maître du cercle ! 🏆'][stars] +
    ' Score : ' + game.score + ' / ' + max + ' · meilleure série : ' + game.bestStreak +
    (record ? ' · 🎉 Nouveau record !' : best ? ' · record : ' + best : '');
}
