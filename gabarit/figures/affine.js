// Figure « affine » du gabarit des notions (docs/gabarit.md).
// scripts/lib/gabarit.mjs l'insère dans le moteur (gabarit/moteur.js) des seules pages dont
// application.figure.type vaut « affine ». Outils du moteur disponibles : h, s, riche, paragraphe,
// nombreFr, exact, pgcd, curseur, tuile.

/** Droite d'équation y = ax + b : coefficient directeur, ordonnée à l'origine, nature de la fonction. */
FIGURES.affine = function affine(conf) {
  const svg = s("svg", { viewBox: "0 0 260 260", role: "img", "aria-label": "Représentation graphique de la fonction f(x) = ax + b" });
  const valeurs = h("div", { classe: "tuiles", "aria-live": "polite" });
  let a = conf.a ?? 2, b = conf.b ?? 1;
  const px = (x) => 130 + x * 20, py = (y) => 130 - y * 20;
  const signe = (v) => (v < 0 ? `− ${nombreFr(-v)}` : `+ ${nombreFr(v)}`);
  const dessiner = () => {
    svg.replaceChildren();
    for (let i = -6; i <= 6; i++) {
      s("line", { x1: px(i), y1: 0, x2: px(i), y2: 260, class: "grille" }, svg);
      s("line", { x1: 0, y1: py(i), x2: 260, y2: py(i), class: "grille" }, svg);
    }
    s("line", { x1: 0, y1: 130, x2: 260, y2: 130, class: "axe" }, svg);
    s("line", { x1: 130, y1: 0, x2: 130, y2: 260, class: "axe" }, svg);
    s("text", { x: px(1), y: py(0) + 14, class: "legende", "text-anchor": "middle" }, svg).textContent = "1";
    s("text", { x: px(0) - 6, y: py(1) + 4, class: "legende", "text-anchor": "end" }, svg).textContent = "1";
    s("line", { x1: px(-7), y1: py(a * -7 + b), x2: px(7), y2: py(a * 7 + b), class: "droite" }, svg);
    // Escalier « +1 en x → +a en y », depuis le point d'ordonnée à l'origine.
    s("polyline", { points: `${px(0)},${py(b)} ${px(1)},${py(b)} ${px(1)},${py(a + b)}`, class: "escalier" }, svg);
    s("circle", { cx: px(0), cy: py(b), r: 5, class: "point" }, svg);
    const nature = a === 0 ? "constante" : b === 0 ? "linéaire (proportionnalité)" : "affine";
    const formule = a === 0 ? `f(x) = ${nombreFr(b)}` : `f(x) = ${a === 1 ? "" : a === -1 ? "−" : nombreFr(a)}x${b === 0 ? "" : ` ${signe(b)}`}`;
    valeurs.replaceChildren(
      tuile("fonction", formule),
      tuile("coefficient directeur a", `${nombreFr(a)} (${a > 0 ? "croissante" : a < 0 ? "décroissante" : "constante"})`, "a"),
      tuile("ordonnée à l'origine b", nombreFr(b), "b"),
      tuile("nature", nature)
    );
  };
  const ca = curseur("Coefficient directeur a", -4, 4, 0.5, a, (v) => { a = v; dessiner(); });
  const cb = curseur("Ordonnée à l'origine b", -5, 5, 0.5, b, (v) => { b = v; dessiner(); });
  ca.maj(); cb.maj();
  return h("div", { classe: "figure" }, svg, h("div", { classe: "curseurs" }, ca.element, cb.element), valeurs);
};
