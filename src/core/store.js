// État central : uniquement des valeurs sources, jamais de valeurs calculées.
// Toute interaction passe par setAngle(), qui notifie les abonnés (le rendu).

import { resolveAngle } from './engine.js';

export function createStore(initial) {
  var state = Object.assign({}, initial), subscribers = [];

  function get() { return Object.freeze(Object.assign({}, state)); }
  function notify(meta) {
    var snapshot = get();
    subscribers.forEach(function (fn) { fn(snapshot, meta || {}); });
  }

  return {
    get: get,
    // opts : { keep360, announce }. Renvoie false si la saisie est invalide (état inchangé).
    setAngle: function (raw, opts) {
      var a = resolveAngle(raw, opts && opts.keep360);
      if (a === null) return false;
      state.angle = a;
      notify(opts);
      return true;
    },
    // Préférences et navigation : pas de rendu déclenché.
    patch: function (values) {
      for (var k in values) {
        if (!(k in state)) throw new Error('Clé d\'état inconnue : ' + k);
        state[k] = values[k];
      }
    },
    refresh: function (meta) { notify(meta); },
    subscribe: function (fn) { subscribers.push(fn); }
  };
}
