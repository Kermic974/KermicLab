// Figure « fraction » du gabarit des notions (docs/gabarit.md).
// scripts/lib/gabarit.mjs l'insère dans le moteur (gabarit/moteur.js) des seules pages dont
// application.figure.type vaut « fraction ». Outils du moteur disponibles : h, s, riche, paragraphe,
// nombreFr, exact, pgcd, curseur, tuile.

/** Barres partagées en parts égales : numérateur / dénominateur, décimal, pourcentage, forme simplifiée. */
FIGURES.fraction = function fraction(conf) {
  const svg = s("svg", { viewBox: "0 0 300 52", role: "img", "aria-label": "Fraction représentée par des barres partagées en parts égales" });
  const valeurs = h("div", { classe: "tuiles", "aria-live": "polite" });
  let n = conf.numerateur ?? 3, d = conf.denominateur ?? 4;
  const dessiner = () => {
    svg.replaceChildren();
    const barres = Math.max(1, Math.ceil(n / d));
    const hauteur = 36;
    svg.setAttribute("viewBox", `0 0 300 ${8 + barres * (hauteur + 8)}`);
    for (let j = 0; j < barres; j++) {
      const y = 8 + j * (hauteur + 8);
      for (let i = 0; i < d; i++) {
        const pleine = j * d + i < n;
        s("rect", { x: 10 + (i * 280) / d, y, width: 280 / d, height: hauteur, class: pleine ? "part pleine" : "part" }, svg);
      }
    }
    const g = pgcd(n, d);
    valeurs.replaceChildren(
      tuile("fraction", `${n}/${d}`),
      tuile("forme simplifiée", g > 1 ? `${n / g}/${d / g}` : "déjà simplifiée"),
      tuile("décimal", `${exact(n / d, 3) ? "" : "≈ "}${nombreFr(n / d, 3)}`),
      tuile("pourcentage", `${exact((n / d) * 100, 1) ? "" : "≈ "}${nombreFr((n / d) * 100, 1)} %`)
    );
  };
  const cn = curseur("Numérateur (parts prises)", 0, 12, 1, n, (v) => { n = v; dessiner(); });
  const cd = curseur("Dénominateur (parts égales)", 1, 12, 1, d, (v) => { d = v; dessiner(); });
  cn.maj(); cd.maj();
  return h("div", { classe: "figure" }, svg, h("div", { classe: "curseurs" }, cn.element, cd.element), valeurs);
};
