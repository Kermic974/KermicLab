// Validation des paramètres de la figure « thales » (gabarit/figures/thales.js).
const entre = (v, min, max) => v === undefined || (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max);

export function valider(f, ou, { exiger }) {
  for (const cle of ["ab", "ac"]) exiger(entre(f[cle], 1, 20), `${ou} : « ${cle} » doit être compris entre 1 et 20`);
  exiger(entre(f.angle, 15, 165), `${ou} : « angle » doit être compris entre 15° et 165°`);
  exiger(entre(f.rapport, 0.1, 0.9), `${ou} : « rapport » doit être compris entre 0,1 et 0,9`);
}
