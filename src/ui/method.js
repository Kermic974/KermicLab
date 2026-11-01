// Sélecteur de méthode et affichage de ses étapes dans le panneau « Ce que montre cet angle ».
// La méthode choisie est une préférence (store.method) : elle ne change jamais les valeurs affichées.

import { $ } from './dom.js';
import { store } from './state.js';
import { solutions } from '../api.js';

export const UNSUPPORTED = 'Méthode non applicable à cet angle';

export function methodsOf(mode) { return solutions.list({ mode: mode }); }

// Méthode choisie si elle est proposée dans le mode courant, sinon la première proposée.
export function resolveMethod(methods, id) {
  var chosen = solutions.get(id);
  return chosen && methods.indexOf(chosen) >= 0 ? chosen : methods[0] || null;
}

function currentMethod() {
  var s = store.get();
  return resolveMethod(methodsOf(s.mode), s.method);
}

export function buildMethodRadios(methods, method) {
  var group = $('mradio'), ids = methods.map(function (m) { return m.id; }).join('|');
  if (group.dataset.ids !== ids) {
    group.dataset.ids = ids;
    group.textContent = '';
    methods.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.method = m.id;
      b.textContent = m.label;
      group.appendChild(b);
    });
  }
  group.classList.toggle('hidden', methods.length === 0);
  Array.prototype.forEach.call(group.children, function (b) {
    var on = !!method && b.dataset.method === method.id;
    b.setAttribute('aria-checked', on);
    b.tabIndex = on ? 0 : -1;
    b.classList.toggle('on', on);
  });
}

function fill(list, items, build) {
  list.textContent = '';
  items.forEach(function (it) {
    var li = document.createElement('li');
    build(li, it);
    list.appendChild(li);
  });
}

// Affiche un résultat de méthode ; cible = { title, steps, warnings, explain } (éléments), par défaut ceux de la page.
export function renderMethod(result, cible) {
  var t = cible || { title: $('mtitle'), steps: $('msteps'), warnings: $('mwarn'), explain: $('explain') };
  var r = result || {};
  var steps = Array.isArray(r.steps) ? r.steps : [], warnings = Array.isArray(r.warnings) ? r.warnings : [];
  t.title.textContent = !result ? '' : r.status === 'unsupported' ? UNSUPPORTED : r.title || '';
  fill(t.steps, steps, function (li, st) {
    var b = document.createElement('b');
    b.textContent = st.title;
    li.appendChild(b);
    li.appendChild(document.createTextNode(' ' + st.text));
  });
  fill(t.warnings, warnings, function (li, w) { li.textContent = w.message; });
  t.explain.textContent = result && r.status !== 'unsupported' && r.explanation ? r.explanation : '';
}

// Méthode voisine d'une méthode, selon la touche fléchée (null si la touche n'est pas gérée).
export function nextMethod(id, key) {
  var ids = methodsOf(store.get().mode).map(function (m) { return m.id; }), i = ids.indexOf(id), n = ids.length, d;
  if (i < 0) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') d = 1;
  else if (key === 'ArrowLeft' || key === 'ArrowUp') d = -1;
  else if (key === 'Home') return ids[0];
  else if (key === 'End') return ids[n - 1];
  else return null;
  return ids[(i + d + n) % n];
}

// Change la méthode (préférence) et l'annonce ; rien n'est annoncé si elle ne change pas.
export function chooseMethod(id, focus) {
  var m = solutions.get(id), before = currentMethod();
  if (!m || m === before) return;
  store.patch({ method: m.id });
  store.refresh();
  $('live').textContent = 'Méthode : ' + m.label;
  if (focus) {
    var b = $('mradio').querySelector('[data-method="' + m.id + '"]');
    if (b) b.focus();
  }
}
