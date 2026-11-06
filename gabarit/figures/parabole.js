// Figure « parabole » du gabarit des notions (docs/gabarit.md).
// scripts/lib/gabarit.mjs l'insère dans le moteur (gabarit/moteur.js) des seules pages dont
// application.figure.type vaut « parabole ». Outils du moteur disponibles : h, s, riche, paragraphe,
// nombreFr, exact, pgcd, curseur, tuile.

/** Parabole y = ax² + bx + c : sommet, discriminant et racines. */
FIGURES.parabole = function parabole(conf) {
  const svg = s("svg", { viewBox: "0 0 260 260", role: "img", "aria-label": "Représentation graphique de f(x) = ax² + bx + c" });
  const valeurs = h("div", { classe: "tuiles", "aria-live": "polite" });
  let a = conf.a ?? 1, b = conf.b ?? -2, c = conf.c ?? -3;
  const px = (x) => 130 + x * 20, py = (y) => 130 - y * 20;
  const terme = (v, lettre, premier) => {
    if (v === 0) return "";
    const abs = Math.abs(v), coef = lettre && abs === 1 ? "" : nombreFr(abs);
    return premier ? `${v < 0 ? "−" : ""}${coef}${lettre}` : ` ${v < 0 ? "−" : "+"} ${coef}${lettre}`;
  };
  const dessiner = () => {
    svg.replaceChildren();
    for (let i = -6; i <= 6; i++) {
      s("line", { x1: px(i), y1: 0, x2: px(i), y2: 260, class: "grille" }, svg);
      s("line", { x1: 0, y1: py(i), x2: 260, y2: py(i), class: "grille" }, svg);
    }
    s("line", { x1: 0, y1: 130, x2: 260, y2: 130, class: "axe" }, svg);
    s("line", { x1: 130, y1: 0, x2: 130, y2: 260, class: "axe" }, svg);
    const f = (x) => a * x * x + b * x + c;
    const points = [];
    for (let x = -6.5; x <= 6.5; x += 0.05) points.push(`${px(x).toFixed(1)},${Math.max(-2000, Math.min(2000, py(f(x)))).toFixed(1)}`);
    s("polyline", { points: points.join(" "), class: "droite courbe" }, svg);
    const delta = b * b - 4 * a * c;
    const alpha = -b / (2 * a), beta = f(alpha);
    s("circle", { cx: px(alpha), cy: py(beta), r: 5, class: "point" }, svg);
    const racines = delta > 0 ? [(-b - Math.sqrt(delta)) / (2 * a), (-b + Math.sqrt(delta)) / (2 * a)].sort((u, v) => u - v) : delta === 0 ? [alpha] : [];
    for (const r of racines) s("circle", { cx: px(r), cy: py(0), r: 4, class: "racine" }, svg);
    valeurs.replaceChildren(
      tuile("fonction", `f(x) = ${terme(a, "x²", true)}${terme(b, "x", false)}${terme(c, "", false)}`),
      tuile("discriminant Δ = b² − 4ac", nombreFr(delta), "a"),
      tuile("racines", racines.length ? racines.map((r) => nombreFr(r)).join(" et ") : "aucune (Δ < 0)", "c"),
      tuile("sommet (α ; β)", `(${nombreFr(alpha)} ; ${nombreFr(beta)}) — ${a > 0 ? "minimum" : "maximum"}`, "b")
    );
  };
  // a ne peut pas valoir 0 (sinon ce n'est plus une parabole) : on saute directement de −0,5 à 0,5.
  const ca = curseur("a", -3, 3, 0.5, a, (v) => {
    if (v === 0) { ca.entree.value = a > 0 ? -0.5 : 0.5; ca.maj(); return; }
    a = v; dessiner();
  });
  const cb = curseur("b", -6, 6, 1, b, (v) => { b = v; dessiner(); });
  const cc = curseur("c", -6, 6, 1, c, (v) => { c = v; dessiner(); });
  ca.maj(); cb.maj(); cc.maj();
  return h("div", { classe: "figure" }, svg, h("div", { classe: "curseurs" }, ca.element, cb.element, cc.element), valeurs);
};
