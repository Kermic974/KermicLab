// Vérification de concordance des méthodes avec le moteur (SPEC.md S-08).

import { exactNum } from '../core/exact-values.js';
import { unfmt } from '../core/format.js';

// Valeur numérique d'une chaîne de résultat (forme exacte ou approchée) ; null si « non définie ».
export function resultNumber(s) {
  var e = exactNum(s);
  return e === undefined ? unfmt(s) : e;
}

function differs(expected, got, tol) {
  if (expected === null || got === null) return expected !== got;
  return !(Math.abs(expected - got) < tol);
}

// Compare les résultats 'success' aux valeurs du moteur ; les autres sont ignorés (skipped).
export function compareResults(results, values) {
  var expected = { cos: values.x, sin: values.y, tan: values.t };
  var out = { agree: true, checked: 0, skipped: [], mismatches: [] };
  results.forEach(function (res) {
    if (res.status !== 'success') { out.skipped.push(res.solutionId); return; }
    out.checked++;
    var tol = res.confidence === 'exact' ? 1e-9 : 1e-6;
    ['cos', 'sin', 'tan'].forEach(function (field) {
      var got = res.result[field] === null ? null : resultNumber(res.result[field]);
      if (differs(expected[field], got, tol)) {
        out.mismatches.push({ solutionId: res.solutionId, field: field, expected: expected[field], got: got });
      }
    });
  });
  out.agree = out.mismatches.length === 0;
  return out;
}
