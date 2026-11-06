// Figure « pythagore » du gabarit des notions (docs/gabarit.md).
// scripts/lib/gabarit.mjs l'insère dans le moteur (gabarit/moteur.js) des seules pages dont
// application.figure.type vaut « pythagore ». Outils du moteur disponibles : h, s, riche, paragraphe,
// nombreFr, exact, pgcd, curseur, tuile.

/** Triangle rectangle et carrés construits sur ses côtés. */
FIGURES.pythagore = function pythagore(conf) {
  const svg = s("svg", { viewBox: "0 0 300 300", role: "img", "aria-label": "Triangle rectangle et carrés construits sur ses côtés" });
  const valeurs = h("div", { classe: "tuiles", "aria-live": "polite" });
  const message = h("p", { classe: "bulle-info", "aria-live": "polite" });
  let a = conf.a ?? 3, b = conf.b ?? 4;
  const dessiner = () => {
    svg.replaceChildren();
    const c = Math.hypot(a, b);
    // Angle droit en O, côté a horizontal (vers A), côté b vertical (vers B) ; chaque carré est construit vers l'extérieur.
    // Encombrement : largeur (a + 2b)·k, hauteur (2a + b)·k ; l'échelle k fait tout tenir dans 300 × 300.
    const k = 280 / Math.max(a + 2 * b, 2 * a + b);
    const O = { x: 10 + b * k, y: 10 + a * k };
    const A = { x: O.x + a * k, y: O.y }, B = { x: O.x, y: O.y + b * k };
    const decale = (p, dx, dy) => ({ x: p.x + dx, y: p.y + dy });
    const poly = (pts, classe) => s("polygon", { points: pts.map((p) => `${p.x},${p.y}`).join(" "), class: classe }, svg);
    poly([O, A, decale(A, 0, -a * k), decale(O, 0, -a * k)], "carre carre-a");
    poly([O, B, decale(B, -b * k, 0), decale(O, -b * k, 0)], "carre carre-b");
    poly([A, B, decale(B, b * k, a * k), decale(A, b * k, a * k)], "carre carre-c");
    poly([O, A, B], "triangle");
    const aire = (pts, texte, classe) => {
      const t = s("text", { x: pts.reduce((m, p) => m + p.x, 0) / 4, y: pts.reduce((m, p) => m + p.y, 0) / 4, class: `etiquette ${classe}` }, svg);
      t.textContent = texte;
    };
    aire([O, A, decale(A, 0, -a * k), decale(O, 0, -a * k)], nombreFr(a * a), "a");
    aire([O, B, decale(B, -b * k, 0), decale(O, -b * k, 0)], nombreFr(b * b), "b");
    aire([A, B, decale(B, b * k, a * k), decale(A, b * k, a * k)], nombreFr(a * a + b * b), "c");
    s("polyline", { points: `${O.x + 10},${O.y} ${O.x + 10},${O.y + 10} ${O.x},${O.y + 10}`, class: "angle-droit" }, svg);
    valeurs.replaceChildren(
      tuile("a²", `${nombreFr(a)}² = ${nombreFr(a * a)}`, "a"),
      tuile("b²", `${nombreFr(b)}² = ${nombreFr(b * b)}`, "b"),
      tuile("c² = a² + b²", nombreFr(a * a + b * b), "c"),
      tuile("hypoténuse c", Number.isInteger(c) ? nombreFr(c) : `≈ ${nombreFr(c)}`, "c")
    );
    message.textContent = Number.isInteger(c)
      ? `Triplet magique ! ${a}, ${b} et ${c} sont tous entiers : on dit que c'est un triplet pythagoricien.`
      : "Astuce : cherche des valeurs de a et b qui donnent une hypoténuse entière (il en existe plusieurs !).";
  };
  const ca = curseur("Côté a", 1, 12, 1, a, (v) => { a = v; dessiner(); });
  const cb = curseur("Côté b", 1, 12, 1, b, (v) => { b = v; dessiner(); });
  ca.maj(); cb.maj();
  return h("div", { classe: "figure" }, svg, h("div", { classe: "curseurs" }, ca.element, cb.element), valeurs, message);
};
