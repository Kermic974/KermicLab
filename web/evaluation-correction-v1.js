// S7 : implémentation v1 figée par evaluations/methodes.json. Une évolution crée une nouvelle version, pas un écrasement.
// La saisie reste une entrée éphémère, jamais une propriété du résultat.
export const METHODES_EVALUATION = Object.freeze([
  Object.freeze({ id: "catalogue-qcm", version: 1, mode: "deterministic", format: "qcm" }),
  Object.freeze({ id: "catalogue-number", version: 1, mode: "deterministic", format: "number" }),
  Object.freeze({ id: "human-review", version: 1, mode: "human" }),
  Object.freeze({ id: "assisted-review", version: 1, mode: "assisted" })
]);
export function methodeConnue(m) {
  return METHODES_EVALUATION.find(v => v.id === m?.id && v.version === m.version && v.mode === m.mode) || null;
}

export function lireNombreEvaluation(saisie) {
  if (!["string", "number"].includes(typeof saisie) || String(saisie).length > 4096) return null;
  const t = String(saisie).trim().replace(/\s+/g, "").replace(",", ".");
  const f = t.match(/^(-?\d+)\/(-?\d+)$/);
  if (f) {
    const n = Number(f[1]), d = Number(f[2]);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
    return { valeur: n / d, fraction: [n, d] };
  }
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const valeur = Number(t);
  return Number.isFinite(valeur) ? { valeur, fraction: null } : null;
}
function pgcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const r = a % b; a = b; b = r; }
  return a;
}
const resultat = (outcome, reason, matches = []) => ({ outcome, reason,
  diagnostic: { state: matches.length > 1 ? "ambiguous" : matches.length ? "matched" : "indeterminate", matches } });

export function motifsPrepares(prepare) {
  const ids = (prepare?.erreurs || []).map((e, i) => e.experienceId ||
    (prepare.type === "qcm" ? "choice-" + e.choix : "numeric-pattern-" + (i + 1)));
  if (prepare?.type === "nombre" && prepare.fractionIrreductible) ids.push("fraction-not-reduced");
  return new Set(ids);
}

/** Le résultat ne contient ni la réponse apprenant, ni les textes des solutions/feedbacks préparés. */
export function corrigerCritere(critere, prepare, entree) {
  const methode = methodeConnue(critere?.method);
  if (!methode) throw new Error("S7-08 : méthode inconnue.");
  if (!entree || !["provided", "empty", "partial", "absent"].includes(entree.responseState)) throw new Error("S7-07 : état de réponse requis.");
  if (entree.responseState === "absent" || entree.responseState === "empty") return resultat("absent", "missing-response");
  if (methode.mode !== "deterministic") return resultat("indeterminate", "awaiting-confirmation");
  if (entree.responseState === "partial") return resultat("partial", "partial-response");
  if (methode.format === "qcm") {
    if (prepare?.type !== "qcm" || !Array.isArray(prepare.choix) || prepare.choix.length < 2 ||
        !Number.isInteger(prepare.bonne) || prepare.bonne < 0 || prepare.bonne >= prepare.choix.length) throw new Error("S7-08 : tâche QCM incompatible.");
    if (!Number.isInteger(entree.value) || entree.value < 0 || entree.value >= prepare.choix.length) return resultat("indeterminate", "ambiguous-evidence");
    if (entree.value === prepare.bonne) return resultat("success", "automatic-correction");
    const matches = (prepare.erreurs || []).filter(e => e.choix === entree.value).map(e => e.experienceId || "choice-" + e.choix);
    return resultat("failure", "automatic-correction", matches);
  }
  if (prepare?.type !== "nombre" || !Number.isFinite(prepare.reponse) ||
      (prepare.tolerance !== undefined && (!Number.isFinite(prepare.tolerance) || prepare.tolerance < 0))) throw new Error("S7-08 : tâche numérique incompatible.");
  const lu = lireNombreEvaluation(entree.value);
  if (!lu) return resultat("indeterminate", "ambiguous-evidence");
  const juste = Math.abs(lu.valeur - prepare.reponse) <= (prepare.tolerance ?? 1e-9);
  if (juste && prepare.fractionIrreductible && (!lu.fraction || pgcd(...lu.fraction) !== 1))
    return resultat("failure", "automatic-correction", ["fraction-not-reduced"]);
  if (juste) return resultat("success", "automatic-correction");
  const matches = (prepare.erreurs || []).flatMap((e, i) => Math.abs(lu.valeur - e.reponse) <= (e.tolerance ?? 1e-9)
    ? [e.experienceId || "numeric-pattern-" + (i + 1)] : []);
  return resultat("failure", "automatic-correction", matches);
}

/** Aucun barème implicite, aucune pénalité d'aide et aucun score pour une réponse absente/indéterminée. */
export function scoreDeclare(critere, outcome, scoreHumain) {
  const s = critere.scoring;
  if (!s || ["absent", "indeterminate"].includes(outcome)) return undefined;
  const valeur = s.kind === "outcome-values" ? s.values[outcome] : scoreHumain;
  if (valeur === undefined) return undefined;
  if (s.rounding !== "none" || !Number.isFinite(valeur) || valeur < s.min || valeur > s.max) throw new Error("S7-10 : score hors barème.");
  return valeur;
}
