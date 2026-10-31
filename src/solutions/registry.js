// Registre des méthodes de résolution et contrat commun (voir ARCHITECTURE.md § Contrat de solution).

export const STATUSES = ['success', 'partial', 'unsupported', 'invalid', 'error'];
export const CONFIDENCES = ['exact', 'approx'];

export function createRegistry() {
  var solutions = [];
  return {
    register: function (s) {
      if (!s || typeof s.id !== 'string' || typeof s.label !== 'string' ||
        typeof s.solve !== 'function' || typeof s.supports !== 'function') {
        throw new Error('Solution invalide : id, label, supports() et solve() sont obligatoires.');
      }
      if (this.get(s.id)) throw new Error('Solution déjà enregistrée : ' + s.id);
      solutions.push(s);
    },
    get: function (id) {
      for (var i = 0; i < solutions.length; i++) if (solutions[i].id === id) return solutions[i];
      return null;
    },
    list: function (context) {
      return solutions.filter(function (s) { return !context || s.supports(context); });
    }
  };
}

// Gèle un objet en profondeur : une solution qui tente de modifier son contexte lève une erreur.
export function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
  }
  return o;
}

// Contexte transmis à solve() : l'angle d'état et les valeurs du moteur, en lecture seule.
export function solutionContext(values) {
  return deepFreeze({ angle: values.angle, values: values });
}

// Liste les écarts d'un résultat au contrat (tableau vide si conforme).
export function checkSolutionResult(res, solutionId) {
  var p = [];
  function str(v) { return typeof v === 'string' && v.length > 0; }
  if (!res || typeof res !== 'object') return ['résultat absent'];
  if (res.solutionId !== solutionId) p.push('solutionId attendu : ' + solutionId);
  if (STATUSES.indexOf(res.status) < 0) p.push('status inconnu : ' + res.status);
  if (CONFIDENCES.indexOf(res.confidence) < 0) p.push('confidence inconnue : ' + res.confidence);
  if (!str(res.title)) p.push('title manquant');
  if (!str(res.explanation)) p.push('explanation manquante');
  if (!Array.isArray(res.steps) || !res.steps.length) p.push('steps vide');
  else res.steps.forEach(function (s, i) {
    if (!s || !str(s.id) || !str(s.title) || !str(s.text)) p.push('étape ' + i + ' incomplète');
  });
  if (!Array.isArray(res.warnings)) p.push('warnings absent');
  else res.warnings.forEach(function (w, i) {
    if (!w || !str(w.code) || !str(w.message)) p.push('avertissement ' + i + ' incomplet');
  });
  var r = res.result;
  if (!r || !str(r.angle) || !str(r.cos) || !str(r.sin)) p.push('result incomplet');
  else if (r.tan === null) {
    if (!(res.warnings || []).some(function (w) { return w && w.code === 'TANGENT_UNDEFINED'; })) {
      p.push('tan null sans avertissement TANGENT_UNDEFINED');
    }
  } else if (!str(r.tan)) p.push('result.tan invalide');
  return p;
}
